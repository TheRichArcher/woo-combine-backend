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


def _seed_invite_claim_fixture(
    fake_db,
    *,
    draft_id: str,
    team_id: str,
    invite_token: str,
    event_id: str = "event-join-1",
    league_id: str = "league-1",
):
    fake_db.collection("events").document(event_id).set(
        {"id": event_id, "name": "Join Event", "league_id": league_id}
    )
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Invite Draft",
            "league_id": league_id,
            "event_id": event_id,
            "event_ids": [event_id],
            "created_by": "org-1",
            "status": "setup",
        }
    )
    fake_db.collection("draft_teams").document(team_id).set(
        {
            "id": team_id,
            "draft_id": draft_id,
            "team_name": "Invite Team",
            "coach_user_id": None,
            "invite_token": invite_token,
        }
    )


def test_create_and_get_draft_standalone(app_client, fake_db, organizer_headers):
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
        headers=organizer_headers,
    )
    assert r.status_code == 200, r.text
    draft_id = r.json()["id"]

    r2 = app_client.get(f"/api/drafts/{draft_id}", headers=organizer_headers)
    assert r2.status_code == 200
    assert r2.json()["id"] == draft_id


def test_create_standalone_draft_requires_scoped_organizer_membership(
    app_client, fake_db, coach_headers
):
    r = app_client.post(
        "/api/drafts",
        json={
            "name": "Coach Standalone Draft Attempt",
            "draft_type": "snake",
            "pick_timer_seconds": 30,
            "auto_pick_on_timeout": False,
            "trades_enabled": False,
            "trades_require_approval": False,
            "event_id": None,
            "event_ids": [],
        },
        headers=coach_headers,
    )
    assert r.status_code == 403, r.text


def test_create_standalone_draft_ignores_global_organizer_without_membership(
    app_client, fake_db
):
    uid = "global-organizer-no-scope-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "global-organizer@example.com", "role": "organizer"}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='global-organizer@example.com', email_verified=True)}"
    }

    r = app_client.post(
        "/api/drafts",
        json={
            "name": "No Scope Organizer Draft",
            "draft_type": "snake",
            "pick_timer_seconds": 30,
            "auto_pick_on_timeout": False,
            "trades_enabled": False,
            "trades_require_approval": False,
            "event_id": None,
            "event_ids": [],
        },
        headers=headers,
    )
    assert r.status_code == 403, r.text


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


def test_create_event_linked_draft_blocks_unassigned_coach(app_client, fake_db):
    fake_db.collection("events").document("event-2").set(
        {"id": "event-2", "name": "Event 2", "league_id": "league-1"}
    )
    uid = "coach-unassigned-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach-unassigned@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {
            "leagues": {
                "league-1": {
                    "role": "coach",
                    "coach_event_ids": ["event-1"],
                }
            }
        }
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='coach-unassigned@example.com', email_verified=True)}"
    }

    r = app_client.post(
        "/api/drafts",
        json={
            "name": "Unauthorized Coach Event Draft",
            "event_id": "event-2",
            "event_ids": [],
            "draft_type": "snake",
            "pick_timer_seconds": 30,
            "auto_pick_on_timeout": False,
            "trades_enabled": False,
            "trades_require_approval": False,
        },
        headers=headers,
    )

    assert r.status_code == 403, r.text


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
    assert r.json() == []


def test_list_drafts_viewer_with_coach_assignment_sees_league_draft(app_client, fake_db):
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
    draft_ids = {d["id"] for d in r.json()}
    assert draft_ids == {"draft-explicit-viewer"}


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


