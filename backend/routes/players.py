from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Dict, Any, Optional
from collections import defaultdict
from pydantic import BaseModel
from ..auth import get_current_user, require_verified_user
from ..middleware.rate_limiting import read_rate_limit, write_rate_limit, bulk_rate_limit
import logging
from ..firestore_client import db
from datetime import datetime
from ..models import PlayerSchema
from ..schemas import SportSchema
from ..services.schema_registry import SchemaRegistry
from ..utils.database import execute_with_timeout
from ..utils.event_schema import get_event_schema
from ..utils.data_integrity import (
    enforce_event_league_relationship,
    ensure_league_document,
)
from ..utils.identity import generate_player_id
from ..utils.lock_validation import check_write_permission
from ..security.access_matrix import require_permission
from ..services.player_bulk_upload import upload_players_service
import hashlib
import uuid

router = APIRouter()

def calculate_composite_score(player_data: Dict[str, Any], weights: Optional[Dict[str, float]] = None, schema: Optional[SportSchema] = None) -> float:
    """
    Calculate composite score using the Multi-Sport Schema Engine.
    Fully dynamic based on the provided schema (or default football).
    """
    # 1. Resolve Schema
    if not schema:
        # Fallback for legacy calls that didn't provide schema
        schema = SchemaRegistry.get_schema("football")

    # 2. Resolve Weights
    # If no custom weights provided, use defaults from schema
    use_weights = weights if weights is not None else {d.key: d.default_weight for d in schema.drills}
    
    score = 0.0
    
    # 3. Iterate Drills defined in Schema
    # Calculate total weight first for renormalization (only active drills)
    total_weight = 0.0
    for drill in schema.drills:
        w = use_weights.get(drill.key, 0.0)
        if w > 0:
            total_weight += w
            
    # 4. Score Calculation
    weighted_sum = 0.0
    
    for drill in schema.drills:
        key = drill.key
        weight = use_weights.get(key, 0.0)
        
        if weight <= 0:
            continue
            
        # Get Value (Check 'scores' map first, then legacy fields)
        scores_map = player_data.get("scores", {})
        raw_val = scores_map.get(key)
        
        # Legacy fallback if not in scores map
        if raw_val is None:
            raw_val = player_data.get(key) or player_data.get(f"drill_{key}")
            
        if raw_val is not None and str(raw_val).strip() != "":
            try:
                val = float(raw_val)
                
                # Normalize Score (0-100 scale) based on Schema Min/Max
                # Use schema min/max if defined, otherwise sensible defaults or raw
                min_v = drill.min_value if drill.min_value is not None else 0.0
                max_v = drill.max_value if drill.max_value is not None else 100.0
                
                if max_v == min_v:
                    normalized = 50.0 # Avoid division by zero
                elif drill.lower_is_better:
                    # Invert logic: (Max - Value) / (Max - Min) * 100
                    # Clamp value to range first to avoid negative scores
                    clamped = max(min_v, min(max_v, val))
                    normalized = ((max_v - clamped) / (max_v - min_v)) * 100
                else:
                    # Standard logic: (Value - Min) / (Max - Min) * 100
                    clamped = max(min_v, min(max_v, val))
                    normalized = ((clamped - min_v) / (max_v - min_v)) * 100
                
                # Add to weighted sum (using raw weight, will normalize total at end)
                weighted_sum += normalized * weight
            except (ValueError, TypeError):
                pass
                
    # Final Renormalization: Weighted Sum / Total Weight
    if total_weight > 0:
        return round(weighted_sum / total_weight, 2)
    return 0.0

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
        
        # FETCH SCHEMA ONCE FOR BATCH SCORING
        schema = get_event_schema(event_id)
            
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
            
            # Flatten scores for frontend compatibility
            scores = player_dict.get("scores", {})
            if scores:
                for k, v in scores.items():
                    # Only set if not already present to allow scores to be the source of truth
                    if k not in player_dict:
                        player_dict[k] = v
            
            # Pass schema to scoring engine
            player_dict["composite_score"] = calculate_composite_score(player_dict, schema=schema)
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
    current_user=Depends(require_verified_user)
):
    try:
        logging.info(f"[CREATE_PLAYER] Starting player creation for event_id: {event_id}")
        
        enforce_event_league_relationship(event_id=event_id)
        # Enforce scoped write authorization (event lock + membership canWrite).
        check_write_permission(
            event_id=event_id,
            user_id=current_user["uid"],
            operation_name="create player"
        )
        
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
            "scores": {} # Initialize empty scores map
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
    current_user=Depends(require_verified_user)
):
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        # Check scoped write permission (membership role is authoritative).
        check_write_permission(
            event_id=event_id,
            user_id=current_user["uid"],
            operation_name="update player"
        )
        
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
    skipped_count: Optional[int] = 0
    method: Optional[str] = "file"
    filename: Optional[str] = None
    mode: Optional[str] = "create_or_update"  # Options: "create_or_update", "scores_only"

