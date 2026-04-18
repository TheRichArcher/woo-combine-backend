"""
Mobile-optimized API endpoints for React Native app.

These endpoints are designed for:
- Offline-first workflows (lightweight payloads)
- Batch operations (reduce API calls)
- Mobile-specific features (QR scanning, scorecards)
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Set
from datetime import datetime
import logging

from ..auth import get_current_user
from ..firestore_client import db
from ..utils.database import execute_with_timeout
from ..utils.authorization import ensure_event_access, _extract_membership_scoped_event_ids
from ..utils.event_schema import get_event_schema
from ..utils.lock_validation import check_write_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mobile", tags=["mobile"])


# ============================================================================
# 1. USER'S COMBINES (Home Screen)
# ============================================================================


@router.get("/combines")
async def get_user_combines(current_user=Depends(get_current_user)):
    """
    Get all combines/events the user has access to across all their leagues.
    Used by mobile Home screen.

    Returns a flat list of events with league info attached.
    """
    try:
        user_id = current_user["uid"]

        # Get user's league memberships
        memberships_ref = db.collection("user_memberships").document(user_id)
        memberships_doc = execute_with_timeout(
            lambda: memberships_ref.get(),
            timeout=6,
            operation_name="mobile combines - membership lookup",
        )

        if not memberships_doc.exists:
            return {"combines": []}

        leagues_data = memberships_doc.to_dict().get("leagues", {})
        if not leagues_data:
            return {"combines": []}

        combines = []

        for league_id, membership_info in leagues_data.items():
            try:
                membership_role = (
                    membership_info.get("role", "viewer")
                    if isinstance(membership_info, dict)
                    else "viewer"
                ).lower()
                scoped_event_ids = _extract_membership_scoped_event_ids(membership_info)

                # Get league name
                league_ref = db.collection("leagues").document(league_id)
                league_doc = execute_with_timeout(
                    lambda lid=league_id: db.collection("leagues").document(lid).get(),
                    timeout=5,
                    operation_name=f"mobile combines - league {league_id}",
                )
                league_name = (
                    league_doc.to_dict().get("name", "Unknown League")
                    if league_doc.exists
                    else "Unknown League"
                )

                # Get events for this league
                events_ref = (
                    db.collection("leagues").document(league_id).collection("events")
                )
                events_query = events_ref.order_by(
                    "created_at", direction="DESCENDING"
                ).limit(50)
                events_stream = execute_with_timeout(
                    lambda lid=league_id: list(
                        db.collection("leagues")
                        .document(lid)
                        .collection("events")
                        .order_by("created_at", direction="DESCENDING")
                        .limit(50)
                        .stream()
                    ),
                    timeout=10,
                    operation_name=f"mobile combines - events for {league_id}",
                )

                for event_doc in events_stream:
                    event_data = event_doc.to_dict()

                    # Skip soft-deleted events
                    if event_data.get("deleted_at"):
                        continue
                    if membership_role == "coach" and event_doc.id not in scoped_event_ids:
                        continue
                    if scoped_event_ids and event_doc.id not in scoped_event_ids:
                        continue

                    # Count players (lightweight - just count)
                    try:
                        players_stream = execute_with_timeout(
                            lambda eid=event_doc.id: list(
                                db.collection("events")
                                .document(eid)
                                .collection("players")
                                .limit(500)
                                .stream()
                            ),
                            timeout=5,
                            operation_name=f"mobile combines - player count {event_doc.id}",
                        )
                        player_count = len(players_stream)
                    except Exception:
                        player_count = 0

                    combines.append(
                        {
                            "event_id": event_doc.id,
                            "event_name": event_data.get("name", "Unnamed Event"),
                            "date": event_data.get("date"),
                            "location": event_data.get("location", ""),
                            "league_id": league_id,
                            "league_name": league_name,
                            "drill_template": event_data.get(
                                "drillTemplate", "football"
                            ),
                            "player_count": player_count,
                            "is_locked": event_data.get("isLocked", False),
                            "live_entry_active": event_data.get(
                                "live_entry_active", False
                            ),
                            "user_role": (
                                membership_role
                            ),
                        }
                    )

            except Exception as e:
                logger.warning(f"Error fetching events for league {league_id}: {e}")
                continue

        # Sort by date (newest first), events without dates at the end
        combines.sort(key=lambda c: c.get("date") or "0000-00-00", reverse=True)

        return {"combines": combines}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching combines for mobile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch combines")


# ============================================================================
# 2. EVENT ROSTER (Roster Screen + Offline Download)
# ============================================================================


@router.get("/events/{event_id}/roster")
async def get_event_roster(event_id: str, current_user=Depends(get_current_user)):
    """
    Get event roster with player details for mobile display.

    Returns:
    - Event metadata
    - Player list with basic info + drill scores
    - Last updated timestamp
    """
    try:
        # Enforce event-level access: only league members with allowed viewer/staff roles.
        ensure_event_access(
            current_user["uid"],
            event_id,
            allowed_roles=("organizer", "coach", "viewer"),
            operation_name="mobile roster access",
        )

        # Get event from top-level collection
        event_ref = db.collection("events").document(event_id)
        event_doc = execute_with_timeout(
            lambda: event_ref.get(),
            timeout=5,
            operation_name="mobile roster - event lookup",
        )

        if not event_doc.exists:
            raise HTTPException(status_code=404, detail="Event not found")

        event_data = event_doc.to_dict()

        if event_data.get("deleted_at"):
            raise HTTPException(status_code=404, detail="Event not found")

        # Get players
        players_ref = db.collection("events").document(event_id).collection("players")
        players_stream = execute_with_timeout(
            lambda: list(players_ref.limit(500).stream()),
            timeout=10,
            operation_name="mobile roster - players",
        )

        players = []
        # Known non-drill fields to exclude from drill scores
        non_drill_fields = {
            "id",
            "name",
            "first_name",
            "last_name",
            "number",
            "jersey_number",
            "age_group",
            "external_id",
            "team_name",
            "position",
            "notes",
            "created_at",
            "updated_at",
            "photo",
            "photo_url",
        }

        for player_doc in players_stream:
            player_data = player_doc.to_dict()

            # Extract drill scores (anything not in non_drill_fields)
            drill_scores = {}
            for key, value in player_data.items():
                if key not in non_drill_fields and isinstance(value, (int, float)):
                    drill_scores[key] = value

            players.append(
                {
                    "id": player_doc.id,
                    "name": player_data.get("name")
                    or f"{player_data.get('first_name', '')} {player_data.get('last_name', '')}".strip(),
                    "number": player_data.get("number")
                    or player_data.get("jersey_number"),
                    "age_group": player_data.get("age_group", ""),
                    "position": player_data.get("position", ""),
                    "team_name": player_data.get("team_name", ""),
                    "drill_scores": drill_scores,
                }
            )

        # Sort by number if available, then name
        players.sort(
            key=lambda p: (
                (
                    int(p["number"])
                    if p.get("number") and str(p["number"]).isdigit()
                    else 9999
                ),
                p.get("name", ""),
            )
        )

        return {
            "event_id": event_id,
            "event_name": event_data.get("name", ""),
            "date": event_data.get("date"),
            "location": event_data.get("location", ""),
            "drill_template": event_data.get("drillTemplate", "football"),
            "is_locked": event_data.get("isLocked", False),
            "live_entry_active": event_data.get("live_entry_active", False),
            "player_count": len(players),
            "players": players,
            "last_updated": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching roster for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roster")


# ============================================================================
# 3. BATCH DRILL RESULTS (Offline Sync)
# ============================================================================


@router.post("/drill-results/batch")
async def submit_batch_drill_results(
    results: List[dict], current_user=Depends(get_current_user)
):
    """
    Submit multiple drill results in one request.
    Used for offline sync: app queues scores locally,
    uploads in batch when connection restored.
    """
    try:
        if not isinstance(results, list) or not results:
            raise HTTPException(
                status_code=400, detail="Request must include at least one result"
            )

        user_id = current_user["uid"]

        # Authorize all referenced events up front to prevent cross-event writes.
        event_ids = {result.get("event_id") for result in results if result.get("event_id")}
        if not event_ids:
            raise HTTPException(
                status_code=400, detail="At least one valid event_id is required"
            )

        allowed_drill_keys_by_event: Dict[str, Set[str]] = {}
        for event_id in event_ids:
            ensure_event_access(
                user_id,
                event_id,
                allowed_roles=("organizer", "coach"),
                operation_name="mobile batch drill write",
            )
            # Enforce same write model as other write routes (lock + canWrite).
            check_write_permission(
                event_id=event_id,
                user_id=user_id,
                operation_name="mobile batch drill write",
            )
            schema = get_event_schema(event_id)
            if not schema:
                raise HTTPException(
                    status_code=400, detail=f"No schema found for event {event_id}"
                )
            allowed_drill_keys_by_event[event_id] = {drill.key for drill in schema.drills}

        submitted = 0
        errors = []

        for result in results:
            try:
                player_id = result.get("player_id")
                event_id = result.get("event_id")
                drill_key = result.get("drill_key")
                value = result.get("value")

                if not all([player_id, event_id, drill_key, value is not None]):
                    errors.append(
                        {"result": result, "error": "Missing required fields"}
                    )
                    continue

                if event_id not in allowed_drill_keys_by_event:
                    errors.append(
                        {"result": result, "error": "Unauthorized event context"}
                    )
                    continue

                if drill_key not in allowed_drill_keys_by_event[event_id]:
                    errors.append(
                        {"result": result, "error": f"Invalid drill key: {drill_key}"}
                    )
                    continue

                try:
                    numeric_value = float(value)
                except (TypeError, ValueError):
                    errors.append(
                        {"result": result, "error": "Drill value must be numeric"}
                    )
                    continue

                # Update player document with drill score
                player_ref = (
                    db.collection("events")
                    .document(event_id)
                    .collection("players")
                    .document(player_id)
                )
                player_doc = execute_with_timeout(
                    lambda pr=player_ref: pr.get(),
                    timeout=5,
                    operation_name=f"batch drill result lookup - {player_id}",
                )
                if not player_doc.exists:
                    errors.append({"result": result, "error": "Player not found"})
                    continue

                execute_with_timeout(
                    lambda pr=player_ref, dk=drill_key, v=numeric_value: pr.update(
                        {
                            # Use schema-bounded drill keys only and write into scores map.
                            f"scores.{dk}": v,
                            # Keep legacy flat field in sync for older mobile/web views.
                            dk: v,
                            "updated_at": datetime.utcnow().isoformat(),
                        }
                    ),
                    timeout=5,
                    operation_name=f"batch drill result - {player_id}/{drill_key}",
                )
                submitted += 1

            except Exception as e:
                errors.append({"result": result, "error": str(e)})

        return {"submitted": submitted, "errors": errors}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting batch results: {e}")
        raise HTTPException(status_code=500, detail="Batch submission failed")


# ============================================================================
# HEALTH CHECK
# ============================================================================


@router.get("/health")
async def mobile_health_check():
    """Mobile API health check."""
    return {
        "status": "ok",
        "service": "woo-combine-mobile-api",
        "timestamp": datetime.utcnow().isoformat(),
    }
