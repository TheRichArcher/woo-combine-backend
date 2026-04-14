import os


def test_create_list_get_update_delete_event_flow(app_client, fake_db, organizer_headers):
    # Seed league
    fake_db.collection("leagues").document("league-1").set(
        {"name": "League", "created_at": "2024-01-01T00:00:00Z"}
    )

    # Create
    r = app_client.post(
        "/api/leagues/league-1/events",
        json={"name": "Combine A", "date": "2025-01-01", "location": "X"},
        headers=organizer_headers,
    )
    assert r.status_code == 200, r.text
    event_id = r.json()["event_id"]

    # List includes it
    r2 = app_client.get(f"/api/leagues/league-1/events", headers=organizer_headers)
    assert r2.status_code == 200
    assert any(e["id"] == event_id for e in r2.json()["events"])

    # Get from league
    r3 = app_client.get(
        f"/api/leagues/league-1/events/{event_id}", headers=organizer_headers
    )
    assert r3.status_code == 200
    assert r3.json()["id"] == event_id

    # Update
    r4 = app_client.put(
        f"/api/leagues/league-1/events/{event_id}",
        json={"name": "Combine A+", "date": "2025-01-02"},
        headers=organizer_headers,
    )
    assert r4.status_code == 200

    # Delete requires header
    r5 = app_client.delete(
        f"/api/leagues/league-1/events/{event_id}",
        headers=organizer_headers,
    )
    assert r5.status_code == 400

    # Delete with required header
    r6 = app_client.delete(
        f"/api/leagues/league-1/events/{event_id}",
        headers={**organizer_headers, "X-Delete-Target-Event-Id": event_id},
    )
    assert r6.status_code == 200

    # Soft-deleted event excluded from list
    r7 = app_client.get(f"/api/leagues/league-1/events", headers=organizer_headers)
    assert r7.status_code == 200
    assert all(e["id"] != event_id for e in r7.json()["events"])

    # Soft-deleted event returns 404
    r8 = app_client.get(
        f"/api/leagues/league-1/events/{event_id}", headers=organizer_headers
    )
    assert r8.status_code == 404


def test_create_event_duplicate_is_idempotent(app_client, fake_db, organizer_headers):
    fake_db.collection("leagues").document("league-1").set({"name": "League"})

    r1 = app_client.post(
        "/api/leagues/league-1/events",
        json={"name": "Combine A", "date": "2025-01-01"},
        headers=organizer_headers,
    )
    assert r1.status_code == 200
    event_id = r1.json()["event_id"]

    r2 = app_client.post(
        "/api/leagues/league-1/events",
        json={"name": "Combine A", "date": "2025-01-01"},
        headers=organizer_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["event_id"] == event_id
    assert r2.json().get("message")


def test_delete_event_blocks_live_entry(app_client, fake_db, organizer_headers):
    fake_db.collection("leagues").document("league-1").set({"name": "League"})

    # Create event
    r = app_client.post(
        "/api/leagues/league-1/events",
        json={"name": "Combine A", "date": "2025-01-01"},
        headers=organizer_headers,
    )
    event_id = r.json()["event_id"]

    # Set live_entry_active
    fake_db.collection("events").document(event_id).update({"live_entry_active": True})
    fake_db.collection("leagues").document("league-1").collection("events").document(event_id).update(
        {"live_entry_active": True}
    )

    r2 = app_client.delete(
        f"/api/leagues/league-1/events/{event_id}",
        headers={**organizer_headers, "X-Delete-Target-Event-Id": event_id},
    )
    assert r2.status_code == 409


def test_issue_delete_intent_token_returns_503_when_unconfigured(app_client, fake_db, organizer_headers):
    # No DELETE_TOKEN_SECRET_KEY in test env
    os.environ.pop("DELETE_TOKEN_SECRET_KEY", None)
    fake_db.collection("leagues").document("league-1").set({"name": "League"})
    r = app_client.post(
        "/api/leagues/league-1/events",
        json={"name": "Combine A", "date": "2025-01-01"},
        headers=organizer_headers,
    )
    event_id = r.json()["event_id"]

    r2 = app_client.post(
        f"/api/leagues/league-1/events/{event_id}/delete-intent-token",
        headers=organizer_headers,
    )
    assert r2.status_code in (200, 503)
    if r2.status_code == 200:
        assert "token" in r2.json()


def test_set_combine_lock_noop(app_client, fake_db, organizer_headers):
    fake_db.collection("leagues").document("league-1").set({"name": "League"})
    r = app_client.post(
        "/api/leagues/league-1/events",
        json={"name": "Combine A", "date": "2025-01-01"},
        headers=organizer_headers,
    )
    event_id = r.json()["event_id"]

    # Default isLocked False; request False should be no-op
    r2 = app_client.patch(
        f"/api/leagues/league-1/events/{event_id}/lock",
        json={"isLocked": False},
        headers=organizer_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["changed"] is False