@router.post("/players/upload")
@bulk_rate_limit()
@require_permission(
    "players",
    "upload",
    target="event",
    target_getter=lambda kwargs: getattr(kwargs.get("req"), "event_id", None),
)
def upload_players(request: Request, req: UploadRequest, current_user=Depends(require_verified_user)):
    return upload_players_service(request=request, req=req, current_user=current_user)


class RevertRequest(BaseModel):
    event_id: str
    undo_log: List[Dict[str, Any]]

@router.post("/players/revert-import")
@bulk_rate_limit()
@require_permission(
    "players",
    "upload", # Using 'upload' permission for revert as it's part of the import flow
    target="event",
    target_getter=lambda kwargs: getattr(kwargs.get("req"), "event_id", None),
)
def revert_import(request: Request, req: RevertRequest, current_user=Depends(require_verified_user)):
    """
    Revert a previous import using the provided undo log.
    Restores previous state or deletes created players.
    """
    try:
        enforce_event_league_relationship(event_id=req.event_id)
        
        event_id = req.event_id
        undo_log = req.undo_log
        
        batch = db.batch()
        batch_count = 0
        restored = 0
        deleted = 0
        
        for item in undo_log:
            player_id = item.get("player_id")
            previous_data = item.get("previous_data")
            
            player_ref = db.collection("events").document(event_id).collection("players").document(player_id)
            
            if previous_data is None:
                # Player didn't exist before -> Delete it
                batch.delete(player_ref)
                deleted += 1
            else:
                # Player existed -> Restore previous data
                batch.set(player_ref, previous_data)
                restored += 1
                
            batch_count += 1
            
            if batch_count >= 400:
                execute_with_timeout(lambda: batch.commit(), timeout=10)
                batch = db.batch()
                batch_count = 0
                
        if batch_count > 0:
            execute_with_timeout(lambda: batch.commit(), timeout=10)
            
        # Log the revert in audit log?
        try:
            import_log_ref = db.collection("events").document(event_id).collection("imports").document()
            log_entry = {
                "id": import_log_ref.id,
                "event_id": event_id,
                "user_id": current_user["uid"] if current_user else "unknown",
                "timestamp": datetime.utcnow().isoformat(),
                "type": "revert",
                "restored": restored,
                "deleted": deleted,
                "method": "undo"
            }
            execute_with_timeout(lambda: import_log_ref.set(log_entry), timeout=5)
        except:
            pass
            
        logging.info(f"Revert completed: {restored} restored, {deleted} deleted")
        return {"status": "success", "restored": restored, "deleted": deleted}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error reverting import: {e}")
        raise HTTPException(status_code=500, detail="Failed to revert import")

@router.delete("/players/reset")
@require_permission("players", "reset", target="event", target_param="event_id")
def reset_players(event_id: str = Query(...), current_user=Depends(require_verified_user)):
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
    request: Request,
    event_id: str = Query(...),
    age_group: Optional[str] = Query(None),
    current_user=Depends(get_current_user)
):
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        # FETCH SCHEMA FOR RANKINGS
        schema = get_event_schema(event_id)
        
        # Extract custom weights from query params
        custom_weights = {}
        for key, value in request.query_params.items():
            if key.startswith("weight_"):
                drill_key = key.replace("weight_", "")
                try:
                    custom_weights[drill_key] = float(value)
                except:
                    pass
        
        # Use custom weights if provided, otherwise calculate_composite_score uses schema defaults
        use_weights = custom_weights if custom_weights else None
        
        players_stream = execute_with_timeout(
            lambda: list(db.collection("events").document(str(event_id)).collection("players").stream()),
            timeout=15
        )
        
        ranked = []
        for player in players_stream:
            player_data = player.to_dict()
            
            # Filter by age group if provided and not "ALL"
            if age_group and age_group.upper() != "ALL" and player_data.get("age_group") != age_group:
                continue
            
            # ELIGIBILITY CHECK: Player must have at least one scored drill in the schema
            has_valid_score = False
            scores_map = player_data.get("scores", {})
            
            for drill in schema.drills:
                # Check scores map first
                raw_val = scores_map.get(drill.key)
                
                # Check legacy field if not in scores map
                if raw_val is None:
                    raw_val = player_data.get(drill.key)
                
                if raw_val is not None and str(raw_val).strip() != "":
                    has_valid_score = True
                    break
            
            if not has_valid_score:
                continue

            composite_score = calculate_composite_score(player_data, weights=use_weights, schema=schema)
            
            # Dynamic Response Construction
            response_obj = {
                "player_id": player.id,
                "name": player_data.get("name"),
                "number": player_data.get("number"),
                "age_group": player_data.get("age_group"), # Added for UI consistency with Live Standings
                "external_id": player_data.get("external_id"), # Added for combine analytics
                "composite_score": composite_score,
                # Scores map takes precedence
                "scores": scores_map
            }
            
            # Flatten drill scores into response object for frontend convenience
            for drill in schema.drills:
                key = drill.key
                val = scores_map.get(key)
                if val is None:
                    val = player_data.get(key)
                response_obj[key] = val
            
            ranked.append(response_obj)
            
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
def add_player(request: Request, league_id: str, req: dict, current_user=Depends(require_verified_user)):
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
