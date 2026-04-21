from types import SimpleNamespace


def _seed_event(fake_db, event_id="event-1", league_id="league-1"):
    fake_db.collection("leagues").document(league_id).set({"name": "League"})
    fake_db.collection("events").document(event_id).set(
        {
            "name": "Combine Event",
            "league_id": league_id,
            "drillTemplate": "football",
            "disabled_drills": [],
        }
    )


def test_results_lookup_uses_checkin_number_field(app_client, fake_db, monkeypatch):
    _seed_event(fake_db)

    players_ref = fake_db.collection("events").document("event-1").collection("players")
    players_ref.document("p-1").set(
        {
            "name": "John Bradshaw Jr",
            "last": "Bradshaw Jr.",
            "number": 7,  # Check-in source-of-truth field
            "external_id": "EXT-999",  # Should not be required for lookup
            "event_id": "event-1",
            "age_group": "U12",
            "scores": {},
        }
    )
    players_ref.document("p-2").set(
        {
            "name": "Alex Tester",
            "last": "Tester",
            "number": 15,
            "event_id": "event-1",
            "age_group": "U12",
            "scores": {},
        }
    )

    import backend.routes.public_results as public_results

    monkeypatch.setattr(
        public_results,
        "get_event_schema",
        lambda _event_id: SimpleNamespace(drills=[]),
    )
    monkeypatch.setattr(
        public_results,
        "calculate_composite_score",
        lambda player, schema=None: float(player.get("number") or 0),
    )

    r = app_client.post(
        "/api/public/results-lookup",
        json={"event_id": "event-1", "combine_number": "007", "last_name": "Bradshaw"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["player_name"] == "John Bradshaw Jr"
    assert body["first_name"] == "John"
    assert body["last_name"] == "Bradshaw Jr."
    assert body["age_group"] == "U12"


def test_results_lookup_rejects_ambiguous_checkin_number_matches(app_client, fake_db, monkeypatch):
    _seed_event(fake_db)

    players_ref = fake_db.collection("events").document("event-1").collection("players")
    players_ref.document("p-1").set(
        {
            "name": "Jordan Bradshaw",
            "last": "Bradshaw",
            "number": 22,
            "event_id": "event-1",
            "age_group": "U12",
            "scores": {},
        }
    )
    players_ref.document("p-2").set(
        {
            "name": "Jordan Bradshaw Jr",
            "last": "Bradshaw Jr",
            "number": 22,
            "event_id": "event-1",
            "age_group": "U12",
            "scores": {},
        }
    )

    import backend.routes.public_results as public_results

    monkeypatch.setattr(
        public_results,
        "get_event_schema",
        lambda _event_id: SimpleNamespace(drills=[]),
    )
    monkeypatch.setattr(
        public_results,
        "calculate_composite_score",
        lambda player, schema=None: float(player.get("number") or 0),
    )

    r = app_client.post(
        "/api/public/results-lookup",
        json={"event_id": "event-1", "combine_number": "22", "last_name": "bradshaw"},
    )
    assert r.status_code == 404
    assert (
        r.json()["detail"]
        == "We couldn't find a matching participant with that Combine Number and Last Name."
    )


def test_results_lookup_scopes_to_requested_event(app_client, fake_db, monkeypatch):
    _seed_event(fake_db, event_id="event-1")
    _seed_event(fake_db, event_id="event-2")

    fake_db.collection("events").document("event-1").collection("players").document("p-1").set(
        {
            "name": "Taylor Jordan",
            "last": "Jordan",
            "number": 31,
            "event_id": "event-1",
            "age_group": "U14",
            "scores": {},
        }
    )
    fake_db.collection("events").document("event-2").collection("players").document("p-2").set(
        {
            "name": "Morgan Jordan",
            "last": "Jordan",
            "number": 31,
            "event_id": "event-2",
            "age_group": "U14",
            "scores": {},
        }
    )

    import backend.routes.public_results as public_results

    monkeypatch.setattr(
        public_results,
        "get_event_schema",
        lambda _event_id: SimpleNamespace(drills=[]),
    )
    monkeypatch.setattr(
        public_results,
        "calculate_composite_score",
        lambda player, schema=None: float(player.get("number") or 0),
    )

    r = app_client.post(
        "/api/public/results-lookup",
        json={"event_id": "event-1", "combine_number": "31", "last_name": "jordan"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["player_name"] == "Taylor Jordan"
    assert r.json()["first_name"] == "Taylor"
    assert r.json()["last_name"] == "Jordan"


def test_results_lookup_name_fields_fallback_to_combined_name(app_client, fake_db, monkeypatch):
    _seed_event(fake_db)

    fake_db.collection("events").document("event-1").collection("players").document("p-1").set(
        {
            "name": "Casey Morgan",
            "number": 9,
            "event_id": "event-1",
            "age_group": "U12",
            "scores": {},
        }
    )

    import backend.routes.public_results as public_results

    monkeypatch.setattr(
        public_results,
        "get_event_schema",
        lambda _event_id: SimpleNamespace(drills=[]),
    )
    monkeypatch.setattr(
        public_results,
        "calculate_composite_score",
        lambda player, schema=None: float(player.get("number") or 0),
    )

    r = app_client.post(
        "/api/public/results-lookup",
        json={"event_id": "event-1", "combine_number": "9", "last_name": "morgan"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["player_name"] == "Casey Morgan"
    assert body["first_name"] == "Casey"
    assert body["last_name"] == "Morgan"
