def test_create_league_creates_membership_and_returns_id(app_client, fake_db, organizer_headers):
    r = app_client.post(
        "/api/leagues/",
        json={"name": "My League"},
        headers=organizer_headers,
    )
    assert r.status_code == 200, r.text
    league_id = r.json()["league_id"]

    # League exists
    league_doc = fake_db.collection("leagues").document(league_id).get()
    assert league_doc.exists
    assert league_doc.to_dict()["name"] == "My League"

    # Member subdoc exists
    member_doc = (
        fake_db.collection("leagues")
        .document(league_id)
        .collection("members")
        .document("org-1")
        .get()
    )
    assert member_doc.exists
    assert member_doc.to_dict()["role"] == "organizer"


def test_get_my_leagues_fast_path(app_client, fake_db, coach_headers):
    # Seed league and membership
    fake_db.collection("leagues").document("league-1").set(
        {"name": "Seed League", "created_at": "2024-01-01T00:00:00Z"}
    )

    r = app_client.get("/api/leagues/me", headers=coach_headers)
    assert r.status_code == 200
    leagues = r.json()["leagues"]
    assert isinstance(leagues, list)
    assert leagues and leagues[0]["id"] == "league-1"
    assert leagues[0]["role"] == "coach"


def test_join_league_forbids_organizer_role(app_client, fake_db, coach_headers):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})

    r = app_client.post(
        "/api/leagues/join/league-1",
        json={"role": "organizer"},
        headers=coach_headers,
    )
    assert r.status_code == 403
