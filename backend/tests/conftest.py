import base64
import json
import itertools
import pytest


def make_jwt(uid: str = "user-1", email: str = "user@example.com", email_verified: bool = True):
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).rstrip(b"=")
    payload = base64.urlsafe_b64encode(
        json.dumps(
            {
                "uid": uid,
                "user_id": uid,
                "email": email,
                "email_verified": email_verified,
                "iat": 1_700_000_000,
                "auth_time": 1_700_000_000,
            }
        ).encode()
    ).rstrip(b"=")
    return b".".join([header, payload, b""]).decode()


class FakeSnapshot:
    def __init__(self, store, path, data=None, exists=True):
        self._store = store
        self._path = path
        self._data = data or {}
        self.exists = exists

    @property
    def id(self):
        return self._path.split("/")[-1]

    @property
    def reference(self):
        return FakeDocument(self._store, self._path)

    def to_dict(self):
        return dict(self._data)


class FakeQuery:
    def __init__(self, docs):
        self._docs = list(docs)

    @staticmethod
    def _parse_filter_kwargs(kwargs):
        ff = kwargs.get("filter")
        if ff is None:
            return None
        field = getattr(ff, "field_path", None) or getattr(ff, "_field_path", None)
        op = getattr(ff, "op_string", None) or getattr(ff, "_op_string", None)
        value = getattr(ff, "value", None) or getattr(ff, "_value", None)
        if field is None or op is None:
            raise ValueError("Unsupported filter object")
        return field, op, value

    def where(self, field=None, op=None, value=None, **kwargs):
        parsed = self._parse_filter_kwargs(kwargs)
        if parsed is not None:
            field, op, value = parsed
        if field is None or op is None:
            raise ValueError("where() requires field/op/value or filter=")

        def match(doc):
            d = doc.to_dict() or {}
            if op == "==":
                return d.get(field) == value
            if op == ">":
                try:
                    return d.get(field) is not None and d.get(field) > value
                except Exception:
                    return False
            # Fallback: treat as field existence check
            return d.get(field) is not None

        return FakeQuery([doc for doc in self._docs if match(doc)])

    def order_by(self, field, direction=None):
        reverse = bool(direction) and str(direction).lower().endswith("descending")
        return FakeQuery(sorted(self._docs, key=lambda d: (d.to_dict() or {}).get(field, ""), reverse=reverse))

    def limit(self, n):
        return FakeQuery(self._docs[:n])

    def stream(self):
        return list(self._docs)


class FakeDocument:
    def __init__(self, store, path):
        self._store = store
        self._path = path

    @property
    def id(self):
        return self._path.split("/")[-1]

    def get(self):
        data = self._store.get(self._path)
        if data is None:
            return FakeSnapshot(self._store, self._path, {}, exists=False)
        return FakeSnapshot(self._store, self._path, data, exists=True)

    def set(self, data, merge=False):
        if merge and self._path in self._store:
            merged = dict(self._store[self._path])
            merged.update(dict(data))
            self._store[self._path] = merged
        else:
            self._store[self._path] = dict(data)

    def update(self, data):
        if self._path not in self._store:
            raise KeyError("document does not exist")
        merged = dict(self._store[self._path])
        merged.update(dict(data))
        self._store[self._path] = merged

    def delete(self):
        self._store.pop(self._path, None)

    def collection(self, name):
        return FakeCollection(self._store, f"{self._path}/{name}")


class FakeCollection:
    def __init__(self, store, path, id_seq=None):
        self._store = store
        self._path = path
        self._id_seq = id_seq or itertools.count(1)

    def document(self, doc_id=None):
        if doc_id is None:
            doc_id = f"auto-{next(self._id_seq)}"
        return FakeDocument(self._store, f"{self._path}/{doc_id}")

    def _iter_docs(self):
        prefix = self._path + "/"
        for k, v in list(self._store.items()):
            if not k.startswith(prefix):
                continue
            rest = k[len(prefix):]
            if "/" in rest:
                continue  # nested deeper
            yield FakeSnapshot(self._store, k, v, exists=True)

    def stream(self):
        return list(self._iter_docs())

    def where(self, field=None, op=None, value=None, **kwargs):
        return FakeQuery(self.stream()).where(field, op, value, **kwargs)

    def order_by(self, field, direction=None):
        return FakeQuery(self.stream()).order_by(field, direction=direction)

    def limit(self, n):
        return FakeQuery(self.stream()).limit(n)


