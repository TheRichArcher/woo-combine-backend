from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit, bulk_rate_limit
import logging
from ..firestore_client import db
from datetime import datetime
from ..models import PlayerSchema
from ..utils.database import execute_with_timeout
from ..utils.data_integrity import (
    enforce_event_league_relationship,
    ensure_league_document,
)
from ..security.access_matrix import require_permission
import hashlib

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

def generate_player_id(event_id: str, first: str, last: str, number: Optional[int]) -> str:
    """Generate a deterministic, unique ID for a player based on their identity"""
    # Normalize inputs
    f = (first or "").strip().lower()
    l = (last or "").strip().lower()
    n = str(number).strip() if number is not None else "nonum"
    
    # Create raw string for hashing
    raw = f"{event_id}:{f}:{l}:{n}"
    
    # Return SHA-256 hash hex digest (truncated to 20 chars for ID-like length)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:20]

@router.get("/players", response_model=List[PlayerSchema])
@read_rate_limit()
@require_permission("players", "read", target="event", target_param="event_id")
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
        
        enforce_event_league_relationship(event_id=event_id)
            
        # Add timeout to players retrieval
        def get_players_query():
            query = db.collection("events").document(str(event_id)).collection("players")
            
            # Apply backend pagination if requested
            if page is not None and limit is not None:
                offset_val = (page - 1) * limit
                query = query.offset(offset_val).limit(limit)
            
            return list(query.stream())
        
        players_stream = execute_with_timeout(get_players_query, timeout=15)

        result = []
        for player in players_stream:
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

class PlayerCreate(BaseModel):
    name: str
    number: Optional[int] = None
    age_group: Optional[str] = None
    photo_url: Optional[str] = None

