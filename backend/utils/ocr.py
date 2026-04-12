import os
import json
import logging
from typing import List, Tuple

from google.cloud import vision
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

_vision_client = None


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
        _vision_client = vision.ImageAnnotatorClient()
        logger.info("[OCR] Initialized Vision client with default credentials")
        return _vision_client

    except Exception as e:
        logger.error(f"[OCR] Failed to initialize Vision client: {e}")
        return None


class OCRProcessor:
    @staticmethod
    def extract_rows_from_image(content: bytes) -> Tuple[List[str], float]:
        """
        Extract text from image bytes.
        Returns (list of text lines, confidence score).
        """
        # Primary: Google Vision (best accuracy when configured)
        try:
            client = get_vision_client()
            if not client:
                raise RuntimeError("Google Vision API client not available")

            image = vision.Image(content=content)

            # Use document text detection for better density/handwriting support
            response = client.document_text_detection(image=image)

            if response.error.message:
                raise RuntimeError(f"OCR Error: {response.error.message}")

            full_text = response.full_text_annotation.text

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

            lines = [line.strip() for line in full_text.split("\n") if line.strip()]
            if lines:
                return lines, float(confidence)
        except Exception as e:
            logger.warning(f"[OCR] Google Vision failed, falling back to Tesseract: {e}")

        # Fallback: local Tesseract OCR
        # This keeps the feature working even if Vision API is not enabled/authorized in prod.
        try:
            from io import BytesIO

            from PIL import Image  # type: ignore
            import pytesseract  # type: ignore

            img = Image.open(BytesIO(content))
            # Basic pre-processing helps with LED timer displays.
            # - convert to grayscale
            # - increase contrast via simple point transform (cheap)
            gray = img.convert("L")

            # Clamp to emphasize bright digits on dark background.
            bw = gray.point(lambda p: 255 if p > 160 else 0)

            config = "--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789:."
            text = pytesseract.image_to_string(bw, config=config) or ""
            lines = [line.strip() for line in text.split("\n") if line.strip()]

            # Tesseract doesn't provide reliable per-line confidence without extra calls.
            # Use a conservative non-zero value so the UI can show "low confidence" instead of 0%.
            confidence = 0.35 if lines else 0.0
            return lines, confidence
        except Exception as e:
            logger.error(f"[OCR] Tesseract fallback failed: {e}")
            raise

    @staticmethod
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
