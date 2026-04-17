from backend.tests.conftest import make_jwt


def _seed_draft_and_team(fake_db, *, draft_id="draft-1", team_id="team-1", created_by="org-1"):
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Secure Draft",
            "league_id": "league-1",
            "created_by": created_by,
            "status": "setup",
        }
    )
    fake_db.collection("draft_teams").document(team_id).set(
        {
            "id": team_id,
            "draft_id": draft_id,
            "team_name": "Original Team",
            "coach_user_id": "coach-1",
        }
    )


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


def test_create_event_linked_draft_allows_coach_member(app_client, fake_db, coach_headers):
    fake_db.collection("events").document("event-1").set(
        {"id": "event-1", "name": "Event 1", "league_id": "league-1"}
    )

    r = app_client.post(
        "/api/drafts",
        json={
            "name": "Coach Event Draft",
            "event_id": "event-1",
            "event_ids": [],
            "draft_type": "snake",
            "pick_timer_seconds": 30,
            "auto_pick_on_timeout": False,
            "trades_enabled": False,
            "trades_require_approval": False,
        },
        headers=coach_headers,
    )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["event_id"] == "event-1"
    assert body["league_id"] == "league-1"


def test_update_team_allows_organizer(app_client, fake_db, organizer_headers):
    _seed_draft_and_team(fake_db, created_by="creator-1")

    r = app_client.patch(
        "/api/drafts/draft-1/teams/team-1",
        json={"team_name": "Updated by Organizer"},
        headers=organizer_headers,
    )

    assert r.status_code == 200, r.text
    assert r.json()["team_name"] == "Updated by Organizer"


def test_update_team_allows_draft_owner_admin(app_client, fake_db):
    _seed_draft_and_team(fake_db, created_by="draft-owner-1")

    uid = "draft-owner-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "owner@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach"}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='owner@example.com', email_verified=True)}"
    }

    r = app_client.patch(
        "/api/drafts/draft-1/teams/team-1",
        json={"team_name": "Updated by Draft Owner"},
        headers=headers,
    )

    assert r.status_code == 200, r.text
    assert r.json()["team_name"] == "Updated by Draft Owner"


def test_update_team_blocks_non_admin_coach(app_client, fake_db, coach_headers):
    _seed_draft_and_team(fake_db, created_by="other-owner-1")

    r = app_client.patch(
        "/api/drafts/draft-1/teams/team-1",
        json={"team_name": "Coach Attempt"},
        headers=coach_headers,
    )

    assert r.status_code == 403, r.text


def test_update_team_blocks_outsider_non_member(app_client, fake_db):
    _seed_draft_and_team(fake_db, created_by="owner-1")

    uid = "outsider-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "outsider@example.com", "role": "viewer"}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='outsider@example.com', email_verified=True)}"
    }

    r = app_client.patch(
        "/api/drafts/draft-1/teams/team-1",
        json={"team_name": "Outsider Attempt"},
        headers=headers,
    )

    assert r.status_code == 403, r.text


def test_update_team_blocks_mismatched_team_and_draft_ids(
    app_client, fake_db, organizer_headers
):
    _seed_draft_and_team(fake_db, draft_id="draft-1", team_id="team-1", created_by="org-1")
    _seed_draft_and_team(fake_db, draft_id="draft-2", team_id="team-2", created_by="org-1")

    r = app_client.patch(
        "/api/drafts/draft-1/teams/team-2",
        json={"team_name": "Invalid Cross-Draft Update"},
        headers=organizer_headers,
    )

    assert r.status_code == 400, r.text


