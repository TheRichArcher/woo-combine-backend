from typing import Dict, Optional


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
