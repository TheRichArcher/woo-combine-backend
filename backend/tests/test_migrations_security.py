from backend.tests.conftest import make_jwt


def _headers(uid: str, email: str):
    return {"Authorization": f"Bearer {make_jwt(uid=uid, email=email, email_verified=True)}"}


def test_migration_endpoint_disabled_by_default_even_for_admin(app_client, fake_db):
    fake_db.collection("users").document("admin-1").set(
        {"id": "admin-1", "email": "admin@example.com", "role": "admin"}
    )
    headers = _headers("admin-1", "admin@example.com")

    r = app_client.post("/api/migrations/migrate-scores", headers=headers)
    assert r.status_code == 404, r.text


def test_migration_endpoint_requires_admin_role_when_enabled(app_client, fake_db, monkeypatch):
    monkeypatch.setenv("ENABLE_SCORE_MIGRATIONS", "true")

    fake_db.collection("users").document("org-1").set(
        {"id": "org-1", "email": "org@example.com", "role": "organizer"}
    )
    organizer_headers = _headers("org-1", "org@example.com")

    r = app_client.post("/api/migrations/migrate-scores", headers=organizer_headers)
    assert r.status_code == 403, r.text


def test_migration_endpoint_allows_admin_when_enabled(app_client, fake_db, monkeypatch):
    monkeypatch.setenv("ENABLE_SCORE_MIGRATIONS", "true")
    fake_db.collection("users").document("admin-2").set(
        {"id": "admin-2", "email": "admin2@example.com", "role": "admin"}
    )
    headers = _headers("admin-2", "admin2@example.com")

    r = app_client.post("/api/migrations/migrate-scores", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "success"
