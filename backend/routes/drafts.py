"""
Draft API Routes
Handles draft creation, management, picks, and real-time state.
"""

import secrets
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from ..auth import get_current_user
from ..firestore_client import get_firestore_client
from ..utils.authorization import ensure_event_access, ensure_league_access
from google.cloud.firestore_v1 import FieldFilter
import uuid
import logging
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/drafts", tags=["drafts"])


def _normalize_age_group(age_group: Optional[str]) -> Optional[str]:
    """Normalize common age group variants to canonical format (e.g., "U8").

    Handles: "U-8", "u8", "Under 8", "8U", "8u".
    Returns None if input is blank/None.
    """
    if not age_group:
        return None
    s = str(age_group).strip()
    if not s:
        return None

    s_up = s.upper().strip()
    # "Under 8" / "UNDER-8" / etc.
    m = re.search(r"\bUNDER\s*[- ]?\s*(\d{1,2})\b", s_up)
    if m:
        return f"U{int(m.group(1))}"

    # "U-8" / "U 8" / "U8"
    m = re.search(r"\bU\s*[- ]?\s*(\d{1,2})\b", s_up)
    if m:
        return f"U{int(m.group(1))}"

    # "8U"
    m = re.search(r"\b(\d{1,2})\s*U\b", s_up)
    if m:
        return f"U{int(m.group(1))}"

    # Fallback: if it's just a number, treat as "U{n}"
    m = re.fullmatch(r"\d{1,2}", s_up)
    if m:
        return f"U{int(s_up)}"

    return s.strip()


def _get_draft_event_ids(draft_data: dict) -> List[str]:
    """Return all event ids associated with a draft (supports multi-combine drafts)."""
    event_ids = draft_data.get("event_ids")
    if isinstance(event_ids, list) and event_ids:
        return [e for e in event_ids if e]
    event_id = draft_data.get("event_id")
    return [event_id] if event_id else []


def _get_player_for_draft(db, draft_data: dict, player_id: str) -> Optional[dict]:
    """Fetch a player doc for a draft.

    - Combine players live in events/{event_id}/players/{player_id}
    - Standalone draft players live in draft_players/{player_id}
    """
    # Try combine players (across all events)
    for eid in _get_draft_event_ids(draft_data):
        doc = (
            db.collection("events")
            .document(eid)
            .collection("players")
            .document(player_id)
            .get()
        )
        if doc.exists:
            pdata = doc.to_dict()
            pdata.setdefault("id", doc.id)
            pdata["source"] = "combine"
            return pdata

    # Fallback to standalone draft players
    doc = db.collection("draft_players").document(player_id).get()
    if doc.exists:
        pdata = doc.to_dict()
        pdata.setdefault("id", doc.id)
        pdata["source"] = "manual"
        return pdata

    return None


def _verify_draft_access(db, draft_id: str, user: dict, *, require_admin: bool = False):
    """Verify user has access to a draft. Returns (draft_ref, draft_data).

    - Any league member can view drafts
    - Only the draft creator or league organizer can modify drafts
    """
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()

    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft_data = draft_doc.to_dict()
    league_id = draft_data.get("league_id")

    if league_id:
        # Verify user is a member of the league
        membership = ensure_league_access(
            user["uid"],
            league_id,
            allowed_roles={"organizer", "coach", "viewer"},
            operation_name="view draft",
        )
        _enforce_draft_scope_for_membership(
            user_id=user["uid"],
            draft_data=draft_data,
            membership=membership,
            operation_name="view draft",
        )
    elif not _has_explicit_draft_access(db, draft_id, user["uid"], draft_data):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this draft",
        )

    if require_admin:
        is_creator = draft_data.get("created_by") == user["uid"]
        is_organizer = False
        if league_id:
            try:
                ensure_league_access(
                    user["uid"],
                    league_id,
                    allowed_roles={"organizer"},
                    operation_name="manage draft",
                )
                is_organizer = True
            except HTTPException:
                pass
        if not is_creator and not is_organizer:
            raise HTTPException(
                status_code=403,
                detail="Only draft creator or league organizer can modify this draft",
            )

    return draft_ref, draft_data


def _has_explicit_draft_access(db, draft_id: str, uid: str, draft_data: dict) -> bool:
    """Allow explicit draft access outside league membership checks."""
    if draft_data.get("created_by") == uid:
        return True

    teams = (
        db.collection("draft_teams")
        .where("draft_id", "==", draft_id)
        .where("coach_user_id", "==", uid)
        .limit(1)
        .stream()
    )
    return len(list(teams)) > 0


# ============================================================================
# Pydantic Models
# ============================================================================


class DraftCreate(BaseModel):
    name: str
    event_id: Optional[str] = None  # Optional for standalone drafts
    event_ids: Optional[List[str]] = None  # Optional for multi-combine drafts
    age_group: Optional[str] = None  # U8, U10, U12, etc. None = all
    draft_type: str = "snake"  # snake | linear
    num_rounds: Optional[int] = None  # Auto-calculate if not provided
    pick_timer_seconds: int = 60  # 0 = no timer
    auto_pick_on_timeout: bool = True
    trades_enabled: bool = False
    trades_require_approval: bool = True
    max_players_per_team: Optional[int] = None  # None => derive from num_rounds
    enforce_composite_balance: bool = False
    max_composite_avg_gap: Optional[float] = None
    composite_balance_blocking: bool = False  # Advanced: make balance violations hard errors


class DraftUpdate(BaseModel):
    name: Optional[str] = None
    draft_type: Optional[str] = None
    num_rounds: Optional[int] = None
    pick_timer_seconds: Optional[int] = None
    auto_pick_on_timeout: Optional[bool] = None
    trades_enabled: Optional[bool] = None
    trades_require_approval: Optional[bool] = None
    max_players_per_team: Optional[int] = None
    enforce_composite_balance: Optional[bool] = None
    max_composite_avg_gap: Optional[float] = None
    composite_balance_blocking: Optional[bool] = None


class TeamCreate(BaseModel):
    team_name: str
    coach_user_id: Optional[str] = None
    coach_name: Optional[str] = None


class TeamUpdate(BaseModel):
    team_name: Optional[str] = None
    coach_user_id: Optional[str] = None
    coach_name: Optional[str] = None


class PickCreate(BaseModel):
    player_id: str


class RankingsUpdate(BaseModel):
    ranked_player_ids: List[str]


class PreSlotCreate(BaseModel):
    player_id: str
    team_id: str
    reason: Optional[str] = None  # e.g., "Coach's child"


class SiblingGroupReviewUpdate(BaseModel):
    action: str  # confirm | clear_lock | mark_separate
    player_ids: Optional[List[str]] = None  # Optional subset inside the group


class TradeCreate(BaseModel):
    offering_team_id: str
    receiving_team_id: str
    offering_player_id: str
    receiving_player_id: str


class TradeUpdate(BaseModel):
    status: str  # "approved" | "rejected"


# ============================================================================
# Helper Functions
# ============================================================================


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def calculate_snake_order(team_order: List[str], round_num: int) -> List[str]:
    """Returns team order for a given round in snake draft."""
    if round_num % 2 == 1:
        return team_order
    else:
        return list(reversed(team_order))


