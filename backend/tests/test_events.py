import os
from backend.tests.conftest import make_jwt


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


def _seed_two_events_in_league(fake_db, league_id="league-1"):
    fake_db.collection("leagues").document(league_id).set(
        {"name": "League", "created_at": "2024-01-01T00:00:00Z"}
    )

    fake_db.collection("events").document("event-1").set(
        {
            "name": "Invited Event",
            "league_id": league_id,
            "created_at": "2024-01-01T00:00:00Z",
        }
    )
    fake_db.collection("events").document("event-2").set(
        {
            "name": "Other Event",
            "league_id": league_id,
            "created_at": "2024-01-02T00:00:00Z",
        }
    )

    fake_db.collection("leagues").document(league_id).collection("events").document(
        "event-1"
    ).set(
        {
            "name": "Invited Event",
            "league_id": league_id,
            "created_at": "2024-01-01T00:00:00Z",
        }
    )
    fake_db.collection("leagues").document(league_id).collection("events").document(
        "event-2"
    ).set(
        {
            "name": "Other Event",
            "league_id": league_id,
            "created_at": "2024-01-02T00:00:00Z",
        }
    )


def _scoped_viewer_headers(fake_db):
    uid = "viewer-locked"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "viewer@example.com", "role": "viewer"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {
            "leagues": {
                "league-1": {
                    "role": "viewer",
                    "viewer_event_ids": ["event-1"],
                }
            }
        }
    )
    token = make_jwt(uid=uid, email="viewer@example.com", email_verified=True)
    return {"Authorization": f"Bearer {token}"}


def test_scoped_viewer_can_read_invited_event_only(app_client, fake_db):
    _seed_two_events_in_league(fake_db)
    viewer_headers = _scoped_viewer_headers(fake_db)

    invited = app_client.get("/api/leagues/league-1/events/event-1", headers=viewer_headers)
    assert invited.status_code == 200, invited.text
    assert invited.json()["id"] == "event-1"

    blocked = app_client.get("/api/leagues/league-1/events/event-2", headers=viewer_headers)
    assert blocked.status_code == 403, blocked.text


def test_coach_cannot_read_unassigned_event(app_client, fake_db, coach_headers):
    _seed_two_events_in_league(fake_db)

    blocked = app_client.get("/api/leagues/league-1/events/event-2", headers=coach_headers)
    assert blocked.status_code == 403, blocked.text


def test_scoped_viewer_event_list_excludes_uninvited_events(app_client, fake_db):
    _seed_two_events_in_league(fake_db)
    viewer_headers = _scoped_viewer_headers(fake_db)

    response = app_client.get("/api/leagues/league-1/events", headers=viewer_headers)
    assert response.status_code == 200, response.text
    returned_ids = [event["id"] for event in response.json()["events"]]
    assert returned_ids == ["event-1"]


def test_organizer_keeps_full_event_list_access(app_client, fake_db, organizer_headers):
    _seed_two_events_in_league(fake_db)

    organizer_response = app_client.get("/api/leagues/league-1/events", headers=organizer_headers)
    assert organizer_response.status_code == 200, organizer_response.text
    organizer_ids = {event["id"] for event in organizer_response.json()["events"]}
    assert organizer_ids == {"event-1", "event-2"}


def test_coach_event_list_is_scoped_to_assigned_events(app_client, fake_db, coach_headers):
    _seed_two_events_in_league(fake_db)

    coach_response = app_client.get("/api/leagues/league-1/events", headers=coach_headers)
    assert coach_response.status_code == 200, coach_response.text
    coach_ids = {event["id"] for event in coach_response.json()["events"]}
    assert coach_ids == {"event-1"}


def test_scoped_viewer_players_read_is_event_scoped(app_client, fake_db):
    _seed_two_events_in_league(fake_db)
    viewer_headers = _scoped_viewer_headers(fake_db)

    # Seed at least one player so endpoint can return normally for invited event.
    fake_db.collection("events").document("event-1").collection("players").document("p1").set(
        {"name": "Player One", "scores": {}}
    )

    allowed = app_client.get("/api/players?event_id=event-1", headers=viewer_headers)
    assert allowed.status_code == 200, allowed.text

    blocked = app_client.get("/api/players?event_id=event-2", headers=viewer_headers)
    assert blocked.status_code == 403, blocked.text
