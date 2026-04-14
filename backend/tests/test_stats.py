import io


def _seed_event(fake_db, event_id="event-1", league_id="league-1"):
    fake_db.collection("leagues").document(league_id).set({"name": "L"})
    fake_db.collection("events").document(event_id).set({"name": "E", "league_id": league_id})


def test_event_stats_endpoint(app_client, fake_db, monkeypatch, coach_headers):
    _seed_event(fake_db)

    import backend.routes.stats as stats_routes

    monkeypatch.setattr(stats_routes, "calculate_event_stats", lambda event_id: {"event_id": event_id, "players": 0})

    r = app_client.get("/api/events/event-1/stats", headers=coach_headers)
    assert r.status_code == 200
    assert r.json()["event_id"] == "event-1"


def test_export_pdf_endpoint(app_client, fake_db, monkeypatch, coach_headers):
    _seed_event(fake_db)

    import backend.routes.stats as stats_routes
    from backend.utils import pdf_generator

    monkeypatch.setattr(stats_routes, "calculate_event_stats", lambda event_id: {"event_id": event_id, "participant_count": 0, "drills": {}})
    monkeypatch.setattr(pdf_generator, "generate_event_pdf", lambda event, stats, players: io.BytesIO(b"%PDF-1.4\n"))

    r = app_client.get("/api/events/event-1/export-pdf", headers=coach_headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
