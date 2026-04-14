def test_mobile_health(app_client):
    r = app_client.get("/api/mobile/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_mobile_combines_lists_events(app_client, fake_db, coach_headers):
    # Membership already set for coach-1 -> league-1
    fake_db.collection("leagues").document("league-1").set({"name": "L"})
    fake_db.collection("leagues").document("league-1").collection("events").document("event-1").set(
        {"name": "E1", "created_at": "2024-01-01T00:00:00Z"}
    )

    r = app_client.get("/api/mobile/combines", headers=coach_headers)
    assert r.status_code == 200, r.text
    combines = r.json().get("combines")
    assert isinstance(combines, list)
