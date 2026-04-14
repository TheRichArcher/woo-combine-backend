def test_scanner_ocr_rejects_non_image(app_client, coach_headers):
    r = app_client.post(
        "/api/scanner/ocr",
        files={"image": ("x.txt", b"nope", "text/plain")},
        data={"drill_type": "40yd"},
        headers=coach_headers,
    )
    assert r.status_code == 400


def test_scanner_ocr_success_picks_value(app_client, monkeypatch, coach_headers):
    from backend.utils import ocr as ocr_mod

    class FakeOCR:
        @staticmethod
        def extract_rows_from_image(content):
            return (["40yd 5.21"], 0.9)

    monkeypatch.setattr(ocr_mod, "OCRProcessor", FakeOCR)

    r = app_client.post(
        "/api/scanner/ocr",
        files={"image": ("x.png", b"fake", "image/png")},
        data={"drill_type": "40yd"},
        headers=coach_headers,
    )
    assert r.status_code == 200
    assert r.json()["value"] == 5.21