def test_list_drafts_member_sees_only_accessible_league(app_client, fake_db, coach_headers):
    fake_db.collection("drafts").document("draft-league-1").set(
        {
            "id": "draft-league-1",
            "name": "League 1 Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )
    fake_db.collection("drafts").document("draft-league-2").set(
        {
            "id": "draft-league-2",
            "name": "League 2 Draft",
            "league_id": "league-2",
            "created_by": "org-2",
            "status": "setup",
        }
    )

    r = app_client.get("/api/drafts", headers=coach_headers)
    assert r.status_code == 200, r.text

    draft_ids = {d["id"] for d in r.json()}
    assert draft_ids == {"draft-league-1"}


def test_list_drafts_organizer_can_list_accessible_league(app_client, fake_db, organizer_headers):
    fake_db.collection("drafts").document("draft-league-1").set(
        {
            "id": "draft-league-1",
            "name": "League 1 Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )
    fake_db.collection("drafts").document("draft-league-2").set(
        {
            "id": "draft-league-2",
            "name": "League 2 Draft",
            "league_id": "league-2",
            "created_by": "org-2",
            "status": "setup",
        }
    )

    r = app_client.get("/api/drafts", headers=organizer_headers)
    assert r.status_code == 200, r.text
    draft_ids = {d["id"] for d in r.json()}
    assert draft_ids == {"draft-league-1"}


def test_list_drafts_viewer_member_gets_no_league_drafts(app_client, fake_db):
    fake_db.collection("drafts").document("draft-league-1").set(
        {
            "id": "draft-league-1",
            "name": "League 1 Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )

    uid = "viewer-list-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "viewer-list@example.com", "role": "viewer"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "viewer"}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='viewer-list@example.com', email_verified=True)}"
    }

    r = app_client.get("/api/drafts", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_list_drafts_coach_with_explicit_access_still_sees_draft(app_client, fake_db):
    fake_db.collection("drafts").document("draft-explicit-coach").set(
        {
            "id": "draft-explicit-coach",
            "name": "Explicit Coach Draft",
            "league_id": "league-2",
            "created_by": "org-2",
            "status": "setup",
        }
    )
    fake_db.collection("draft_teams").document("team-explicit-coach").set(
        {
            "id": "team-explicit-coach",
            "draft_id": "draft-explicit-coach",
            "team_name": "Coach Team",
            "coach_user_id": "coach-explicit-1",
        }
    )

    uid = "coach-explicit-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach-explicit@example.com", "role": "coach"}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='coach-explicit@example.com', email_verified=True)}"
    }

    r = app_client.get("/api/drafts", headers=headers)
    assert r.status_code == 200, r.text
    draft_ids = {d["id"] for d in r.json()}
    assert draft_ids == {"draft-explicit-coach"}


def test_list_drafts_viewer_with_coach_assignment_still_sees_none(app_client, fake_db):
    fake_db.collection("drafts").document("draft-explicit-viewer").set(
        {
            "id": "draft-explicit-viewer",
            "name": "Explicit Viewer Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )
    fake_db.collection("draft_teams").document("team-explicit-viewer").set(
        {
            "id": "team-explicit-viewer",
            "draft_id": "draft-explicit-viewer",
            "team_name": "Viewer Team",
            "coach_user_id": "viewer-explicit-1",
        }
    )

    uid = "viewer-explicit-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "viewer-explicit@example.com", "role": "viewer"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "viewer"}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='viewer-explicit@example.com', email_verified=True)}"
    }

    r = app_client.get("/api/drafts", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_list_drafts_outsider_sees_none(app_client, fake_db):
    fake_db.collection("drafts").document("draft-league-1").set(
        {
            "id": "draft-league-1",
            "name": "League 1 Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )

    uid = "outsider-list-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "outsider-list@example.com", "role": "viewer"}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='outsider-list@example.com', email_verified=True)}"
    }

    r = app_client.get("/api/drafts", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == []


def test_standalone_draft_creator_can_read(app_client, fake_db):
    draft_id = "standalone-draft-creator"
    uid = "standalone-owner-1"
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Standalone Draft",
            "league_id": None,
            "created_by": uid,
            "status": "setup",
        }
    )
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "owner@example.com", "role": "coach"}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='owner@example.com', email_verified=True)}"
    }

    r = app_client.get(f"/api/drafts/{draft_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == draft_id


def test_standalone_draft_assigned_coach_can_read(app_client, fake_db):
    draft_id = "standalone-draft-coach"
    uid = "assigned-coach-1"
    team_id = "dteam-assigned-1"
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Standalone Draft",
            "league_id": None,
            "created_by": "someone-else",
            "status": "setup",
        }
    )
    fake_db.collection("draft_teams").document(team_id).set(
        {
            "id": team_id,
            "draft_id": draft_id,
            "team_name": "Assigned Team",
            "coach_user_id": uid,
        }
    )
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach@example.com", "role": "coach"}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='coach@example.com', email_verified=True)}"
    }

    r = app_client.get(f"/api/drafts/{draft_id}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == draft_id


def test_standalone_draft_outsider_is_forbidden(app_client, fake_db):
    draft_id = "standalone-draft-outsider"
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Standalone Draft",
            "league_id": None,
            "created_by": "owner-1",
            "status": "setup",
        }
    )
    uid = "standalone-outsider-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "outsider@example.com", "role": "viewer"}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='outsider@example.com', email_verified=True)}"
    }

    r = app_client.get(f"/api/drafts/{draft_id}", headers=headers)
    assert r.status_code == 403, r.text


