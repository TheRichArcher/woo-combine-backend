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


def test_get_draft_pricing_blocks_unrelated_authenticated_user(app_client, fake_db):
    fake_db.collection("drafts").document("draft-pricing-private").set(
        {
            "id": "draft-pricing-private",
            "created_by": "coach-1",
            "league_id": "league-1",
            "event_id": None,
            "event_ids": [],
        }
    )

    uid = "pricing-outsider-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "pricing-outsider@example.com", "role": "viewer"}
    )
    # No membership for league-1 -> should fail draft access check.
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='pricing-outsider@example.com', email_verified=True)}"
    }

    r = app_client.get(
        "/api/draft-payments/pricing/draft-pricing-private",
        headers=headers,
    )
    assert r.status_code == 403, r.text