def test_global_coach_role_cannot_override_viewer_membership_for_rankings_write(
    app_client, fake_db
):
    draft_id = "rankings-global-role-drift"
    fake_db.collection("events").document("event-1").set(
        {"id": "event-1", "name": "Event 1", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "League Draft",
            "league_id": "league-1",
            "event_id": "event-1",
            "event_ids": ["event-1"],
            "created_by": "org-1",
            "status": "setup",
        }
    )

    uid = "coach-role-viewer-scope-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "role-drift@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {
            "leagues": {
                "league-1": {
                    "role": "viewer",
                    "viewer_event_ids": ["event-1"],
                }
            }
        }
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='role-drift@example.com', email_verified=True)}"
    }

    denied = app_client.put(
        f"/api/drafts/{draft_id}/rankings",
        headers=headers,
        json={"ranked_player_ids": ["x1", "x2"]},
    )
    assert denied.status_code == 403, denied.text


def _seed_active_pickable_draft(
    fake_db,
    *,
    draft_id: str,
    team_id: str,
    created_by: str,
    team_coach_user_id: str,
    auto_pick_on_timeout: bool = True,
):
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Active Draft",
            "league_id": "league-1",
            "created_by": created_by,
            "status": "active",
            "draft_type": "snake",
            "num_rounds": 1,
            "num_teams": 1,
            "team_order": [team_id],
            "current_round": 1,
            "current_pick": 1,
            "current_team_id": team_id,
            "pick_timer_seconds": 0,
            "pick_deadline": None,
            "auto_pick_on_timeout": auto_pick_on_timeout,
            "trades_enabled": True,
            "trades_require_approval": True,
            "event_id": None,
            "event_ids": [],
        }
    )
    fake_db.collection("draft_teams").document(team_id).set(
        {
            "id": team_id,
            "draft_id": draft_id,
            "team_name": "Team One",
            "coach_user_id": team_coach_user_id,
            "coach_name": "Coach One",
        }
    )


def _seed_viewer_headers(fake_db, *, uid: str):
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": f"{uid}@example.com", "role": "viewer"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "viewer"}}}
    )
    return {
        "Authorization": f"Bearer {make_jwt(uid=uid, email=f'{uid}@example.com', email_verified=True)}"
    }


def test_viewer_cannot_make_pick_even_if_team_assigned(app_client, fake_db):
    draft_id = "viewer-pick-denied-draft"
    team_id = "viewer-pick-denied-team"
    viewer_uid = "viewer-pick-denied-1"
    headers = _seed_viewer_headers(fake_db, uid=viewer_uid)
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        created_by="org-1",
        team_coach_user_id=viewer_uid,
    )
    fake_db.collection("draft_players").document("dp-viewer-pick").set(
        {"id": "dp-viewer-pick", "draft_id": draft_id, "name": "Available Player"}
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "dp-viewer-pick"},
        headers=headers,
    )

    assert r.status_code == 403, r.text


def test_viewer_cannot_auto_pick_even_if_team_assigned(app_client, fake_db):
    draft_id = "viewer-auto-denied-draft"
    team_id = "viewer-auto-denied-team"
    viewer_uid = "viewer-auto-denied-1"
    headers = _seed_viewer_headers(fake_db, uid=viewer_uid)
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        created_by="org-1",
        team_coach_user_id=viewer_uid,
        auto_pick_on_timeout=True,
    )
    fake_db.collection("draft_players").document("dp-viewer-auto").set(
        {"id": "dp-viewer-auto", "draft_id": draft_id, "name": "Available Player"}
    )

    r = app_client.post(f"/api/drafts/{draft_id}/picks/auto", headers=headers)

    assert r.status_code == 403, r.text


def test_viewer_cannot_save_rankings(app_client, fake_db):
    draft_id = "viewer-rankings-denied-draft"
    viewer_uid = "viewer-rankings-denied-1"
    headers = _seed_viewer_headers(fake_db, uid=viewer_uid)
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id="viewer-rankings-team",
        created_by="org-1",
        team_coach_user_id="coach-1",
    )

    r = app_client.put(
        f"/api/drafts/{draft_id}/rankings",
        json={"ranked_player_ids": ["p1", "p2"]},
        headers=headers,
    )

    assert r.status_code == 403, r.text