def test_league_backed_draft_membership_behavior_unchanged(app_client, fake_db, coach_headers):
    draft_id = "league-draft-1"
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "League Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )

    # Existing member on league-1 remains allowed.
    ok = app_client.get(f"/api/drafts/{draft_id}", headers=coach_headers)
    assert ok.status_code == 200, ok.text

    # Non-member remains blocked for league-backed drafts.
    outsider_uid = "league-outsider-1"
    fake_db.collection("users").document(outsider_uid).set(
        {"id": outsider_uid, "email": "league-outsider@example.com", "role": "viewer"}
    )
    outsider_headers = {
        "Authorization": f"Bearer {make_jwt(uid=outsider_uid, email='league-outsider@example.com', email_verified=True)}"
    }
    denied = app_client.get(f"/api/drafts/{draft_id}", headers=outsider_headers)
    assert denied.status_code == 403, denied.text


def test_rankings_authorized_user_can_read_and_write(app_client, fake_db, coach_headers):
    draft_id = "rankings-draft-1"
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Rankings Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )

    read_before = app_client.get(f"/api/drafts/{draft_id}/rankings", headers=coach_headers)
    assert read_before.status_code == 200, read_before.text
    assert read_before.json()["ranked_player_ids"] == []

    write = app_client.put(
        f"/api/drafts/{draft_id}/rankings",
        headers=coach_headers,
        json={"ranked_player_ids": ["p1", "p2"]},
    )
    assert write.status_code == 200, write.text
    assert write.json()["ranked_player_ids"] == ["p1", "p2"]


def test_rankings_outsider_read_blocked(app_client, fake_db):
    draft_id = "rankings-draft-read-blocked"
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Rankings Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )
    outsider_uid = "rankings-outsider-read-1"
    fake_db.collection("users").document(outsider_uid).set(
        {"id": outsider_uid, "email": "rankings-outsider-read@example.com", "role": "viewer"}
    )
    outsider_headers = {
        "Authorization": f"Bearer {make_jwt(uid=outsider_uid, email='rankings-outsider-read@example.com', email_verified=True)}"
    }

    denied = app_client.get(f"/api/drafts/{draft_id}/rankings", headers=outsider_headers)
    assert denied.status_code == 403, denied.text


def test_rankings_outsider_write_blocked_and_not_persisted(app_client, fake_db):
    draft_id = "rankings-draft-write-blocked"
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Rankings Draft",
            "league_id": "league-1",
            "created_by": "org-1",
            "status": "setup",
        }
    )
    outsider_uid = "rankings-outsider-write-1"
    fake_db.collection("users").document(outsider_uid).set(
        {"id": outsider_uid, "email": "rankings-outsider-write@example.com", "role": "viewer"}
    )
    outsider_headers = {
        "Authorization": f"Bearer {make_jwt(uid=outsider_uid, email='rankings-outsider-write@example.com', email_verified=True)}"
    }

    denied = app_client.put(
        f"/api/drafts/{draft_id}/rankings",
        headers=outsider_headers,
        json={"ranked_player_ids": ["x1", "x2"]},
    )
    assert denied.status_code == 403, denied.text

    ranking_docs = [
        doc.to_dict()
        for doc in fake_db.collection("coach_rankings").stream()
        if doc.to_dict().get("draft_id") == draft_id
    ]
    assert ranking_docs == []
