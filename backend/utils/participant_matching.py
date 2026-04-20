import hashlib
import re
from typing import Any, Dict, List, Optional, Set, Tuple


_PUNCTUATION_RE = re.compile(r"[^a-z0-9\s]")
_SPACE_RE = re.compile(r"\s+")
_SIGNAL_EMAIL = "parent_email"
_SIGNAL_PHONE = "cell_phone"
_SIGNAL_STREET_PARENT_LAST = "street_parent_last_name"


def normalize_match_text(value: Any) -> Optional[str]:
    """Normalize free text for robust matching."""
    if value is None:
        return None
    normalized = _PUNCTUATION_RE.sub(" ", str(value).strip().lower())
    normalized = _SPACE_RE.sub(" ", normalized).strip()
    return normalized or None


def normalize_person_name(value: Any) -> Optional[str]:
    return normalize_match_text(value)


def normalize_email(value: Any) -> Optional[str]:
    normalized = normalize_match_text(value)
    if not normalized:
        return None
    return normalized.replace(" ", "")


def normalize_street(value: Any) -> Optional[str]:
    return normalize_match_text(value)


def normalize_phone(value: Any) -> Optional[str]:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    if len(digits) < 7:
        return None
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def normalize_buddy_request(value: Any) -> Optional[str]:
    return normalize_person_name(value)


def parse_bool(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    return normalized in {"1", "true", "yes", "y"}


def has_explicit_sibling_separation_request(
    row: Dict[str, Any], notes_value: Any = None
) -> bool:
    explicit_fields = (
        "sibling_separation_requested",
        "separate_sibling",
        "separate_siblings",
        "separate_sibling_request",
        "keep_siblings_separate",
    )
    for field in explicit_fields:
        if parse_bool(row.get(field)):
            return True

    notes = normalize_match_text(notes_value or row.get("notes"))
    if not notes:
        return False

    separation_markers = (
        "separate sibling",
        "separate siblings",
        "siblings separate",
        "keep siblings apart",
        "do not place with sibling",
        "not with sibling",
        "different team than sibling",
    )
    return any(marker in notes for marker in separation_markers)


def infer_sibling_group_assignments(
    players: List[Dict[str, Any]], *, event_id: str
) -> Dict[str, Dict[str, Any]]:
    """
    Infer sibling groups per division using strong household signals:
    - same normalized parent email, OR
    - same normalized parent cell phone, OR
    - same normalized street AND same normalized parent last name
    """
    by_division: Dict[str, List[Dict[str, Any]]] = {}
    assignments: Dict[str, Dict[str, Any]] = {}

    for player in players:
        player_id = player.get("id")
        if not player_id:
            continue
        division = normalize_match_text(player.get("age_group")) or "__unknown_division__"
        by_division.setdefault(division, []).append(player)
        assignments[player_id] = {
            "siblingGroupId": None,
            "forceSameTeamWithSibling": False,
            "siblingInferenceSignals": [],
            "siblingInferenceSuspicious": False,
            "siblingInferenceSuspicionReasons": [],
            "siblingGroupSize": 1,
        }

    for division_key, division_players in by_division.items():
        n = len(division_players)
        if n < 2:
            continue

        adjacency: Dict[str, Set[str]] = {
            str(p.get("id")): set() for p in division_players if p.get("id")
        }
        edge_signals: Dict[Tuple[str, str], Set[str]] = {}

        for i in range(n):
            left = division_players[i]
            left_id = left.get("id")
            if not left_id or parse_bool(left.get("siblingSeparationRequested")):
                continue

            for j in range(i + 1, n):
                right = division_players[j]
                right_id = right.get("id")
                if not right_id or parse_bool(right.get("siblingSeparationRequested")):
                    continue

                same_email = bool(
                    left.get("parentEmailNormalized")
                    and left.get("parentEmailNormalized") == right.get("parentEmailNormalized")
                )
                same_phone = bool(
                    left.get("cellPhoneNormalized")
                    and left.get("cellPhoneNormalized") == right.get("cellPhoneNormalized")
                )
                same_street_and_parent_last = bool(
                    left.get("streetNormalized")
                    and right.get("streetNormalized")
                    and left.get("streetNormalized") == right.get("streetNormalized")
                    and left.get("parentLastNameNormalized")
                    and right.get("parentLastNameNormalized")
                    and left.get("parentLastNameNormalized")
                    == right.get("parentLastNameNormalized")
                )

                if same_email or same_phone or same_street_and_parent_last:
                    left_key = str(left_id)
                    right_key = str(right_id)
                    adjacency[left_key].add(right_key)
                    adjacency[right_key].add(left_key)
                    edge_key = tuple(sorted((left_key, right_key)))
                    signals = edge_signals.setdefault(edge_key, set())
                    if same_email:
                        signals.add(_SIGNAL_EMAIL)
                    if same_phone:
                        signals.add(_SIGNAL_PHONE)
                    if same_street_and_parent_last:
                        signals.add(_SIGNAL_STREET_PARENT_LAST)

        visited: Set[str] = set()
        for node in list(adjacency.keys()):
            if node in visited:
                continue

            stack = [node]
            component: List[str] = []
            while stack:
                current = stack.pop()
                if current in visited:
                    continue
                visited.add(current)
                component.append(current)
                for neighbor in adjacency.get(current, set()):
                    if neighbor not in visited:
                        stack.append(neighbor)

            if len(component) <= 1:
                continue

            component_set = set(component)
            component_signals: Set[str] = set()
            for edge_key, signals in edge_signals.items():
                if edge_key[0] in component_set and edge_key[1] in component_set:
                    component_signals.update(signals)

            suspicious_reasons: List[str] = []
            if len(component) >= 4:
                suspicious_reasons.append("large_group")
            if component_signals == {_SIGNAL_STREET_PARENT_LAST}:
                # Address + parent last name can over-group families sharing a household
                # record, so we mark these for organizer review.
                suspicious_reasons.append("weak_signal_only")

            seed = f"{event_id}|{division_key}|{'|'.join(sorted(component))}"
            digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]
            sibling_group_id = f"sg_{digest}"
            for pid in component:
                assignments[pid] = {
                    "siblingGroupId": sibling_group_id,
                    "forceSameTeamWithSibling": True,
                    "siblingInferenceSignals": sorted(component_signals),
                    "siblingInferenceSuspicious": len(suspicious_reasons) > 0,
                    "siblingInferenceSuspicionReasons": suspicious_reasons,
                    "siblingGroupSize": len(component),
                }

    return assignments
