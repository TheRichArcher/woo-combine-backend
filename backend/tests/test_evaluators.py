def _seed_event_and_player(fake_db, event_id="event-1", league_id="league-1", player_id="p1"):
    fake_db.collection("leagues").document(league_id).set({"name": "L"})
    fake_db.collection("events").document(event_id).set({"name": "E", "league_id": league_id})
    fake_db.collection("events").document(event_id).collection("players").document(player_id).set(
        {"name": "Player"}
    )


def test_add_and_list_evaluators(app_client, fake_db, coach_headers):
    _seed_event_and_player(fake_db)

    r = app_client.post(
        "/api/events/event-1/evaluators",
        json={"name": "Evaluator 1", "email": "e1@example.com", "role": "evaluator"},
        headers=coach_headers,
    )
    assert r.status_code == 200, r.text

    r2 = app_client.get("/api/events/event-1/evaluators", headers=coach_headers)
    assert r2.status_code == 200
    assert any(e.get("name") == "Evaluator 1" for e in r2.json())


def test_submit_and_get_player_evaluations(app_client, fake_db, coach_headers):
    _seed_event_and_player(fake_db)

    # Create evaluator
    app_client.post(
        "/api/events/event-1/evaluators",
        json={"name": "Evaluator 1", "email": "e1@example.com", "role": "evaluator"},
        headers=coach_headers,
    )

    r = app_client.post(
        "/api/events/event-1/evaluations",
        json={
            "player_id": "p1",
            "drill_type": "40m_dash",
            "value": 5.3,
            "notes": "ok",
        },
        headers=coach_headers,
    )
    assert r.status_code == 200, r.text

    r2 = app_client.get(
        "/api/events/event-1/players/p1/evaluations", headers=coach_headers
    )
    assert r2.status_code == 200
    # Evaluations endpoint returns a dict keyed by drill type
    body = r2.json()
    assert isinstance(body, dict)
    assert "40m_dash" in body
    assert len(body["40m_dash"]) >= 1


def test_evaluator_unauth_returns_401(app_client, fake_db):
    _seed_event_and_player(fake_db)
    r = app_client.get("/api/events/event-1/evaluators")
    assert r.status_code in (401, 403)
