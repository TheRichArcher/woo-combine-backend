from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit, bulk_rate_limit
import logging
from ..firestore_client import db
from datetime import datetime
from ..models import PlayerSchema
from ..utils.validation import (
    validate_player_data,
    validate_age_group,
    canonicalize_age_group,
)
from ..utils.database import execute_with_timeout

router = APIRouter()

# Utility: Composite Score Calculation
DRILL_WEIGHTS = {
    "40m_dash": 0.3,
    "vertical_jump": 0.2,
    "catching": 0.15,
    "throwing": 0.15,
    "agility": 0.2,
}

def calculate_composite_score(player_data: Dict[str, Any], weights: Optional[Dict[str, float]] = None) -> float:
    """Calculate composite score for a player based on their drill results"""
    use_weights = weights if weights is not None else DRILL_WEIGHTS
    score = 0.0
    
    # Define which drills have "lower is better" scoring
    lower_is_better_drills = {"40m_dash"}
    
    for drill, weight in use_weights.items():
        # Get drill value from player data (stored as drill_[type] or just [type])
        value = player_data.get(drill) or player_data.get(f"drill_{drill}")
        
        # CRITICAL FIX: Handle missing scores properly
        if value is not None and value != "":
            try:
                drill_value = float(value)
                
                # For "lower is better" drills like 40-yard dash, invert the score
                # Use a reasonable maximum (30 seconds for 40-yard dash) to create an inverted scale
                if drill in lower_is_better_drills:
                    if drill == "40m_dash":
                        # Convert to "higher is better" scale: use (30 - time) so 4 seconds becomes 26, 15 seconds becomes 15
                        drill_value = max(0, 30 - drill_value)
                
                score += drill_value * weight
            except (ValueError, TypeError):
                # Invalid values contribute 0 to score (missing data is penalized)
                pass
        # Missing or null values contribute 0 to score (no artificial boost)
    
    return round(score, 2)

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()



@router.get("/players", response_model=List[PlayerSchema])
@read_rate_limit()
def get_players(
    request: Request,
    event_id: str = Query(...),
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=500),
    current_user = Depends(get_current_user)
):
    try:
        if 'user_id' in request.query_params:
            raise HTTPException(status_code=400, detail="Do not include user_id in query params. Use Authorization header.")
        
        # Add timeout to event lookup
        event = execute_with_timeout(
            db.collection("events").document(str(event_id)).get,
            timeout=5
        )
        if not event.exists:
            raise HTTPException(status_code=404, detail="Event not found")
            
        # Add timeout to players retrieval
        def get_players_stream():
            return list(db.collection("events").document(str(event_id)).collection("players").stream())
        
        players_stream = execute_with_timeout(get_players_stream, timeout=15)

        players_list = list(players_stream)
        # Optional in-memory pagination
        if page is not None and limit is not None:
            start = (page - 1) * limit
            end = start + limit
            paged = players_list[start:end]
        else:
            paged = players_list

        result = []
        for player in paged:
            player_dict = player.to_dict()
            player_dict["id"] = player.id
            # Calculate and add composite score
            player_dict["composite_score"] = calculate_composite_score(player_dict)
            result.append(player_dict)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in /players: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve players")

from pydantic import BaseModel
class PlayerCreate(BaseModel):
    name: str
    number: Optional[int] = None
    age_group: Optional[str] = None
    photo_url: Optional[str] = None

