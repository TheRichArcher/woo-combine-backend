from types import SimpleNamespace


def test_unmeasured_players_have_no_invented_stars(app_client, fake_db, organizer_headers, monkeypatch):
    import backend.routes.drafts as routes
    schema = SimpleNamespace(drills=[SimpleNamespace(key="catching", default_weight=1, min_value=0, max_value=10, lower_is_better=False)])
    monkeypatch.setattr(routes, "get_event_schema", lambda _event: schema)
    fake_db.collection("events").document("event-1").set({"id": "event-1", "league_id": "league-1"})
    fake_db.collection("drafts").document("d").set({"id": "d", "created_by": "org-1", "league_id": "league-1", "event_ids": ["event-1"]})
    players = fake_db.collection("events").document("event-1").collection("players")
    for pid, scores in [("empty", {}), ("null", {"catching": None}), ("invalid", {"catching": "unknown"}), ("measured-zero", {"catching": 0}), ("measured-ten", {"catching": 10})]:
        players.document(pid).set({"id": pid, "name": pid, "scores": scores})
    response = app_client.get("/api/drafts/d/players", headers=organizer_headers)
    assert response.status_code == 200, response.text
    data = {player["id"]: player for player in response.json()}
    for pid in ["empty", "null", "invalid"]:
        assert data[pid]["star_count"] is None
        assert data[pid]["canonical_rank"] is None
        assert data[pid]["canonical_percentile"] is None
        assert data[pid]["star_label"] == ""
    assert data["measured-zero"]["canonical_cohort_size"] == 2
    assert data["measured-zero"]["canonical_rank"] == 2
    assert data["measured-ten"]["canonical_rank"] == 1
