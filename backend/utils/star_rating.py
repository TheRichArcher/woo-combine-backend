from typing import Any, Dict, List, Optional


STAR_BANDS = [
    {"min": 90, "max": 100, "star_count": 5, "star_label": "Elite"},
    {"min": 75, "max": 89, "star_count": 4, "star_label": "Impact Player"},
    {"min": 50, "max": 74, "star_count": 3, "star_label": "Reliable Starter"},
    {"min": 25, "max": 49, "star_count": 2, "star_label": "Mid-Major Contributor"},
    {"min": 0, "max": 24, "star_count": 1, "star_label": "Developmental Prospect"},
]


def normalize_percentile(percentile: Optional[float]) -> Optional[int]:
    if percentile is None:
        return None
    try:
        numeric = float(percentile)
    except (TypeError, ValueError):
        return None
    return max(0, min(100, round(numeric)))


def percentile_from_rank(rank: int, total: int) -> Optional[int]:
    if not isinstance(rank, int) or not isinstance(total, int) or total <= 0:
        return None
    clamped_rank = max(1, min(total, rank))
    return round(((total - clamped_rank + 1) / total) * 100)


def get_star_rating_from_percentile(percentile: Optional[float]) -> Dict[str, Optional[object]]:
    normalized = normalize_percentile(percentile)
    if normalized is None:
        return {
            "percentile": None,
            "star_count": None,
            "star_label": "",
            "star_display": "",
        }

    band = next(
        (
            item
            for item in STAR_BANDS
            if normalized >= item["min"] and normalized <= item["max"]
        ),
        STAR_BANDS[-1],
    )

    return {
        "percentile": normalized,
        "star_count": int(band["star_count"]),
        "star_label": str(band["star_label"]),
        "star_display": "★" * int(band["star_count"]),
    }


def _extract_drill_score(player_data: Dict[str, Any], drill_key: str) -> Optional[float]:
    scores_map = player_data.get("scores", {}) or {}
    raw_value = scores_map.get(drill_key)
    if raw_value is None:
        raw_value = player_data.get(drill_key)
    if raw_value is None:
        raw_value = player_data.get(f"drill_{drill_key}")
    if raw_value is None or str(raw_value).strip() == "":
        return None
    try:
        return float(raw_value)
    except (TypeError, ValueError):
        return None


def build_canonical_drill_metrics_for_cohort(
    cohort_players: List[Dict[str, Any]], schema: Any
) -> Dict[str, Dict[str, Dict[str, Optional[object]]]]:
    metrics_by_player_id: Dict[str, Dict[str, Dict[str, Optional[object]]]] = {}
    if not cohort_players or not schema:
        return metrics_by_player_id

    for drill in getattr(schema, "drills", []):
        comparable: List[Dict[str, Any]] = []
        for player in cohort_players:
            player_id = player.get("id")
            if not player_id:
                continue
            score = _extract_drill_score(player, drill.key)
            if score is None:
                continue
            comparable.append({"id": player_id, "score": score})

        if not comparable:
            continue

        if getattr(drill, "lower_is_better", False):
            comparable.sort(key=lambda item: (item["score"], str(item["id"])))
        else:
            comparable.sort(key=lambda item: (-item["score"], str(item["id"])))

        total = len(comparable)
        for rank_index, item in enumerate(comparable, start=1):
            percentile = percentile_from_rank(rank_index, total)
            stars = get_star_rating_from_percentile(percentile)
            metrics_by_player_id.setdefault(item["id"], {})[drill.key] = {
                "drill_percentile": percentile,
                "drill_star_count": stars.get("star_count"),
                "drill_star_label": stars.get("star_label"),
                "drill_star_display": stars.get("star_display"),
            }

    return metrics_by_player_id