def test_viewer_cannot_create_trade_even_if_offering_team_assigned(app_client, fake_db):
    draft_id = "viewer-trade-denied-draft"
    viewer_uid = "viewer-trade-denied-1"
    headers = _seed_viewer_headers(fake_db, uid=viewer_uid)
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id="viewer-trade-team-offer",
        created_by="org-1",
        team_coach_user_id=viewer_uid,
    )
    fake_db.collection("draft_teams").document("viewer-trade-team-recv").set(
        {
            "id": "viewer-trade-team-recv",
            "draft_id": draft_id,
            "team_name": "Team Two",
            "coach_user_id": "coach-2",
        }
    )
    fake_db.collection("draft_picks").document("pick-viewer-offer").set(
        {
            "id": "pick-viewer-offer",
            "draft_id": draft_id,
            "team_id": "viewer-trade-team-offer",
            "player_id": "player-offer",
        }
    )
    fake_db.collection("draft_picks").document("pick-viewer-recv").set(
        {
            "id": "pick-viewer-recv",
            "draft_id": draft_id,
            "team_id": "viewer-trade-team-recv",
            "player_id": "player-recv",
        }
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/trades",
        json={
            "offering_team_id": "viewer-trade-team-offer",
            "receiving_team_id": "viewer-trade-team-recv",
            "offering_player_id": "player-offer",
            "receiving_player_id": "player-recv",
        },
        headers=headers,
    )

    assert r.status_code == 403, r.text


def test_admin_can_still_trigger_auto_pick_mutation(app_client, fake_db, organizer_headers):
    draft_id = "admin-auto-allowed-draft"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id="admin-auto-team",
        created_by="creator-x",
        team_coach_user_id="coach-1",
        auto_pick_on_timeout=True,
    )
    fake_db.collection("draft_players").document("dp-admin-auto").set(
        {"id": "dp-admin-auto", "draft_id": draft_id, "name": "Available Player"}
    )

    r = app_client.post(f"/api/drafts/{draft_id}/picks/auto", headers=organizer_headers)

    assert r.status_code == 200, r.text
    assert r.json()["pick_type"] == "auto"


def test_team_owner_coach_can_make_pick(app_client, fake_db, coach_headers):
    draft_id = "coach-pick-allowed-draft"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id="coach-pick-team",
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("draft_players").document("dp-coach-pick").set(
        {"id": "dp-coach-pick", "draft_id": draft_id, "name": "Available Player"}
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "dp-coach-pick"},
        headers=coach_headers,
    )

    assert r.status_code == 200, r.text
    assert r.json()["pick_type"] == "manual"


