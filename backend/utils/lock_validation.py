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
from ..utils.authorization import ensure_event_access


def check_write_permission(
    event_id: str,
    user_id: str,
    user_role: str,
    league_id: Optional[str] = None,
    operation_name: str = "write operation"
) -> dict:
    """
    Comprehensive write permission check that respects both global lock and per-coach permissions.
    
    Returns membership dict if write is allowed, raises HTTPException otherwise.
    
    Args:
        event_id: The event being modified
        user_id: Firebase UID of the user
        user_role: User's role (organizer/coach/viewer)
        league_id: Optional league ID for faster lookup
        operation_name: Description of operation for error messages
        
    Raises:
        HTTPException 403: If event is locked or user doesn't have write permission
        HTTPException 404: If event not found
    """
    
    # 1. Fetch event data
    event_ref = db.collection("events").document(event_id)
    event_doc = execute_with_timeout(
        lambda: event_ref.get(),
        timeout=5,
        operation_name=f"{operation_name} - fetch event"
    )
    
    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event_data = event_doc.to_dict()
    is_locked = event_data.get("isLocked", False)
    
    # 2. Check global combine lock
    # If event is locked, only organizers can proceed
    if is_locked:
        if user_role != "organizer":
            logging.warning(
                f"[LOCK] User {user_id} ({user_role}) attempted {operation_name} on locked event {event_id}"
            )
            raise HTTPException(
                status_code=403,
                detail="This combine has been locked. Results are final and cannot be edited. Contact the organizer if corrections are needed."
            )
        
        # Organizer on locked event - allowed, but log it
        logging.info(
            f"[LOCK] Organizer {user_id} performing {operation_name} on locked event {event_id}"
        )
    
    # 3. Event is unlocked - check per-coach write permissions
    # Get league_id from event if not provided
    if not league_id:
        league_id = event_data.get("league_id")
    
    if not league_id:
        logging.error(f"[LOCK] Event {event_id} has no league_id - cannot check membership")
        raise HTTPException(status_code=500, detail="Event configuration error")
    
    # Verify event access (handles Kill Switch and membership checks)
    # Note: ensure_event_access gets league_id from event document internally
    membership = ensure_event_access(
        user_id=user_id,
        event_id=event_id,
        allowed_roles=["organizer", "coach"],
        operation_name=operation_name
    )
    
    # 4. Check per-coach canWrite permission (only applies to coaches)
    if user_role == "coach":
        can_write = membership.get("canWrite", True)  # Default to True for backward compatibility
        
        if not can_write:
            logging.warning(
                f"[LOCK] Coach {user_id} attempted {operation_name} but has canWrite=False"
            )
            raise HTTPException(
                status_code=403,
                detail="Your access has been set to read-only. You can view results but cannot make edits. Contact the organizer if you need write access restored."
            )
    
    # 5. All checks passed
    logging.info(
        f"[LOCK] Write permission granted for {user_id} ({user_role}) on event {event_id} for {operation_name}"
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
        lambda: event_ref.get(),
        timeout=5,
        operation_name="check event lock status"
    )
    
    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
        
    if event_doc.to_dict().get("live_entry_active", False):
        raise HTTPException(
            status_code=409,
            detail="Cannot modify drill configuration after Live Entry has started"
        )

