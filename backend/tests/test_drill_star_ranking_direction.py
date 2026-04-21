from backend.services.schema_registry import SchemaRegistry
from backend.utils.star_rating import build_canonical_drill_metrics_for_cohort


def _metric(metrics_by_player_id, player_id, drill_key):
    return metrics_by_player_id.get(player_id, {}).get(drill_key, {})


def test_football_drill_directions_are_canonical():
    football = SchemaRegistry.get_schema("football")
    drills = {drill.key: drill for drill in football.drills}

    assert drills["40m_dash"].lower_is_better is True
    assert drills["vertical_jump"].lower_is_better is False
    assert drills["catching"].lower_is_better is False
    assert drills["throwing"].lower_is_better is False
    assert drills["agility"].lower_is_better is True


def test_catching_zero_score_is_not_elite_when_higher_scores_exist():
    football = SchemaRegistry.get_schema("football")
    players = [
        {"id": "p0", "age_group": "12U", "scores": {"catching": 0}},
        {"id": "p1", "age_group": "12U", "scores": {"catching": 20}},
        {"id": "p2", "age_group": "12U", "scores": {"catching": 40}},
        {"id": "p3", "age_group": "12U", "scores": {}},
    ]

    metrics = build_canonical_drill_metrics_for_cohort(players, football)
    zero_catching = _metric(metrics, "p0", "catching")

    assert zero_catching.get("drill_percentile") is not None
    assert zero_catching.get("drill_star_count") is not None
    assert zero_catching.get("drill_star_count") < 5


def test_lower_is_better_drills_rank_fastest_time_highest():
    football = SchemaRegistry.get_schema("football")
    players = [
        {"id": "fast", "age_group": "12U", "scores": {"40m_dash": 5.0}},
        {"id": "mid", "age_group": "12U", "scores": {"40m_dash": 6.0}},
        {"id": "slow", "age_group": "12U", "scores": {"40m_dash": 7.0}},
    ]

    metrics = build_canonical_drill_metrics_for_cohort(players, football)

    assert _metric(metrics, "fast", "40m_dash").get("drill_star_count") == 5
    assert _metric(metrics, "slow", "40m_dash").get("drill_star_count") < 5


def test_single_comparable_drill_score_does_not_get_stars():
    football = SchemaRegistry.get_schema("football")
    players = [
        {"id": "only", "age_group": "12U", "scores": {"catching": 0}},
        {"id": "missing", "age_group": "12U", "scores": {}},
    ]

    metrics = build_canonical_drill_metrics_for_cohort(players, football)
    assert _metric(metrics, "only", "catching") == {}
