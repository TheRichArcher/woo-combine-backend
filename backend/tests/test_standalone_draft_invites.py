"""Standalone invitations grant only one draft team, never league authority."""
from backend.tests.conftest import make_jwt


def seed(fake_db, **draft_fields):
    fake_db.collection("users").document("guest").set({"id": "guest", "role": "viewer"})
    fake_db.collection("drafts").document("standalone").set({
        "id": "standalone", "name": "Draft", "created_by": "owner", "status": "setup", **draft_fields,
    })
    fake_db.collection("draft_teams").document("team").set({
        "id": "team", "draft_id": "standalone", "team_name": "Team", "invite_token": "valid-token", "coach_user_id": None,
    })
    return {"Authorization": "Bearer " + make_jwt(uid="guest")}


def test_standalone_invite_is_scoped_and_idempotent(app_client, fake_db):
    headers = seed(fake_db)
    for _ in range(2):
        response = app_client.post("/api/drafts/join/valid-token", headers=headers)
        assert response.status_code == 200, response.text
    assert app_client.get("/api/drafts/standalone", headers=headers).status_code == 200
    assert app_client.patch("/api/drafts/standalone", json={"name": "Forbidden"}, headers=headers).status_code == 403
    assert not fake_db.collection("user_memberships").document("guest").get().exists


def test_event_linked_draft_without_league_cannot_be_claimed(app_client, fake_db):
    headers = seed(fake_db, event_ids=["event-1"])
    response = app_client.post("/api/drafts/join/valid-token", headers=headers)
    assert response.status_code == 400
    assert fake_db.collection("draft_teams").document("team").get().to_dict()["coach_user_id"] is None


def test_finished_standalone_invite_cannot_be_claimed(app_client, fake_db):
    headers = seed(fake_db, status="completed")
    assert app_client.post("/api/drafts/join/valid-token", headers=headers).status_code == 400
    assert fake_db.collection("draft_teams").document("team").get().to_dict()["coach_user_id"] is None


def test_league_invite_still_requires_membership(app_client, fake_db):
    headers = seed(fake_db, league_id="league-1", event_ids=["event-1"])
    assert app_client.post("/api/drafts/join/valid-token", headers=headers).status_code == 403
    assert fake_db.collection("draft_teams").document("team").get().to_dict()["coach_user_id"] is None


def test_coach_cannot_discover_other_team_invites(app_client, fake_db):
    headers = seed(fake_db)
    fake_db.collection("draft_teams").document("other").set({
        "id": "other", "draft_id": "standalone", "team_name": "Other team",
        "invite_token": "secret-other-token", "coach_user_id": None,
    })
    assert app_client.post("/api/drafts/join/valid-token", headers=headers).status_code == 200
    for path in ("/api/drafts/standalone/teams", "/api/drafts/standalone", "/api/drafts"):
        response = app_client.get(path, headers=headers)
        assert response.status_code == 200, response.text
        assert "secret-other-token" not in response.text
        assert "invite_token" not in response.text
    fake_db.collection("users").document("owner").set({"id": "owner", "role": "organizer"})
    owner_headers = {"Authorization": "Bearer " + make_jwt(uid="owner")}
    response = app_client.get("/api/drafts/standalone/teams", headers=owner_headers)
    assert response.status_code == 200
    assert "secret-other-token" in response.text
