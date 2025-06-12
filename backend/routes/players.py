from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Dict, Any
from pydantic import BaseModel
from backend.auth import get_current_user, require_role
import logging
from backend.firestore_client import db
from datetime import datetime
from backend.models import PlayerSchema
import concurrent.futures

router = APIRouter()

# Utility: Composite Score Calculation
DRILL_WEIGHTS = {
    "40m_dash": 0.3,
    "vertical_jump": 0.2,
    "catching": 0.15,
    "throwing": 0.15,
    "agility": 0.2,
}

def calculate_composite_score(player_data: dict, weights: dict = None) -> float:
    """Calculate composite score for a player based on their drill results"""
    use_weights = weights if weights is not None else DRILL_WEIGHTS
    score = 0.0
    
    for drill, weight in use_weights.items():
        # Get drill value from player data (stored as drill_[type] or just [type])
        value = player_data.get(drill, 0) or player_data.get(f"drill_{drill}", 0)
        if value is None:
            value = 0
        try:
            score += float(value) * weight
        except (ValueError, TypeError):
            # Skip invalid values
            continue
    
    return round(score, 2)

# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

def execute_with_timeout(func, timeout=2, *args, **kwargs):
    """Execute a function with timeout protection - OPTIMIZED like big apps"""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            logging.error(f"Operation timed out after {timeout} seconds: {func.__name__}")
            raise HTTPException(
                status_code=504,
                detail=f"Database operation timed out after {timeout} seconds"
            )

@router.get("/players", response_model=List[PlayerSchema])
def get_players(request: Request, event_id: str = Query(...), current_user = Depends(get_current_user)):
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
        
        players_stream = execute_with_timeout(get_players_stream, timeout=2)
        
        result = []
        for player in players_stream:
            player_dict = player.to_dict()
            player_dict["id"] = player.id
            
            # Debug logging for drill scores
            logging.info(f"[PLAYERS DEBUG] Player {player.id} data: {player_dict}")
            drill_scores = {
                "40m_dash": player_dict.get("40m_dash"),
                "vertical_jump": player_dict.get("vertical_jump"),
                "catching": player_dict.get("catching"),
                "throwing": player_dict.get("throwing"),
                "agility": player_dict.get("agility")
            }
            logging.info(f"[PLAYERS DEBUG] Drill scores for {player_dict.get('name', 'Unknown')}: {drill_scores}")
            
            # Calculate and add composite score
            player_dict["composite_score"] = calculate_composite_score(player_dict)
            result.append(player_dict)
            
        logging.info(f"[PLAYERS DEBUG] Returning {len(result)} players for event {event_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in /players: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve players")

from pydantic import BaseModel
class PlayerCreate(BaseModel):
    name: str
    number: int | None = None
    age_group: str | None = None
    photo_url: str | None = None

@router.post("/players", response_model=PlayerSchema)
def create_player(player: PlayerCreate, event_id: str = Query(...), current_user=Depends(get_current_user)):
    try:
        # Validate that the event exists
        event = execute_with_timeout(
            db.collection("events").document(str(event_id)).get,
            timeout=3
        )
        if not event.exists:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Create player in the event subcollection
        player_doc = db.collection("events").document(str(event_id)).collection("players").document()
        
        # Add timeout to player creation
        execute_with_timeout(
            lambda: player_doc.set({
                "name": player.name,
                "number": player.number,
                "age_group": player.age_group,
                "photo_url": player.photo_url,
                "event_id": event_id,
                "created_at": datetime.utcnow().isoformat(),
            }),
            timeout=5
        )
        return {"player_id": player_doc.id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating player: {e}")
        raise HTTPException(status_code=500, detail="Failed to create player")

@router.put("/players/{player_id}")
def update_player(player_id: str, player: PlayerCreate, event_id: str = Query(...), current_user=Depends(get_current_user)):
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
def upload_players(req: UploadRequest, current_user=Depends(require_role("organizer"))):
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
        required_fields = ["name"]
        drill_fields = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
        errors = []
        added = 0
        
        for idx, player in enumerate(players):
            row_errors = []
            for field in required_fields:
                if not player.get(field):
                    row_errors.append(f"Missing {field}")
            # More flexible number validation
            if player.get("number") not in (None, ""):
                try:
                    # Allow empty strings or convert to int
                    if str(player.get("number")).strip() != "":
                        int(player.get("number"))
                except (ValueError, TypeError):
                    row_errors.append(f"Invalid number: '{player.get('number')}')")
            # Allow any age group format - don't restrict to specific values
            # if player.get("age_group") not in (None, ""):
            #     if player.get("age_group") not in ["7-8", "9-10", "11-12"]:
            #         row_errors.append("Invalid age_group")
            # More flexible drill validation - only validate non-empty values
            for drill in drill_fields:
                val = player.get(drill, "")
                if val not in ("", None) and str(val).strip() != "":
                    try:
                        float(val)
                    except (ValueError, TypeError):
                        row_errors.append(f"Invalid {drill}: '{val}' (must be a number)")
            if row_errors:
                errors.append({"row": idx + 1, "message": ", ".join(row_errors)})
                continue
                
            # CRITICAL FIX: Store players in event subcollection where they're retrieved from
            player_doc = db.collection("events").document(event_id).collection("players").document()
            
            # Prepare player data with drill scores
            player_data = {
                "name": player["name"],
                "number": int(player["number"]) if player.get("number") not in (None, "") else None,
                "age_group": player["age_group"] if player.get("age_group") not in (None, "") else None,
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
def list_players(league_id: str, current_user=Depends(get_current_user)):
    try:
        players_ref = db.collection("leagues").document(league_id).collection("players")
        # Add timeout to players retrieval
        players_stream = execute_with_timeout(
            lambda: list(players_ref.stream()),
            timeout=10
        )
        players = [dict(p.to_dict(), id=p.id) for p in players_stream]
        return {"players": players}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing players: {e}")
        raise HTTPException(status_code=500, detail="Failed to list players")

@router.post('/leagues/{league_id}/players')
def add_player(league_id: str, req: dict, current_user=Depends(get_current_user)):
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
def list_drill_results(league_id: str, player_id: str, current_user=Depends(get_current_user)):
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
