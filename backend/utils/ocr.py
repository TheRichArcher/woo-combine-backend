import os
import json
import logging
import re
from typing import Any, List, Tuple


logger = logging.getLogger(__name__)

_vision_client = None


def _import_vision():
    try:
        from google.cloud import vision  # type: ignore
        from google.oauth2 import service_account  # type: ignore
        return vision, service_account
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "google-cloud-vision is not installed/configured in this environment"
        ) from e


def get_vision_client():
    global _vision_client
    if _vision_client:
        return _vision_client

    try:
        # Try to load from env var JSON similar to firestore_client
        creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        if creds_json:
            try:
                cred_dict = json.loads(creds_json)
                vision, service_account = _import_vision()
                credentials = service_account.Credentials.from_service_account_info(
                    cred_dict
                )
                _vision_client = vision.ImageAnnotatorClient(credentials=credentials)
                logger.info("[OCR] Initialized Vision client with JSON credentials")
                return _vision_client
            except json.JSONDecodeError:
                logger.warning(
                    "[OCR] Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON"
                )

        # Fallback to default environment (GOOGLE_APPLICATION_CREDENTIALS file path or GCE metadata)
        vision, _ = _import_vision()
        _vision_client = vision.ImageAnnotatorClient()
        logger.info("[OCR] Initialized Vision client with default credentials")
        return _vision_client

    except Exception as e:
        logger.error(f"[OCR] Failed to initialize Vision client: {e}")
        return None


