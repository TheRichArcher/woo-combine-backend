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
