from types import SimpleNamespace


def _seed_event_and_player(fake_db, event_id="event-1", league_id="league-1", player_id="p1"):
    fake_db.collection("leagues").document(league_id).set({"name": "L"})
    fake_db.collection("events").document(event_id).set({"name": "E", "league_id": league_id})
    fake_db.collection("events").document(event_id).collection("players").document(player_id).set(
        {"name": "Player", "scores": {}}
    )


def _score_value(player_doc_dict, drill_key):
    return player_doc_dict.get(f"scores.{drill_key}") or player_doc_dict.get("scores", {}).get(drill_key)


def test_create_drill_result_validates_schema_and_updates_player(app_client, fake_db, monkeypatch, coach_headers):
    _seed_event_and_player(fake_db)

    import backend.routes.drills as drills_routes

    monkeypatch.setattr(
        drills_routes,
        "get_event_schema",
        lambda event_id: SimpleNamespace(
            id=event_id,
            name="E",
            sport="football",
            drills=[SimpleNamespace(key="40yd", unit="s", min_value=0, max_value=20)],
            presets=[],
        ),
    )

    r = app_client.post(
        "/api/drill-results/",
        json={"player_id": "p1", "type": "40yd", "value": 5.2, "event_id": "event-1"},
        headers=coach_headers,
    )
    assert r.status_code == 200, r.text

    # player scores updated
    pdoc = (
        fake_db.collection("events")
        .document("event-1")
        .collection("players")
        .document("p1")
        .get()
    )
    assert _score_value(pdoc.to_dict(), "40yd") == 5.2
    assert pdoc.to_dict().get("40yd") == 5.2


def test_delete_drill_result_404(app_client, fake_db, coach_headers):
    _seed_event_and_player(fake_db)
    r = app_client.delete(
        "/api/drill-results/missing?event_id=event-1&player_id=p1",
        headers=coach_headers,
    )
    assert r.status_code == 404


def test_list_and_update_drill_result(app_client, fake_db, monkeypatch, coach_headers):
    _seed_event_and_player(fake_db)

    import backend.routes.drills as drills_routes

    monkeypatch.setattr(
        drills_routes,
        "get_event_schema",
        lambda event_id: SimpleNamespace(
            id=event_id,
            name="E",
            sport="football",
            drills=[SimpleNamespace(key="40yd", unit="s", min_value=0, max_value=20)],
            presets=[],
        ),
    )

    created = app_client.post(
        "/api/drill-results/",
        json={"player_id": "p1", "type": "40yd", "value": 5.2, "event_id": "event-1"},
        headers=coach_headers,
    )
    assert created.status_code == 200, created.text
    result_id = created.json().get("id")
    assert result_id

    listed = app_client.get(
        "/api/drill-results/?event_id=event-1&player_id=p1",
        headers=coach_headers,
    )
    assert listed.status_code == 200, listed.text
    results = listed.json().get("results", [])
    assert len(results) == 1
    assert results[0]["type"] == "40yd"
    assert results[0]["value"] == 5.2

    updated = app_client.put(
        f"/api/drill-results/{result_id}?event_id=event-1&player_id=p1",
        json={"value": 5.4, "notes": "Corrected timing"},
        headers=coach_headers,
    )
    assert updated.status_code == 200, updated.text

    pdoc = (
        fake_db.collection("events")
        .document("event-1")
        .collection("players")
        .document("p1")
        .get()
    )
    assert _score_value(pdoc.to_dict(), "40yd") == 5.4
    assert pdoc.to_dict().get("40yd") == 5.4
