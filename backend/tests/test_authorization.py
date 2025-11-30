import pytest
from fastapi import HTTPException

from backend.utils import authorization as authz
from backend.security.access_matrix import ACCESS_MATRIX, REGISTERED_PERMISSIONS


class FakeSnapshot:
    def __init__(self, data=None, exists=True, doc_id=None):
        self._data = data or {}
        self.exists = exists
        self.id = doc_id

    def to_dict(self):
        return self._data


class FakeDocument:
    def __init__(self, store, path):
        self._store = store
        self._path = path

    def get(self):
        data = self._store.get(self._path)
        doc_id = self._path.split("/")[-1]
        if data is None:
            return FakeSnapshot({}, False, doc_id)
        return FakeSnapshot(data, True, doc_id)

    def collection(self, name):
        return FakeCollection(self._store, f"{self._path}/{name}")


class FakeCollection:
    def __init__(self, store, path):
        self._store = store
        self._path = path

    def document(self, doc_id):
        return FakeDocument(self._store, f"{self._path}/{doc_id}")


class FakeFirestore:
    def __init__(self, store):
        self._store = store

    def collection(self, name):
        return FakeCollection(self._store, name)


def _install_fakes(monkeypatch, store):
    fake_db = FakeFirestore(store)
    monkeypatch.setattr(authz, "db", fake_db)
    monkeypatch.setattr(authz, "execute_with_timeout", lambda func, **kwargs: func())


def test_ensure_league_access_allows_member(monkeypatch):
    store = {
        "user_memberships/user-1": {
            "leagues": {
                "league-123": {"role": "coach", "joined_at": "2024-01-01T00:00:00Z"}
            }
        }
    }
    _install_fakes(monkeypatch, store)

    membership = authz.ensure_league_access("user-1", "league-123")
    assert membership["role"] == "coach"


def test_ensure_league_access_denies_non_member(monkeypatch):
    store = {"user_memberships/user-1": {"leagues": {}}}
    _install_fakes(monkeypatch, store)

    with pytest.raises(HTTPException) as exc:
        authz.ensure_league_access("user-1", "league-unknown")
    assert exc.value.status_code == 403


def test_ensure_event_access_inherits_league_roles(monkeypatch):
    store = {
        "user_memberships/user-2": {
            "leagues": {"league-abc": {"role": "organizer"}}
        },
        "events/event-9": {"league_id": "league-abc", "name": "Combine"},
    }
    _install_fakes(monkeypatch, store)

    event = authz.ensure_event_access(
        "user-2",
        "event-9",
        allowed_roles=("organizer",),
    )
    assert event["league_id"] == "league-abc"


def test_ensure_event_access_blocks_other_leagues(monkeypatch):
    store = {
        "user_memberships/user-3": {
            "leagues": {"league-xyz": {"role": "viewer"}}
        },
        "events/event-10": {"league_id": "league-abc"},
    }
    _install_fakes(monkeypatch, store)

    with pytest.raises(HTTPException) as exc:
        authz.ensure_event_access(
            "user-3",
            "event-10",
            allowed_roles=("organizer", "coach"),
        )
    assert exc.value.status_code == 403


def test_permission_registry_matches_matrix():
    assert REGISTERED_PERMISSIONS, "No endpoints registered with RBAC decorator"
    for record in REGISTERED_PERMISSIONS:
        key = (record["resource"], record["action"])
        assert key in ACCESS_MATRIX
        assert record["allowed_roles"] == sorted(ACCESS_MATRIX[key])