@router.post("/players")
@write_rate_limit()
def create_player(
    request: Request,
    player: PlayerCreate,
    event_id: str = Query(...),
    current_user=Depends(require_role("organizer", "coach"))
):
    try:
        logging.info(f"[CREATE_PLAYER] Starting player creation for event_id: {event_id}")
        logging.info(f"[CREATE_PLAYER] Current user: {current_user.get('uid', 'unknown')}")
        logging.info(f"[CREATE_PLAYER] Player data: {player.model_dump()}")
        
        # Validate that the event exists
        logging.info(f"[CREATE_PLAYER] Validating event exists: {event_id}")
        event = execute_with_timeout(
            db.collection("events").document(str(event_id)).get,
            timeout=3
        )
        logging.info(f"[CREATE_PLAYER] Event validation completed. Exists: {event.exists}")
        
        if not event.exists:
            logging.warning(f"[CREATE_PLAYER] Event not found: {event_id}")
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Create player in the event subcollection
        logging.info(f"[CREATE_PLAYER] Creating player document in Firestore")
        player_doc = db.collection("events").document(str(event_id)).collection("players").document()
        
        player_data = {
            "name": player.name,
            "number": player.number,
            "age_group": player.age_group,
            "photo_url": player.photo_url,
            "event_id": event_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        logging.info(f"[CREATE_PLAYER] Player data to save: {player_data}")
        
        # Add timeout to player creation
        execute_with_timeout(
            lambda: player_doc.set(player_data),
            timeout=5
        )
        
        logging.info(f"[CREATE_PLAYER] Player created successfully with ID: {player_doc.id}")
        
        # Return the created player data with the generated ID
        return {
            "id": player_doc.id,
            "name": player.name,
            "number": player.number,
            "age_group": player.age_group,
            "photo_url": player.photo_url,
            "event_id": event_id,
            "created_at": player_data["created_at"]
        }
    except HTTPException:
        logging.error(f"[CREATE_PLAYER] HTTPException occurred")
        raise
    except Exception as e:
        logging.error(f"[CREATE_PLAYER] Unexpected error creating player: {type(e).__name__}: {str(e)}")
        logging.exception(f"[CREATE_PLAYER] Full exception trace:")
        raise HTTPException(status_code=500, detail=f"Failed to create player: {str(e)}")

@router.put("/players/{player_id}")
@write_rate_limit()
def update_player(
    request: Request,
    player_id: str,
    player: PlayerCreate,
    event_id: str = Query(...),
    current_user=Depends(require_role("organizer", "coach"))
):
    try:
        # Validate that the event exists (use longer timeout for writes)
        event = execute_with_timeout(
            db.collection("events").document(str(event_id)).get,
            timeout=3
        )
        if not event.exists:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Get the player document
        player_ref = db.collection("events").document(str(event_id)).collection("players").document(player_id)
        player_doc = execute_with_timeout(
            player_ref.get,
            timeout=3
        )
        
        if not player_doc.exists:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Update player data
        update_data = {
            "name": player.name,
            "number": player.number,
            "age_group": player.age_group,
            "photo_url": player.photo_url,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Add timeout to player update (longer for write operations)
        execute_with_timeout(
            lambda: player_ref.update(update_data),
            timeout=5
        )
        
        return {"player_id": player_id, "updated": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating player: {e}")
        raise HTTPException(status_code=500, detail="Failed to update player")

class UploadRequest(BaseModel):
    event_id: str
    players: List[Dict[str, Any]]

@router.post("/players/upload")
@bulk_rate_limit()
def upload_players(request: Request, req: UploadRequest, current_user=Depends(require_role("organizer"))):
    try:
        # Add timeout to event lookup
        event = execute_with_timeout(
            db.collection("events").document(str(req.event_id)).get,
            timeout=5
        )
        if not event.exists:
            raise HTTPException(status_code=404, detail="Event not found")
            
        event_id = req.event_id
        players = req.players
        # CSV contract: require first_name, last_name, jersey_number; age_group is optional
        required_fields = ["first_name", "last_name", "jersey_number"]
        drill_fields = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
        errors = []
        added = 0
        
        # Hard limits
        MAX_ROWS = 5000
        if len(players) > MAX_ROWS:
            raise HTTPException(status_code=400, detail=f"Too many rows: max {MAX_ROWS}")

        # Duplicate detection within the same event
        seen_ids = set()
        seen_name_number = set()

        # Load existing players to check duplicates against DB for this event
        existing_players_stream = execute_with_timeout(
            lambda: list(db.collection("events").document(event_id).collection("players").stream()),
            timeout=10
        )
        existing_name_number = set()
        existing_ids = set()
        existing_external_ids = set()
        existing_first_last_age = set()
        for ep in existing_players_stream:
            epd = ep.to_dict()
            first = str(epd.get("first") or "").strip().lower()
            last = str(epd.get("last") or "").strip().lower()
            number_key = epd.get("number")
            if number_key not in (None, ""):
                try:
                    number_key = int(str(number_key).strip())
                except Exception:
                    number_key = None
            existing_name_number.add((first, last, number_key))
            existing_ids.add(("id", ep.id))
            ext_id = str(epd.get("external_id") or "").strip()
            if ext_id:
                existing_external_ids.add(ext_id)
            age_val = str(epd.get("age_group") or "").strip().lower()
            if first or last:
                existing_first_last_age.add((first, last, age_val))

        for idx, player in enumerate(players):
            row_errors = []
            # Required fields per contract
            for field in required_fields:
                if player.get(field) in (None, ""):
                    row_errors.append(f"Missing {field}")
            # jersey_number must be numeric 1-9999
            try:
                num = int(str(player.get("jersey_number")).strip()) if player.get("jersey_number") not in (None, "") else None
                if num is None:
                    row_errors.append("Missing jersey_number")
                elif num < 1 or num > 9999:
                    row_errors.append("jersey_number must be between 1 and 9999")
            except Exception:
                row_errors.append("Invalid jersey_number (must be numeric)")
            # Age group: optional; validate only if provided (non-empty)
            age_group_val = player.get("age_group")
            if age_group_val not in (None, ""):
                try:
                    _ = validate_age_group(str(age_group_val))
                except Exception as ve:
                    row_errors.append(str(ve))
            # More flexible drill validation - only validate non-empty values
            for drill in drill_fields:
                val = player.get(drill, "")
                if val not in ("", None) and str(val).strip() != "":
                    try:
                        float(val)
                    except (ValueError, TypeError):
                        row_errors.append(f"Invalid {drill}: '{val}' (must be a number)")
            # Duplicate checks
            player_id = str(player.get("id") or "").strip()
            first = str(player.get("first_name") or "").strip().lower()
            last = str(player.get("last_name") or "").strip().lower()
            number_key = None
            if player.get("jersey_number") not in (None, ""):
                try:
                    number_key = int(str(player.get("jersey_number")).strip())
                except Exception:
                    pass

            if player_id:
                key = ("id", player_id)
                if key in seen_ids:
                    row_errors.append("Duplicate playerId within upload")
                else:
                    seen_ids.add(key)
                # Check against existing DB ids
                if key in existing_ids:
                    row_errors.append("Duplicate playerId already exists in event")

            name_number_key = (first, last, number_key)
            if any([first, last, number_key is not None]):
                if name_number_key in seen_name_number:
                    row_errors.append("Duplicate (first,last,number) within upload")
                else:
                    seen_name_number.add(name_number_key)
                # Check against existing DB
                if name_number_key in existing_name_number:
                    row_errors.append("Duplicate (first,last,number) already exists in event")

            # External ID duplicate detection
            ext_id = str(player.get("external_id") or "").strip()
            if ext_id:
                if ext_id in existing_external_ids:
                    row_errors.append("Duplicate external_id already exists in event")
            # When jersey_number is missing/invalid, fallback duplicate check on (first,last,age_group)
            if number_key is None and (first or last):
                try:
                    age_val_canon = canonicalize_age_group(str(player.get("age_group") or ""))
                except Exception:
                    age_val_canon = str(player.get("age_group") or "").strip()
                age_l = str(age_val_canon or "").strip().lower()
                if (first, last, age_l) in existing_first_last_age:
                    row_errors.append("Duplicate (first,last,age_group) already exists in event")

            if row_errors:
                errors.append({"row": idx + 1, "message": ", ".join(row_errors)})
                continue
                
            # CRITICAL FIX: Store players in event subcollection where they're retrieved from
            player_doc = db.collection("events").document(event_id).collection("players").document()
            
            # Prepare player data with drill scores and canonical fields
            canonical_age = canonicalize_age_group(str(player.get("age_group") or "")) if player.get("age_group") else None
            first_name = (player.get("first_name") or "").strip()
            last_name = (player.get("last_name") or "").strip()
            full_name = f"{first_name} {last_name}".strip()
            # Precompute jersey number safely for typing
            jersey_raw = player.get("jersey_number")
            number_value = None
            if jersey_raw not in (None, ""):
                try:
                    number_value = int(str(jersey_raw).strip())
                except Exception:
                    number_value = None

            player_data = {
                "name": full_name,
                "first": first_name,
                "last": last_name,
                "number": number_value,
                "age_group": canonical_age,
                "external_id": (player.get("external_id") or None),
                "team_name": (player.get("team_name") or None),
                "position": (player.get("position") or None),
                "notes": (player.get("notes") or None),
                "photo_url": None,
                "event_id": event_id,
                "created_at": datetime.utcnow().isoformat(),
            }
            
            # Add drill scores if provided
            for drill in drill_fields:
                value = player.get(drill, "")
                if value and value.strip() != "":
                    try:
                        player_data[drill] = float(value)
                    except ValueError:
                        # This shouldn't happen due to validation, but just in case
                        player_data[drill] = None
                else:
                    player_data[drill] = None
            
            # Add timeout to player creation
            execute_with_timeout(
                lambda: player_doc.set(player_data),
                timeout=10
            )
            added += 1
            
        logging.info(f"Player upload completed: {added} added, {len(errors)} errors")
        if errors:
            logging.warning(f"Upload errors: {errors}")
        
        return {"added": added, "errors": errors}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading players: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload players")

@router.delete("/players/reset")
def reset_players(event_id: str = Query(...), current_user=Depends(require_role("organizer"))):
    try:
        # First, get all players in the event
        players_ref = db.collection("events").document(str(event_id)).collection("players")
        players_stream = execute_with_timeout(
            lambda: list(players_ref.stream()),
            timeout=15
        )
        
        # Delete drill results for each player
        for player in players_stream:
            drill_results_ref = player.reference.collection("drill_results")
            drill_results_stream = execute_with_timeout(
                lambda: list(drill_results_ref.stream()),
                timeout=10
            )
            for drill_result in drill_results_stream:
                drill_result.reference.delete()
        
        # Then delete all players
        for player in players_stream:
            player.reference.delete()
        
        return {"status": "reset", "event_id": str(event_id)}
    except Exception as e:
        logging.error(f"Error resetting players: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset players")

@router.get("/rankings")
def get_rankings(
    age_group: str = Query(...),
    event_id: str = Query(...),
    weight_40m_dash: float = Query(None, alias="weight_40m_dash"),
    weight_vertical_jump: float = Query(None, alias="weight_vertical_jump"),
    weight_catching: float = Query(None, alias="weight_catching"),
    weight_throwing: float = Query(None, alias="weight_throwing"),
    weight_agility: float = Query(None, alias="weight_agility"),
):
    try:
        # Validate that the event exists
        event = execute_with_timeout(
            db.collection("events").document(str(event_id)).get,
            timeout=5
        )
        if not event.exists:
            raise HTTPException(status_code=404, detail="Event not found")
            
        # Parse weights if all are provided
        custom_weights = None
        weight_params = [weight_40m_dash, weight_vertical_jump, weight_catching, weight_throwing, weight_agility]
        drill_keys = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
        if all(w is not None for w in weight_params):
            if not all(isinstance(w, float) and 0 <= w <= 1 for w in weight_params):
                raise HTTPException(status_code=400, detail="All weights must be numbers between 0 and 1.")
            total = sum(weight_params)
            if abs(total - 1.0) > 1e-6:
                raise HTTPException(status_code=400, detail="Weights must sum to 1.0.")
            custom_weights = dict(zip(drill_keys, weight_params))
        elif any(w is not None for w in weight_params):
            raise HTTPException(status_code=400, detail="Either provide all weights or none.")
            
        # Query players from the event subcollection and filter by age group
        players_stream = execute_with_timeout(
            lambda: list(db.collection("events").document(str(event_id)).collection("players").stream()),
            timeout=15
        )
        
        ranked = []
        for player in players_stream:
            player_data = player.to_dict()
            # Filter by age group
            if player_data.get("age_group") != age_group:
                continue
                
            composite_score = calculate_composite_score(player_data, custom_weights)
            ranked.append({
                "player_id": player.id,
                "name": player_data.get("name"),
                "number": player_data.get("number"),
                "composite_score": composite_score,
                # Include individual drill scores
                "40m_dash": player_data.get("40m_dash"),
                "vertical_jump": player_data.get("vertical_jump"), 
                "catching": player_data.get("catching"),
                "throwing": player_data.get("throwing"),
                "agility": player_data.get("agility")
            })
        ranked.sort(key=lambda x: x.get("composite_score", 0), reverse=True)
        for idx, player in enumerate(ranked, start=1):
            player["rank"] = idx
        return ranked
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting rankings: {e}")
        raise HTTPException(status_code=500, detail="Failed to get rankings")

# Note: Bulk upload, custom weights, and admin dashboard endpoints 
# were removed as they are not currently used by the frontend.
# The bulk upload functionality is handled by the existing /players/upload endpoint.
# Custom weights are handled client-side in the rankings component.
# Admin functionality is handled by the frontend /admin route.

@router.get('/leagues/{league_id}/players')
@read_rate_limit()
def list_players(
    request: Request,
    league_id: str,
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=500),
    current_user=Depends(get_current_user)
):
    try:
        players_ref = db.collection("leagues").document(league_id).collection("players")
        # Add timeout to players retrieval
        players_stream = execute_with_timeout(
            lambda: list(players_ref.stream()),
            timeout=10
        )
        items = [dict(p.to_dict(), id=p.id) for p in players_stream]
        if page is not None and limit is not None:
            start = (page - 1) * limit
            end = start + limit
            players = items[start:end]
        else:
            players = items
        return {"players": players}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing players: {e}")
        raise HTTPException(status_code=500, detail="Failed to list players")

@router.post('/leagues/{league_id}/players')
@write_rate_limit()
def add_player(request: Request, league_id: str, req: dict, current_user=Depends(require_role("organizer", "coach"))):
    try:
        players_ref = db.collection("leagues").document(league_id).collection("players")
        player_doc = players_ref.document()
        
        # Add timeout to player creation
        execute_with_timeout(
            lambda: player_doc.set({
                **req,
                "created_at": datetime.utcnow().isoformat(),
            }),
            timeout=10
        )
        return {"player_id": player_doc.id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding player: {e}")
        raise HTTPException(status_code=500, detail="Failed to add player")

@router.get('/leagues/{league_id}/players/{player_id}/drill_results')
@read_rate_limit()
def list_drill_results(request: Request, league_id: str, player_id: str, current_user=Depends(get_current_user)):
    try:
        drill_results_ref = db.collection("leagues").document(league_id).collection("players").document(player_id).collection("drill_results")
        # Add timeout to drill results retrieval
        results_stream = execute_with_timeout(
            lambda: list(drill_results_ref.stream()),
            timeout=10
        )
        results = [dict(r.to_dict(), id=r.id) for r in results_stream]
        return {"drill_results": results}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing drill results: {e}")
        raise HTTPException(status_code=500, detail="Failed to list drill results")
