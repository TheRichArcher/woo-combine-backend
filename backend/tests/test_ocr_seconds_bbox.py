from dataclasses import dataclass

from backend.utils.ocr import OCRProcessor


@dataclass
class V:
    x: int
    y: int


@dataclass
class BP:
    vertices: list[V]


@dataclass
class Ann:
    description: str
    bounding_poly: BP


def _ann(desc: str, x0: int, y0: int, x1: int, y1: int) -> Ann:
    # rectangle bbox
    return Ann(
        description=desc,
        bounding_poly=BP(
            vertices=[V(x0, y0), V(x1, y0), V(x1, y1), V(x0, y1)],
        ),
    )


def test_pick_largest_seconds_parses_decimal():
    anns = [
        {"description": "07.13"},
        _ann("07.13", 0, 0, 200, 100),
    ]
    val, candidates, _ = OCRProcessor.pick_largest_seconds_from_text_annotations(anns)
    assert val == 7.13
    assert candidates == [7.13]


def test_pick_largest_seconds_parses_compact_digits():
    anns = [
        {"description": "0713"},
        _ann("0713", 0, 0, 200, 100),
    ]
    val, candidates, _ = OCRProcessor.pick_largest_seconds_from_text_annotations(anns)
    assert val == 7.13
    assert candidates == [7.13]


def test_pick_largest_seconds_parses_colon_as_decimal():
    anns = [
        {"description": "5:23"},
        _ann("5:23", 0, 0, 200, 100),
    ]
    val, candidates, _ = OCRProcessor.pick_largest_seconds_from_text_annotations(anns)
    assert val == 5.23
    assert candidates == [5.23]


def test_pick_largest_seconds_prefers_biggest_bbox_over_stray_digits():
    anns = [
        {"description": "NO. 02\n07.13s"},
        _ann("6", 0, 0, 20, 10),  # small stray
        _ann("07.13", 0, 0, 300, 120),  # big winner
        _ann("02", 10, 10, 40, 20),  # athlete number
    ]
    val, candidates, raw = OCRProcessor.pick_largest_seconds_from_text_annotations(anns)
    assert "NO. 02" in raw
    assert val == 7.13
    assert 7.13 in candidates


def test_pick_largest_seconds_ignores_athlete_number_with_suffix():
    anns = [
        {"description": "NO. 02\n07.13s"},
        _ann("NO.", 0, 0, 10, 10),
        _ann("02", 0, 0, 60, 20),
        _ann("07.13s", 0, 0, 200, 100),
    ]
    val, candidates, _ = OCRProcessor.pick_largest_seconds_from_text_annotations(anns)
    assert val == 7.13
    assert 2.0 in candidates  # still parsed, but should not win
    assert 7.13 in candidates
