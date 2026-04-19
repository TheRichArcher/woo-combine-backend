def _seed_event(fake_db, event_id="event-1", league_id="league-1"):
    fake_db.collection("leagues").document(league_id).set({"name": "L"})
    fake_db.collection("events").document(event_id).set(
        {"name": "E", "league_id": league_id, "created_at": "2024-01-01T00:00:00Z"}
    )


def test_create_and_update_player(app_client, fake_db, coach_headers):
    _seed_event(fake_db, event_id="event-1")

    r = app_client.post(
        "/api/players?event_id=event-1",
        json={"name": "Ada Lovelace", "number": 12, "age_group": "U12"},
        headers=coach_headers,
    )
    assert r.status_code == 200, r.text
    player_id = r.json()["id"]

    # Stored under /events/{event}/players/{id}
    doc = (
        fake_db.collection("events")
        .document("event-1")
        .collection("players")
        .document(player_id)
        .get()
    )
    assert doc.exists
    assert doc.to_dict()["name"] == "Ada Lovelace"

    r2 = app_client.put(
        f"/api/players/{player_id}?event_id=event-1",
        json={"name": "Ada L.", "number": 12, "age_group": "U12"},
        headers=coach_headers,
    )
    assert r2.status_code == 200


def test_update_player_404(app_client, fake_db, coach_headers):
    _seed_event(fake_db, event_id="event-1")
    r = app_client.put(
        "/api/players/missing?event_id=event-1",
        json={"name": "X", "number": 1},
        headers=coach_headers,
    )
    assert r.status_code == 404


def test_list_league_players_endpoint(app_client, fake_db, coach_headers):
    # league players live under /leagues/{league}/players
    fake_db.collection("leagues").document("league-1").set({"name": "L"})
    fake_db.collection("leagues").document("league-1").collection("players").document("p1").set(
        {"name": "Player 1", "created_at": "2024-01-01T00:00:00Z"}
    )

    r = app_client.get("/api/leagues/league-1/players", headers=coach_headers)
    assert r.status_code == 200
    assert any(p.get("id") == "p1" for p in r.json().get("players", []))


def test_create_player_requires_verified_email(app_client, fake_db):
    from backend.tests.conftest import make_jwt

    _seed_event(fake_db, event_id="event-1")
    uid = "coach-unverified-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach-unverified@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach", "coach_event_ids": ["event-1"]}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='coach-unverified@example.com', email_verified=False)}"
    }

    response = app_client.post(
        "/api/players?event_id=event-1",
        json={"name": "Unverified Coach", "number": 8, "age_group": "U12"},
        headers=headers,
    )
    assert response.status_code == 403, response.text


def test_get_players_prefers_scores_map_over_legacy_flat_fields(app_client, fake_db, coach_headers):
    _seed_event(fake_db, event_id="event-1")
    fake_db.collection("events").document("event-1").collection("players").document("p1").set(
        {
            "name": "Player 1",
            "agility": 5.0,
            "scores": {"agility": 5.1},
        }
    )

    response = app_client.get("/api/players?event_id=event-1", headers=coach_headers)
    assert response.status_code == 200, response.text
    players = response.json()
    player = next(p for p in players if p["id"] == "p1")
    assert player["agility"] == 5.1


def test_league_player_create_requires_organizer_scope(app_client, fake_db, coach_headers):
    fake_db.collection("leagues").document("league-1").set({"name": "League"})
    response = app_client.post(
        "/api/leagues/league-1/players",
        json={"name": "League Scoped Player"},
        headers=coach_headers,
    )
    assert response.status_code == 403, response.text
