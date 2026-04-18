def _seed_event(fake_db, event_id="event-1", league_id="league-1"):
    fake_db.collection("leagues").document(league_id).set({"name": "League"})
    fake_db.collection("events").document(event_id).set(
        {"name": "Scanner Event", "league_id": league_id, "created_at": "2024-01-01T00:00:00Z"}
    )


def test_scanner_ocr_rejects_non_image(app_client, fake_db, coach_headers):
    _seed_event(fake_db)
    r = app_client.post(
        "/api/scanner/ocr",
        files={"image": ("x.txt", b"nope", "text/plain")},
        data={"drill_type": "40yd", "event_id": "event-1"},
        headers=coach_headers,
    )
    assert r.status_code == 400


def test_scanner_ocr_success_picks_value(app_client, fake_db, monkeypatch, coach_headers):
    from backend.utils import ocr as ocr_mod

    _seed_event(fake_db)

    class FakeOCR:
        @staticmethod
        def extract_rows_from_image(content):
            return (["40yd 5.21"], 0.9)

    monkeypatch.setattr(ocr_mod, "OCRProcessor", FakeOCR)

    r = app_client.post(
        "/api/scanner/ocr",
        files={"image": ("x.png", b"fake", "image/png")},
        data={"drill_type": "40yd", "event_id": "event-1"},
        headers=coach_headers,
    )
    assert r.status_code == 200
    assert r.json()["value"] == 5.21


def test_scanner_ocr_requires_event_scope_membership(app_client, fake_db):
    from backend.tests.conftest import make_jwt

    _seed_event(fake_db, event_id="event-2", league_id="league-2")
    uid = "coach-unscoped-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach-unscoped@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach", "coach_event_ids": ["event-1"]}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='coach-unscoped@example.com', email_verified=True)}"
    }

    response = app_client.post(
        "/api/scanner/ocr",
        files={"image": ("x.png", b"fake", "image/png")},
        data={"drill_type": "40yd", "event_id": "event-2"},
        headers=headers,
    )

    assert response.status_code == 403, response.text