def get_pick_team(draft: dict, overall_pick: int) -> str:
    """Determine which team picks at a given overall pick number."""
    num_teams = len(draft.get("team_order", []))
    if num_teams == 0:
        return None

    round_num = ((overall_pick - 1) // num_teams) + 1
    pick_in_round = (overall_pick - 1) % num_teams

    if draft.get("draft_type") == "snake":
        order = calculate_snake_order(draft["team_order"], round_num)
    else:
        order = draft["team_order"]

    return order[pick_in_round]


def _normalize_player_name_for_match(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = re.sub(r"[^a-z0-9\s]", " ", str(value).strip().lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized or None


def _load_draft_player_pool(db, draft_data: dict) -> Dict[str, dict]:
    """Load all age-eligible players for this draft."""
    event_ids = _get_draft_event_ids(draft_data)
    age_group = _normalize_age_group(draft_data.get("age_group"))
    all_players: Dict[str, dict] = {}

    if event_ids:
        for event_id in event_ids:
            players_query = db.collection("events").document(event_id).collection("players")
            for p in players_query.stream():
                pdata = p.to_dict() or {}
                pdata.setdefault("id", p.id)
                if age_group and _normalize_age_group(pdata.get("age_group")) != age_group:
                    continue
                all_players[p.id] = pdata
    else:
        players_query = db.collection("draft_players").where(
            filter=FieldFilter("draft_id", "==", draft_data.get("id"))
        )
        for p in players_query.stream():
            pdata = p.to_dict() or {}
            pdata.setdefault("id", p.id)
            if age_group and _normalize_age_group(pdata.get("age_group")) != age_group:
                continue
            all_players[p.id] = pdata

    return all_players


def _get_event_player_ref_for_draft(db, draft_data: dict, player_id: str):
    """Return event player doc ref for a draft-scoped player id."""
    for event_id in _get_draft_event_ids(draft_data):
        ref = db.collection("events").document(event_id).collection("players").document(player_id)
        if ref.get().exists:
            return ref
    return None


def _list_draft_picks(db, draft_id: str) -> List[dict]:
    picks_query = (
        db.collection("draft_picks")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    return [p.to_dict() for p in picks_query]


def _validate_sibling_team_constraint(
    *,
    selected_player_id: str,
    all_players: Dict[str, dict],
    drafted_team_by_player: Dict[str, str],
    current_team_id: str,
) -> None:
    selected = all_players.get(selected_player_id) or {}
    sibling_group_id = selected.get("siblingGroupId")
    force_same_team = bool(selected.get("forceSameTeamWithSibling"))
    if not sibling_group_id or not force_same_team:
        return

    sibling_team_ids = {
        drafted_team_by_player.get(pid)
        for pid, pdata in all_players.items()
        if pid != selected_player_id
        and pdata.get("siblingGroupId") == sibling_group_id
        and bool(pdata.get("forceSameTeamWithSibling"))
        and drafted_team_by_player.get(pid)
    }
    sibling_team_ids.discard(None)
    if sibling_team_ids and current_team_id not in sibling_team_ids:
        forced_team = list(sibling_team_ids)[0]
        raise HTTPException(
            status_code=400,
            detail=f"Sibling constraint: this player must be drafted to team {forced_team}",
        )


def _build_assignment_unit(
    *,
    selected_player_id: str,
    all_players: Dict[str, dict],
    drafted_player_ids: set[str],
) -> List[str]:
    """Return player ids assigned with the pick (forced sibling group)."""
    selected = all_players.get(selected_player_id) or {}
    sibling_group_id = selected.get("siblingGroupId")
    force_same_team = bool(selected.get("forceSameTeamWithSibling"))
    if not sibling_group_id or not force_same_team:
        return [selected_player_id]

    unit = []
    for pid, pdata in all_players.items():
        if pid in drafted_player_ids:
            continue
        if pdata.get("siblingGroupId") == sibling_group_id and bool(
            pdata.get("forceSameTeamWithSibling")
        ):
            unit.append(pid)

    if selected_player_id not in unit:
        unit.append(selected_player_id)
    return sorted(set(unit))


def _team_player_ids_for_draft_picks(draft_picks: List[dict], team_id: str) -> List[str]:
    return [
        pick.get("player_id")
        for pick in draft_picks
        if pick.get("team_id") == team_id and pick.get("player_id")
    ]


def _remaining_draft_slots(draft_data: dict) -> int:
    num_teams = int(draft_data.get("num_teams") or 0)
    num_rounds = int(draft_data.get("num_rounds") or 0)
    current_pick = int(draft_data.get("current_pick") or 1)
    total_picks = num_teams * num_rounds
    return max(0, (total_picks - current_pick) + 1)


def _resolve_team_cap(draft_data: dict) -> Optional[int]:
    explicit_cap = draft_data.get("max_players_per_team")
    if explicit_cap is not None:
        try:
            cap = int(explicit_cap)
            return cap if cap > 0 else None
        except Exception:
            return None
    try:
        num_rounds = int(draft_data.get("num_rounds") or 0)
    except Exception:
        num_rounds = 0
    return num_rounds if num_rounds > 0 else None


def _player_composite_for_balance(player: dict) -> float:
    return float(
        player.get("composite_score")
        or (player.get("scores") or {}).get("composite")
        or 0.0
    )


def _validate_team_level_constraints_for_unit(
    *,
    assignment_unit: List[str],
    all_players: Dict[str, dict],
    drafted_team_by_player: Dict[str, str],
    current_team_id: str,
    draft_data: dict,
) -> List[str]:
    advisory_warnings: List[str] = []
    # 1) Hard per-team roster cap.
    team_cap = _resolve_team_cap(draft_data)
    if team_cap is not None:
        current_team_count = sum(
            1 for team_id in drafted_team_by_player.values() if team_id == current_team_id
        )
        projected_team_count = current_team_count + len(assignment_unit)
        if projected_team_count > team_cap:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Pick rejected: per-team roster cap exceeded "
                    f"for {current_team_id} "
                    f"({projected_team_count} > {team_cap})"
                ),
            )

    # 2) Optional composite balance check (advisory by default).
    if not bool(draft_data.get("enforce_composite_balance")):
        return advisory_warnings

    raw_gap_limit = draft_data.get("max_composite_avg_gap")
    try:
        gap_limit = float(raw_gap_limit) if raw_gap_limit is not None else 20.0
    except Exception:
        gap_limit = 20.0
    if gap_limit < 0:
        return advisory_warnings

    team_order = list(draft_data.get("team_order") or [])
    if current_team_id not in team_order:
        team_order.append(current_team_id)

    team_counts: Dict[str, int] = {team_id: 0 for team_id in team_order}
    team_scores: Dict[str, float] = {team_id: 0.0 for team_id in team_order}

    for player_id, team_id in drafted_team_by_player.items():
        if team_id not in team_counts:
            continue
        player = all_players.get(player_id)
        if not player:
            continue
        team_counts[team_id] += 1
        team_scores[team_id] += _player_composite_for_balance(player)

    for player_id in assignment_unit:
        player = all_players.get(player_id)
        if not player:
            continue
        team_counts[current_team_id] = team_counts.get(current_team_id, 0) + 1
        team_scores[current_team_id] = team_scores.get(current_team_id, 0.0) + _player_composite_for_balance(player)

    populated_teams = [team_id for team_id, count in team_counts.items() if count > 0]
    if len(populated_teams) < 2:
        return advisory_warnings

    averages = [team_scores[team_id] / team_counts[team_id] for team_id in populated_teams]
    projected_gap = max(averages) - min(averages)
    if projected_gap > gap_limit:
        message = (
            "Composite balance advisory: projected avg gap "
            f"{projected_gap:.2f} exceeds limit {gap_limit:.2f}"
        )
        if bool(draft_data.get("composite_balance_blocking")):
            raise HTTPException(
                status_code=400,
                detail=f"Pick rejected: {message}",
            )
        advisory_warnings.append(message)

    return advisory_warnings


def _validate_assignment_unit_before_pick(
    *,
    assignment_unit: List[str],
    all_players: Dict[str, dict],
    drafted_player_ids: set[str],
    drafted_team_by_player: Dict[str, str],
    current_team_id: str,
    draft_data: dict,
) -> List[str]:
    if not assignment_unit:
        raise HTTPException(status_code=400, detail="No players in assignment unit")

    remaining_slots = _remaining_draft_slots(draft_data)
    if len(assignment_unit) > remaining_slots:
        raise HTTPException(
            status_code=400,
            detail=(
                "Sibling group cannot be assigned: not enough remaining draft slots "
                f"({len(assignment_unit)} needed, {remaining_slots} available)"
            ),
        )

    for pid in assignment_unit:
        if pid in drafted_player_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Sibling group cannot be assigned: player already drafted ({pid})",
            )
        if pid not in all_players:
            raise HTTPException(
                status_code=400,
                detail=f"Sibling group contains ineligible player ({pid})",
            )
        _validate_sibling_team_constraint(
            selected_player_id=pid,
            all_players=all_players,
            drafted_team_by_player=drafted_team_by_player,
            current_team_id=current_team_id,
        )

    return _validate_team_level_constraints_for_unit(
        assignment_unit=assignment_unit,
        all_players=all_players,
        drafted_team_by_player=drafted_team_by_player,
        current_team_id=current_team_id,
        draft_data=draft_data,
    )


def _apply_pick_unit_atomically(
    *,
    db,
    draft_ref,
    draft_id: str,
    draft_data: dict,
    assignment_unit: List[str],
    all_players: Dict[str, dict],
    current_team_id: str,
    picked_by: str,
    pick_type: str,
) -> dict:
    transaction = db.transaction()

    # Read and validate draft + picks inside a transaction so overlapping pick
    # attempts cannot both assign the same players.
    draft_snapshot = transaction.get(draft_ref)
    if not draft_snapshot.exists:
        raise HTTPException(status_code=404, detail="Draft not found")

    live_draft_data = draft_snapshot.to_dict() or {}
    if live_draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")
    if live_draft_data.get("current_team_id") != current_team_id:
        raise HTTPException(
            status_code=409,
            detail="Draft turn advanced. Refresh and try again.",
        )

    picks_query = db.collection("draft_picks").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    )
    pick_snapshots = list(transaction.get(picks_query))
    drafted_player_ids = {
        p.to_dict().get("player_id")
        for p in pick_snapshots
        if p.to_dict().get("player_id")
    }
    drafted_team_by_player = {
        p.to_dict().get("player_id"): p.to_dict().get("team_id")
        for p in pick_snapshots
        if p.to_dict().get("player_id")
    }

    advisory_warnings = _validate_assignment_unit_before_pick(
        assignment_unit=assignment_unit,
        all_players=all_players,
        drafted_player_ids=drafted_player_ids,
        drafted_team_by_player=drafted_team_by_player,
        current_team_id=current_team_id,
        draft_data=live_draft_data,
    )

    overall_pick = int(live_draft_data.get("current_pick", 1))
    num_teams = int(live_draft_data.get("num_teams", 1))
    total_picks = int(live_draft_data.get("num_rounds", 1)) * num_teams
    next_pick = overall_pick + len(assignment_unit)
    last_assigned_pick = overall_pick + len(assignment_unit) - 1

    first_pick_data = None
    for offset, player_id in enumerate(assignment_unit):
        pick_number = overall_pick + offset
        pick_round = ((pick_number - 1) // num_teams) + 1
        pick_in_round = pick_number - ((pick_round - 1) * num_teams)
        pick_id = generate_id("pick_")
        pick_data = {
            "id": pick_id,
            "draft_id": draft_id,
            "round": pick_round,
            "pick_number": pick_number,
            "pick_in_round": pick_in_round,
            "team_id": current_team_id,
            "player_id": player_id,
            "picked_by": picked_by,
            "pick_type": pick_type,
            "created_at": now_iso(),
        }
        if first_pick_data is None:
            first_pick_data = dict(pick_data)
        transaction.set(db.collection("draft_picks").document(pick_id), pick_data)

    completed = next_pick > total_picks
    if completed:
        transaction.update(
            draft_ref,
            {
                "status": "completed",
                "completed_at": now_iso(),
                "current_pick": last_assigned_pick,
                "pick_deadline": None,
            },
        )
    else:
        next_round = ((next_pick - 1) // num_teams) + 1
        next_team_id = get_pick_team(live_draft_data, next_pick)
        pick_deadline = None
        if live_draft_data.get("pick_timer_seconds", 0) > 0:
            pick_deadline = (
                datetime.now(timezone.utc)
                + timedelta(seconds=live_draft_data["pick_timer_seconds"])
            ).isoformat()
        transaction.update(
            draft_ref,
            {
                "current_round": next_round,
                "current_pick": next_pick,
                "current_team_id": next_team_id,
                "pick_deadline": pick_deadline,
            },
        )

    transaction.commit()

    response_pick = first_pick_data or {}
    response_pick["assigned_player_ids"] = assignment_unit
    response_pick["completed"] = completed
    response_pick["advisory_warnings"] = advisory_warnings
    return response_pick


def _build_buddy_preference_context(
    *, all_players: Dict[str, dict], team_player_ids: List[str]
) -> Dict[str, Dict[str, int]]:
    team_name_counts: Dict[str, int] = {}
    team_buddy_target_counts: Dict[str, int] = {}

    for pid in team_player_ids:
        pdata = all_players.get(pid) or {}
        player_name = _normalize_player_name_for_match(pdata.get("name"))
        if player_name:
            team_name_counts[player_name] = team_name_counts.get(player_name, 0) + 1
        buddy_target = _normalize_player_name_for_match(pdata.get("buddyRequestNormalized"))
        if buddy_target:
            team_buddy_target_counts[buddy_target] = (
                team_buddy_target_counts.get(buddy_target, 0) + 1
            )

    return {
        "team_name_counts": team_name_counts,
        "team_buddy_target_counts": team_buddy_target_counts,
    }


def _calculate_buddy_preference_bonus(
    *, candidate_player: dict, buddy_context: Dict[str, Dict[str, int]]
) -> float:
    buddy_name = _normalize_player_name_for_match(
        candidate_player.get("buddyRequestNormalized")
    )
    player_name = _normalize_player_name_for_match(candidate_player.get("name"))
    team_name_counts = buddy_context.get("team_name_counts", {})
    team_buddy_target_counts = buddy_context.get("team_buddy_target_counts", {})

    buddy_bonus = 0.0
    if buddy_name:
        direct_matches = team_name_counts.get(buddy_name, 0)
        # Duplicate-name buddy targets are treated as ambiguous and do not get bonus.
        if direct_matches == 1:
            buddy_bonus += 0.5
    if player_name:
        reverse_requests = team_buddy_target_counts.get(player_name, 0)
        # Multiple requests for same name still represent team preference.
        if reverse_requests >= 1:
            buddy_bonus += 0.25
    return buddy_bonus


def _is_draft_admin(user: dict, draft_data: dict) -> bool:
    if draft_data.get("created_by") == user["uid"]:
        return True
    league_id = draft_data.get("league_id")
    if not league_id:
        return False
    try:
        ensure_league_access(
            user["uid"],
            league_id,
            allowed_roles={"organizer"},
            operation_name="manage draft",
        )
        return True
    except HTTPException:
        return False


def _get_user_league_roles(db, uid: str) -> Dict[str, str]:
    membership_doc = db.collection("user_memberships").document(uid).get()
    if not membership_doc.exists:
        return {}
    leagues_data = (membership_doc.to_dict() or {}).get("leagues", {}) or {}
    roles: Dict[str, str] = {}
    for league_id, membership in leagues_data.items():
        role = ((membership or {}).get("role") or "").lower()
        if role:
            roles[str(league_id)] = role
    return roles


def _user_has_scoped_organizer_membership(db, uid: str) -> bool:
    return any(role == "organizer" for role in _get_user_league_roles(db, uid).values())


def _user_has_team_assignment(db, draft_id: str, uid: str) -> bool:
    teams = (
        db.collection("draft_teams")
        .where("draft_id", "==", draft_id)
        .where("coach_user_id", "==", uid)
        .limit(1)
        .stream()
    )
    return len(list(teams)) > 0


def _enforce_draft_scope_for_membership(
    *,
    user_id: str,
    draft_data: dict,
    membership: dict,
    operation_name: str,
) -> None:
    role = (membership.get("role") or "").lower()
    if role not in {"organizer", "coach", "viewer"}:
        raise HTTPException(status_code=403, detail="Insufficient league permissions")

    if role == "organizer":
        return

    for event_id in _get_draft_event_ids(draft_data):
        ensure_event_access(
            user_id,
            event_id,
            allowed_roles={"organizer", "coach", "viewer"},
            operation_name=operation_name,
        )


def _require_draft_staff(db, user: dict, draft_data: dict, *, operation_name: str) -> None:
    league_id = draft_data.get("league_id")
    if league_id:
        membership = ensure_league_access(
            user["uid"],
            league_id,
            allowed_roles={"organizer", "coach"},
            operation_name=operation_name,
        )
        scoped_role = (membership.get("role") or "").lower()
        if scoped_role in {"organizer", "coach"}:
            _enforce_draft_scope_for_membership(
                user_id=user["uid"],
                draft_data=draft_data,
                membership=membership,
                operation_name=operation_name,
            )
            return

    # Standalone drafts: explicit draft scope only.
    if draft_data.get("created_by") == user["uid"]:
        return
    if _user_has_team_assignment(db, draft_data.get("id"), user["uid"]):
        return
    raise HTTPException(
        status_code=403,
        detail=f"{operation_name} is restricted to draft owners or assigned team coaches",
    )


def _ensure_team_coach_or_admin(
    *,
    db,
    user: dict,
    draft_data: dict,
    team_id: str,
    operation_name: str,
) -> dict:
    team_doc = db.collection("draft_teams").document(team_id).get()
    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")

    team_data = team_doc.to_dict() or {}
    if team_data.get("draft_id") != draft_data.get("id"):
        raise HTTPException(status_code=400, detail="Team not in this draft")

    is_admin = _is_draft_admin(user, draft_data)
    is_team_coach = team_data.get("coach_user_id") == user["uid"]

    if not is_admin and not is_team_coach:
        raise HTTPException(
            status_code=403,
            detail=f"Not authorized for {operation_name}",
        )

    if is_team_coach:
        _require_draft_staff(db, user, draft_data, operation_name=operation_name)

    return team_data


def _get_team_for_draft(db, draft_id: str, team_id: str) -> dict:
    team_doc = db.collection("draft_teams").document(team_id).get()
    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")
    team_data = team_doc.to_dict() or {}
    if team_data.get("draft_id") != draft_id:
        raise HTTPException(status_code=400, detail="Team not in this draft")
    return team_data


def _get_pick_for_player(db, draft_id: str, player_id: str):
    pick_query = (
        db.collection("draft_picks")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .where(filter=FieldFilter("player_id", "==", player_id))
        .limit(1)
        .stream()
    )
    picks = list(pick_query)
    return picks[0] if picks else None


def _execute_trade_swap(
    db,
    draft_id: str,
    offering_player_id: str,
    receiving_player_id: str,
    offering_team_id: str,
    receiving_team_id: str,
):
    offering_pick = _get_pick_for_player(db, draft_id, offering_player_id)
    receiving_pick = _get_pick_for_player(db, draft_id, receiving_player_id)

    if not offering_pick or not receiving_pick:
        raise HTTPException(
            status_code=400, detail="One or more players not found in picks"
        )

    offering_pick_data = offering_pick.to_dict()
    receiving_pick_data = receiving_pick.to_dict()

    if offering_pick_data.get("team_id") != offering_team_id:
        raise HTTPException(
            status_code=400, detail="Offering player is not on the offering team"
        )
    if receiving_pick_data.get("team_id") != receiving_team_id:
        raise HTTPException(
            status_code=400, detail="Receiving player is not on the receiving team"
        )

    batch = db.batch()
    batch.update(
        offering_pick.reference, {"team_id": receiving_team_id, "updated_at": now_iso()}
    )
    batch.update(
        receiving_pick.reference, {"team_id": offering_team_id, "updated_at": now_iso()}
    )
    batch.commit()


# ============================================================================
# Payment Gate Helper
# ============================================================================


def _check_payment_gate(db, draft_id: str, draft_data: dict):
    """Check if a draft requires payment. Raises 402 if payment is needed but not provided."""
    from .draft_pricing import (
        PAYMENTS_ENABLED,
        is_draft_free,
        FREE_PLAYER_LIMIT,
        get_draft_player_count,
    )

    if not PAYMENTS_ENABLED:
        return

    payment_status = draft_data.get("payment_status", "not_required")
    if payment_status in ["paid", "bypassed"]:
        return

    teams = list(
        db.collection("draft_teams")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    num_teams = len(teams)
    num_players = get_draft_player_count(db, draft_data)

    if not is_draft_free(num_teams, num_players):
        raise HTTPException(
            status_code=402,
            detail=f"Payment required. Drafts with {num_teams} teams and {num_players} players require payment. Drafts with <={FREE_PLAYER_LIMIT} players are free.",
        )


# ============================================================================
# Draft CRUD
# ============================================================================


@router.post("")
async def create_draft(
    draft_in: DraftCreate, user: dict = Depends(get_current_user)
):
    """Create a new draft for an event."""
    db = get_firestore_client()

    # Verify events exist (if provided) and user has access
    league_id = None
    # Multi-combine drafts: event_ids[] (preferred), plus back-compat event_id
    event_ids = [e for e in (draft_in.event_ids or []) if e]
    if draft_in.event_id and draft_in.event_id not in event_ids:
        event_ids = [draft_in.event_id] + event_ids
    # de-dupe while preserving order
    event_ids = list(dict.fromkeys(event_ids))

    if event_ids:
        for event_id in event_ids:
            event_ref = db.collection("events").document(event_id)
            event_doc = event_ref.get()
            if not event_doc.exists:
                raise HTTPException(status_code=404, detail=f"Event not found: {event_id}")

            event_data = event_doc.to_dict()
            event_league_id = event_data.get("league_id")

            if event_league_id:
                ensure_event_access(
                    user["uid"],
                    event_id,
                    allowed_roles={"organizer", "coach"},
                    operation_name="create draft",
                )
                if league_id is None:
                    league_id = event_league_id
                elif league_id != event_league_id:
                    raise HTTPException(
                        status_code=400,
                        detail="All selected events must belong to the same league",
                    )
    elif not _user_has_scoped_organizer_membership(db, user["uid"]):
        raise HTTPException(
            status_code=403,
            detail="Standalone drafts are restricted to organizer memberships",
        )
    # Standalone draft - no event required

    draft_id = generate_id("draft_")
    normalized_age_group = _normalize_age_group(draft_in.age_group)
    draft_data = {
        "id": draft_id,
        # Keep event_id for back-compat, but store full list for multi-combine drafts
        "event_id": event_ids[0] if event_ids else None,
        "event_ids": event_ids,
        "league_id": league_id,
        "name": draft_in.name,
        "age_group": normalized_age_group,
        "status": "setup",
        "draft_type": draft_in.draft_type,
        "num_teams": 0,
        "num_rounds": draft_in.num_rounds,
        "pick_timer_seconds": draft_in.pick_timer_seconds,
        "auto_pick_on_timeout": draft_in.auto_pick_on_timeout,
        "trades_enabled": draft_in.trades_enabled,
        "trades_require_approval": draft_in.trades_require_approval,
        "max_players_per_team": draft_in.max_players_per_team,
        "enforce_composite_balance": draft_in.enforce_composite_balance,
        "max_composite_avg_gap": draft_in.max_composite_avg_gap,
        "composite_balance_blocking": draft_in.composite_balance_blocking,
        "team_order": [],
        "current_round": 0,
        "current_pick": 0,
        "current_team_id": None,
        "pick_deadline": None,
        "created_at": now_iso(),
        "started_at": None,
        "completed_at": None,
        "created_by": user["uid"],
    }

    db.collection("drafts").document(draft_id).set(draft_data)
    logger.info(f"Draft created: {draft_id} for events {event_ids}")

    return draft_data


@router.get("/{draft_id}")
async def get_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Get draft details."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user)
    return draft_data


@router.patch("/{draft_id}")
async def update_draft(
    draft_id: str, draft_in: DraftUpdate, user: dict = Depends(get_current_user)
):
    """Update draft settings. Only allowed in 'setup' status."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    # Use exclude_unset so callers can explicitly clear nullable settings by
    # sending null (e.g., max_players_per_team = null).
    updates = draft_in.dict(exclude_unset=True)
    updates["updated_at"] = now_iso()

    draft_ref.update(updates)

    return {**draft_data, **updates}


@router.delete("/{draft_id}")
async def delete_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Delete a draft. Only allowed in 'setup' status."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    # Delete associated teams and picks
    teams = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    for team in teams:
        team.reference.delete()

    draft_ref.delete()

    return {"status": "deleted", "draft_id": draft_id}


@router.get("")
async def list_drafts(
    event_id: Optional[str] = Query(None),
    league_id: Optional[str] = Query(None),
    mine: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    """List drafts, optionally filtered by event, league, or owned by user."""
    db = get_firestore_client()
    uid = user["uid"]
    user_league_roles = _get_user_league_roles(db, uid)

    def _staff_league_ids() -> set[str]:
        return {
            league_id
            for league_id, role in user_league_roles.items()
            if role in {"organizer", "coach"}
        }

    drafts: List[dict] = []
    seen_ids: set = set()

    def _add_doc(doc):
        if not doc or not getattr(doc, "exists", False):
            return
        data = doc.to_dict()
        did = data.get("id") or doc.id
        if did and did in seen_ids:
            return
        if did:
            seen_ids.add(did)
        drafts.append(data)

    # Primary list query
    if event_id:
        # Support both legacy event_id field and newer event_ids[]
        q1 = db.collection("drafts").where(filter=FieldFilter("event_id", "==", event_id))
        q2 = db.collection("drafts").where(filter=FieldFilter("event_ids", "array_contains", event_id))
        for d in q1.stream():
            _add_doc(d)
        for d in q2.stream():
            _add_doc(d)
    elif league_id:
        q = db.collection("drafts").where(filter=FieldFilter("league_id", "==", league_id))
        for d in q.stream():
            _add_doc(d)
    elif mine:
        # Drafts created by this user
        q = db.collection("drafts").where(filter=FieldFilter("created_by", "==", user["uid"]))
        for d in q.stream():
            _add_doc(d)
        # Also drafts where user is a team coach
        coach_teams = (
            db.collection("draft_teams")
            .where(filter=FieldFilter("coach_user_id", "==", user["uid"]))
            .stream()
        )
        coach_draft_ids = {t.to_dict().get("draft_id") for t in coach_teams}
        for did in coach_draft_ids:
            if did and did not in seen_ids:
                _add_doc(db.collection("drafts").document(did).get())
    else:
        for scoped_league_id in _staff_league_ids():
            q = db.collection("drafts").where(
                filter=FieldFilter("league_id", "==", scoped_league_id)
            )
            for d in q.stream():
                _add_doc(d)
        q = db.collection("drafts").where(filter=FieldFilter("created_by", "==", uid))
        for d in q.stream():
            _add_doc(d)
        coach_teams = (
            db.collection("draft_teams")
            .where(filter=FieldFilter("coach_user_id", "==", uid))
            .stream()
        )
        coach_draft_ids = {t.to_dict().get("draft_id") for t in coach_teams}
        for did in coach_draft_ids:
            if did and did not in seen_ids:
                _add_doc(db.collection("drafts").document(did).get())

    visible: List[dict] = []
    for draft in drafts:
        draft_id = draft.get("id")
        league_id_val = draft.get("league_id")

        if league_id_val:
            try:
                membership = ensure_league_access(
                    uid,
                    league_id_val,
                    allowed_roles={"organizer", "coach", "viewer"},
                    operation_name="list drafts",
                )
                _enforce_draft_scope_for_membership(
                    user_id=uid,
                    draft_data=draft,
                    membership=membership,
                    operation_name="list drafts",
                )
                visible.append(draft)
            except HTTPException:
                pass
            continue

        if draft_id and _has_explicit_draft_access(db, draft_id, uid, draft):
            visible.append(draft)

    return visible


# ============================================================================
# Draft Control
# ============================================================================


@router.post("/{draft_id}/start")
async def start_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Start the draft. Requires at least 2 teams."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    # Get teams
    teams_query = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    teams = [t.to_dict() for t in teams_query]

    if len(teams) < 2:
        raise HTTPException(
            status_code=400, detail="Need at least 2 teams to start draft"
        )

    # Sort by pick_order
    teams.sort(key=lambda t: t.get("pick_order", 999))
    team_order = [t["id"] for t in teams]

    # Calculate rounds if not set
    num_rounds = draft_data.get("num_rounds")
    if not num_rounds:
        # Get player count (from event or standalone players)
        player_count = get_draft_player_count(db, draft_data)
        if player_count == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot start draft with 0 players. Import players into the linked combine(s) first."
            )
        num_rounds = max(1, player_count // len(teams)) if len(teams) > 0 else 1

    # Set pick deadline if timer enabled
    pick_deadline = None
    if draft_data.get("pick_timer_seconds", 0) > 0:
        pick_deadline = (
            datetime.now(timezone.utc)
            + timedelta(seconds=draft_data["pick_timer_seconds"])
        ).isoformat()

    updates = {
        "status": "active",
        "team_order": team_order,
        "num_teams": len(teams),
        "num_rounds": num_rounds,
        "current_round": 1,
        "current_pick": 1,
        "current_team_id": team_order[0],
        "pick_deadline": pick_deadline,
        "started_at": now_iso(),
    }

    draft_ref.update(updates)

    logger.info(
        f"Draft started: {draft_id} with {len(teams)} teams, {num_rounds} rounds"
    )

    return {**draft_data, **updates}


@router.post("/{draft_id}/reset")
async def reset_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Reset a draft back to setup status. Deletes all picks."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") == "setup":
        raise HTTPException(status_code=400, detail="Draft is already in setup")

    # Delete all picks
    picks = db.collection("draft_picks").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).stream()
    for pick in picks:
        pick.reference.delete()

    # Delete any team rosters created on completion
    rosters = db.collection("draft_rosters").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).stream()
    for roster in rosters:
        roster.reference.delete()

    draft_ref.update({
        "status": "setup",
        "current_round": None,
        "current_pick": None,
        "current_team_id": None,
        "num_rounds": None,
        "num_teams": None,
        "team_order": None,
        "pick_deadline": None,
        "started_at": None,
        "completed_at": None,
    })

    return {"status": "reset", "draft_id": draft_id}


@router.post("/{draft_id}/pause")
async def pause_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Pause an active draft."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")

    draft_ref.update(
        {"status": "paused", "pick_deadline": None}  # Clear timer while paused
    )

    return {"status": "paused", "draft_id": draft_id}


@router.post("/{draft_id}/resume")
async def resume_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Resume a paused draft."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "paused":
        raise HTTPException(status_code=400, detail="Draft is not paused")

    # Reset timer if enabled
    pick_deadline = None
    if draft_data.get("pick_timer_seconds", 0) > 0:
        pick_deadline = (
            datetime.now(timezone.utc)
            + timedelta(seconds=draft_data["pick_timer_seconds"])
        ).isoformat()

    draft_ref.update({"status": "active", "pick_deadline": pick_deadline})

    return {"status": "active", "draft_id": draft_id}


# ============================================================================
# Teams
# ============================================================================


@router.post("/{draft_id}/teams")
async def add_team(
    draft_id: str, team_in: TeamCreate, user: dict = Depends(get_current_user)
):
    """Add a team to the draft."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    # Get current team count for pick order
    teams_query = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    current_count = len(list(teams_query))

    team_id = generate_id("dteam_")
    team_data = {
        "id": team_id,
        "draft_id": draft_id,
        "team_name": team_in.team_name,
        "coach_user_id": team_in.coach_user_id,
        "coach_name": team_in.coach_name,
        "pick_order": current_count + 1,
        "pre_slotted_player_ids": [],
        "invite_token": generate_invite_token(),  # For coach invite links
        "created_at": now_iso(),
    }

    db.collection("draft_teams").document(team_id).set(team_data)

    # Update draft team count
    draft_ref.update({"num_teams": current_count + 1})

    return team_data


@router.get("/{draft_id}/teams")
async def list_teams(draft_id: str, user: dict = Depends(get_current_user)):
    """List all teams in a draft."""
    db = get_firestore_client()
    _verify_draft_access(db, draft_id, user)

    teams_query = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    teams = [t.to_dict() for t in teams_query]
    teams.sort(key=lambda t: t.get("pick_order", 999))

    return teams


@router.patch("/{draft_id}/teams/{team_id}")
async def update_team(
    draft_id: str,
    team_id: str,
    team_in: TeamUpdate,
    user: dict = Depends(get_current_user),
):
    """Update a team."""
    db = get_firestore_client()
    _verify_draft_access(db, draft_id, user, require_admin=True)

    team_ref = db.collection("draft_teams").document(team_id)
    team_doc = team_ref.get()

    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")
    if team_doc.to_dict().get("draft_id") != draft_id:
        raise HTTPException(status_code=400, detail="Team not in this draft")

    updates = {k: v for k, v in team_in.dict().items() if v is not None}
    updates["updated_at"] = now_iso()

    team_ref.update(updates)

    return {**team_doc.to_dict(), **updates}


@router.delete("/{draft_id}/teams/{team_id}")
async def remove_team(
    draft_id: str, team_id: str, user: dict = Depends(get_current_user)
):
    """Remove a team from the draft."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    team_ref = db.collection("draft_teams").document(team_id)
    _get_team_for_draft(db, draft_id, team_id)

    team_ref.delete()

    # Update team count
    teams_query = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    new_count = len(list(teams_query))
    draft_ref.update({"num_teams": new_count})

    return {"status": "deleted", "team_id": team_id}


@router.post("/{draft_id}/teams/reorder")
async def reorder_teams(
    draft_id: str, team_ids: List[str], user: dict = Depends(get_current_user)
):
    """Reorder teams for the draft."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    # Update pick_order for each team
    for i, team_id in enumerate(team_ids):
        _get_team_for_draft(db, draft_id, team_id)
        db.collection("draft_teams").document(team_id).update({"pick_order": i + 1})

    return {"status": "reordered", "order": team_ids}


# ============================================================================
# Picks
# ============================================================================


@router.post("/{draft_id}/picks")
async def make_pick(
    draft_id: str, pick_in: PickCreate, user: dict = Depends(get_current_user)
):
    """Make a draft pick."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user)

    if draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")

    current_team_id = draft_data.get("current_team_id")
    if not current_team_id:
        raise HTTPException(status_code=400, detail="Draft is missing current team")

    # Pick mutations are staff-only and must be team-owned or admin-authorized.
    _ensure_team_coach_or_admin(
        db=db,
        user=user,
        draft_data=draft_data,
        team_id=current_team_id,
        operation_name="pick submission",
    )

    all_players = _load_draft_player_pool(db, draft_data)
    if pick_in.player_id not in all_players:
        raise HTTPException(status_code=400, detail="Player is not draft-eligible")

    draft_picks = _list_draft_picks(db, draft_id)
    drafted_player_ids = {pick.get("player_id") for pick in draft_picks if pick.get("player_id")}
    drafted_team_by_player = {
        pick.get("player_id"): pick.get("team_id")
        for pick in draft_picks
        if pick.get("player_id")
    }

    if pick_in.player_id in drafted_player_ids:
        raise HTTPException(status_code=400, detail="Player already drafted")

    _validate_sibling_team_constraint(
        selected_player_id=pick_in.player_id,
        all_players=all_players,
        drafted_team_by_player=drafted_team_by_player,
        current_team_id=current_team_id,
    )

    assignment_unit = _build_assignment_unit(
        selected_player_id=pick_in.player_id,
        all_players=all_players,
        drafted_player_ids=drafted_player_ids,
    )
    if not assignment_unit:
        assignment_unit = [pick_in.player_id]

    _validate_assignment_unit_before_pick(
        assignment_unit=assignment_unit,
        all_players=all_players,
        drafted_player_ids=drafted_player_ids,
        drafted_team_by_player=drafted_team_by_player,
        current_team_id=current_team_id,
        draft_data=draft_data,
    )

    response_pick = _apply_pick_unit_atomically(
        db=db,
        draft_ref=draft_ref,
        draft_id=draft_id,
        draft_data=draft_data,
        assignment_unit=assignment_unit,
        all_players=all_players,
        current_team_id=current_team_id,
        picked_by=user["uid"],
        pick_type="manual",
    )

    if response_pick.get("completed"):
        await _create_team_rosters(db, draft_id, draft_data)
        logger.info(
            f"Draft completed: {draft_id} (pick unit size={len(assignment_unit)})"
        )

    logger.info(
        f"Pick made: team={current_team_id} player={pick_in.player_id} "
        f"unit_size={len(assignment_unit)}"
    )

    return response_pick


@router.get("/{draft_id}/picks")
async def list_picks(draft_id: str, user: dict = Depends(get_current_user)):
    """Get all picks for a draft."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user)

    picks_query = (
        db.collection("draft_picks")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .order_by("pick_number")
        .stream()
    )

    picks = [p.to_dict() for p in picks_query]

    # Enrich with player data for UI convenience (supports multi-combine + standalone players)
    player_ids = [p.get("player_id") for p in picks if p.get("player_id")]
    players_by_id: Dict[str, dict] = {}

    for pid in set(player_ids):
        pdata = _get_player_for_draft(db, draft_data, pid)
        if pdata:
            players_by_id[pid] = pdata

    for pick in picks:
        pid = pick.get("player_id")
        if pid and pid in players_by_id:
            pick["player"] = players_by_id[pid]

    return picks


@router.post("/{draft_id}/picks/auto")
async def auto_pick(draft_id: str, user: dict = Depends(get_current_user)):
    """
    Trigger auto-pick for the current team if timer has expired.
    Uses coach's rankings if available, otherwise uses composite score.
    """
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user)

    if draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")

    if not draft_data.get("auto_pick_on_timeout"):
        raise HTTPException(
            status_code=400, detail="Auto-pick is disabled for this draft"
        )

    # Check if timer has actually expired
    pick_deadline = draft_data.get("pick_deadline")
    if pick_deadline:
        deadline_dt = datetime.fromisoformat(pick_deadline.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) < deadline_dt:
            raise HTTPException(status_code=400, detail="Timer has not expired yet")

    current_team_id = draft_data.get("current_team_id")
    if not current_team_id:
        raise HTTPException(status_code=400, detail="Draft is missing current team")

    team_data = _ensure_team_coach_or_admin(
        db=db,
        user=user,
        draft_data=draft_data,
        team_id=current_team_id,
        operation_name="auto-pick",
    )
    coach_user_id = team_data.get("coach_user_id")

    # Try to get coach rankings
    ranked_player_ids = []
    if coach_user_id:
        ranking_query = (
            db.collection("coach_rankings")
            .where(filter=FieldFilter("draft_id", "==", draft_id))
            .where(filter=FieldFilter("coach_user_id", "==", coach_user_id))
            .limit(1)
            .stream()
        )

        rankings = list(ranking_query)
        if rankings:
            ranked_player_ids = rankings[0].to_dict().get("ranked_player_ids", [])

    all_players = _load_draft_player_pool(db, draft_data)
    draft_picks = _list_draft_picks(db, draft_id)
    drafted_ids = {p.get("player_id") for p in draft_picks if p.get("player_id")}
    drafted_team_by_player = {
        p.get("player_id"): p.get("team_id")
        for p in draft_picks
        if p.get("player_id")
    }

    # Filter to available players
    available_ids = [pid for pid in all_players.keys() if pid not in drafted_ids]

    if not available_ids:
        raise HTTPException(status_code=400, detail="No players available")

    # Select best available player with sibling hard constraints and buddy soft preference.
    ranking_index = {pid: idx for idx, pid in enumerate(ranked_player_ids)}
    team_player_ids = _team_player_ids_for_draft_picks(draft_picks, current_team_id)
    buddy_context = _build_buddy_preference_context(
        all_players=all_players, team_player_ids=team_player_ids
    )

    def _candidate_score(pid: str) -> Optional[float]:
        try:
            _validate_sibling_team_constraint(
                selected_player_id=pid,
                all_players=all_players,
                drafted_team_by_player=drafted_team_by_player,
                current_team_id=current_team_id,
            )
        except HTTPException:
            return None

        pdata = all_players.get(pid) or {}
        if pid in ranking_index:
            base = 100000.0 - float(ranking_index[pid])
        else:
            base = float(
                pdata.get("composite_score")
                or pdata.get("scores", {}).get("composite", 0)
                or 0
            )
        buddy_bonus = _calculate_buddy_preference_bonus(
            candidate_player=pdata, buddy_context=buddy_context
        )
        return base + buddy_bonus

    ranked_candidates = []
    for pid in available_ids:
        score = _candidate_score(pid)
        if score is None:
            continue
        ranked_candidates.append((pid, score))

    if not ranked_candidates:
        raise HTTPException(
            status_code=400,
            detail="No eligible players available for this team (sibling constraints)",
        )

    ranked_candidates.sort(key=lambda item: item[1], reverse=True)
    selected_player_id = ranked_candidates[0][0]
    assignment_unit = _build_assignment_unit(
        selected_player_id=selected_player_id,
        all_players=all_players,
        drafted_player_ids=drafted_ids,
    )
    if not assignment_unit:
        assignment_unit = [selected_player_id]

    _validate_assignment_unit_before_pick(
        assignment_unit=assignment_unit,
        all_players=all_players,
        drafted_player_ids=drafted_ids,
        drafted_team_by_player=drafted_team_by_player,
        current_team_id=current_team_id,
        draft_data=draft_data,
    )

    base_pick = _apply_pick_unit_atomically(
        db=db,
        draft_ref=draft_ref,
        draft_id=draft_id,
        draft_data=draft_data,
        assignment_unit=assignment_unit,
        all_players=all_players,
        current_team_id=current_team_id,
        picked_by="system",
        pick_type="auto",
    )

    if base_pick.get("completed"):
        await _create_team_rosters(db, draft_id, draft_data)
        logger.info(
            f"Draft completed via auto-pick: {draft_id} "
            f"(pick unit size={len(assignment_unit)})"
        )

    logger.info(
        f"Auto-pick made: player={selected_player_id} "
        f"team={current_team_id} unit_size={len(assignment_unit)}"
    )

    return {
        **base_pick,
        "player_name": all_players.get(selected_player_id, {}).get("name", "Unknown"),
    }


@router.post("/{draft_id}/picks/undo")
async def undo_last_pick(draft_id: str, user: dict = Depends(get_current_user)):
    """Undo the last pick. Admin only."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") not in ["active", "paused"]:
        raise HTTPException(
            status_code=400, detail="Cannot undo picks in current draft state"
        )

    # Get last pick
    picks_query = (
        db.collection("draft_picks")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .order_by("pick_number", direction="DESCENDING")
        .limit(1)
        .stream()
    )

    picks = list(picks_query)
    if len(picks) == 0:
        raise HTTPException(status_code=400, detail="No picks to undo")

    last_pick = picks[0]
    last_pick_data = last_pick.to_dict()

    # Delete the pick
    last_pick.reference.delete()

    # Revert draft state
    num_teams = draft_data.get("num_teams", 1)
    reverted_pick = last_pick_data.get("pick_number")
    reverted_round = ((reverted_pick - 1) // num_teams) + 1
    reverted_team_id = last_pick_data.get("team_id")

    draft_ref.update(
        {
            "current_round": reverted_round,
            "current_pick": reverted_pick,
            "current_team_id": reverted_team_id,
            "status": (
                "active"
                if draft_data.get("status") == "completed"
                else draft_data.get("status")
            ),
        }
    )

    logger.info(f"Pick undone: {last_pick_data.get('id')} from draft {draft_id}")

    return {"status": "undone", "pick_id": last_pick_data.get("id")}


# ============================================================================
# Rankings
# ============================================================================


@router.get("/{draft_id}/rankings")
async def get_my_rankings(draft_id: str, user: dict = Depends(get_current_user)):
    """Get the current user's player rankings for this draft."""
    db = get_firestore_client()
    _verify_draft_access(db, draft_id, user)

    ranking_query = (
        db.collection("coach_rankings")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .where(filter=FieldFilter("coach_user_id", "==", user["uid"]))
        .limit(1)
        .stream()
    )

    rankings = list(ranking_query)
    if len(rankings) == 0:
        return {"draft_id": draft_id, "ranked_player_ids": []}

    return rankings[0].to_dict()


@router.put("/{draft_id}/rankings")
async def save_rankings(
    draft_id: str, rankings_in: RankingsUpdate, user: dict = Depends(get_current_user)
):
    """Save the current user's player rankings."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user)
    _require_draft_staff(db, user, draft_data, operation_name="Ranking updates")

    # Check if ranking exists
    ranking_query = (
        db.collection("coach_rankings")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .where(filter=FieldFilter("coach_user_id", "==", user["uid"]))
        .limit(1)
        .stream()
    )

    rankings = list(ranking_query)

    ranking_data = {
        "draft_id": draft_id,
        "coach_user_id": user["uid"],
        "ranked_player_ids": rankings_in.ranked_player_ids,
        "updated_at": now_iso(),
    }

    if len(rankings) > 0:
        rankings[0].reference.update(ranking_data)
        ranking_data["id"] = rankings[0].id
    else:
        ranking_id = generate_id("ranking_")
        ranking_data["id"] = ranking_id
        ranking_data["created_at"] = now_iso()
        db.collection("coach_rankings").document(ranking_id).set(ranking_data)

    return ranking_data


# ============================================================================
# Players (Draft Context)
# ============================================================================


@router.get("/{draft_id}/players")
async def get_available_players(draft_id: str, user: dict = Depends(get_current_user)):
    """Get available (undrafted) players for this draft."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user)
    event_ids = _get_draft_event_ids(draft_data)
    age_group = _normalize_age_group(draft_data.get("age_group"))

    all_players = {}

    # Get players from event(s) (if linked to combine)
    for event_id in event_ids:
        players_query = (
            db.collection("events").document(event_id).collection("players")
        )
        for p in players_query.stream():
            pdata = p.to_dict()
            pdata.setdefault("id", p.id)
            if age_group and _normalize_age_group(pdata.get("age_group")) != age_group:
                continue
            pdata["source"] = "combine"
            all_players[p.id] = pdata

    # Get players added directly to this draft (standalone mode)
    draft_players_query = db.collection("draft_players").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    )
    for p in draft_players_query.stream():
        pdata = p.to_dict()
        pdata.setdefault("id", p.id)
        if age_group and _normalize_age_group(pdata.get("age_group")) != age_group:
            continue
        pdata["source"] = "manual"
        all_players[p.id] = pdata

    # Get drafted player IDs
    picks_query = (
        db.collection("draft_picks")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )
    drafted_ids = {p.to_dict().get("player_id") for p in picks_query}

    # Filter to available players
    available = [
        p
        for pid, p in all_players.items()
        if pid not in drafted_ids and p.get("id") not in drafted_ids
    ]

    return available


@router.get("/{draft_id}/players/drafted")
async def get_drafted_players(draft_id: str, user: dict = Depends(get_current_user)):
    """Get all drafted players with their team assignments."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user)

    picks_query = (
        db.collection("draft_picks")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .order_by("pick_number")
        .stream()
    )

    picks = [p.to_dict() for p in picks_query]

    # Enrich with player data (multi-combine + standalone)
    player_ids = [p.get("player_id") for p in picks if p.get("player_id")]
    players_by_id: Dict[str, dict] = {}
    for pid in set(player_ids):
        pdata = _get_player_for_draft(db, draft_data, pid)
        if pdata:
            players_by_id[pid] = pdata

    for pick in picks:
        pick["player"] = players_by_id.get(pick.get("player_id"), {})

    return picks


@router.post("/{draft_id}/sibling-groups/{sibling_group_id}/review")
async def review_sibling_group(
    draft_id: str,
    sibling_group_id: str,
    review_in: SiblingGroupReviewUpdate,
    user: dict = Depends(get_current_user),
):
    """
    Operator review action for inferred sibling groups during draft setup.

    Actions:
    - confirm: keep sibling lock and mark as reviewed
    - clear_lock: remove sibling lock/group association
    - mark_separate: explicitly mark siblings as intentionally separate
    """
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400,
            detail="Sibling group review is only allowed before draft start",
        )

    action = (review_in.action or "").strip().lower()
    if action not in {"confirm", "clear_lock", "mark_separate"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid action. Use confirm, clear_lock, or mark_separate",
        )

    all_players = _load_draft_player_pool(db, draft_data)
    group_players = [
        p
        for p in all_players.values()
        if p.get("siblingGroupId") == sibling_group_id and p.get("id")
    ]
    if review_in.player_ids:
        requested = set(review_in.player_ids)
        group_players = [p for p in group_players if p.get("id") in requested]

    if not group_players:
        raise HTTPException(status_code=404, detail="Sibling group not found in draft scope")

    reviewed_at = now_iso()
    batch = db.batch()
    updated_player_ids = []
    for player in group_players:
        player_id = player.get("id")
        if not player_id:
            continue
        player_ref = _get_event_player_ref_for_draft(db, draft_data, player_id)
        if not player_ref:
            # Manual draft players are not inferred sibling entities.
            continue

        update_payload = {
            "siblingReviewedAt": reviewed_at,
            "siblingReviewedBy": user["uid"],
            "siblingReviewDecision": action,
        }

        if action == "confirm":
            update_payload.update(
                {
                    "forceSameTeamWithSibling": True,
                    "siblingReviewStatus": "confirmed",
                    "siblingInferenceSuspicious": False,
                    "siblingInferenceSuspicionReasons": [],
                }
            )
        elif action == "clear_lock":
            update_payload.update(
                {
                    "forceSameTeamWithSibling": False,
                    "siblingGroupId": None,
                    "siblingReviewStatus": "cleared",
                }
            )
        elif action == "mark_separate":
            update_payload.update(
                {
                    "forceSameTeamWithSibling": False,
                    "siblingGroupId": None,
                    "siblingSeparationRequested": True,
                    "siblingReviewStatus": "separate",
                }
            )

        batch.set(player_ref, update_payload, merge=True)
        updated_player_ids.append(player_id)

    if not updated_player_ids:
        raise HTTPException(
            status_code=400,
            detail="No event-linked players in this sibling group were eligible for review",
        )

    batch.commit()

    return {
        "status": "ok",
        "draft_id": draft_id,
        "sibling_group_id": sibling_group_id,
        "action": action,
        "updated_player_ids": sorted(updated_player_ids),
    }


# ============================================================================
# Pre-Slotted Players
# ============================================================================


@router.post("/{draft_id}/pre-slots")
async def add_pre_slot(
    draft_id: str, slot_in: PreSlotCreate, user: dict = Depends(get_current_user)
):
    """Pre-assign a player to a team (e.g., coach's child)."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    team_ref = db.collection("draft_teams").document(slot_in.team_id)
    team_data = _get_team_for_draft(db, draft_id, slot_in.team_id)
    pre_slotted = team_data.get("pre_slotted_player_ids", [])

    if slot_in.player_id not in pre_slotted:
        pre_slotted.append(slot_in.player_id)
        team_ref.update({"pre_slotted_player_ids": pre_slotted})

    return {
        "status": "added",
        "team_id": slot_in.team_id,
        "player_id": slot_in.player_id,
    }


@router.delete("/{draft_id}/pre-slots/{team_id}/{player_id}")
async def remove_pre_slot(
    draft_id: str, team_id: str, player_id: str, user: dict = Depends(get_current_user)
):
    """Remove a pre-slotted player."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Cannot modify draft after it has started"
        )

    _check_payment_gate(db, draft_id, draft_data)

    team_ref = db.collection("draft_teams").document(team_id)
    team_data = _get_team_for_draft(db, draft_id, team_id)
    pre_slotted = team_data.get("pre_slotted_player_ids", [])

    if player_id in pre_slotted:
        pre_slotted.remove(player_id)
        team_ref.update({"pre_slotted_player_ids": pre_slotted})

    return {"status": "removed", "team_id": team_id, "player_id": player_id}


# ============================================================================
# Trades
# ============================================================================


@router.post("/{draft_id}/trades")
async def create_trade(
    draft_id: str, trade_in: TradeCreate, user: dict = Depends(get_current_user)
):
    """Create a trade proposal."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user)
    _require_draft_staff(db, user, draft_data, operation_name="Trade proposals")

    if draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")

    if not draft_data.get("trades_enabled", False):
        raise HTTPException(status_code=400, detail="Trades are not enabled for this draft")

    if trade_in.offering_player_id == trade_in.receiving_player_id:
        raise HTTPException(status_code=400, detail="Cannot trade the same player")

    offering_pick = _get_pick_for_player(db, draft_id, trade_in.offering_player_id)
    receiving_pick = _get_pick_for_player(db, draft_id, trade_in.receiving_player_id)

    if not offering_pick or not receiving_pick:
        raise HTTPException(
            status_code=400, detail="One or more players not found in picks"
        )

    offering_pick_data = offering_pick.to_dict()
    receiving_pick_data = receiving_pick.to_dict()

    if offering_pick_data.get("team_id") != trade_in.offering_team_id:
        raise HTTPException(
            status_code=400, detail="Offering player is not on the offering team"
        )
    if receiving_pick_data.get("team_id") != trade_in.receiving_team_id:
        raise HTTPException(
            status_code=400, detail="Receiving player is not on the receiving team"
        )

    is_admin = _is_draft_admin(user, draft_data)
    if not is_admin:
        offering_team_data = _get_team_for_draft(
            db, draft_id, trade_in.offering_team_id
        )
        _get_team_for_draft(db, draft_id, trade_in.receiving_team_id)
        if offering_team_data.get("coach_user_id") != user["uid"]:
            raise HTTPException(
                status_code=403,
                detail="Only the offering team's coach or draft admin can propose trades",
            )

    requires_approval = draft_data.get("trades_require_approval", True)

    trade_id = generate_id("trade_")
    status = "approved" if is_admin or not requires_approval else "pending"
    created_at = now_iso()
    resolved_at = created_at if status == "approved" else None

    if status == "approved":
        _execute_trade_swap(
            db,
            draft_id,
            trade_in.offering_player_id,
            trade_in.receiving_player_id,
            trade_in.offering_team_id,
            trade_in.receiving_team_id,
        )

    trade_data = {
        "id": trade_id,
        "offering_team_id": trade_in.offering_team_id,
        "receiving_team_id": trade_in.receiving_team_id,
        "offering_player_id": trade_in.offering_player_id,
        "receiving_player_id": trade_in.receiving_player_id,
        "proposed_by_user_id": user["uid"],
        "status": status,
        "created_at": created_at,
        "resolved_at": resolved_at,
    }

    draft_ref.collection("trades").document(trade_id).set(trade_data)

    return trade_data


@router.get("/{draft_id}/trades")
async def list_trades(draft_id: str, user: dict = Depends(get_current_user)):
    """List all trades for a draft."""
    db = get_firestore_client()
    _verify_draft_access(db, draft_id, user)

    trades_query = (
        db.collection("drafts")
        .document(draft_id)
        .collection("trades")
        .order_by("created_at", direction="DESCENDING")
        .stream()
    )

    return [t.to_dict() for t in trades_query]


@router.patch("/{draft_id}/trades/{trade_id}")
async def update_trade(
    draft_id: str,
    trade_id: str,
    trade_in: TradeUpdate,
    user: dict = Depends(get_current_user),
):
    """Approve or reject a trade. Admin only."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if trade_in.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    trade_ref = draft_ref.collection("trades").document(trade_id)
    trade_doc = trade_ref.get()
    if not trade_doc.exists:
        raise HTTPException(status_code=404, detail="Trade not found")

    trade_data = trade_doc.to_dict()
    if trade_data.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Trade already resolved")

    resolved_at = now_iso()

    if trade_in.status == "approved":
        _execute_trade_swap(
            db,
            draft_id,
            trade_data.get("offering_player_id"),
            trade_data.get("receiving_player_id"),
            trade_data.get("offering_team_id"),
            trade_data.get("receiving_team_id"),
        )

    updates = {"status": trade_in.status, "resolved_at": resolved_at}

    trade_ref.update(updates)

    return {**trade_data, **updates}


# ============================================================================
# Helper: Create Team Rosters on Draft Completion
# ============================================================================


async def _create_team_rosters(db, draft_id: str, draft_data: dict):
    """Create team roster records when draft completes."""

    # Get all picks grouped by team
    picks_query = (
        db.collection("draft_picks")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )

    team_players: Dict[str, List[str]] = {}
    for pick_doc in picks_query:
        pick = pick_doc.to_dict()
        team_id = pick.get("team_id")
        player_id = pick.get("player_id")
        if team_id not in team_players:
            team_players[team_id] = []
        team_players[team_id].append(player_id)

    # Get team details
    teams_query = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("draft_id", "==", draft_id))
        .stream()
    )

    teams = {t.id: t.to_dict() for t in teams_query}

    # Create roster records
    for team_id, player_ids in team_players.items():
        team_data = teams.get(team_id, {})

        event_ids = _get_draft_event_ids(draft_data)

        roster_id = generate_id("roster_")
        roster_data = {
            "id": roster_id,
            "draft_id": draft_id,
            "event_id": event_ids[0] if event_ids else None,
            "event_ids": event_ids,
            "league_id": draft_data.get("league_id"),
            "team_name": team_data.get("team_name"),
            "coach_user_id": team_data.get("coach_user_id"),
            "coach_name": team_data.get("coach_name"),
            "player_ids": player_ids,
            "created_at": now_iso(),
            "created_from": "draft",
        }

        db.collection("team_rosters").document(roster_id).set(roster_data)

    logger.info(f"Created {len(team_players)} team rosters from draft {draft_id}")


# ============================================================================
# Standalone Draft Players (no combine required)
# ============================================================================


class DraftPlayerCreate(BaseModel):
    """Add a player directly to a draft (no combine required)."""

    name: str
    number: Optional[str] = None  # Jersey number
    position: Optional[str] = None
    age_group: Optional[str] = None
    notes: Optional[str] = None


class DraftPlayerBulkCreate(BaseModel):
    """Bulk add players to a draft."""

    players: List[DraftPlayerCreate]


@router.post("/{draft_id}/players")
async def add_draft_player(
    draft_id: str, player_in: DraftPlayerCreate, user: dict = Depends(get_current_user)
):
    """Add a player directly to a draft (for standalone drafts without combine)."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(status_code=400, detail="Can only add players during setup")

    player_id = generate_id("dplayer_")
    player_data = {
        "id": player_id,
        "draft_id": draft_id,
        "name": player_in.name,
        "number": player_in.number,
        "position": player_in.position,
        "age_group": _normalize_age_group(player_in.age_group),
        "notes": player_in.notes,
        "source": "manual",  # vs "combine" for event-linked players
        "created_at": now_iso(),
        "created_by": user["uid"],
    }

    db.collection("draft_players").document(player_id).set(player_data)

    return player_data


@router.post("/{draft_id}/players/bulk")
async def add_draft_players_bulk(
    draft_id: str,
    bulk_in: DraftPlayerBulkCreate,
    user: dict = Depends(get_current_user),
):
    """Bulk add players to a draft."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(status_code=400, detail="Can only add players during setup")

    added = []
    for p in bulk_in.players:
        player_id = generate_id("dplayer_")
        player_data = {
            "id": player_id,
            "draft_id": draft_id,
            "name": p.name,
            "number": p.number,
            "position": p.position,
            "age_group": _normalize_age_group(p.age_group),
            "notes": p.notes,
            "source": "manual",
            "created_at": now_iso(),
            "created_by": user["uid"],
        }
        db.collection("draft_players").document(player_id).set(player_data)
        added.append(player_data)

    return {"added": len(added), "players": added}


@router.delete("/{draft_id}/players/{player_id}")
async def remove_draft_player(
    draft_id: str, player_id: str, user: dict = Depends(get_current_user)
):
    """Remove a manually-added player from a draft."""
    db = get_firestore_client()
    draft_ref, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    if draft_data.get("status") != "setup":
        raise HTTPException(
            status_code=400, detail="Can only remove players during setup"
        )

    player_ref = db.collection("draft_players").document(player_id)
    player_doc = player_ref.get()

    if not player_doc.exists:
        raise HTTPException(status_code=404, detail="Player not found")

    if player_doc.to_dict().get("draft_id") != draft_id:
        raise HTTPException(status_code=400, detail="Player not in this draft")

    player_ref.delete()

    return {"status": "ok", "deleted": player_id}


# ============================================================================
# Coach Invite Links
# ============================================================================


def generate_invite_token() -> str:
    """Generate a short, URL-safe invite token."""
    return secrets.token_urlsafe(12)  # ~16 chars, URL-safe


class JoinTeamResponse(BaseModel):
    status: str
    team_id: str
    team_name: str
    draft_id: str
    draft_name: str


@router.get("/join/{invite_token}")
async def get_invite_info(invite_token: str):
    """Get info about an invite link (no auth required)."""
    db = get_firestore_client()

    # Find team with this token
    teams_query = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("invite_token", "==", invite_token))
        .limit(1)
        .stream()
    )

    teams = list(teams_query)
    if not teams:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    team_data = teams[0].to_dict()
    draft_id = team_data.get("draft_id")

    # Get draft info
    draft_doc = db.collection("drafts").document(draft_id).get()
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft_data = draft_doc.to_dict()

    return {
        "team_id": team_data.get("id"),
        "team_name": team_data.get("team_name"),
        "coach_name": team_data.get("coach_name"),
        "draft_id": draft_id,
        "draft_name": draft_data.get("name"),
        "draft_status": draft_data.get("status"),
        "already_claimed": team_data.get("coach_user_id") is not None,
    }


@router.post("/join/{invite_token}")
async def join_team_via_invite(
    invite_token: str, user: dict = Depends(get_current_user)
) -> JoinTeamResponse:
    """Claim a team spot using an invite link."""
    db = get_firestore_client()

    # Find team with this token
    teams_query = (
        db.collection("draft_teams")
        .where(filter=FieldFilter("invite_token", "==", invite_token))
        .limit(1)
        .stream()
    )

    teams = list(teams_query)
    if not teams:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")

    team_doc = teams[0]
    team_data = team_doc.to_dict()
    team_id = team_data.get("id")
    draft_id = team_data.get("draft_id")

    # Check if already claimed
    if team_data.get("coach_user_id"):
        if team_data.get("coach_user_id") == user["uid"]:
            # Already claimed by this user - just return success
            pass
        else:
            raise HTTPException(
                status_code=400,
                detail="This team has already been claimed by another coach",
            )

    # Get draft info
    draft_doc = db.collection("drafts").document(draft_id).get()
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft_data = draft_doc.to_dict()
    league_id = draft_data.get("league_id")

    # Scoped league membership is authoritative for invite claims.
    # Deny by default when league context cannot be safely validated.
    if not league_id:
        raise HTTPException(
            status_code=400,
            detail="Draft invite is missing league context",
        )
    membership = ensure_league_access(
        user["uid"],
        league_id,
        allowed_roles={"organizer", "coach"},
        operation_name="claim team invite",
    )
    scoped_role = (membership.get("role") or "").lower()

    # Coach claims require explicit draft event scope.
    # League membership alone is never sufficient for coaches.
    if scoped_role == "coach":
        draft_event_ids = _get_draft_event_ids(draft_data)
        if not draft_event_ids:
            raise HTTPException(
                status_code=403,
                detail="Coach claims require explicit draft event scope",
            )
        for event_id in draft_event_ids:
            ensure_event_access(
                user["uid"],
                event_id,
                allowed_roles={"organizer", "coach"},
                operation_name="claim team invite",
            )
    elif scoped_role != "organizer":
        raise HTTPException(status_code=403, detail="Insufficient league permissions")

    # Check draft status - can only join during setup
    if draft_data.get("status") not in ["setup", "active"]:
        raise HTTPException(status_code=400, detail="Cannot join - draft has ended")

    # Claim the team
    db.collection("draft_teams").document(team_id).update(
        {
            "coach_user_id": user["uid"],
            "coach_email": user.get("email"),
            "claimed_at": now_iso(),
        }
    )

    logger.info(f"Coach {user['uid']} claimed team {team_id} in draft {draft_id}")

    return JoinTeamResponse(
        status="ok",
        team_id=team_id,
        team_name=team_data.get("team_name"),
        draft_id=draft_id,
        draft_name=draft_data.get("name"),
    )


@router.post("/{draft_id}/teams/{team_id}/regenerate-invite")
async def regenerate_invite_token(
    draft_id: str, team_id: str, user: dict = Depends(get_current_user)
):
    """Regenerate invite token for a team (invalidates old link)."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    team_ref = db.collection("draft_teams").document(team_id)
    team_doc = team_ref.get()

    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")

    if team_doc.to_dict().get("draft_id") != draft_id:
        raise HTTPException(status_code=400, detail="Team not in this draft")

    new_token = generate_invite_token()
    team_ref.update({"invite_token": new_token, "invite_regenerated_at": now_iso()})

    return {"status": "ok", "invite_token": new_token}


@router.post("/{draft_id}/teams/{team_id}/remove-coach")
async def remove_coach_from_team(
    draft_id: str, team_id: str, user: dict = Depends(get_current_user)
):
    """Remove coach assignment from a team (admin only)."""
    db = get_firestore_client()
    _, draft_data = _verify_draft_access(db, draft_id, user, require_admin=True)

    team_ref = db.collection("draft_teams").document(team_id)
    team_doc = team_ref.get()

    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")

    if team_doc.to_dict().get("draft_id") != draft_id:
        raise HTTPException(status_code=400, detail="Team not in this draft")

    # Clear coach and regenerate invite
    new_token = generate_invite_token()
    team_ref.update(
        {
            "coach_user_id": None,
            "coach_email": None,
            "claimed_at": None,
            "invite_token": new_token,
        }
    )

    return {"status": "ok", "message": "Coach removed, new invite link generated"}
