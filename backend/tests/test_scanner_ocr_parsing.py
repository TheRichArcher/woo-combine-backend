from backend.routes.scanner import _extract_numbers, _pick_best_value


def test_extract_numbers_timer_colon_decimal():
    nums = _extract_numbers("TIME 5:23")
    # Can interpret as 5.23 seconds OR 5 minutes 23 seconds depending on regex order.
    # Our extractor may include both; ensure at least one expected candidate exists.
    assert any(abs(n - 5.23) < 1e-6 for n in nums)


def test_extract_numbers_plain_decimal():
    nums = _extract_numbers("5.17")
    assert nums == [5.17]


def test_pick_best_value_seconds_prefers_decimals_in_range():
    nums = [517.0, 5.17, 31.0, 0.2]
    val = _pick_best_value(nums, drill_type="40 yard dash")
    assert abs(val - 5.17) < 1e-6


def test_pick_best_value_inch_jump():
    nums = [7.12, 30.0, 31.5, 300.0]
    val = _pick_best_value(nums, drill_type="Broad Jump")
    assert val in (30.0, 31.5)

