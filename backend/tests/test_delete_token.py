"""Unit tests for delete-intent JWT flow (in-memory store; single-instance semantics)."""

import pytest

from backend.utils import delete_token as dt


@pytest.fixture
def secret_key(monkeypatch):
    key = "unit-test-delete-token-secret-32bytes!"
    monkeypatch.setattr(dt, "SECRET_KEY", key, raising=False)
    dt._token_usage_store.clear()
    yield key
    dt._token_usage_store.clear()


def test_generate_validate_and_one_time_use(secret_key):
    uid, league, ev = "user-1", "league-a", "event-x"
    token = dt.generate_delete_intent_token(uid, league, ev)
    payload = dt.validate_delete_intent_token(
        token, uid, league, ev, mark_as_used=False
    )
    assert payload["purpose"] == "event_deletion"
    assert payload["target_event_id"] == ev

    dt.validate_delete_intent_token(token, uid, league, ev, mark_as_used=True)

    with pytest.raises(ValueError, match="already used|Replay"):
        dt.validate_delete_intent_token(token, uid, league, ev, mark_as_used=False)


def test_claim_mismatch_rejected(secret_key):
    token = dt.generate_delete_intent_token("u1", "l1", "e1")
    with pytest.raises(ValueError, match="mismatch"):
        dt.validate_delete_intent_token(token, "u2", "l1", "e1", mark_as_used=False)

    token2 = dt.generate_delete_intent_token("u1", "l1", "e1")
    with pytest.raises(ValueError, match="mismatch"):
        dt.validate_delete_intent_token(token2, "u1", "l1", "e-wrong", mark_as_used=False)


def test_cleanup_expired_tokens(secret_key):
    """Expired entries in the store are removed (memory hygiene)."""
    from datetime import datetime, timedelta

    dt._token_usage_store["stale"] = {
        "user_id": "x",
        "target_event_id": "y",
        "expires_at": datetime.utcnow() - timedelta(hours=1),
        "used_at": None,
    }
    removed = dt.cleanup_expired_tokens()
    assert removed >= 1
    assert "stale" not in dt._token_usage_store
