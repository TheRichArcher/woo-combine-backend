"""
Combine Locking System - Two-Tier Permission Validation

This module implements the comprehensive locking system as described in the architecture:

1. PER-COACH LOCK (granular control)
   - Individual coaches can be set to read-only by organizer
   - Lives in membership.canWrite field
   - Only applies when event is unlocked

2. GLOBAL COMBINE LOCK (event-level control)
   - Event.isLocked = True blocks all non-organizers
   - Overrides all per-coach permissions
   - Represents "official end" of combine

Permission Hierarchy:
  - If event.isLocked: only organizers can write
  - If event unlocked: respect membership.canWrite
  - Organizers always have full access (unless disabled via Kill Switch)
"""

import logging
from typing import Optional
from fastapi import HTTPException

from ..firestore_client import db
from ..utils.database import execute_with_timeout
from ..utils.authorization import ensure_event_access, ensure_league_access


def check_write_permission(
    event_id: str,
    user_id: str,
    user_role: Optional[str] = None,
    league_id: Optional[str] = None,
    operation_name: str = "write operation",
) -> dict:
    """
    Comprehensive write permission check that respects both global lock and per-coach permissions.

    Returns membership dict if write is allowed, raises HTTPException otherwise.

    Scoped league/event membership role is authoritative for write authorization.
    Caller-provided user_role is treated as advisory only and never grants access.

    Raises:
        HTTPException 403: If event is locked or user doesn't have write permission
        HTTPException 404: If event not found
    """

    # 1. Fetch event data
    event_ref = db.collection("events").document(event_id)
    event_doc = execute_with_timeout(
        lambda: event_ref.get(),
        timeout=5,
        operation_name=f"{operation_name} - fetch event",
    )

    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")

    event_data = event_doc.to_dict()
    is_locked = event_data.get("isLocked", False)

    # 2. Resolve scoped league membership role (authoritative source of truth).
    # Get league_id from event if not provided.
    if not league_id:
        league_id = event_data.get("league_id")

    if not league_id:
        logging.error(
            f"[LOCK] Event {event_id} has no league_id - cannot check membership"
        )
        raise HTTPException(status_code=500, detail="Event configuration error")

    ensure_event_access(
        user_id=user_id,
        event_id=event_id,
        allowed_roles=["organizer", "coach"],
        operation_name=operation_name,
    )

    membership = ensure_league_access(
        user_id=user_id,
        league_id=league_id,
        allowed_roles=["organizer", "coach"],
        operation_name=operation_name,
    )
    membership_role = (membership.get("role") or "").lower()

    # Deny-by-default if scoped role cannot be established safely.
    if membership_role not in {"organizer", "coach"}:
        logging.warning(
            "[LOCK] User %s denied %s on event %s due to invalid scoped role '%s'",
            user_id,
            operation_name,
            event_id,
            membership_role,
        )
        raise HTTPException(status_code=403, detail="Insufficient league permissions")

    # 3. Check global combine lock using scoped membership role.
    if is_locked and membership_role != "organizer":
        logging.warning(
            "[LOCK] User %s (%s) attempted %s on locked event %s",
            user_id,
            membership_role,
            operation_name,
            event_id,
        )
        raise HTTPException(
            status_code=403,
            detail="This combine has been locked. Results are final and cannot be edited. Contact the organizer if corrections are needed.",
        )

    # Log role drift for diagnostics only; never use caller role for authorization.
    if user_role and user_role != membership_role:
        logging.warning(
            "[LOCK] Role drift for user %s on event %s: global role=%s, membership role=%s",
            user_id,
            event_id,
            user_role,
            membership_role,
        )

    # 4. Check per-coach canWrite permission (applies to scoped coach role).
    if membership_role == "coach":
        can_write = membership.get(
            "canWrite", True
        )  # Default to True for backward compatibility

        if not can_write:
            logging.warning(
                f"[LOCK] Coach {user_id} attempted {operation_name} but has canWrite=False"
            )
            raise HTTPException(
                status_code=403,
                detail="Your access has been set to read-only. You can view results but cannot make edits. Contact the organizer if you need write access restored.",
            )

    # 5. All checks passed
    logging.info(
        "[LOCK] Write permission granted for %s (%s) on event %s for %s",
        user_id,
        membership_role,
        event_id,
        operation_name,
    )

    return membership


def check_event_unlocked_for_drill_config(event_id: str):
    """
    Legacy helper for checking if event allows drill configuration changes.

    This checks live_entry_active (not isLocked) because custom drills should be
    locked once live entry starts, but general scoring can continue.

    This is separate from the write permission system above.
    """
    event_ref = db.collection("events").document(event_id)
    event_doc = execute_with_timeout(
        lambda: event_ref.get(), timeout=5, operation_name="check event lock status"
    )

    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")

    if event_doc.to_dict().get("live_entry_active", False):
        raise HTTPException(
            status_code=409,
            detail="Cannot modify drill configuration after Live Entry has started",
        )
