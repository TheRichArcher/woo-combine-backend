def test_batch_events_by_ids(app_client, fake_db, coach_headers):
    fake_db.collection("leagues").document("league-1").set({"name": "L"})
    fake_db.collection("events").document("event-1").set({"name": "E", "league_id": "league-1"})

    r = app_client.post(
        "/api/batch/events-by-ids",
        json={"event_ids": ["event-1", "missing"]},
        headers=coach_headers,
    )
    assert r.status_code == 200, r.text
    results = r.json()["results"]
    assert results["event-1"]["success"] is True
    assert results["missing"]["success"] is False
