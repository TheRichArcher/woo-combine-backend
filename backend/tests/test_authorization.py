import pytest
from fastapi import HTTPException
import ast
import importlib
from pathlib import Path

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


def test_ensure_event_access_allows_scoped_coach_assignment(monkeypatch):
    store = {
        "user_memberships/user-2": {
            "leagues": {
                "league-abc": {
                    "role": "coach",
                    "coach_event_ids": ["event-9"],
                }
            }
        },
        "events/event-9": {"league_id": "league-abc", "name": "Combine"},
    }
    _install_fakes(monkeypatch, store)

    event = authz.ensure_event_access(
        "user-2",
        "event-9",
        allowed_roles=("organizer", "coach"),
    )
    assert event["league_id"] == "league-abc"


def test_ensure_event_access_denies_unscoped_coach(monkeypatch):
    store = {
        "user_memberships/user-2": {
            "leagues": {
                "league-abc": {
                    "role": "coach",
                    "coach_event_ids": ["event-11"],
                }
            }
        },
        "events/event-9": {"league_id": "league-abc", "name": "Combine"},
    }
    _install_fakes(monkeypatch, store)

    with pytest.raises(HTTPException) as exc:
        authz.ensure_event_access(
            "user-2",
            "event-9",
            allowed_roles=("organizer", "coach"),
        )
    assert exc.value.status_code == 403


def test_ensure_event_access_denies_coach_with_no_assignments(monkeypatch):
    store = {
        "user_memberships/user-2": {
            "leagues": {
                "league-abc": {
                    "role": "coach",
                    "joined_at": "2026-01-01T00:00:00Z",
                }
            }
        },
        "events/event-9": {"league_id": "league-abc", "name": "Combine"},
    }
    _install_fakes(monkeypatch, store)

    with pytest.raises(HTTPException) as exc:
        authz.ensure_event_access(
            "user-2",
            "event-9",
            allowed_roles=("organizer", "coach"),
        )
    assert exc.value.status_code == 403
    assert exc.value.detail == "You are not assigned to any events"


def test_ensure_event_access_blocks_other_leagues(monkeypatch):
    store = {
        "user_memberships/user-3": {"leagues": {"league-xyz": {"role": "viewer"}}},
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


def test_ensure_event_access_denies_player_role_even_without_allowed_roles(monkeypatch):
    store = {
        "user_memberships/user-9": {
            "leagues": {
                "league-abc": {
                    "role": "player",
                    "event_ids": ["event-9"],
                }
            }
        },
        "events/event-9": {"league_id": "league-abc", "name": "Combine"},
    }
    _install_fakes(monkeypatch, store)

    with pytest.raises(HTTPException) as exc:
        authz.ensure_event_access("user-9", "event-9")
    assert exc.value.status_code == 403


def test_ensure_event_access_denies_viewer_without_explicit_scope(monkeypatch):
    store = {
        "user_memberships/user-10": {
            "leagues": {
                "league-abc": {
                    "role": "viewer",
                }
            }
        },
        "events/event-9": {"league_id": "league-abc", "name": "Combine"},
    }
    _install_fakes(monkeypatch, store)

    with pytest.raises(HTTPException) as exc:
        authz.ensure_event_access("user-10", "event-9")
    assert exc.value.status_code == 403


def test_permission_registry_matches_matrix():
    if not REGISTERED_PERMISSIONS:
        import backend.main  # noqa: F401 - imports routes and registers decorators

    assert REGISTERED_PERMISSIONS, "No endpoints registered with RBAC decorator"
    for record in REGISTERED_PERMISSIONS:
        key = (record["resource"], record["action"])
        assert key in ACCESS_MATRIX
        assert record["allowed_roles"] == sorted(ACCESS_MATRIX[key])


def _is_depends_require_role_call(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call):
        return False
    if not isinstance(node.func, ast.Name) or node.func.id != "Depends":
        return False
    if not node.args:
        return False
    first_arg = node.args[0]
    return (
        isinstance(first_arg, ast.Call)
        and isinstance(first_arg.func, ast.Name)
        and first_arg.func.id == "require_role"
    )


def _node_contains_depends_require_role(node: ast.AST) -> bool:
    return any(_is_depends_require_role_call(candidate) for candidate in ast.walk(node))


def _find_endpoint_node(tree: ast.AST, function_name: str):
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
            return node
    return None


def test_scoped_rbac_routes_do_not_use_global_require_role_dependency():
    if not REGISTERED_PERMISSIONS:
        import backend.main  # noqa: F401 - imports routes and registers decorators

    parsed_modules: dict[str, tuple[ast.AST, Path]] = {}
    violations: list[str] = []

    for record in REGISTERED_PERMISSIONS:
        if record.get("target") not in {"event", "league"}:
            continue

        endpoint = record["endpoint"]
        module_name, function_name = endpoint.rsplit(".", 1)
        if module_name not in parsed_modules:
            module = importlib.import_module(module_name)
            module_path = Path(module.__file__)
            parsed_modules[module_name] = (ast.parse(module_path.read_text()), module_path)

        tree, module_path = parsed_modules[module_name]
        endpoint_node = _find_endpoint_node(tree, function_name)
        if endpoint_node is None:
            violations.append(f"{endpoint} (definition not found in {module_path})")
            continue

        # Disallow global role gating in function dependency parameters.
        defaults = list(endpoint_node.args.defaults) + [
            default for default in endpoint_node.args.kw_defaults if default is not None
        ]
        for default_node in defaults:
            if _is_depends_require_role_call(default_node):
                violations.append(
                    f"{endpoint} uses Depends(require_role(...)) in function parameters"
                )

        # Also disallow route-level dependencies=[Depends(require_role(...))] on decorators.
        for decorator_node in endpoint_node.decorator_list:
            if isinstance(decorator_node, ast.Call):
                for keyword in decorator_node.keywords:
                    if keyword.arg == "dependencies" and _node_contains_depends_require_role(
                        keyword.value
                    ):
                        violations.append(
                            f"{endpoint} uses dependencies=[Depends(require_role(...))] in route decorator"
                        )

    assert not violations, "Scoped RBAC endpoints must not depend on global require_role:\n" + "\n".join(
        sorted(set(violations))
    )
