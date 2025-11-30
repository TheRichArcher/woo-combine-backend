from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from ..firestore_client import db
from .database import execute_with_timeout

REPAIR_ENABLED = True


def _utc_now() -> str:
    return datetime.utcnow().isoformat()


def ensure_league_document(league_id: str):
    league_ref = db.collection("leagues").document(league_id)
    league_doc = execute_with_timeout(
        league_ref.get,
        timeout=6,
        operation_name="league validation",
    )
    if not league_doc.exists:
        raise HTTPException(status_code=404, detail="League not found")
    return league_doc


def ensure_event_document(event_id: str):
    event_ref = db.collection("events").document(event_id)
    event_doc = execute_with_timeout(
        event_ref.get,
        timeout=6,
        operation_name="event validation",
    )
    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    return event_doc


def enforce_event_league_relationship(
    *,
    event_id: str,
    expected_league_id: Optional[str] = None,
    allow_repair: bool = True,
):
    """
    Ensure event exists and belongs to the expected league. If league_id is missing
    but expected is provided, optionally repair the document.
    """
    event_doc = ensure_event_document(event_id)
    data = event_doc.to_dict() or {}
    actual_league = data.get("league_id")

    if expected_league_id:
        if not actual_league and allow_repair and REPAIR_ENABLED:
            try:
                event_doc.reference.update(
                    {
                        "league_id": expected_league_id,
                        "integrity_repaired_at": _utc_now(),
                    }
                )
                logging.info(
                    "[INTEGRITY] Repaired missing league_id for event %s -> %s",
                    event_id,
                    expected_league_id,
                )
                actual_league = expected_league_id
            except Exception as exc:
                logging.error(
                    "[INTEGRITY] Failed to repair league_id for event %s: %s",
                    event_id,
                    exc,
                )

        if actual_league != expected_league_id:
            raise HTTPException(
                status_code=409,
                detail="Event does not belong to the specified league",
            )

    return event_doc