@router.post("/players")
@write_rate_limit()
@require_permission("players", "create", target="event", target_param="event_id")
def create_player(
    request: Request,
    player: PlayerCreate,
    event_id: str = Query(...),
    current_user=Depends(require_role("organizer", "coach"))
):
    try:
        logging.info(f"[CREATE_PLAYER] Starting player creation for event_id: {event_id}")
        
        enforce_event_league_relationship(event_id=event_id)
        
        # Parse names for ID generation
        parts = player.name.strip().split()
        first = parts[0] if parts else ""
        last = " ".join(parts[1:]) if len(parts) > 1 else ""
        
        # Generate deterministic ID for deduplication
        player_id = generate_player_id(event_id, first, last, player.number)
        
        # Create/Update player in the event subcollection
        logging.info(f"[CREATE_PLAYER] Creating player document with deterministic ID: {player_id}")
        player_doc = db.collection("events").document(str(event_id)).collection("players").document(player_id)
        
        player_data = {
            "name": player.name,
            "first": first,
            "last": last,
            "number": player.number,
            "age_group": player.age_group,
            "photo_url": player.photo_url,
            "event_id": event_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Add timeout to player creation (merge=True allows idempotent retries)
        execute_with_timeout(
            lambda: player_doc.set(player_data, merge=True),
            timeout=5
        )
        
        logging.info(f"[CREATE_PLAYER] Player created successfully")
        
        return {
            "id": player_id,
            **player_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[CREATE_PLAYER] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create player: {str(e)}")

@router.put("/players/{player_id}")
@write_rate_limit()
@require_permission("players", "update", target="event", target_param="event_id")
def update_player(
    request: Request,
    player_id: str,
    player: PlayerCreate,
    event_id: str = Query(...),
    current_user=Depends(require_role("organizer", "coach"))
):
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        player_ref = db.collection("events").document(str(event_id)).collection("players").document(player_id)
        player_doc = execute_with_timeout(
            player_ref.get,
            timeout=3
        )
        
        if not player_doc.exists:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Parse names
        parts = player.name.strip().split()
        first = parts[0] if parts else ""
        last = " ".join(parts[1:]) if len(parts) > 1 else ""
        
        # Update player data
        update_data = {
            "name": player.name,
            "first": first,
            "last": last,
            "number": player.number,
            "age_group": player.age_group,
            "photo_url": player.photo_url,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
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
@require_permission(
    "players",
    "upload",
    target="event",
    target_getter=lambda kwargs: getattr(kwargs.get("req"), "event_id", None),
)
def upload_players(request: Request, req: UploadRequest, current_user=Depends(require_role("organizer"))):
    try:
        enforce_event_league_relationship(event_id=req.event_id)
            
        event_id = req.event_id
        players = req.players
        required_fields = ["first_name", "last_name", "jersey_number"]
        drill_fields = ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]
        errors = []
        added = 0
        
        MAX_ROWS = 5000
        if len(players) > MAX_ROWS:
            raise HTTPException(status_code=400, detail=f"Too many rows: max {MAX_ROWS}")

        # Local duplicate detection within upload batch
        seen_keys = set()

        batch = db.batch()
        batch_count = 0
        
        for idx, player in enumerate(players):
            row_errors = []
            for field in required_fields:
                if player.get(field) in (None, ""):
                    row_errors.append(f"Missing {field}")
            
            try:
                num = int(str(player.get("jersey_number")).strip()) if player.get("jersey_number") not in (None, "") else None
                if num is None:
                    row_errors.append("Missing jersey_number")
                elif num < 1 or num > 9999:
                    row_errors.append("jersey_number must be between 1 and 9999")
            except Exception:
                row_errors.append("Invalid jersey_number")
                
            if row_errors:
                errors.append({"row": idx + 1, "message": ", ".join(row_errors)})
                continue

            # Generate ID for deduplication
            first_name = (player.get("first_name") or "").strip()
            last_name = (player.get("last_name") or "").strip()
            
            # Check local batch duplicates
            key = (first_name.lower(), last_name.lower(), num)
            if key in seen_keys:
                errors.append({"row": idx + 1, "message": "Duplicate player in file"})
                continue
            seen_keys.add(key)

            player_id = generate_player_id(event_id, first_name, last_name, num)
            
            full_name = f"{first_name} {last_name}".strip()
            player_data = {
                "name": full_name,
                "first": first_name,
                "last": last_name,
                "number": num,
                "age_group": (str(player.get("age_group")).strip() if str(player.get("age_group") or "").strip() != "" else None),
                "external_id": (player.get("external_id") or None),
                "team_name": (player.get("team_name") or None),
                "position": (player.get("position") or None),
                "notes": (player.get("notes") or None),
                "photo_url": None,
                "event_id": event_id,
                "created_at": datetime.utcnow().isoformat(),
            }

            for drill in drill_fields:
                value = player.get(drill, "")
                if value and str(value).strip() != "":
                    try:
                        player_data[drill] = float(value)
                    except ValueError:
                        player_data[drill] = None
                else:
                    player_data[drill] = None

            player_ref = db.collection("events").document(event_id).collection("players").document(player_id)
            batch.set(player_ref, player_data, merge=True)
            batch_count += 1
            added += 1

            # Commit batch every 400 operations
            if batch_count >= 400:
                execute_with_timeout(lambda: batch.commit(), timeout=10)
                batch = db.batch()
                batch_count = 0

        # Commit remaining
        if batch_count > 0:
            execute_with_timeout(lambda: batch.commit(), timeout=10)
            
        logging.info(f"Player upload completed: {added} processed, {len(errors)} errors")
        return {"added": added, "errors": errors}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading players: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload players")

@router.delete("/players/reset")
@require_permission("players", "reset", target="event", target_param="event_id")
def reset_players(event_id: str = Query(...), current_user=Depends(require_role("organizer"))):
    try:
        enforce_event_league_relationship(event_id=event_id)
        players_ref = db.collection("events").document(str(event_id)).collection("players")
        players_stream = execute_with_timeout(lambda: list(players_ref.stream()), timeout=15)
        
        # Delete drill results for each player
        for player in players_stream:
            drill_results_ref = player.reference.collection("drill_results")
            drill_results_stream = execute_with_timeout(lambda: list(drill_results_ref.stream()), timeout=10)
            for drill_result in drill_results_stream:
                drill_result.reference.delete()
        
        # Delete all players
        for player in players_stream:
            player.reference.delete()
            
        # Reset Live Entry status
        event_ref = db.collection("events").document(str(event_id))
        execute_with_timeout(lambda: event_ref.update({"live_entry_active": False}), timeout=5)
        
        # Also clear aggregated results (per user request for consistency)
        agg_ref = db.collection("events").document(str(event_id)).collection("aggregated_drill_results")
        agg_stream = execute_with_timeout(lambda: list(agg_ref.stream()), timeout=10)
        for doc in agg_stream:
            doc.reference.delete()

        return {"status": "reset", "event_id": str(event_id)}
    except Exception as e:
        logging.error(f"Error resetting players: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset players")

@router.get("/rankings")
@require_permission("players", "rankings", target="event", target_param="event_id")
def get_rankings(
    age_group: str = Query(...),
    event_id: str = Query(...),
    weight_40m_dash: float = Query(None, alias="weight_40m_dash"),
    weight_vertical_jump: float = Query(None, alias="weight_vertical_jump"),
    weight_catching: float = Query(None, alias="weight_catching"),
    weight_throwing: float = Query(None, alias="weight_throwing"),
    weight_agility: float = Query(None, alias="weight_agility"),
    current_user=Depends(get_current_user)
):
    try:
        enforce_event_league_relationship(event_id=event_id)
            
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
            
        players_stream = execute_with_timeout(
            lambda: list(db.collection("events").document(str(event_id)).collection("players").stream()),
            timeout=15
        )
        
        ranked = []
        for player in players_stream:
            player_data = player.to_dict()
            if player_data.get("age_group") != age_group:
                continue
                
            composite_score = calculate_composite_score(player_data, custom_weights)
            ranked.append({
                "player_id": player.id,
                "name": player_data.get("name"),
                "number": player_data.get("number"),
                "composite_score": composite_score,
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

@router.get('/leagues/{league_id}/players')
@require_permission("league_players", "read", target="league", target_param="league_id")
def list_players(
    league_id: str,
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=500),
    current_user=Depends(get_current_user)
):
    try:
        ensure_league_document(league_id)
        
        def get_league_players_query():
            query = db.collection("leagues").document(league_id).collection("players")
            if page is not None and limit is not None:
                offset_val = (page - 1) * limit
                query = query.offset(offset_val).limit(limit)
            return list(query.stream())
            
        players_stream = execute_with_timeout(get_league_players_query, timeout=10)
        items = [dict(p.to_dict(), id=p.id) for p in players_stream]
        return {"players": items}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing players: {e}")
        raise HTTPException(status_code=500, detail="Failed to list players")

@router.post('/leagues/{league_id}/players')
@write_rate_limit()
@require_permission("league_players", "create", target="league", target_param="league_id")
def add_player(request: Request, league_id: str, req: dict, current_user=Depends(require_role("organizer", "coach"))):
    try:
        ensure_league_document(league_id)
        players_ref = db.collection("leagues").document(league_id).collection("players")
        player_doc = players_ref.document()
        
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
@require_permission("league_players", "drill_results", target="league", target_param="league_id")
def list_drill_results(request: Request, league_id: str, player_id: str, current_user=Depends(get_current_user)):
    try:
        ensure_league_document(league_id)
        drill_results_ref = db.collection("leagues").document(league_id).collection("players").document(player_id).collection("drill_results")
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