def test_manual_pick_assigns_entire_sibling_group(app_client, fake_db, organizer_headers):
    draft_id = "sibling-pick-draft"
    team_id = "sibling-pick-team"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("events").document("event-1").set(
        {"id": "event-1", "name": "Event 1", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {"event_id": "event-1", "event_ids": ["event-1"], "num_rounds": 2}
    )

    fake_db.collection("events").document("event-1").collection("players").document("sib-1").set(
        {
            "id": "sib-1",
            "name": "Alex Smith",
            "age_group": "U10",
            "siblingGroupId": "sg_abc123",
            "forceSameTeamWithSibling": True,
        }
    )
    fake_db.collection("events").document("event-1").collection("players").document("sib-2").set(
        {
            "id": "sib-2",
            "name": "Avery Smith",
            "age_group": "U10",
            "siblingGroupId": "sg_abc123",
            "forceSameTeamWithSibling": True,
        }
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "sib-1"},
        headers=organizer_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert sorted(body["assigned_player_ids"]) == ["sib-1", "sib-2"]

    picks = [
        p.to_dict()
        for p in fake_db.collection("draft_picks")
        .where("draft_id", "==", draft_id)
        .stream()
    ]
    assert len(picks) == 2
    assert {p["player_id"] for p in picks} == {"sib-1", "sib-2"}
    assert all(p["team_id"] == team_id for p in picks)


def test_manual_pick_rejects_sibling_unit_when_slots_insufficient(
    app_client, fake_db, organizer_headers
):
    draft_id = "sibling-capacity-draft"
    team_id = "sibling-capacity-team"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("events").document("event-cap").set(
        {"id": "event-cap", "name": "Event Cap", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {"event_id": "event-cap", "event_ids": ["event-cap"], "num_rounds": 1, "num_teams": 1}
    )
    fake_db.collection("events").document("event-cap").collection("players").document("sib-cap-1").set(
        {
            "id": "sib-cap-1",
            "name": "Cap One",
            "age_group": "U10",
            "siblingGroupId": "sg_cap",
            "forceSameTeamWithSibling": True,
        }
    )
    fake_db.collection("events").document("event-cap").collection("players").document("sib-cap-2").set(
        {
            "id": "sib-cap-2",
            "name": "Cap Two",
            "age_group": "U10",
            "siblingGroupId": "sg_cap",
            "forceSameTeamWithSibling": True,
        }
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "sib-cap-1"},
        headers=organizer_headers,
    )
    assert r.status_code == 400, r.text
    assert "not enough remaining draft slots" in r.json().get("detail", "")

    picks = list(
        fake_db.collection("draft_picks")
        .where("draft_id", "==", draft_id)
        .stream()
    )
    assert len(picks) == 0


def test_manual_pick_rejects_when_sibling_already_on_other_team_without_partial_write(
    app_client, fake_db, organizer_headers
):
    draft_id = "sibling-hard-constraint-draft"
    team1 = "sibling-team-1"
    team2 = "sibling-team-2"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team1,
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("draft_teams").document(team2).set(
        {"id": team2, "draft_id": draft_id, "team_name": "Team Two", "coach_user_id": "coach-2"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {"num_teams": 2, "num_rounds": 3, "team_order": [team1, team2]}
    )
    fake_db.collection("events").document("event-hard").set(
        {"id": "event-hard", "name": "Event Hard", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {"event_id": "event-hard", "event_ids": ["event-hard"]}
    )
    fake_db.collection("events").document("event-hard").collection("players").document("sib-hard-1").set(
        {
            "id": "sib-hard-1",
            "name": "Hard One",
            "age_group": "U10",
            "siblingGroupId": "sg_hard",
            "forceSameTeamWithSibling": True,
        }
    )
    fake_db.collection("events").document("event-hard").collection("players").document("sib-hard-2").set(
        {
            "id": "sib-hard-2",
            "name": "Hard Two",
            "age_group": "U10",
            "siblingGroupId": "sg_hard",
            "forceSameTeamWithSibling": True,
        }
    )
    fake_db.collection("draft_picks").document("existing-hard-pick").set(
        {
            "id": "existing-hard-pick",
            "draft_id": draft_id,
            "round": 1,
            "pick_number": 1,
            "team_id": team2,
            "player_id": "sib-hard-2",
        }
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "sib-hard-1"},
        headers=organizer_headers,
    )
    assert r.status_code == 400, r.text
    assert "Sibling constraint" in r.json().get("detail", "")

    picks = [
        p.to_dict()
        for p in fake_db.collection("draft_picks")
        .where("draft_id", "==", draft_id)
        .stream()
    ]
    assert len(picks) == 1
    assert picks[0]["player_id"] == "sib-hard-2"


def test_auto_pick_rejects_sibling_unit_when_slots_insufficient_without_partial_write(
    app_client, fake_db, organizer_headers
):
    draft_id = "sibling-auto-capacity-draft"
    team_id = "sibling-auto-capacity-team"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        created_by="org-1",
        team_coach_user_id="coach-1",
        auto_pick_on_timeout=True,
    )
    fake_db.collection("events").document("event-auto-cap").set(
        {"id": "event-auto-cap", "name": "Event Auto Cap", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {
            "event_id": "event-auto-cap",
            "event_ids": ["event-auto-cap"],
            "num_rounds": 1,
            "num_teams": 1,
        }
    )
    fake_db.collection("events").document("event-auto-cap").collection("players").document("sib-auto-cap-1").set(
        {
            "id": "sib-auto-cap-1",
            "name": "Auto Cap One",
            "age_group": "U10",
            "siblingGroupId": "sg_auto_cap",
            "forceSameTeamWithSibling": True,
        }
    )
    fake_db.collection("events").document("event-auto-cap").collection("players").document("sib-auto-cap-2").set(
        {
            "id": "sib-auto-cap-2",
            "name": "Auto Cap Two",
            "age_group": "U10",
            "siblingGroupId": "sg_auto_cap",
            "forceSameTeamWithSibling": True,
        }
    )

    r = app_client.post(f"/api/drafts/{draft_id}/picks/auto", headers=organizer_headers)
    assert r.status_code == 400, r.text
    assert "not enough remaining draft slots" in r.json().get("detail", "")

    picks = list(
        fake_db.collection("draft_picks")
        .where("draft_id", "==", draft_id)
        .stream()
    )
    assert len(picks) == 0


def test_manual_pick_rejects_when_team_cap_would_be_exceeded(
    app_client, fake_db, organizer_headers
):
    draft_id = "team-cap-hard-reject-draft"
    team_id = "team-cap-hard-reject-team"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("events").document("event-team-cap").set(
        {"id": "event-team-cap", "name": "Event Team Cap", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {
            "event_id": "event-team-cap",
            "event_ids": ["event-team-cap"],
            "num_rounds": 3,
            "num_teams": 1,
            "max_players_per_team": 1,
        }
    )
    fake_db.collection("events").document("event-team-cap").collection("players").document("team-cap-p1").set(
        {"id": "team-cap-p1", "name": "Cap Candidate", "age_group": "U10"}
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "team-cap-p1"},
        headers=organizer_headers,
    )
    assert r.status_code == 200, r.text

    fake_db.collection("events").document("event-team-cap").collection("players").document("team-cap-p2").set(
        {"id": "team-cap-p2", "name": "Cap Candidate 2", "age_group": "U10"}
    )
    r2 = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "team-cap-p2"},
        headers=organizer_headers,
    )
    assert r2.status_code == 400, r2.text
    assert "per-team roster cap exceeded" in r2.json().get("detail", "")


