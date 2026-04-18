from backend.tests.conftest import make_jwt


def _seed_event_and_player(fake_db):
    fake_db.collection("events").document("event-1").set(
        {"name": "E1", "league_id": "league-1", "created_at": "2024-01-01T00:00:00Z"}
    )
    fake_db.collection("events").document("event-1").collection("players").document("p1").set(
        {"name": "Player One", "forty": 4.5}
    )


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


def test_mobile_roster_allows_valid_member(app_client, fake_db, coach_headers):
    _seed_event_and_player(fake_db)
    r = app_client.get("/api/mobile/events/event-1/roster", headers=coach_headers)
    assert r.status_code == 200, r.text
    assert r.json()["event_id"] == "event-1"


def test_mobile_roster_blocks_non_member(app_client, fake_db):
    _seed_event_and_player(fake_db)
    uid = "outsider-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "outsider@example.com", "role": "viewer"}
    )
    token = make_jwt(uid=uid, email="outsider@example.com", email_verified=True)
    headers = {"Authorization": f"Bearer {token}"}

    r = app_client.get("/api/mobile/events/event-1/roster", headers=headers)
    assert r.status_code == 403, r.text


def test_mobile_roster_blocks_member_with_disallowed_role(app_client, fake_db):
    _seed_event_and_player(fake_db)
    uid = "player-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "player@example.com", "role": "player"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "player"}}}
    )
    token = make_jwt(uid=uid, email="player@example.com", email_verified=True)
    headers = {"Authorization": f"Bearer {token}"}

    r = app_client.get("/api/mobile/events/event-1/roster", headers=headers)
    assert r.status_code == 403, r.text


def test_mobile_batch_drill_results_allows_valid_staff_member(
    app_client, fake_db, coach_headers
):
    _seed_event_and_player(fake_db)
    payload = [
        {"player_id": "p1", "event_id": "event-1", "drill_key": "40m_dash", "value": 4.4}
    ]

    r = app_client.post(
        "/api/mobile/drill-results/batch", json=payload, headers=coach_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["submitted"] == 1

    updated = (
        fake_db.collection("events")
        .document("event-1")
        .collection("players")
        .document("p1")
        .get()
        .to_dict()
    )
    assert updated.get("40m_dash") == 4.4


def test_mobile_batch_drill_results_blocks_non_member_cross_event(app_client, fake_db):
    # User belongs to league-1, tries writing to event in league-2.
    _seed_event_and_player(fake_db)
    fake_db.collection("events").document("event-2").set(
        {"name": "E2", "league_id": "league-2", "created_at": "2024-01-01T00:00:00Z"}
    )
    fake_db.collection("events").document("event-2").collection("players").document("p2").set(
        {"name": "Player Two", "forty": 4.8}
    )

    uid = "coach-league1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach1@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach"}}}
    )
    token = make_jwt(uid=uid, email="coach1@example.com", email_verified=True)
    headers = {"Authorization": f"Bearer {token}"}
    payload = [
        {"player_id": "p2", "event_id": "event-2", "drill_key": "40m_dash", "value": 4.3}
    ]

    r = app_client.post("/api/mobile/drill-results/batch", json=payload, headers=headers)
    assert r.status_code == 403, r.text

    unchanged = (
        fake_db.collection("events")
        .document("event-2")
        .collection("players")
        .document("p2")
        .get()
        .to_dict()
    )
    assert unchanged.get("forty") == 4.8


def test_mobile_batch_drill_results_blocks_disallowed_role_member(app_client, fake_db):
    _seed_event_and_player(fake_db)
    uid = "viewer-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "viewer@example.com", "role": "viewer"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "viewer"}}}
    )
    token = make_jwt(uid=uid, email="viewer@example.com", email_verified=True)
    headers = {"Authorization": f"Bearer {token}"}
    payload = [
        {"player_id": "p1", "event_id": "event-1", "drill_key": "40m_dash", "value": 4.2}
    ]

    r = app_client.post("/api/mobile/drill-results/batch", json=payload, headers=headers)
    assert r.status_code == 403, r.text

    unchanged = (
        fake_db.collection("events")
        .document("event-1")
        .collection("players")
        .document("p1")
        .get()
        .to_dict()
    )
    assert unchanged.get("forty") == 4.5
