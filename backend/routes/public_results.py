from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..firestore_client import db
from ..middleware.rate_limiting import auth_rate_limit
from ..routes.players import calculate_composite_score
from ..utils.database import execute_with_timeout
from ..utils.event_schema import get_event_schema
from ..utils.participant_matching import normalize_person_name

router = APIRouter(prefix="/public")

LOOKUP_FAILURE_MESSAGE = (
    "We couldn't find a matching participant with that Combine Number and Last Name."
)


class ParentLookupRequest(BaseModel):
    combine_number: str = Field(..., min_length=1, max_length=64)
    last_name: str = Field(..., min_length=1, max_length=128)


def _normalize_combine_number(value: str) -> str:
    return str(value or "").strip()


def _candidate_last_names(player_data: Dict[str, Any]) -> List[str]:
    candidates: List[str] = []

    raw_last = player_data.get("last") or player_data.get("last_name")
    normalized_last = normalize_person_name(raw_last)
    if normalized_last:
        candidates.append(normalized_last)

    full_name = player_data.get("name")
    if full_name:
        full_name_parts = str(full_name).strip().split()
        if len(full_name_parts) > 1:
            parsed_last = normalize_person_name(" ".join(full_name_parts[1:]))
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


@router.post("/results-lookup")
@auth_rate_limit()
def parent_results_lookup(request: Request, payload: ParentLookupRequest):
    combine_number = _normalize_combine_number(payload.combine_number)
    normalized_last_name = normalize_person_name(payload.last_name)

    if not combine_number or not normalized_last_name:
        raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)

    try:
        # Query by combine number first (cheap index), then apply normalized last-name match
        # in memory to avoid exposing field-level match diagnostics.
        candidate_docs = execute_with_timeout(
            lambda: list(
                db.collection_group("players")
                .where("external_id", "==", combine_number)
                .limit(10)
                .stream()
            ),
            timeout=10,
            operation_name="parent report lookup candidates",
        )

        matches = []
        for doc in candidate_docs:
            player_data = doc.to_dict() or {}
            if normalized_last_name in _candidate_last_names(player_data):
                matches.append((doc, player_data))

        # Require exactly one match to avoid leaking identities across duplicate identifiers.
        if len(matches) != 1:
            raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)

        matched_doc, matched_player = matches[0]
        event_id = matched_player.get("event_id")
        if not event_id:
            parent_doc = matched_doc.reference.parent.parent
            event_id = parent_doc.id if parent_doc else None
        if not event_id:
            raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)

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
        composite_rankings.sort(key=lambda item: item.get("composite_score", 0.0), reverse=True)
        target_rank = next(
            (
                index + 1
                for index, entry in enumerate(composite_rankings)
                if entry.get("id") == target_player.get("id")
            ),
            len(composite_rankings),
        )
        overall_percentile = (
            round(((len(composite_rankings) - target_rank + 1) / len(composite_rankings)) * 100)
            if composite_rankings
            else 0
        )

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
            "positive_highlight": _build_positive_highlight(int(overall_percentile)),
            "drill_breakdown": drill_breakdown,
        }
    except HTTPException:
        raise
    except Exception:
        # Generic failure to avoid exposing internal lookup details.
        raise HTTPException(status_code=404, detail=LOOKUP_FAILURE_MESSAGE)
