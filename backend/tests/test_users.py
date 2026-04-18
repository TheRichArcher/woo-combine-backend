def test_get_current_user_profile(app_client, fake_db, coach_headers):
    # coach_headers seeds /users/coach-1
    r = app_client.get("/api/users/me", headers=coach_headers)
    assert r.status_code == 200
    assert r.json()["id"] == "coach-1"


def test_set_user_role_valid_and_invalid(app_client, fake_db):
    # Seed a user without role
    uid = "new-1"
    fake_db.collection("users").document(uid).set({"id": uid, "email": "n@example.com"})

    from backend.tests.conftest import make_jwt

    token = make_jwt(uid=uid, email="n@example.com", email_verified=True)
    headers = {"Authorization": f"Bearer {token}"}

    r_bad = app_client.post("/api/users/role", json={"role": "nope"}, headers=headers)
    assert r_bad.status_code == 400

    r_ok = app_client.post("/api/users/role", json={"role": "coach"}, headers=headers)
    assert r_ok.status_code == 200, r_ok.text
    doc = fake_db.collection("users").document(uid).get()
    assert doc.to_dict().get("role") == "coach"


def test_set_user_role_blocks_self_promotion_to_organizer(app_client, fake_db, coach_headers):
    # Existing coach must not be able to self-promote to organizer.
    r = app_client.post("/api/users/role", json={"role": "organizer"}, headers=coach_headers)
    assert r.status_code == 403, r.text

    coach_doc = fake_db.collection("users").document("coach-1").get()
    assert coach_doc.to_dict().get("role") == "coach"


def test_set_user_role_simple_requires_authenticated_identity(app_client, fake_db, monkeypatch):
    monkeypatch.setenv("ENABLE_ROLE_SIMPLE", "true")

    # Missing auth header should be rejected.
    missing = app_client.post("/api/users/role-simple", json={"role": "coach"})
    assert missing.status_code == 401

    # Authenticated request should bind role to token identity.
    from backend.tests.conftest import make_jwt

    uid = "simple-1"
    token = make_jwt(uid=uid, email="simple@example.com", email_verified=True)
    headers = {"Authorization": f"Bearer {token}"}
    ok = app_client.post("/api/users/role-simple", json={"role": "coach"}, headers=headers)
    assert ok.status_code == 200, ok.text

    doc = fake_db.collection("users").document(uid).get()
    assert doc.exists
    assert doc.to_dict().get("role") == "coach"
