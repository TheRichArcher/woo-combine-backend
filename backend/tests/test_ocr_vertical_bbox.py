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


def test_pick_largest_inches_prefers_biggest_bbox():
    # text_annotations[0] is full text, others are tokens.
    anns = [
        {"description": "VERT\n13.6\"\n2.9\n1\n13.6\""},
        _ann('2.9', 10, 10, 30, 20),
        _ann('13.6"', 0, 0, 300, 120),  # big winner
        _ann('1', 5, 5, 15, 15),
        _ann('13.6"', 10, 200, 60, 220),  # smaller duplicate
    ]

    val, candidates, raw = OCRProcessor.pick_largest_inches_from_text_annotations(anns)
    assert raw.startswith("VERT")
    assert val == 13.6
    assert 13.6 in candidates


def test_pick_largest_inches_rejects_non_inches_tokens():
    anns = [
        {"description": "something"},
        _ann('Gs', 0, 0, 100, 100),
        _ann('2.9', 0, 0, 100, 100),
        _ann('250', 0, 0, 500, 500),  # out of plausible range
    ]
    val, candidates, _ = OCRProcessor.pick_largest_inches_from_text_annotations(anns)
    assert val == 2.9
    assert candidates == [2.9]
