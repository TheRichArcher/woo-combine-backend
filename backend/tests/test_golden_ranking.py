from backend.routes.players import calculate_composite_score
from backend.schemas import SportSchema, DrillDefinition

def test_golden_ranking_evan():
    """
    Verify ranking calculation matches the "Golden Example" (Evan).
    Schema: Basketball (custom active weights summing to 0.75)
    Policy: Renormalize to 100.
    """
    # 1. Define Golden Schema
    # Active drills sum to 0.75
    schema = SportSchema(
        id="basketball_test",
        sport="Basketball",
        name="Test",
        description="Test",
        drills=[
            DrillDefinition(key="free_throws", label="FT", unit="%", category="shooting", min_value=0.0, max_value=100.0, default_weight=0.20),
            DrillDefinition(key="three_point", label="3PT", unit="%", category="shooting", min_value=0.0, max_value=100.0, default_weight=0.20),
            DrillDefinition(key="vertical_jump", label="VJ", unit="in", category="power", min_value=0.0, max_value=50.0, default_weight=0.20),
            DrillDefinition(key="lane_agility", label="LA", unit="s", category="agility", min_value=8.0, max_value=20.0, lower_is_better=True, default_weight=0.15),
            # Disabled drills (dribbling, defensive_slide) omitted for this test to match "active drills"
        ]
    )

    # 2. Define Golden Player Data
    player_data = {
        "free_throws": 95.0,
        "three_point": 64.0,
        "vertical_jump": 40.0,
        "lane_agility": 12.26
    }

    # 3. Calculate
    score = calculate_composite_score(player_data, schema=schema)

    # 4. Assert
    # Expected: 76.63
    print(f"Computed Score: {score}")
    assert score == 76.63, f"Expected 76.63, got {score}"




