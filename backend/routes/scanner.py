from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
import logging
import re

from ..auth import require_role
from ..middleware.rate_limiting import write_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_numbers(raw_text: str) -> list[float]:
    """Extract candidate numeric values from OCR text.

    Supports:
    - ints: 31
    - floats: 5.23
    - comma decimals: 5,23
    """
    if not raw_text:
        return []

    # Normalize common OCR variants
    # - decimal comma -> dot
    # - Unicode colon variants to ':'
    normalized = (
        raw_text.replace(",", ".")
        .replace("：", ":")
        .replace("﹕", ":")
        .replace("∶", ":")
    )

    numbers: list[float] = []

    # 1) Timer-style formats that OCR often returns using ':'
    # Examples:
    # - "5:23" -> 5.23 seconds (common for sprint timers)
    # - "0:05.23" or "0:05:23" -> 5.23 seconds
    # - "1:02.34" -> 62.34 seconds
    # Extract these first so we can prefer precise candidates.
    for m in re.findall(
        r"(?<!\d)(\d{1,2})\s*:\s*(\d{2})\s*(?:[\.:]\s*(\d{1,3}))?(?!\d)",
        normalized,
    ):
        try:
            minutes = int(m[0])
            seconds = int(m[1])
            frac = m[2]
            frac_val = int(frac) if frac else 0
            denom = 10 ** (len(frac) if frac else 0)
            total = minutes * 60 + seconds + (frac_val / denom if denom else 0.0)
            numbers.append(float(total))
        except Exception:
            continue

    # Pattern: S:FF where ':' is actually a decimal separator
    # Example: "5:23" => 5.23
    for m in re.findall(r"(?<!\d)(\d{1,2})\s*:\s*(\d{1,3})(?!\d)", normalized):
        try:
            whole = int(m[0])
            frac = m[1]
            frac_val = int(frac)
            denom = 10 ** len(frac)
            numbers.append(float(whole + frac_val / denom))
        except Exception:
            continue

    # 2) Plain ints/floats
    matches = re.findall(r"(?<!\d)(\d{1,4}(?:\.\d{1,3})?)(?!\d)", normalized)
    for m in matches:
        try:
            numbers.append(float(m))
        except Exception:
            continue

    return numbers


def _classify_drill(drill_type: str) -> str:
    k = (drill_type or "").lower().strip()

    if any(
        tok in k
        for tok in [
            "40",
            "dash",
            "shuttle",
            "cone",
            "3cone",
            "3-cone",
            "time",
            "sec",
            "seconds",
        ]
    ):
        return "seconds"

    if any(
        tok in k
        for tok in [
            "vert",
            "vertical",
            "broad",
            "jump",
            "height",
            "inch",
            "inches",
            "in",
        ]
    ):
        return "inches"

    return "score"


def _pick_best_value(numbers: list[float], drill_type: str) -> float | None:
    if not numbers:
        return None

    kind = _classify_drill(drill_type)

    # De-dup while preserving order
    seen = set()
    deduped: list[float] = []
    for n in numbers:
        if n in seen:
            continue
        seen.add(n)
        deduped.append(n)

    if kind == "seconds":
        candidates = [n for n in deduped if 0.5 < n < 60]
        if not candidates:
            return None
        decimals = [n for n in candidates if abs(n - round(n)) > 1e-6]
        pool = decimals or candidates
        return sorted(pool, key=lambda n: (abs(n - 6.0), n))[0]

    if kind == "inches":
        candidates = [n for n in deduped if 1 < n < 200]
        if not candidates:
            return None
        preferred = [n for n in candidates if abs(n * 2 - round(n * 2)) < 1e-6]
        pool = preferred or candidates
        return sorted(pool, key=lambda n: (abs(n - 30.0), n))[0]

    candidates = [n for n in deduped if 0 <= n < 10000]
    if not candidates:
        return None
    return candidates[0]


@router.post("/ocr", response_model=dict)
@write_rate_limit()
async def ocr_image(
    request: Request,
    image: UploadFile = File(...),
    drill_type: str = Form(...),
    current_user=Depends(require_role("organizer", "coach")),
):
    """OCR an uploaded image and extract the most likely numeric value."""

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an image.",
        )

    content = await image.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty image upload"
        )

    max_bytes = 10 * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image too large (max 10MB)",
        )

    try:
        from ..utils.ocr import OCRProcessor
        lines, confidence = OCRProcessor.extract_rows_from_image(content)
        raw_text = "\n".join(lines)
        numbers = _extract_numbers(raw_text)
        value = _pick_best_value(numbers, drill_type)

        return {
            "value": value,
            "confidence": float(confidence or 0.0),
            "raw_text": raw_text,
            "all_numbers": numbers,
        }
    except HTTPException:
        raise
    except Exception as e:
        # Graceful failure for bad photos/OCR issues
        logger.warning(f"[SCANNER] OCR failed: {e}")
        return {
            "value": None,
            "confidence": 0.0,
            "raw_text": "",
            "all_numbers": [],
        }