class OCRProcessor:
    @staticmethod
    def _get_attr(obj: Any, name: str, default=None):
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(name, default)
        return getattr(obj, name, default)

    @staticmethod
    def _vertices_to_bbox(
        vertices: list[Any],
    ) -> tuple[float, float, float, float] | None:
        """Return (min_x, min_y, max_x, max_y) from Vision vertices."""
        if not vertices:
            return None
        xs: list[float] = []
        ys: list[float] = []
        for v in vertices:
            x = OCRProcessor._get_attr(v, "x", None)
            y = OCRProcessor._get_attr(v, "y", None)
            if x is None or y is None:
                continue
            xs.append(float(x))
            ys.append(float(y))
        if not xs or not ys:
            return None
        return (min(xs), min(ys), max(xs), max(ys))

    @staticmethod
    def _bbox_area_from_annotation(annotation: Any) -> float:
        bp = OCRProcessor._get_attr(annotation, "bounding_poly", None)
        vertices = OCRProcessor._get_attr(bp, "vertices", None)
        if vertices is None and isinstance(bp, dict):
            vertices = bp.get("vertices")
        bbox = OCRProcessor._vertices_to_bbox(vertices or [])
        if not bbox:
            return 0.0
        min_x, min_y, max_x, max_y = bbox
        w = max(0.0, max_x - min_x)
        h = max(0.0, max_y - min_y)
        return w * h

    @staticmethod
    def _parse_inches_token(token: str) -> float | None:
        """Parse a token like 13.6, 13.6" or 13.6in into a float."""
        if not token:
            return None
        t = token.strip().lower()
        m = re.match(r"^(\d{1,3}(?:\.\d{1,2})?)\s*(?:\"|in)?$", t)
        if not m:
            return None
        try:
            return float(m.group(1))
        except Exception:
            return None

    @staticmethod
    def _parse_seconds_token(token: str) -> float | None:
        """Parse a token into seconds.

        Supports common OCR outputs for sprint timers:
        - "07.13", "7.13"
        - "5:23" (colon-as-decimal)
        - "0713" or "523" (SKLZ compact digits => 7.13 / 5.23)
        - plain numbers: "6"
        """
        if not token:
            return None

        t = str(token).strip()
        if not t:
            return None

        # Normalize common OCR punctuation variants
        t = (
            t.replace(",", ".")
            .replace("：", ":")
            .replace("﹕", ":")
            .replace("∶", ":")
        )
        t = re.sub(r"\s+", "", t)
        t = t.lower()

        # Drop leading/trailing non-numeric chars, but keep digits/./:
        t = re.sub(r"^[^0-9]+", "", t)
        t = re.sub(r"[^0-9\.:]+$", "", t)

        if not t:
            return None

        # Decimal seconds
        m = re.match(r"^(\d{1,2})\.(\d{1,3})$", t)
        if m:
            try:
                return float(f"{int(m.group(1))}.{m.group(2)}")
            except Exception:
                return None

        # Colon as decimal separator (common in sprint timer OCR)
        m = re.match(r"^(\d{1,2}):(\d{1,3})$", t)
        if m:
            try:
                whole = int(m.group(1))
                frac = m.group(2)
                frac_val = int(frac)
                denom = 10 ** len(frac)
                return float(whole + frac_val / denom)
            except Exception:
                return None

        # SKLZ compact digits: 3-4 digits => split last 2 as decimals
        m = re.match(r"^(\d{3,4})$", t)
        if m:
            d = m.group(1)
            try:
                return float(f"{int(d[:-2])}.{d[-2:]}")
            except Exception:
                return None

        # Plain integer seconds
        m = re.match(r"^(\d{1,2})$", t)
        if m:
            try:
                return float(int(m.group(1)))
            except Exception:
                return None

        return None

    @staticmethod
    def pick_largest_inches_from_text_annotations(
        text_annotations: list[Any],
    ) -> tuple[float | None, list[float], str]:
        """Pick the largest (by bbox area) plausible inches value from Vision text_annotations.

        Returns (value, all_candidates, raw_text).
        """
        if not text_annotations:
            return None, [], ""

        raw_text = (
            OCRProcessor._get_attr(text_annotations[0], "description", "") or ""
        ).strip()

        scored: list[tuple[float, float]] = []  # (area, value)
        all_candidates: list[float] = []

        # Skip index 0 which is full text; per-token annotations start at 1.
        for ann in text_annotations[1:]:
            desc = OCRProcessor._get_attr(ann, "description", "")
            if not desc:
                continue
            val = OCRProcessor._parse_inches_token(str(desc))
            if val is None:
                continue
            if not (1.0 < val < 120.0):
                continue
            area = OCRProcessor._bbox_area_from_annotation(ann)
            all_candidates.append(val)
            scored.append((area, val))

        if not scored:
            return None, all_candidates, raw_text

        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return scored[0][1], all_candidates, raw_text

    @staticmethod
    def pick_largest_seconds_from_text_annotations(
        text_annotations: list[Any],
    ) -> tuple[float | None, list[float], str]:
        """Pick the largest (by bbox area) plausible seconds value from Vision text_annotations.

        Returns (value, all_candidates, raw_text).
        """
        if not text_annotations:
            return None, [], ""

        raw_text = (
            OCRProcessor._get_attr(text_annotations[0], "description", "") or ""
        ).strip()

        scored: list[tuple[float, float]] = []  # (area, value)
        all_candidates: list[float] = []

        # Skip index 0 which is full text; per-token annotations start at 1.
        for ann in text_annotations[1:]:
            desc = OCRProcessor._get_attr(ann, "description", "")
            if not desc:
                continue
            val = OCRProcessor._parse_seconds_token(str(desc))
            if val is None:
                continue
            if not (0.5 < val < 60.0):
                continue
            area = OCRProcessor._bbox_area_from_annotation(ann)
            all_candidates.append(val)
            scored.append((area, val))

        if not scored:
            return None, all_candidates, raw_text

        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return scored[0][1], all_candidates, raw_text

    @staticmethod
    def extract_rows_from_image(content: bytes) -> Tuple[List[str], float]:
        """Extract text from image bytes.

        Returns (list of text lines, confidence score).

        Note: This implementation intentionally has **no** local/Tesseract fallback.
        Google Vision must be configured in the runtime environment.
        """
        client = get_vision_client()
        if not client:
            raise RuntimeError("Google Vision API client not available")

        vision, _ = _import_vision()
        image = vision.Image(content=content)

        # 1) document_text_detection tends to work best for dense/structured text.
        response = client.document_text_detection(image=image)
        if response.error.message:
            raise RuntimeError(f"OCR Error: {response.error.message}")

        full_text = (response.full_text_annotation.text or "").strip()

        # Estimate confidence from pages -> blocks -> paragraphs -> words
        total_conf = 0.0
        count = 0
        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        total_conf += float(word.confidence or 0.0)
                        count += 1
        confidence = (total_conf / count) if count > 0 else 0.0

        if full_text:
            lines = [line.strip() for line in full_text.split("\n") if line.strip()]
            if lines:
                return lines, float(confidence)

        # 2) If document text came back empty, fall back to plain text_detection.
        # This can sometimes do better for simple LED digits / sparse text.
        response2 = client.text_detection(image=image)
        if response2.error.message:
            raise RuntimeError(f"OCR Error: {response2.error.message}")

        # text_annotations[0] contains the full text for the image.
        if response2.text_annotations:
            text = (response2.text_annotations[0].description or "").strip()
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            if lines:
                # The API doesn't provide per-word confidences here in the same way.
                return lines, 0.0

        raise RuntimeError("OCR produced no text")

    @staticmethod
    def extract_text_annotations_from_image(content: bytes) -> list[Any]:
        """Return Google Vision text_annotations for an image."""
        client = get_vision_client()
        if not client:
            raise RuntimeError("Google Vision API client not available")

        vision, _ = _import_vision()
        image = vision.Image(content=content)
        response = client.text_detection(image=image)
        if response.error.message:
            raise RuntimeError(f"OCR Error: {response.error.message}")
        return list(response.text_annotations or [])

    @staticmethod
    def extract_largest_inches_value_from_image(
        content: bytes,
    ) -> tuple[float | None, float, str, list[float]]:
        """Best-effort inches OCR for vertical leap.

        Uses Vision's text_annotations bounding boxes and selects the candidate with the
        largest bbox area.
        """
        anns = OCRProcessor.extract_text_annotations_from_image(content)
        value, candidates, raw_text = OCRProcessor.pick_largest_inches_from_text_annotations(
            anns
        )
        return value, 0.0, raw_text, candidates

    @staticmethod
    def extract_largest_seconds_value_from_image(
        content: bytes,
    ) -> tuple[float | None, float, str, list[float]]:
        """Best-effort seconds OCR for timed drills.

        Uses document_text_detection which groups characters into proper words
        (critical for LED/digital displays where text_detection splits digits).
        Selects the word-level candidate with the largest bounding box area.
        Returns real per-word confidence instead of 0.0.
        """
        client = get_vision_client()
        if not client:
            raise RuntimeError("Google Vision API client not available")

        vision, _ = _import_vision()
        image = vision.Image(content=content)

        response = client.document_text_detection(image=image)
        if response.error.message:
            raise RuntimeError(f"OCR Error: {response.error.message}")

        raw_text = (response.full_text_annotation.text or "").strip()

        scored: list[tuple[float, float, float]] = []  # (area, value, confidence)
        all_candidates: list[float] = []

        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        # Reconstruct word text from symbols
                        word_text = "".join(
                            s.text for s in word.symbols if s.text
                        )
                        if not word_text:
                            continue

                        val = OCRProcessor._parse_seconds_token(word_text)
                        if val is None:
                            continue
                        if not (0.5 < val < 60.0):
                            continue

                        # Word-level bounding box area
                        bbox = OCRProcessor._vertices_to_bbox(
                            word.bounding_box.vertices if word.bounding_box else []
                        )
                        area = 0.0
                        if bbox:
                            w = max(0.0, bbox[2] - bbox[0])
                            h = max(0.0, bbox[3] - bbox[1])
                            area = w * h

                        word_conf = float(word.confidence or 0.0)
                        all_candidates.append(val)
                        scored.append((area, val, word_conf))

        if not scored:
            # Fallback to text_annotations approach
            anns = OCRProcessor.extract_text_annotations_from_image(content)
            value, candidates, _ = OCRProcessor.pick_largest_seconds_from_text_annotations(anns)
            return value, 0.0, raw_text, candidates

        # Pick largest bbox
        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        best_area, best_val, best_conf = scored[0]
        return best_val, best_conf, raw_text, all_candidates

    def lines_to_csv_string(lines: List[str]) -> str:
        """
        Convert OCR lines to a CSV-like string.
        Attempt to detect column separators (large spaces) or just comma-separate words.
        For MVP, we'll assume the user's whiteboard/sheet has some spacing.
        Replacing 2+ spaces with a comma is a common heuristic for OCR tables.
        """
        csv_lines = []
        for line in lines:
            # Heuristic: If there are multiple spaces, treat as delimiter
            # or if there are tabs.
            # We'll replace sequences of 2+ spaces with a comma
            import re

            csv_line = re.sub(r"\s{2,}", ",", line)
            csv_lines.append(csv_line)

        return "\n".join(csv_lines)
