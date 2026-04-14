from types import SimpleNamespace


def _seed_event(fake_db, event_id="event-1", league_id="league-1"):
    fake_db.collection("leagues").document(league_id).set({"name": "L"})
    fake_db.collection("events").document(event_id).set(
        {
            "name": "E",
            "league_id": league_id,
            "drillTemplate": "football",
            "disabled_drills": [],
        }
    )


def test_parse_import_rejects_unsupported_format(app_client, fake_db, organizer_headers):
    _seed_event(fake_db)

    files = {
        "file": ("data.txt", b"hello", "text/plain"),
    }
    r = app_client.post(
        "/api/events/event-1/parse-import",
        files=files,
        headers=organizer_headers,
    )
    assert r.status_code == 400


def test_parse_import_csv_happy_path(app_client, fake_db, monkeypatch, organizer_headers):
    _seed_event(fake_db)

    from backend.utils import importers

    monkeypatch.setattr(
        importers.DataImporter,
        "parse_csv",
        lambda content, event_id=None, disabled_drills=None: SimpleNamespace(
            valid_rows=[{"data": {"first_name": "P", "last_name": "1", "jersey_number": "1"}}],
            errors=[],
            detected_sport="football",
            confidence="high",
            sheets=[],
        ),
    )

    files = {
        "file": ("data.csv", b"name\nP1\n", "text/csv"),
    }

    r = app_client.post(
        "/api/events/event-1/parse-import",
        files=files,
        headers=organizer_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["summary"]["valid_count"] == 1
    assert body["summary"]["error_count"] == 0


def test_import_history_empty(app_client, fake_db, organizer_headers):
    _seed_event(fake_db)
    r = app_client.get("/api/events/event-1/history", headers=organizer_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
