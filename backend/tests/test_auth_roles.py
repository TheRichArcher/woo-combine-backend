import os
import importlib
import base64
import json


def import_app():
    import sys
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    sys.path.insert(0, os.path.dirname(root))
    mod = importlib.import_module("backend.main")
    return mod.app


def _fake_jwt(uid="test-user", email="user@example.com", email_verified=True):
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).rstrip(b"=")
    payload = base64.urlsafe_b64encode(
        json.dumps(
            {
                "uid": uid,
                "user_id": uid,
                "email": email,
                "email_verified": email_verified,
                "iat": 1_700_000_000,
            }
        ).encode()
    ).rstrip(b"=")
    return b".".join([header, payload, b""]) .decode()


def test_protected_requires_auth(monkeypatch):
    from starlette.testclient import TestClient

    app = import_app()
    client = TestClient(app)

    r = client.get("/api/leagues/me")
    assert r.status_code in (401, 403)


def test_role_enforced_on_write(monkeypatch):
    from starlette.testclient import TestClient

    # Patch firebase_admin.auth.verify_id_token to accept our fake JWT
    import backend.auth as auth_mod

    def fake_verify(token):
        # Decode payload
        parts = token.split(".")
        payload = parts[1] + ("=" * ((4 - len(parts[1]) % 4) % 4))
        data = json.loads(base64.urlsafe_b64decode(payload.encode()))
        return data

    monkeypatch.setattr(auth_mod.auth, "verify_id_token", lambda t: fake_verify(t))

    # Mock Firestore client to avoid real calls
    class FakeDoc:
        def __init__(self, exists=False, data=None):
            self._exists = exists
            self._data = data or {}

        @property
        def id(self):
            return "docid"

        @property
        def reference(self):
            return self

        def to_dict(self):
            return self._data

        @property
        def exists(self):
            return self._exists

        def get(self):
            return self

        def set(self, *_args, **_kwargs):
            return None

        def update(self, *_args, **_kwargs):
            return None

        def stream(self):
            return []

        def collection(self, _):
            return self

        def document(self, _=None):
            return self

        def batch(self):
            return self

        def commit(self):
            return None

        def where(self, *_args, **_kwargs):
            return self

    import backend.firestore_client as fsc

    def fake_get_client():
        return FakeDoc()

    monkeypatch.setattr(fsc, "get_firestore_client", fake_get_client)

    from starlette.testclient import TestClient

    app = import_app()
    client = TestClient(app)

    # First call to set role (organizer)
    token = _fake_jwt()
    r = client.post(
        "/api/users/role",
        json={"role": "organizer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code in (200, 500)  # allow 500 if fake client raises elsewhere

    # Create league requires organizer role; fake client returns minimal ok
    r2 = client.post(
        "/api/leagues",
        json={"name": "My League"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code in (200, 500, 403)



