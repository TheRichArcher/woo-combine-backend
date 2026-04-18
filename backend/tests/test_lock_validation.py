from fastapi import HTTPException

from backend.utils import authorization as authz
from backend.utils import lock_validation as lock_validation


def _patch_db(monkeypatch, fake_db):
    monkeypatch.setattr(lock_validation, "db", fake_db)
    monkeypatch.setattr(authz, "db", fake_db)
    monkeypatch.setattr(lock_validation, "execute_with_timeout", lambda func, **kwargs: func())
    monkeypatch.setattr(authz, "execute_with_timeout", lambda func, **kwargs: func())


def _seed_event(fake_db, event_id: str, league_id: str, *, is_locked: bool = False):
    fake_db.collection("events").document(event_id).set(
        {
            "name": "Combine",
            "league_id": league_id,
            "isLocked": is_locked,
        }
    )


def _seed_membership(
    fake_db,
    user_id: str,
    league_id: str,
    *,
    role: str,
    can_write: bool | None = None,
    coach_event_ids: list[str] | None = None,
):
    membership = {"role": role}
    if can_write is not None:
        membership["canWrite"] = can_write
    if role == "coach":
        membership["coach_event_ids"] = coach_event_ids or ["event-1"]
    fake_db.collection("user_memberships").document(user_id).set(
        {"leagues": {league_id: membership}}
    )


def test_check_write_permission_allows_organizer_membership_on_locked_event(
    monkeypatch, fake_db
):
    _patch_db(monkeypatch, fake_db)
    _seed_event(fake_db, "event-1", "league-1", is_locked=True)
    _seed_membership(fake_db, "user-1", "league-1", role="organizer")

    membership = lock_validation.check_write_permission(
        event_id="event-1",
        user_id="user-1",
        operation_name="locked write",
    )

    assert membership["role"] == "organizer"


def test_check_write_permission_allows_coach_with_can_write_when_unlocked(
    monkeypatch, fake_db
):
    _patch_db(monkeypatch, fake_db)
    _seed_event(fake_db, "event-1", "league-1", is_locked=False)
    _seed_membership(fake_db, "user-1", "league-1", role="coach", can_write=True)

    membership = lock_validation.check_write_permission(
        event_id="event-1",
        user_id="user-1",
        operation_name="coach write",
    )

    assert membership["role"] == "coach"
    assert membership["canWrite"] is True


def test_check_write_permission_blocks_coach_with_can_write_false(monkeypatch, fake_db):
    _patch_db(monkeypatch, fake_db)
    _seed_event(fake_db, "event-1", "league-1", is_locked=False)
    _seed_membership(fake_db, "user-1", "league-1", role="coach", can_write=False)

    try:
        lock_validation.check_write_permission(
            event_id="event-1",
            user_id="user-1",
            operation_name="coach write",
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "read-only" in exc.detail


def test_check_write_permission_blocks_viewer_membership_even_with_global_organizer_hint(
    monkeypatch, fake_db
):
    _patch_db(monkeypatch, fake_db)
    _seed_event(fake_db, "event-1", "league-1", is_locked=False)
    _seed_membership(fake_db, "user-1", "league-1", role="viewer")

    try:
        lock_validation.check_write_permission(
            event_id="event-1",
            user_id="user-1",
            user_role="organizer",
            operation_name="viewer write attempt",
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "Insufficient league permissions" in exc.detail


def test_check_write_permission_blocks_role_drift_global_organizer_vs_scoped_coach_read_only(
    monkeypatch, fake_db
):
    _patch_db(monkeypatch, fake_db)
    _seed_event(fake_db, "event-1", "league-1", is_locked=False)
    _seed_membership(fake_db, "user-1", "league-1", role="coach", can_write=False)

    try:
        lock_validation.check_write_permission(
            event_id="event-1",
            user_id="user-1",
            user_role="organizer",
            operation_name="role drift write attempt",
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "read-only" in exc.detail


def test_check_write_permission_blocks_missing_membership(monkeypatch, fake_db):
    _patch_db(monkeypatch, fake_db)
    _seed_event(fake_db, "event-1", "league-1", is_locked=False)

    try:
        lock_validation.check_write_permission(
            event_id="event-1",
            user_id="user-1",
            operation_name="no membership write",
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "You do not have access to this league" in exc.detail


def test_check_write_permission_blocks_coach_for_unassigned_event(monkeypatch, fake_db):
    _patch_db(monkeypatch, fake_db)
    _seed_event(fake_db, "event-2", "league-1", is_locked=False)
    _seed_membership(
        fake_db,
        "user-1",
        "league-1",
        role="coach",
        can_write=True,
        coach_event_ids=["event-1"],
    )

    try:
        lock_validation.check_write_permission(
            event_id="event-2",
            user_id="user-1",
            operation_name="unassigned event write",
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "access to this event" in exc.detail