def test_manual_pick_rejects_when_composite_balance_rule_would_be_exceeded(
    app_client, fake_db, organizer_headers
):
    draft_id = "composite-balance-hard-reject-draft"
    team1 = "composite-team-1"
    team2 = "composite-team-2"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team1,
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("draft_teams").document(team2).set(
        {"id": team2, "draft_id": draft_id, "team_name": "Team Two", "coach_user_id": "coach-2"}
    )
    fake_db.collection("events").document("event-comp").set(
        {"id": "event-comp", "name": "Event Composite", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {
            "event_id": "event-comp",
            "event_ids": ["event-comp"],
            "num_teams": 2,
            "num_rounds": 3,
            "team_order": [team1, team2],
            "current_pick": 3,
            "current_round": 2,
            "current_team_id": team1,
            "enforce_composite_balance": True,
            "max_composite_avg_gap": 5.0,
            "composite_balance_blocking": True,
        }
    )

    fake_db.collection("events").document("event-comp").collection("players").document("comp-a").set(
        {"id": "comp-a", "name": "Comp A", "age_group": "U10", "composite_score": 50}
    )
    fake_db.collection("events").document("event-comp").collection("players").document("comp-b").set(
        {"id": "comp-b", "name": "Comp B", "age_group": "U10", "composite_score": 50}
    )
    fake_db.collection("events").document("event-comp").collection("players").document("comp-c").set(
        {"id": "comp-c", "name": "Comp C", "age_group": "U10", "composite_score": 100}
    )
    fake_db.collection("draft_picks").document("comp-pick-1").set(
        {"id": "comp-pick-1", "draft_id": draft_id, "round": 1, "pick_number": 1, "team_id": team1, "player_id": "comp-a"}
    )
    fake_db.collection("draft_picks").document("comp-pick-2").set(
        {"id": "comp-pick-2", "draft_id": draft_id, "round": 1, "pick_number": 2, "team_id": team2, "player_id": "comp-b"}
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "comp-c"},
        headers=organizer_headers,
    )
    assert r.status_code == 400, r.text
    assert "composite balance rule exceeded" in r.json().get("detail", "")


