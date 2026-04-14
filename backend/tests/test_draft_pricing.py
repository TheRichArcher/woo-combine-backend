def test_get_draft_pricing_free_when_no_teams_or_players(app_client, fake_db, coach_headers):
    fake_db.collection("drafts").document("draft-1").set(
        {"id": "draft-1", "created_by": "coach-1", "event_id": None, "event_ids": []}
    )

    r = app_client.get("/api/draft-payments/pricing/draft-1", headers=coach_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["draft_id"] == "draft-1"
    assert body["is_free"] is True
    assert body["price_cents"] == 0


def test_get_draft_pricing_404(app_client, coach_headers):
    r = app_client.get("/api/draft-payments/pricing/missing", headers=coach_headers)
    assert r.status_code == 404
