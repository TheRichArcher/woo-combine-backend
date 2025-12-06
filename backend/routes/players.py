from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..auth import get_current_user, require_role
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
from ..security.access_matrix import require_permission
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
    for drill in schema.drills:
        key = drill.key
        weight = use_weights.get(key, 0.0)
        
        if weight <= 0:
            continue
            
        # 4. Get Value (Check 'scores' map first, then legacy fields)
        scores_map = player_data.get("scores", {})
        raw_val = scores_map.get(key)
        
        # Legacy fallback if not in scores map
        if raw_val is None:
            raw_val = player_data.get(key) or player_data.get(f"drill_{key}")
            
        if raw_val is not None and raw_val != "":
            try:
                val = float(raw_val)
                
                # 5. Normalize Score (0-100 scale) based on Schema Min/Max
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
                
                # Treat weight as percentage (0-100) to prevent inflation
                score += normalized * (weight / 100.0)
            except (ValueError, TypeError):
                pass
                
    return round(score, 2)

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
    skipped_count: Optional[int] = 0
    method: Optional[str] = "file"
    filename: Optional[str] = None

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
        
        # FETCH SCHEMA FOR VALIDATION
        schema = get_event_schema(event_id)
        
        players = req.players
        required_fields = ["first_name", "last_name", "jersey_number"]
        
        # DYNAMIC DRILL FIELDS FROM SCHEMA
        drill_fields = [d.key for d in schema.drills]
        
        errors = []
        added = 0
        
        MAX_ROWS = 5000
        if len(players) > MAX_ROWS:
            raise HTTPException(status_code=400, detail=f"Too many rows: max {MAX_ROWS}")

        # Local duplicate detection within upload batch
        seen_keys = set()
        
        # CAPTURE PREVIOUS STATE FOR UNDO
        undo_log = []
        
        # First, identify all player IDs we are about to touch
        ids_to_fetch = []
        
        # We need to iterate through players to generate IDs, similar to validation loop below
        for p in players:
            # Only generate ID if required fields present
            if p.get("first_name") and p.get("last_name"):
                try:
                     # Robust number parsing (handle "12.0", "12", 12, 12.0)
                     raw_num = p.get("jersey_number")
                     num = int(float(str(raw_num).strip())) if raw_num not in (None, "") else None
                     
                     if num is not None:
                         pid = generate_player_id(event_id, p.get("first_name"), p.get("last_name"), num)
                         ids_to_fetch.append(pid)
                except:
                    pass
        
        # Fetch existing documents in batches (Firestore limit 10-30 per getAll? No, supports more but better chunked)
        existing_docs_map = {}
        if ids_to_fetch:
            # Unique IDs only
            unique_ids = list(set(ids_to_fetch))
            
            logging.info(f"[IMPORT_DEBUG] Fetching {len(unique_ids)} potential existing players for duplicate check.")

            # Fetch in chunks of 100
            for i in range(0, len(unique_ids), 100):
                chunk = unique_ids[i:i+100]
                refs = [db.collection("events").document(event_id).collection("players").document(pid) for pid in chunk]
                docs = db.get_all(refs)
                for doc in docs:
                    if doc.exists:
                        existing_docs_map[doc.id] = doc.to_dict()
                    else:
                        existing_docs_map[doc.id] = None # Explicitly mark as not existing

        batch = db.batch()
        batch_count = 0
        
        for idx, player in enumerate(players):
            row_errors = []
            for field in required_fields:
                if player.get(field) in (None, ""):
                    row_errors.append(f"Missing {field}")
            
            try:
                raw_num = player.get("jersey_number")
                num = int(float(str(raw_num).strip())) if raw_num not in (None, "") else None
                
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

            # DEBUG LOGGING FOR DUPLICATION DIAGNOSIS
            logging.info(f"[IMPORT_DEBUG] Row {idx+1}: Incoming Identity -> First='{first_name}', Last='{last_name}', Num={num}")
            logging.info(f"[IMPORT_DEBUG] Row {idx+1}: Generated ID -> {player_id}")

            # Record Undo State
            previous_state = existing_docs_map.get(player_id)
            
            if previous_state:
                logging.info(f"[IMPORT_DEBUG] Row {idx+1}: FOUND EXISTING PLAYER -> ID={player_id}, Name='{previous_state.get('name')}'")
            else:
                logging.info(f"[IMPORT_DEBUG] Row {idx+1}: NO MATCH FOUND -> Will create new document {player_id}")
                # Also log why it might have failed - check if we tried to fetch it?
                if player_id not in ids_to_fetch:
                     logging.info(f"[IMPORT_DEBUG] Row {idx+1}: WARNING - ID {player_id} was NOT in pre-fetch list. 'ids_to_fetch' only included players with valid jersey numbers.")

            undo_log.append({
                "player_id": player_id,
                "previous_data": previous_state # None if didn't exist, dict if existed
            })

            full_name = f"{first_name} {last_name}".strip()
            
            # BASE PLAYER DATA
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
                "scores": {} # Start with empty scores
            }

            # PROCESS DYNAMIC SCORES
            scores = {}
            
            # If we are merging, preserve existing scores
            if previous_state and previous_state.get("scores"):
                scores = previous_state.get("scores").copy()
                
            for drill_key in drill_fields:
                value = player.get(drill_key, "")
                
                # Handle both new keys "sprint_100" and legacy mapping if needed
                # (Frontend usually normalizes CSV headers to match drill keys)
                
                if value and str(value).strip() != "":
                    try:
                        val_float = float(value)
                        scores[drill_key] = val_float
                        # Also set legacy field for football compatibility if it matches
                        # This ensures older frontends still see data
                        if drill_key in ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]:
                            player_data[drill_key] = val_float
                    except ValueError:
                        pass
            
            player_data["scores"] = scores
            
            # --- IMPROVED DUPLICATE HANDLING (MERGE LOGIC) ---
            # Strategy: 'overwrite' (default) or 'merge'
            strategy = player.get("merge_strategy", "overwrite")
            
            if strategy == "merge":
                if previous_state and "created_at" in previous_state:
                    del player_data["created_at"]
                
                # For merge, we need to be careful not to overwrite the whole 'scores' map with a partial one
                # Logic above already handled merging scores into existing dictionary
                
                # Filter out None values from payload
                player_data = {k: v for k, v in player_data.items() if v is not None}

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
            
        # --- IMPORT AUDIT LOG ---
        try:
            import_log_ref = db.collection("events").document(event_id).collection("imports").document()
            log_entry = {
                "id": import_log_ref.id,
                "event_id": event_id,
                "user_id": current_user["uid"] if current_user else "unknown",
                "timestamp": datetime.utcnow().isoformat(),
                "rows_imported": added,
                "rows_skipped": req.skipped_count or len(errors),
                "method": req.method,
                "filename": req.filename,
                "undo_available": True,
                "errors_count": len(errors)
            }
            execute_with_timeout(lambda: import_log_ref.set(log_entry), timeout=5)
        except Exception as e:
            logging.error(f"Failed to write import audit log: {e}")
            
        logging.info(f"Player upload completed: {added} processed, {len(errors)} errors")
        return {"added": added, "errors": errors, "undo_log": undo_log}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading players: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload players")

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
def revert_import(request: Request, req: RevertRequest, current_user=Depends(require_role("organizer"))):
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
    request: Request,
    event_id: str = Query(...),
    age_group: Optional[str] = Query(None),
    current_user=Depends(get_current_user)
):
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        # FETCH SCHEMA FOR RANKINGS
        schema = get_event_schema(event_id)
        logging.info(f"[GET_RANKINGS] Event: {event_id}, Schema: {schema.id}, Drills: {[d.key for d in schema.drills]}")
        
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
        debug_logged = False
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
                if not debug_logged:
                    logging.info(f"[GET_RANKINGS] Skipping player {player.id} (No valid score). Scores keys: {list(scores_map.keys())}, Schema keys: {[d.key for d in schema.drills]}")
                    debug_logged = True
                continue

            composite_score = calculate_composite_score(player_data, weights=use_weights, schema=schema)
            
            # Dynamic Response Construction
            response_obj = {
                "player_id": player.id,
                "name": player_data.get("name"),
                "number": player_data.get("number"),
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