def test_sibling_unit_allows_advisory_composite_balance_violation_when_non_blocking(
    app_client, fake_db, organizer_headers
):
    draft_id = "composite-balance-advisory-draft"
    team1 = "advisory-team-1"
    team2 = "advisory-team-2"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team1,
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("draft_teams").document(team2).set(
        {"id": team2, "draft_id": draft_id, "team_name": "Team Two", "coach_user_id": "coach-2"}
    )
    fake_db.collection("events").document("event-advisory").set(
        {"id": "event-advisory", "name": "Event Advisory", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {
            "event_id": "event-advisory",
            "event_ids": ["event-advisory"],
            "num_teams": 2,
            "num_rounds": 4,
            "team_order": [team1, team2],
            "current_pick": 3,
            "current_round": 2,
            "current_team_id": team1,
            "enforce_composite_balance": True,
            "max_composite_avg_gap": 5.0,
            "composite_balance_blocking": False,
        }
    )
    fake_db.collection("events").document("event-advisory").collection("players").document("adv-low-1").set(
        {"id": "adv-low-1", "name": "Low One", "age_group": "U10", "composite_score": 50}
    )
    fake_db.collection("events").document("event-advisory").collection("players").document("adv-low-2").set(
        {"id": "adv-low-2", "name": "Low Two", "age_group": "U10", "composite_score": 50}
    )
    fake_db.collection("events").document("event-advisory").collection("players").document("adv-sib-1").set(
        {
            "id": "adv-sib-1",
            "name": "High Sib One",
            "age_group": "U10",
            "composite_score": 100,
            "siblingGroupId": "sg_adv",
            "forceSameTeamWithSibling": True,
        }
    )
    fake_db.collection("events").document("event-advisory").collection("players").document("adv-sib-2").set(
        {
            "id": "adv-sib-2",
            "name": "High Sib Two",
            "age_group": "U10",
            "composite_score": 100,
            "siblingGroupId": "sg_adv",
            "forceSameTeamWithSibling": True,
        }
    )
    fake_db.collection("draft_picks").document("adv-pick-1").set(
        {"id": "adv-pick-1", "draft_id": draft_id, "round": 1, "pick_number": 1, "team_id": team1, "player_id": "adv-low-1"}
    )
    fake_db.collection("draft_picks").document("adv-pick-2").set(
        {"id": "adv-pick-2", "draft_id": draft_id, "round": 1, "pick_number": 2, "team_id": team2, "player_id": "adv-low-2"}
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "adv-sib-1"},
        headers=organizer_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert sorted(body.get("assigned_player_ids") or []) == ["adv-sib-1", "adv-sib-2"]
    warnings = body.get("advisory_warnings") or []
    assert any("Composite balance advisory" in warning for warning in warnings)


def test_admin_can_review_suspicious_sibling_group_actions(
    app_client, fake_db, organizer_headers
):
    draft_id = "sibling-review-draft"
    team_id = "sibling-review-team"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("drafts").document(draft_id).update({"status": "setup"})
    fake_db.collection("events").document("event-review").set(
        {"id": "event-review", "name": "Event Review", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).update(
        {"event_id": "event-review", "event_ids": ["event-review"]}
    )
    fake_db.collection("events").document("event-review").collection("players").document("sib-review-1").set(
        {
            "id": "sib-review-1",
            "name": "Review One",
            "age_group": "U10",
            "siblingGroupId": "sg_review",
            "forceSameTeamWithSibling": True,
            "siblingInferenceSuspicious": True,
            "siblingInferenceSuspicionReasons": ["large_group"],
        }
    )
    fake_db.collection("events").document("event-review").collection("players").document("sib-review-2").set(
        {
            "id": "sib-review-2",
            "name": "Review Two",
            "age_group": "U10",
            "siblingGroupId": "sg_review",
            "forceSameTeamWithSibling": True,
            "siblingInferenceSuspicious": True,
            "siblingInferenceSuspicionReasons": ["large_group"],
        }
    )

    confirm = app_client.post(
        f"/api/drafts/{draft_id}/sibling-groups/sg_review/review",
        json={"action": "confirm"},
        headers=organizer_headers,
    )
    assert confirm.status_code == 200, confirm.text

    doc1 = (
        fake_db.collection("events")
        .document("event-review")
        .collection("players")
        .document("sib-review-1")
        .get()
        .to_dict()
    )
    assert doc1.get("siblingReviewStatus") == "confirmed"
    assert doc1.get("forceSameTeamWithSibling") is True
    assert doc1.get("siblingInferenceSuspicious") is False

    separate = app_client.post(
        f"/api/drafts/{draft_id}/sibling-groups/sg_review/review",
        json={"action": "mark_separate"},
        headers=organizer_headers,
    )
    assert separate.status_code == 200, separate.text
    doc2 = (
        fake_db.collection("events")
        .document("event-review")
        .collection("players")
        .document("sib-review-2")
        .get()
        .to_dict()
    )
    assert doc2.get("siblingReviewStatus") == "separate"
    assert doc2.get("forceSameTeamWithSibling") is False
    assert doc2.get("siblingSeparationRequested") is True


def test_unassigned_coach_cannot_make_pick_outside_event_scope(app_client, fake_db):
    draft_id = "coach-out-of-scope-pick-draft"
    team_id = "coach-out-of-scope-team"
    uid = "coach-out-of-scope-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "out-of-scope@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {
            "leagues": {
                "league-1": {
                    "role": "coach",
                    "coach_event_ids": ["event-1"],
                }
            }
        }
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='out-of-scope@example.com', email_verified=True)}"
    }

    fake_db.collection("events").document("event-2").set(
        {"id": "event-2", "name": "Event 2", "league_id": "league-1"}
    )
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": "Scoped Draft",
            "league_id": "league-1",
            "event_id": "event-2",
            "event_ids": ["event-2"],
            "created_by": "org-1",
            "status": "active",
            "draft_type": "snake",
            "num_rounds": 1,
            "num_teams": 1,
            "team_order": [team_id],
            "current_round": 1,
            "current_pick": 1,
            "current_team_id": team_id,
            "pick_timer_seconds": 0,
            "pick_deadline": None,
            "auto_pick_on_timeout": True,
        }
    )
    fake_db.collection("draft_teams").document(team_id).set(
        {
            "id": team_id,
            "draft_id": draft_id,
            "team_name": "Scoped Team",
            "coach_user_id": uid,
        }
    )
    fake_db.collection("draft_players").document("dp-out-of-scope").set(
        {"id": "dp-out-of-scope", "draft_id": draft_id, "name": "Available Player"}
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/picks",
        json={"player_id": "dp-out-of-scope"},
        headers=headers,
    )
    assert r.status_code == 403, r.text


