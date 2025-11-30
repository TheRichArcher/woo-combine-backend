"""
Authorization helpers shared across route modules.

Ensures that league-scoped endpoints enforce membership checks rather than
relying solely on global user roles.
"""
from fastapi import HTTPException
import logging
import time
from collections import defaultdict
from typing import Dict, Iterable, Optional, Set

from ..firestore_client import db
from .database import execute_with_timeout

_denial_tracker: Dict[str, Dict[str, float]] = defaultdict(lambda: {"count": 0, "first": 0.0})


def _register_denial(key: str):
    now = time.time()
    info = _denial_tracker[key]
    if now - info["first"] > 300:
        info["count"] = 0
        info["first"] = now
    info["count"] += 1
    if info["first"] == 0:
        info["first"] = now
    if info["count"] in (3, 5, 10):
        logging.warning("[AUTHZ] Repeated permission denials for %s (%s in last 5m)", key, info["count"])


def _normalize_allowed_roles(allowed_roles: Optional[Iterable[str]]) -> Optional[Set[str]]:
    if not allowed_roles:
        return None
    return {role.strip().lower() for role in allowed_roles if isinstance(role, str)}


def ensure_league_access(
    user_id: str,
    league_id: str,
    *,
    allowed_roles: Optional[Iterable[str]] = None,
    operation_name: str = "league access",
) -> dict:
    """
    Verify that the given user belongs to the league and (optionally) has one
    of the allowed roles. Returns the membership metadata for auditing.
    """
    normalized_roles = _normalize_allowed_roles(allowed_roles)
    membership = None

    try:
        # Fast path: user_memberships document
        memberships_ref = db.collection("user_memberships").document(user_id)
        memberships_doc = execute_with_timeout(
            lambda: memberships_ref.get(),
            timeout=6,
            operation_name=f"{operation_name} membership lookup",
        )

        if memberships_doc.exists:
            leagues_data = memberships_doc.to_dict().get("leagues", {})
            membership = leagues_data.get(league_id)

        if not membership:
            # Fallback: legacy members subcollection
            member_ref = (
                db.collection("leagues")
                .document(league_id)
                .collection("members")
                .document(user_id)
            )
            member_doc = execute_with_timeout(
                lambda: member_ref.get(),
                timeout=6,
                operation_name=f"{operation_name} legacy membership lookup",
            )
            if member_doc.exists:
                membership = member_doc.to_dict() or {}

        if not membership:
            logging.warning(
                "[AUTHZ] User %s attempted %s on league %s without membership",
                user_id,
                operation_name,
                league_id,
            )
            _register_denial(f"league:{league_id}")
            raise HTTPException(status_code=403, detail="You do not have access to this league")

        role = (membership.get("role") or "").lower()
        if normalized_roles and role not in normalized_roles:
            logging.warning(
                "[AUTHZ] User %s has role %s but attempted %s requiring %s on league %s",
                user_id,
                role,
                operation_name,
                ",".join(sorted(normalized_roles)),
                league_id,
            )
            _register_denial(f"league:{league_id}:{operation_name}")
            raise HTTPException(status_code=403, detail="Insufficient league permissions")

        return membership
    except HTTPException:
        raise
    except Exception as exc:
        logging.error(
            "[AUTHZ] Failed membership check for user %s on league %s: %s",
            user_id,
            league_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="Failed to validate league permissions")


def ensure_event_access(
    user_id: str,
    event_id: str,
    *,
    allowed_roles: Optional[Iterable[str]] = None,
    operation_name: str = "event access",
) -> dict:
    """
    Validate access to an event by verifying the user is a member of the parent
    league (and optionally has a required role). Returns the event data.
    """
    try:
        event_ref = db.collection("events").document(event_id)
        event_doc = execute_with_timeout(
            event_ref.get,
            timeout=6,
            operation_name=f"{operation_name} event lookup",
        )

        if not event_doc.exists:
            raise HTTPException(status_code=404, detail="Event not found")

        event_data = event_doc.to_dict() or {}
        league_id = event_data.get("league_id")
        if not league_id:
            logging.error(
                "[AUTHZ] Event %s missing league_id during %s", event_id, operation_name
            )
            raise HTTPException(
                status_code=500, detail="Event is missing league association"
            )

        ensure_league_access(
            user_id,
            league_id,
            allowed_roles=allowed_roles,
            operation_name=operation_name,
        )

        event_data["id"] = event_doc.id
        return event_data
    except HTTPException:
        raise
    except Exception as exc:
        logging.error(
            "[AUTHZ] Failed event access check for user %s on event %s: %s",
            user_id,
            event_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="Failed to validate event permissions")

