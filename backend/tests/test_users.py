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


def test_set_user_role_blocks_new_user_from_self_assigning_organizer(app_client, fake_db):
    uid = "new-organizer-attempt-1"
    fake_db.collection("users").document(uid).set({"id": uid, "email": "new-org@example.com"})

    from backend.tests.conftest import make_jwt

    token = make_jwt(uid=uid, email="new-org@example.com", email_verified=True)
    headers = {"Authorization": f"Bearer {token}"}

    r = app_client.post("/api/users/role", json={"role": "organizer"}, headers=headers)
    assert r.status_code == 403, r.text

    stored = fake_db.collection("users").document(uid).get().to_dict()
    assert stored.get("role") is None


def test_set_user_role_rejects_disabled_user(app_client, fake_db, monkeypatch):
    from backend.tests.conftest import make_jwt
    import backend.auth as auth_mod

    uid = "disabled-role-user-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "disabled-role@example.com"}
    )
    monkeypatch.setattr(auth_mod, "_is_user_disabled_cached", lambda _uid, _bucket: True)

    token = make_jwt(uid=uid, email="disabled-role@example.com", email_verified=True)
    response = app_client.post(
        "/api/users/role",
        json={"role": "coach"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "User disabled"


def test_set_user_role_simple_requires_authenticated_identity(app_client, fake_db, monkeypatch):
    monkeypatch.setenv("ENABLE_ROLE_SIMPLE", "true")

    # Missing auth header should be rejected.
    missing = app_client.post("/api/users/role-simple", json={"role": "coach"})
    assert missing.status_code == 401

    # Authenticated request should bind role to token identity.
    from backend.tests.conftest import make_jwt

    uid = "simple-1"
    token = make_jwt(uid=uid, email="simple@example.com", email_verified=True)
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "pytest-role-simple-authenticated",
    }
    ok = app_client.post("/api/users/role-simple", json={"role": "coach"}, headers=headers)
    assert ok.status_code == 200, ok.text

    doc = fake_db.collection("users").document(uid).get()
    assert doc.exists
    assert doc.to_dict().get("role") == "coach"


def test_set_user_role_simple_disabled_by_default(app_client, fake_db):
    from backend.tests.conftest import make_jwt

    uid = "simple-disabled-env-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "simple-disabled-env@example.com"}
    )
    token = make_jwt(uid=uid, email="simple-disabled-env@example.com", email_verified=True)

    response = app_client.post(
        "/api/users/role-simple",
        json={"role": "coach"},
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "pytest-role-simple-disabled-env",
        },
    )

    assert response.status_code == 404


def test_set_user_role_simple_blocks_self_promotion_to_organizer(
    app_client, fake_db, monkeypatch
):
    monkeypatch.setenv("ENABLE_ROLE_SIMPLE", "true")

    from backend.tests.conftest import make_jwt

    uid = "simple-coach-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "simple-coach@example.com", "role": "coach"}
    )
    token = make_jwt(uid=uid, email="simple-coach@example.com", email_verified=True)
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "pytest-role-simple-coach-promotion",
    }

    response = app_client.post(
        "/api/users/role-simple", json={"role": "organizer"}, headers=headers
    )

    assert response.status_code == 403, response.text
    doc = fake_db.collection("users").document(uid).get()
    assert doc.to_dict().get("role") == "coach"


def test_set_user_role_simple_blocks_new_user_from_assigning_organizer(
    app_client, fake_db, monkeypatch
):
    monkeypatch.setenv("ENABLE_ROLE_SIMPLE", "true")

    from backend.tests.conftest import make_jwt

    uid = "simple-new-organizer-attempt-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "simple-new@example.com"}
    )
    token = make_jwt(uid=uid, email="simple-new@example.com", email_verified=True)
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "pytest-role-simple-new-organizer",
    }

    response = app_client.post(
        "/api/users/role-simple", json={"role": "organizer"}, headers=headers
    )

    assert response.status_code == 403, response.text
    doc = fake_db.collection("users").document(uid).get()
    assert doc.to_dict().get("role") is None


def test_set_user_role_simple_allows_organizer_to_keep_organizer(
    app_client, fake_db, monkeypatch
):
    monkeypatch.setenv("ENABLE_ROLE_SIMPLE", "true")

    from backend.tests.conftest import make_jwt

    uid = "simple-organizer-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "simple-organizer@example.com", "role": "organizer"}
    )
    token = make_jwt(uid=uid, email="simple-organizer@example.com", email_verified=True)
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "pytest-role-simple-organizer-keep",
    }

    response = app_client.post(
        "/api/users/role-simple",
        json={"role": "organizer"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    doc = fake_db.collection("users").document(uid).get()
    assert doc.to_dict().get("role") == "organizer"


def test_set_user_role_simple_blocks_organizer_self_demotion(
    app_client, fake_db, monkeypatch
):
    monkeypatch.setenv("ENABLE_ROLE_SIMPLE", "true")

    from backend.tests.conftest import make_jwt

    uid = "simple-organizer-demotion-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "simple-organizer-demotion@example.com", "role": "organizer"}
    )
    token = make_jwt(
        uid=uid, email="simple-organizer-demotion@example.com", email_verified=True
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "pytest-role-simple-organizer-demotion",
    }

    response = app_client.post(
        "/api/users/role-simple",
        json={"role": "coach"},
        headers=headers,
    )

    assert response.status_code == 400, response.text
    doc = fake_db.collection("users").document(uid).get()
    assert doc.to_dict().get("role") == "organizer"


def test_debug_role_rejects_disabled_user(app_client, fake_db, monkeypatch):
    monkeypatch.setenv("ENABLE_DEBUG_ENDPOINTS", "true")

    from backend.tests.conftest import make_jwt
    import backend.auth as auth_mod

    uid = "debug-disabled-1"
    fake_db.collection("users").document(uid).set(
        {"id": uid, "email": "debug-disabled@example.com", "role": "coach"}
    )
    monkeypatch.setattr(auth_mod, "_is_user_disabled_cached", lambda _uid, _bucket: True)
    token = make_jwt(uid=uid, email="debug-disabled@example.com", email_verified=True)

    response = app_client.post(
        "/api/users/debug-role",
        json={"role": "coach"},
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "pytest-debug-role-disabled-user",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "User disabled"