def test_team_owner_coach_can_create_trade(app_client, fake_db, coach_headers):
    draft_id = "coach-trade-allowed-draft"
    _seed_active_pickable_draft(
        fake_db,
        draft_id=draft_id,
        team_id="coach-trade-team-offer",
        created_by="org-1",
        team_coach_user_id="coach-1",
    )
    fake_db.collection("draft_teams").document("coach-trade-team-recv").set(
        {
            "id": "coach-trade-team-recv",
            "draft_id": draft_id,
            "team_name": "Receiver Team",
            "coach_user_id": "coach-2",
        }
    )
    fake_db.collection("draft_picks").document("pick-coach-offer").set(
        {
            "id": "pick-coach-offer",
            "draft_id": draft_id,
            "team_id": "coach-trade-team-offer",
            "player_id": "player-coach-offer",
        }
    )
    fake_db.collection("draft_picks").document("pick-coach-recv").set(
        {
            "id": "pick-coach-recv",
            "draft_id": draft_id,
            "team_id": "coach-trade-team-recv",
            "player_id": "player-coach-recv",
        }
    )

    r = app_client.post(
        f"/api/drafts/{draft_id}/trades",
        json={
            "offering_team_id": "coach-trade-team-offer",
            "receiving_team_id": "coach-trade-team-recv",
            "offering_player_id": "player-coach-offer",
            "receiving_player_id": "player-coach-recv",
        },
        headers=coach_headers,
    )

    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending"


