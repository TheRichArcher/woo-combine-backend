def test_create_and_get_draft_standalone(app_client, fake_db, coach_headers):
    # Standalone draft: no event required
    r = app_client.post(
        "/api/drafts",
        json={
            "name": "Draft 1",
            "age_group": "U12",
            "draft_type": "snake",
            "num_rounds": 3,
            "pick_timer_seconds": 30,
            "auto_pick_on_timeout": False,
            "trades_enabled": False,
            "trades_require_approval": False,
            "event_id": None,
            "event_ids": [],
        },
        headers=coach_headers,
    )
    assert r.status_code == 200, r.text
    draft_id = r.json()["id"]

    r2 = app_client.get(f"/api/drafts/{draft_id}", headers=coach_headers)
    assert r2.status_code == 200
    assert r2.json()["id"] == draft_id
