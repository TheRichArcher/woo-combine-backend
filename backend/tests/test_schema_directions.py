from backend.services.schema_registry import SchemaRegistry


def test_football_timed_drills_are_lower_is_better():
    football = SchemaRegistry.get_schema("football")
    assert football is not None

    drills_by_key = {drill.key: drill for drill in football.drills}

    assert drills_by_key["40m_dash"].lower_is_better is True
    assert drills_by_key["agility"].lower_is_better is True