def test_join_invite_denies_coach_without_draft_event_scope(app_client, fake_db):
    draft_id = "invite-scope-denied-draft"
    team_id = "invite-scope-denied-team"
    invite_token = "invite-token-scope-denied"
    _seed_invite_claim_fixture(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        invite_token=invite_token,
        event_id="event-join-2",
    )

    uid = "coach-in-league-but-unassigned-join-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach-unassigned-join@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach", "coach_event_ids": ["event-join-1"]}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='coach-unassigned-join@example.com', email_verified=True)}"
    }

    denied = app_client.post(f"/api/drafts/join/{invite_token}", headers=headers)
    assert denied.status_code == 403, denied.text


def test_join_invite_allows_coach_with_draft_event_scope(app_client, fake_db):
    draft_id = "invite-scope-allowed-draft"
    team_id = "invite-scope-allowed-team"
    invite_token = "invite-token-scope-allowed"
    _seed_invite_claim_fixture(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        invite_token=invite_token,
        event_id="event-join-3",
    )

    uid = "coach-assigned-join-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "coach-assigned-join@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach", "coach_event_ids": ["event-join-3"]}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='coach-assigned-join@example.com', email_verified=True)}"
    }

    allowed = app_client.post(f"/api/drafts/join/{invite_token}", headers=headers)
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["status"] == "ok"
    assert allowed.json()["team_id"] == team_id

    team_doc = fake_db.collection("draft_teams").document(team_id).get()
    assert team_doc.to_dict().get("coach_user_id") == uid


def test_join_invite_allows_organizer_path(app_client, fake_db):
    draft_id = "invite-organizer-allowed-draft"
    team_id = "invite-organizer-allowed-team"
    invite_token = "invite-token-organizer-allowed"
    _seed_invite_claim_fixture(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        invite_token=invite_token,
        event_id="event-join-4",
    )

    uid = "organizer-join-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "organizer-join@example.com", "role": "organizer"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "organizer"}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='organizer-join@example.com', email_verified=True)}"
    }

    allowed = app_client.post(f"/api/drafts/join/{invite_token}", headers=headers)
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["status"] == "ok"


def test_join_invite_leaked_token_does_not_bypass_event_scope(app_client, fake_db):
    draft_id = "invite-leaked-token-draft"
    team_id = "invite-leaked-token-team"
    invite_token = "invite-token-leaked-scope"
    _seed_invite_claim_fixture(
        fake_db,
        draft_id=draft_id,
        team_id=team_id,
        invite_token=invite_token,
        event_id="event-join-5",
    )

    uid = "coach-global-role-leaked-token-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "leaked-token-coach@example.com", "role": "coach"}
    )
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach", "coach_event_ids": ["event-other"]}}}
    )
    headers = {
        "Authorization": f"Bearer {make_jwt(uid=uid, email='leaked-token-coach@example.com', email_verified=True)}"
    }

    denied = app_client.post(f"/api/drafts/join/{invite_token}", headers=headers)
    assert denied.status_code == 403, denied.text

    team_doc = fake_db.collection("draft_teams").document(team_id).get()
    assert team_doc.to_dict().get("coach_user_id") is None