class FakeBatch:
    def __init__(self):
        self._ops = []

    def set(self, doc_ref, data, **kwargs):
        # Accept Firestore-like kwargs (merge=True)
        self._ops.append(("set", doc_ref, data, kwargs))

    def update(self, doc_ref, data):
        self._ops.append(("update", doc_ref, data, {}))

    def delete(self, doc_ref):
        self._ops.append(("delete", doc_ref, None, {}))

    def commit(self):
        for op, ref, data, kwargs in self._ops:
            if op == "set":
                ref.set(data, **kwargs)
            elif op == "update":
                ref.update(data)
            elif op == "delete":
                ref.delete()
        return None


class FakeFirestore:
    def __init__(self, store=None):
        self.store = store if store is not None else {}
        self._id_seq = itertools.count(1)

        # Minimal Firestore Query constants used in a few routes
        class _Query:
            DESCENDING = "descending"
            ASCENDING = "ascending"

        self.Query = _Query

    def collection(self, name):
        return FakeCollection(self.store, name, id_seq=self._id_seq)

    def batch(self):
        return FakeBatch()

    def get_all(self, doc_refs):
        return [ref.get() for ref in doc_refs]


@pytest.fixture()
def fake_db():
    store = {}
    db = FakeFirestore(store)
    return db


@pytest.fixture()
def app_client(monkeypatch, fake_db):
    """TestClient with Firebase auth + Firestore mocked to an in-memory fake."""
    # Patch firebase_admin.auth.verify_id_token to accept our fake JWTs
    import backend.auth as auth_mod

    def fake_verify(token, *args, **kwargs):
        parts = token.split(".")
        payload = parts[1] + ("=" * ((4 - len(parts[1]) % 4) % 4))
        return json.loads(base64.urlsafe_b64decode(payload.encode()))

    monkeypatch.setattr(auth_mod.auth, "verify_id_token", fake_verify)
    monkeypatch.setattr(auth_mod, "_verify_id_token_strict", lambda t: fake_verify(t))
    monkeypatch.setattr(auth_mod, "_enforce_session_max_age", lambda decoded: None)

    # Patch Firestore client getters used across modules
    import backend.firestore_client as fsc

    monkeypatch.setattr(fsc, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(auth_mod, "get_firestore_client", lambda: fake_db)

    # Import app after patching
    from starlette.testclient import TestClient
    import importlib

    mod = importlib.import_module("backend.main")
    app = mod.app

    # Patch execute_with_timeout everywhere it is imported as a local symbol
    import sys

    def no_timeout(func, **_kwargs):
        return func()

    for name, module in list(sys.modules.items()):
        if not name or not name.startswith("backend"):
            continue
        if hasattr(module, "execute_with_timeout"):
            monkeypatch.setattr(module, "execute_with_timeout", no_timeout, raising=False)
        if hasattr(module, "check_write_permission"):
            monkeypatch.setattr(
                module,
                "check_write_permission",
                lambda *args, **kwargs: {"canWrite": True},
                raising=False,
            )
        if hasattr(module, "get_firestore_client"):
            monkeypatch.setattr(module, "get_firestore_client", lambda: fake_db, raising=False)
        if hasattr(module, "db") and getattr(module, "db") is not fake_db:
            # Route modules import db directly; patch their local alias too.
            monkeypatch.setattr(module, "db", fake_db, raising=False)

    return TestClient(app)


@pytest.fixture()
def auth_headers():
    token = make_jwt(uid="user-1", email_verified=True)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def organizer_headers(fake_db):
    # Ensure user has organizer role + membership
    uid = "org-1"
    fake_db.collection("users").document(uid).set({"id": uid, "email": "o@example.com", "role": "organizer"})
    fake_db.collection("user_memberships").document(uid).set({"leagues": {"league-1": {"role": "organizer"}}})
    token = make_jwt(uid=uid, email="o@example.com", email_verified=True)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def coach_headers(fake_db):
    uid = "coach-1"
    fake_db.collection("users").document(uid).set({"id": uid, "email": "c@example.com", "role": "coach"})
    fake_db.collection("user_memberships").document(uid).set(
        {"leagues": {"league-1": {"role": "coach", "coach_event_ids": ["event-1"]}}}
    )
    token = make_jwt(uid=uid, email="c@example.com", email_verified=True)
    return {"Authorization": f"Bearer {token}"}
