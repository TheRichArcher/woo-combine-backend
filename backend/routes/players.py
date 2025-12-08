from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Dict, Any, Optional
from collections import defaultdict
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
    mode: Optional[str] = "create_or_update"  # Options: "create_or_update", "scores_only"

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
        required_fields = ["first_name", "last_name"]
        
        # DYNAMIC DRILL FIELDS FROM SCHEMA
        drill_fields = [d.key for d in schema.drills]
        
        # REQUESTED LOG: Server's drill_fields list
        logging.warning(f"[IMPORT_DEBUG] Server Drill Fields for Event {event_id}: {drill_fields}")
        
        errors = []
        
        # REQUESTED LOG: Payload Shape Debugging (Force Visibility)
        if players and isinstance(players, list) and len(players) > 0 and isinstance(players[0], dict):
            p0 = players[0]
            logging.warning(f"[IMPORT_DEBUG] first player top-level keys={sorted(list(p0.keys()))}")

            scores = p0.get("scores")
            if isinstance(scores, dict):
                logging.warning(f"[IMPORT_DEBUG] first player scores keys={sorted(list(scores.keys()))}")
                for k in ["lane_agility", "vertical_jump", "free_throws", "three_point"]:
                    if k in scores:
                        logging.warning(f"[IMPORT_DEBUG] scores[{k}]={scores.get(k)}")
            else:
                # Log specific drill keys if found at top level (flat structure)
                flat_drills = [k for k in p0.keys() if k in drill_fields or k in ["lane_agility", "vertical_jump", "free_throws", "three_point"]]
                if flat_drills:
                     logging.warning(f"[IMPORT_DEBUG] first player flat drill keys found: {flat_drills}")
                logging.warning(f"[IMPORT_DEBUG] first player has no 'scores' dict (type={type(scores)})")
        added = 0
        created_players = 0
        updated_players = 0
        players_matched = 0
        scores_written_total = 0
        scores_written_by_drill = defaultdict(int)
        
        MAX_ROWS = 5000
        if len(players) > MAX_ROWS:
            raise HTTPException(status_code=400, detail=f"Too many rows: max {MAX_ROWS}")

        # Local duplicate detection within upload batch
        seen_keys = set()
        
        # CAPTURE PREVIOUS STATE FOR UNDO
        undo_log = []
        
        # First, identify all player IDs we are about to touch
        ids_to_fetch = []
        external_ids_to_fetch = []
        
        # We need to iterate through players to generate IDs, similar to validation loop below
        for p in players:
            # Capture External ID for robust matching
            if p.get("external_id") and str(p.get("external_id")).strip():
                external_ids_to_fetch.append(str(p.get("external_id")).strip())

            # Only generate ID if required fields present
            if p.get("first_name") and p.get("last_name"):
                try:
                     # Robust number parsing (handle "12.0", "12", 12, 12.0)
                     raw_num = p.get("jersey_number")
                     if raw_num is None:
                         # Try common synonyms
                         for alias in ["jersey", "number", "no", "No", "#", "Jersey #"]:
                             if p.get(alias) is not None:
                                 raw_num = p.get(alias)
                                 break
                                 
                     num = int(float(str(raw_num).strip())) if raw_num not in (None, "") else None
                     
                     # Even if num is None, we can generate an ID
                     pid = generate_player_id(event_id, p.get("first_name"), p.get("last_name"), num)
                     ids_to_fetch.append(pid)
                except:
                    pass
        
        # Fetch existing documents in batches (Firestore limit 10-30 per getAll? No, supports more but better chunked)
        existing_docs_map = {}
        external_id_map = {}

        # 1. Fetch by External ID (Priority Match)
        if external_ids_to_fetch:
            unique_exts = list(set(external_ids_to_fetch))
            logging.warning(f"[IMPORT_DEBUG] Fetching {len(unique_exts)} potential existing players by External ID: {unique_exts}")
            
            # Firestore 'in' query limit is 10
            for i in range(0, len(unique_exts), 10):
                chunk = unique_exts[i:i+10]
                try:
                    logging.warning(f"[IMPORT_DEBUG] Querying chunk: {chunk}")
                    q = db.collection("events").document(event_id).collection("players").where("external_id", "in", chunk)
                    docs = q.stream()
                    for doc in docs:
                        data = doc.to_dict()
                        data['id'] = doc.id
                        ext_key = str(data.get('external_id')).strip()
                        external_id_map[ext_key] = data
                        existing_docs_map[doc.id] = data # Also populate ID map
                        logging.warning(f"[IMPORT_DEBUG] Found by external_id: {ext_key} -> {doc.id}")
                except Exception as e:
                    logging.warning(f"[IMPORT_DEBUG] Failed to fetch by external_id chunk: {e}")

        # 2. Fetch by Generated ID (Name+Number Fallback)
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
            
            num = None
            try:
                raw_num = player.get("jersey_number")
                if raw_num is None:
                    # Try common synonyms
                    for alias in ["jersey", "number", "no", "No", "#", "Jersey #"]:
                        if player.get(alias) is not None:
                            raw_num = player.get(alias)
                            break
                            
                num = int(float(str(raw_num).strip())) if raw_num not in (None, "") else None
                
                # Validation: jersey_number is now OPTIONAL, but if present must be valid
                if num is not None and (num < 0 or num > 9999):
                    row_errors.append("jersey_number must be between 0 and 9999")
            except Exception:
                row_errors.append("Invalid jersey_number")
                
            if row_errors:
                errors.append({"row": idx + 1, "message": ", ".join(row_errors)})
                continue

            # Generate ID for deduplication (Default / Fallback)
            first_name = (player.get("first_name") or "").strip()
            last_name = (player.get("last_name") or "").strip()
            
            # Determine Target Player ID with Priority Matching
            player_id = None
            previous_state = None
            
            # Priority 1: External ID Match
            incoming_ext_id = str(player.get("external_id") or "").strip()
            if incoming_ext_id and incoming_ext_id in external_id_map:
                previous_state = external_id_map[incoming_ext_id]
                player_id = previous_state['id']
                logging.info(f"[IMPORT_DEBUG] Row {idx+1}: MATCHED BY EXTERNAL_ID -> {incoming_ext_id} -> {player_id}")
            else:
                # Priority 2: Name + Number Match (Deterministic ID)
                player_id = generate_player_id(event_id, first_name, last_name, num)
                previous_state = existing_docs_map.get(player_id)
            
            # Check local batch duplicates
            # Note: We use Name+Number key for local dup check usually, but what if ext_id matches?
            # Let's keep the name+number check for simplicity, or should we check ID?
            key = (first_name.lower(), last_name.lower(), num)
            if key in seen_keys:
                errors.append({"row": idx + 1, "message": "Duplicate player in file"})
                continue
            seen_keys.add(key)

            # DEBUG LOGGING FOR DUPLICATION DIAGNOSIS
            logging.info(f"[IMPORT_DEBUG] Row {idx+1}: Incoming Identity -> First='{first_name}', Last='{last_name}', Num={num}")
            logging.info(f"[IMPORT_DEBUG] Row {idx+1}: Resolved ID -> {player_id}")

            # Record Undo State
            # previous_state is already set above
            
            # --- SCORES ONLY MODE CHECK ---
            if req.mode == "scores_only" and not previous_state:
                # In scores_only mode, we strictly require the player to exist
                errors.append({"row": idx + 1, "message": f"Player match not found for {first_name} {last_name} (#{num}). strictly requiring existing player."})
                continue
            
            if previous_state:
                players_matched += 1
                updated_players += 1
                logging.info(f"[IMPORT_DEBUG] Row {idx+1}: FOUND EXISTING PLAYER -> ID={player_id}, Name='{previous_state.get('name')}'")
            else:
                created_players += 1
                logging.info(f"[IMPORT_DEBUG] Row {idx+1}: NO MATCH FOUND -> Will create new document {player_id}")
                # Also log why it might have failed - check if we tried to fetch it?
                if player_id not in ids_to_fetch and not incoming_ext_id:
                     logging.info(f"[IMPORT_DEBUG] Row {idx+1}: WARNING - ID {player_id} was NOT in pre-fetch list.")

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
            
            # 1. Start with existing scores if we are merging (or overwrite if empty)
            scores = {}
            if previous_state and previous_state.get("scores"):
                scores = previous_state.get("scores").copy()
            
            # 2. Extract incoming scores from payload
            incoming_scores = {}
            
            # 2a. Check nested 'scores' dict first (highest priority if present)
            if player.get("scores") and isinstance(player.get("scores"), dict):
                incoming_scores.update(player.get("scores"))
                
            # 2b. Check flat keys for any drills in the schema (merges/overrides)
            # This handles the "flat" payload sent by the frontend importer
            for drill_key in drill_fields:
                # Explicit check for existence in top-level dict (handles None/0/empty string if key exists)
                if drill_key in player:
                    val = player.get(drill_key)
                    # Only add if not None (allow 0 or empty string to be processed by validation logic)
                    if val is not None:
                        incoming_scores[drill_key] = val
            
            # Debug log for first player to diagnose why scores might be dropped
            if idx == 0:
                 logging.warning(f"[IMPORT_DEBUG] Row 1 incoming_scores (unified): {incoming_scores}")

            # 3. Process and validate all incoming scores
            for drill_key, raw_val in incoming_scores.items():
                if raw_val is not None and str(raw_val).strip() != "":
                    try:
                        val_float = float(raw_val)
                        scores[drill_key] = val_float
                        
                        # Only count as "written" if it's in the current schema or we want to track all?
                        # Let's track all valid numbers written to 'scores'
                        scores_written_total += 1
                        scores_written_by_drill[drill_key] += 1
                        
                        if idx == 0:
                            logging.warning(f"[IMPORT_DEBUG] Row 1 processed {drill_key}: raw='{raw_val}' -> float={val_float}")

                        # Also set legacy field for football compatibility if it matches
                        if drill_key in ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]:
                            player_data[drill_key] = val_float
                    except (ValueError, TypeError):
                        if idx == 0:
                            logging.warning(f"[IMPORT_DEBUG] Row 1 failed to parse {drill_key}: raw='{raw_val}'")
                        pass
            
            player_data["scores"] = scores
            if idx == 0:
                logging.warning(f"[IMPORT_DEBUG] Row 1 final scores to write: {scores}")
            
            # --- IMPROVED DUPLICATE HANDLING (MERGE LOGIC) ---
            # Strategy: 'overwrite' (default) or 'merge'
            strategy = player.get("merge_strategy", "overwrite")
            
            if strategy == "merge" or (req.mode == "scores_only" and previous_state):
                if previous_state and "created_at" in previous_state:
                    del player_data["created_at"]
                
                # New Logic for Scores Only: Strictly preserve identity fields
                if req.mode == "scores_only":
                    # Keep only scores and non-identity fields from payload
                    identity_fields = ["name", "first", "last", "number", "age_group", "team_name", "position", "photo_url", "external_id"]
                    for f in identity_fields:
                        if f in player_data:
                            del player_data[f]
                
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
        
        # --- DETAILED IMPORT SUMMARY FOR DEBUGGING ---
        logging.info(f"[IMPORT_SUMMARY] Event {event_id}: {scores_written_total} total scores written across {len(scores_written_by_drill)} drills")
        for drill_key, count in scores_written_by_drill.items():
            logging.info(f"  - {drill_key}: {count} scores")
        
        # Log any drills that were expected but not received
        # Use unified check logic against ALL processed rows to be accurate
        # But here we only have aggregate counts.
        # If scores_written_by_drill is empty, it means NO valid scores were parsed.
        
        expected_drills = set(drill_fields)
        received_drills = set(scores_written_by_drill.keys())
        missing_drills = expected_drills - received_drills
        
        # Suppress warning if at least some scores were written, unless specific debugging is needed
        if missing_drills and scores_written_total == 0:
            logging.warning(f"[IMPORT_WARNING] Expected drill keys not received in any player data: {missing_drills}")
            logging.warning(f"[IMPORT_WARNING] This could mean: 1) No players had scores for these drills, 2) CSV columns weren't mapped correctly, or 3) Column names didn't match drill keys/labels")
            # Add detail about first row keys
            if len(players) > 0:
                 logging.warning(f"[IMPORT_WARNING] First row keys for debugging: {list(players[0].keys())}")
        elif missing_drills:
             # Just info log if we have some data but not all drills (common partial import case)
             logging.info(f"[IMPORT_INFO] Some drills were not present in this import: {missing_drills}")
            
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
            
        logging.info(f"Player upload completed: Mode={req.mode}, Created={created_players}, Updated={updated_players}, Scores={scores_written_total}, Errors={len(errors)}")
        return {
            "added": added, 
            "created_players": created_players,
            "updated_players": updated_players,
            "errors": errors, 
            "undo_log": undo_log,
            "players_received": len(players),
            "players_matched": players_matched,
            "scores_written_total": scores_written_total,
            "scores_written_by_drill": scores_written_by_drill
        }
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
