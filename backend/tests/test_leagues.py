from backend.tests.conftest import make_jwt


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


def test_join_league_persists_viewer_event_scope(app_client, fake_db):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})
    fake_db.collection("events").document("event-1").set(
        {"name": "Invited Event", "league_id": "league-1"}
    )
    uid = "new-viewer-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "viewer1@example.com", "role": "viewer"}
    )
    headers = {"Authorization": f"Bearer {make_jwt(uid=uid, email='viewer1@example.com', email_verified=True)}"}

    r = app_client.post(
        "/api/leagues/join/league-1",
        json={"role": "viewer", "invited_event_id": "event-1"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("invited_event_id") == "event-1"


def test_join_league_persists_coach_event_scope(app_client, fake_db):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})
    fake_db.collection("events").document("event-1").set(
        {"name": "Invited Event", "league_id": "league-1"}
    )
    uid = "new-coach-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach1@example.com", "role": "coach"}
    )
    headers = {"Authorization": f"Bearer {make_jwt(uid=uid, email='coach1@example.com', email_verified=True)}"}

    r = app_client.post(
        "/api/leagues/join/league-1",
        json={"role": "coach", "invited_event_id": "event-1"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("invited_event_id") == "event-1"

    member_doc = (
        fake_db.collection("leagues")
        .document("league-1")
        .collection("members")
        .document(uid)
        .get()
    )
    assert member_doc.exists
    assert member_doc.to_dict().get("coach_event_ids") == ["event-1"]


def test_join_league_event_code_scopes_coach_to_event(app_client, fake_db):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})
    fake_db.collection("events").document("event-1").set(
        {"name": "Invited Event", "league_id": "league-1"}
    )
    uid = "event-coach-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "eventcoach@example.com", "role": "coach"}
    )
    headers = {"Authorization": f"Bearer {make_jwt(uid=uid, email='eventcoach@example.com', email_verified=True)}"}

    r = app_client.post(
        "/api/leagues/join/event-1",
        json={"role": "coach"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("joined_via_event_code") is True
    assert r.json().get("invited_event_id") == "event-1"

    member_doc = (
        fake_db.collection("leagues")
        .document("league-1")
        .collection("members")
        .document(uid)
        .get()
    )
    assert member_doc.exists
    assert member_doc.to_dict().get("coach_event_ids") == ["event-1"]


def test_join_league_invalid_role_returns_400(app_client, fake_db, coach_headers):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})

    r = app_client.post(
        "/api/leagues/join/league-1",
        json={"role": "superuser"},
        headers=coach_headers,
    )

    assert r.status_code == 400, r.text


def test_join_league_coach_requires_event_invite(app_client, fake_db):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})
    uid = "coach-no-scope-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach-noscope@example.com", "role": "coach"}
    )
    headers = {"Authorization": f"Bearer {make_jwt(uid=uid, email='coach-noscope@example.com', email_verified=True)}"}

    r = app_client.post(
        "/api/leagues/join/league-1",
        json={"role": "coach"},
        headers=headers,
    )

    assert r.status_code == 400, r.text
    assert r.json()["detail"] == "Coach must join via event invite"


def test_join_league_existing_coach_creates_user_membership_scope(app_client, fake_db):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})
    fake_db.collection("events").document("event-1").set(
        {"name": "Invited Event", "league_id": "league-1"}
    )
    uid = "legacy-coach-no-fastpath"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "legacycoach@example.com", "role": "coach"}
    )
    fake_db.collection("leagues").document("league-1").collection("members").document(uid).set(
        {
            "role": "coach",
            "email": "legacycoach@example.com",
            "coach_event_ids": ["event-legacy"],
            "joined_at": "2024-01-01T00:00:00Z",
        }
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='legacycoach@example.com', email_verified=True)}"
    }

    r = app_client.post(
        "/api/leagues/join/league-1",
        json={"role": "coach", "invited_event_id": "event-1"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("invited_event_id") == "event-1"

    user_membership_doc = fake_db.collection("user_memberships").document(uid).get()
    assert user_membership_doc.exists
    league_membership = (user_membership_doc.to_dict().get("leagues") or {}).get("league-1") or {}
    assert league_membership.get("role") == "coach"
    assert set(league_membership.get("coach_event_ids") or []) == {
        "event-legacy",
        "event-1",
    }


def test_join_league_existing_member_uses_fast_path_role_for_scope_sync(app_client, fake_db):
    fake_db.collection("leagues").document("league-1").set({"name": "Seed"})
    fake_db.collection("events").document("event-1").set(
        {"name": "Invited Event", "league_id": "league-1"}
    )
    uid = "legacy-member-role-missing"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "legacymissing@example.com", "role": "coach"}
    )
    # Legacy member doc exists but role field is missing/invalid.
    fake_db.collection("leagues").document("league-1").collection("members").document(uid).set(
        {
            "email": "legacymissing@example.com",
            "coach_event_ids": ["event-legacy"],
            "joined_at": "2024-01-01T00:00:00Z",
        }
    )
    # Fast path already knows this user is a coach in this league.
    fake_db.collection("user_memberships").document(uid).set(
        {
            "leagues": {
                "league-1": {
                    "role": "coach",
                    "joined_at": "2024-01-01T00:00:00Z",
                    "coach_event_ids": ["event-legacy"],
                }
            }
        }
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='legacymissing@example.com', email_verified=True)}"
    }

    r = app_client.post(
        "/api/leagues/join/league-1",
        json={"role": "coach", "invited_event_id": "event-1"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("invited_event_id") == "event-1"

    member_doc = (
        fake_db.collection("leagues")
        .document("league-1")
        .collection("members")
        .document(uid)
        .get()
    )
    member_data = member_doc.to_dict() or {}
    assert member_data.get("role") == "coach"
    assert set(member_data.get("coach_event_ids") or []) == {"event-legacy", "event-1"}

    user_membership_doc = fake_db.collection("user_memberships").document(uid).get()
    league_membership = (user_membership_doc.to_dict().get("leagues") or {}).get("league-1") or {}
    assert league_membership.get("role") == "coach"
    assert set(league_membership.get("coach_event_ids") or []) == {
        "event-legacy",
        "event-1",
    }
