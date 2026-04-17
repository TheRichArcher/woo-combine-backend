from backend.tests.conftest import make_jwt


def _headers(uid: str, email: str):
    return {"Authorization": f"Bearer {make_jwt(uid=uid, email=email, email_verified=True)}"}


def _seed_user(fake_db, uid: str, email: str, role: str, leagues: dict | None = None):
    fake_db.collection("users").document(uid).set({"id": uid, "email": email, "role": role})
    if leagues is not None:
        fake_db.collection("user_memberships").document(uid).set({"leagues": leagues})


def _seed_draft(fake_db, draft_id: str, league_id: str | None, created_by: str):
    fake_db.collection("drafts").document(draft_id).set(
        {
            "id": draft_id,
            "name": f"Draft {draft_id}",
            "league_id": league_id,
            "created_by": created_by,
            "status": "setup",
        }
    )


def test_draft_policy_matrix_list_and_mutation_access(app_client, fake_db):
    # Users: organizer/coaches/viewer in league-1, outsider in no leagues.
    _seed_user(
        fake_db,
        "org-1",
        "org@example.com",
        "organizer",
        leagues={"league-1": {"role": "organizer"}},
    )
    _seed_user(
        fake_db,
        "coach-1",
        "coach@example.com",
        "coach",
        leagues={"league-1": {"role": "coach"}},
    )
    _seed_user(
        fake_db,
        "viewer-1",
        "viewer@example.com",
        "viewer",
        leagues={"league-1": {"role": "viewer"}},
    )
    _seed_user(fake_db, "outsider-1", "outsider@example.com", "viewer")
    _seed_user(fake_db, "coach-explicit-1", "coach-explicit@example.com", "coach")

    # Drafts:
    # - draft-league-1 visible to league-1 staff
    # - draft-coach-owned allows coach mutation as creator/admin
    # - draft-explicit-coach in another league but with explicit coach assignment
    # - draft-explicit-viewer in another league with (bad data) viewer assigned as coach_user_id
    _seed_draft(fake_db, "draft-league-1", "league-1", "org-1")
    _seed_draft(fake_db, "draft-coach-owned", "league-1", "coach-1")
    _seed_draft(fake_db, "draft-explicit-coach", "league-2", "org-2")
    _seed_draft(fake_db, "draft-explicit-viewer", "league-2", "org-2")

    fake_db.collection("draft_teams").document("team-explicit-coach").set(
        {
            "id": "team-explicit-coach",
            "draft_id": "draft-explicit-coach",
            "team_name": "Coach Team",
            "coach_user_id": "coach-explicit-1",
        }
    )
    fake_db.collection("draft_teams").document("team-explicit-viewer").set(
        {
            "id": "team-explicit-viewer",
            "draft_id": "draft-explicit-viewer",
            "team_name": "Viewer Team",
            "coach_user_id": "viewer-1",
        }
    )

    org_headers = _headers("org-1", "org@example.com")
    coach_headers = _headers("coach-1", "coach@example.com")
    viewer_headers = _headers("viewer-1", "viewer@example.com")
    outsider_headers = _headers("outsider-1", "outsider@example.com")
    explicit_coach_headers = _headers("coach-explicit-1", "coach-explicit@example.com")

    # Draft list policy (staff-only; explicit staff access allowed).
    org_list = app_client.get("/api/drafts", headers=org_headers)
    assert org_list.status_code == 200
    assert {d["id"] for d in org_list.json()} == {"draft-league-1", "draft-coach-owned"}

    coach_list = app_client.get("/api/drafts", headers=coach_headers)
    assert coach_list.status_code == 200
    assert {d["id"] for d in coach_list.json()} == {"draft-league-1", "draft-coach-owned"}

    viewer_list = app_client.get("/api/drafts", headers=viewer_headers)
    assert viewer_list.status_code == 200
    assert viewer_list.json() == []

    outsider_list = app_client.get("/api/drafts", headers=outsider_headers)
    assert outsider_list.status_code == 200
    assert outsider_list.json() == []

    explicit_coach_list = app_client.get("/api/drafts", headers=explicit_coach_headers)
    assert explicit_coach_list.status_code == 200
    assert {d["id"] for d in explicit_coach_list.json()} == {"draft-explicit-coach"}

    # Mutation policy (admin-only per draft).
    org_patch = app_client.patch(
        "/api/drafts/draft-league-1", headers=org_headers, json={"name": "Org Updated Draft"}
    )
    assert org_patch.status_code == 200

    coach_patch_not_owner = app_client.patch(
        "/api/drafts/draft-league-1", headers=coach_headers, json={"name": "Coach Blocked"}
    )
    assert coach_patch_not_owner.status_code == 403

    coach_patch_owner = app_client.patch(
        "/api/drafts/draft-coach-owned", headers=coach_headers, json={"name": "Coach Owned Update"}
    )
    assert coach_patch_owner.status_code == 200

    viewer_patch = app_client.patch(
        "/api/drafts/draft-league-1", headers=viewer_headers, json={"name": "Viewer Blocked"}
    )
    assert viewer_patch.status_code == 403

