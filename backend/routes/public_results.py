import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..firestore_client import db
from ..middleware.rate_limiting import auth_rate_limit
from ..routes.players import calculate_composite_score
from ..utils.database import execute_with_timeout
from ..utils.event_schema import get_event_schema
from ..utils.star_rating import (
    get_star_rating_from_percentile,
    percentile_from_rank,
)
logger = logging.getLogger(__name__)

_PUNCTUATION_RE = re.compile(r"[^a-z0-9\s]")
_SPACE_RE = re.compile(r"\s+")

router = APIRouter(prefix="/public")

LOOKUP_FAILURE_MESSAGE = (
    "We couldn't find a matching participant with that Combine Number and Last Name."
)


class ParentLookupRequest(BaseModel):
    event_id: str = Field(..., min_length=1, max_length=128)
    combine_number: str = Field(..., min_length=1, max_length=64)
    last_name: str = Field(..., min_length=1, max_length=128)


def _normalize_combine_number(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _canonicalize_number(value: Any) -> Optional[str]:
    normalized = _normalize_combine_number(value)
    if not normalized:
        return None
    if normalized.isdigit():
        return normalized.lstrip("0") or "0"
    return normalized


def _number_query_values(input_number: str) -> List[Any]:
    """
    Build Firestore query candidates for player.number.
    Check-in writes number as an int, but legacy/migrated rows may store strings.
    """
    normalized = _normalize_combine_number(input_number)
    canonical = _canonicalize_number(input_number)
    if not normalized:
        return []

    candidates: List[Any] = [normalized]
    if canonical and canonical != normalized:
        candidates.append(canonical)
    if canonical and canonical.isdigit():
        try:
            candidates.append(int(canonical))
        except ValueError:
            pass

    deduped: List[Any] = []
    seen = set()
    for candidate in candidates:
        dedupe_key = (type(candidate).__name__, str(candidate))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        deduped.append(candidate)
    return deduped


def _is_combine_number_match(input_number: str, stored_number: Any) -> bool:
    input_canonical = _canonicalize_number(input_number)
    stored_canonical = _canonicalize_number(stored_number)
    if not input_canonical or not stored_canonical:
        return False
    return input_canonical == stored_canonical


def _normalize_last_name(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    normalized = _PUNCTUATION_RE.sub(" ", normalized)
    normalized = _SPACE_RE.sub(" ", normalized).strip()
    return normalized or None


def _candidate_last_names(player_data: Dict[str, Any]) -> List[str]:
    candidates: List[str] = []

    raw_last = player_data.get("last") or player_data.get("last_name")
    normalized_last = _normalize_last_name(raw_last)
    if normalized_last:
        candidates.append(normalized_last)

    full_name = player_data.get("name")
    if full_name:
        full_name_parts = str(full_name).strip().split()
        if len(full_name_parts) > 1:
            parsed_last = _normalize_last_name(" ".join(full_name_parts[1:]))
            if parsed_last:
                candidates.append(parsed_last)

    # De-duplicate while preserving order.
    deduped: List[str] = []
    seen = set()
    for candidate in candidates:
        if candidate not in seen:
            seen.add(candidate)
            deduped.append(candidate)
    return deduped


def _extract_score(player_data: Dict[str, Any], drill_key: str) -> Optional[float]:
    scores_map = player_data.get("scores", {}) or {}
    raw_value = scores_map.get(drill_key)
    if raw_value is None:
        raw_value = player_data.get(drill_key) or player_data.get(f"drill_{drill_key}")
    if raw_value is None or str(raw_value).strip() == "":
        return None
    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return None


def _build_positive_highlight(percentile: int) -> str:
    if percentile >= 90:
        return "Outstanding performance! Ranked among the top performers in your age group."
    if percentile >= 75:
        return "Great job! Strong performance compared to peers in your age group."
    return ""


def _is_tolerant_last_name_match(input_last_name: str, candidate_last_name: str) -> bool:
    # Tolerant, directional matching for suffixes (e.g. "bradshaw" -> "bradshaw jr")
    # while still anchored to combine_number exact lookup.
    return (
        candidate_last_name == input_last_name
        or candidate_last_name.startswith(input_last_name)
        or input_last_name.startswith(candidate_last_name)
    )


@router.post("/results-lookup")
@auth_rate_limit()
def parent_results_lookup(request: Request, payload: ParentLookupRequest):
    event_id = str(payload.event_id or "").strip()
    combine_number = _normalize_combine_number(payload.combine_number)
    normalized_last_name = _normalize_last_name(payload.last_name)
    number_query_values = _number_query_values(combine_number)

    if not event_id or not combine_number or not normalized_last_name or not number_query_values:
        raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)

    try:
        logger.debug(
            "results_lookup input normalized: event_id=%s combine_number=%s normalized_last_name=%s number_query_values=%s",
            event_id,
            combine_number,
            normalized_last_name,
            number_query_values,
        )

        # Query only within requested event by check-in bib/combine number (`number`),
        # then apply in-memory canonical + last-name checks.
        candidate_docs = []
        seen_doc_ids = set()
        for query_value in number_query_values:
            docs_for_value = execute_with_timeout(
                lambda qv=query_value: list(
                    db.collection("events")
                    .document(event_id)
                    .collection("players")
                    .where("number", "==", qv)
                    .limit(25)
                    .stream()
                ),
                timeout=10,
                operation_name="parent report lookup candidates",
            )
            for doc in docs_for_value:
                if doc.id in seen_doc_ids:
                    continue
                seen_doc_ids.add(doc.id)
                candidate_docs.append(doc)

        candidate_debug = []
        for doc in candidate_docs:
            player_data = doc.to_dict() or {}
            candidate_event_id = player_data.get("event_id") or event_id
            candidate_debug.append(
                {
                    "player_id": doc.id,
                    "name": player_data.get("name"),
                    "event_id": candidate_event_id,
                    "number": player_data.get("number"),
                    "last_name_candidates": _candidate_last_names(player_data),
                }
            )
        logger.debug(
            "results_lookup candidates before final filtering: event_id=%s candidates=%s",
            event_id,
            candidate_debug,
        )

        matches = []
        number_mismatch_count = 0
        last_name_mismatch_count = 0
        for doc in candidate_docs:
            player_data = doc.to_dict() or {}
            if not _is_combine_number_match(combine_number, player_data.get("number")):
                number_mismatch_count += 1
                continue
            candidate_last_names = _candidate_last_names(player_data)
            if any(
                _is_tolerant_last_name_match(normalized_last_name, candidate_last_name)
                for candidate_last_name in candidate_last_names
            ):
                matches.append((doc, player_data))
            else:
                last_name_mismatch_count += 1

        # Require exactly one match to avoid leaking identities across duplicate identifiers.
        if len(matches) > 1:
            logger.debug(
                "results_lookup rejected_ambiguous: event_id=%s combine_number=%s normalized_last_name=%s matches=%s",
                event_id,
                combine_number,
                normalized_last_name,
                [
                    {
                        "player_id": matched_doc.id,
                        "name": (matched_player or {}).get("name"),
                    }
                    for matched_doc, matched_player in matches
                ],
            )
            raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)

        if len(matches) == 0:
            rejection_reason = "no_number_candidates"
            if candidate_docs:
                if last_name_mismatch_count > 0:
                    rejection_reason = "last_name_mismatch"
                elif number_mismatch_count > 0:
                    rejection_reason = "combine_number_canonical_mismatch"
                else:
                    rejection_reason = "no_final_match"
            logger.debug(
                "results_lookup rejected_no_match: event_id=%s combine_number=%s normalized_last_name=%s "
                "reason=%s candidate_count=%s number_mismatch_count=%s last_name_mismatch_count=%s",
                event_id,
                combine_number,
                normalized_last_name,
                rejection_reason,
                len(candidate_docs),
                number_mismatch_count,
                last_name_mismatch_count,
            )
            raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)

        matched_doc, matched_player = matches[0]
        matched_event_id = matched_player.get("event_id") or event_id

        all_player_docs = execute_with_timeout(
            lambda: list(db.collection("events").document(event_id).collection("players").stream()),
            timeout=15,
            operation_name="parent report lookup event players",
        )

        all_players: List[Dict[str, Any]] = []
        for doc in all_player_docs:
            data = doc.to_dict() or {}
            data["id"] = doc.id
            all_players.append(data)

        target_player = next((p for p in all_players if p.get("id") == matched_doc.id), None)
        if not target_player:
            raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)

        logger.debug(
            "results_lookup matched: event_id=%s player_id=%s player_name=%s player_event_id=%s",
            event_id,
            matched_doc.id,
            target_player.get("name"),
            matched_event_id,
        )

        schema = get_event_schema(event_id)
        target_score = calculate_composite_score(target_player, schema=schema)
        age_group = target_player.get("age_group")
        age_group_players = [p for p in all_players if p.get("age_group") == age_group]
        if not age_group_players:
            age_group_players = [target_player]

        composite_rankings = []
        for player in age_group_players:
            composite_rankings.append(
                {
                    "id": player.get("id"),
                    "composite_score": calculate_composite_score(player, schema=schema),
                }
            )
        composite_rankings.sort(
            key=lambda item: (
                -(item.get("composite_score", 0.0) or 0.0),
                str(item.get("id") or ""),
            )
        )
        target_rank = next(
            (
                index + 1
                for index, entry in enumerate(composite_rankings)
                if entry.get("id") == target_player.get("id")
            ),
            len(composite_rankings),
        )
        overall_percentile = percentile_from_rank(target_rank, len(composite_rankings)) or 0
        star_rating = get_star_rating_from_percentile(overall_percentile)

        drill_breakdown = []
        for drill in schema.drills:
            player_score = _extract_score(target_player, drill.key)
            drill_percentile: Optional[int] = None

            if player_score is not None:
                comparable = []
                for player in age_group_players:
                    candidate_score = _extract_score(player, drill.key)
                    if candidate_score is not None:
                        comparable.append({"id": player.get("id"), "score": candidate_score})

                if comparable:
                    comparable.sort(
                        key=lambda item: item["score"],
                        reverse=not drill.lower_is_better,
                    )
                    drill_rank = next(
                        (
                            idx + 1
                            for idx, item in enumerate(comparable)
                            if item["id"] == target_player.get("id")
                        ),
                        len(comparable),
                    )
                    drill_percentile = round(
                        ((len(comparable) - drill_rank + 1) / len(comparable)) * 100
                    )

            drill_breakdown.append(
                {
                    "drill_key": drill.key,
                    "drill_label": drill.label,
                    "unit": drill.unit,
                    "score": player_score,
                    "percentile": drill_percentile,
                }
            )

        return {
            "player_name": target_player.get("name") or "Participant",
            "age_group": age_group,
            "overall_score": round(float(target_score), 1),
            "percentile": int(overall_percentile),
            "star_count": star_rating.get("star_count"),
            "star_label": star_rating.get("star_label"),
            "star_display": star_rating.get("star_display"),
            "positive_highlight": _build_positive_highlight(int(overall_percentile)),
            "drill_breakdown": drill_breakdown,
        }
    except HTTPException:
        raise
    except Exception:
        # Generic failure to avoid exposing internal lookup details.
        raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)
