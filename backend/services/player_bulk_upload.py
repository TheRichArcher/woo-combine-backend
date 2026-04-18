from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict

from fastapi import HTTPException, Request

from ..firestore_client import db
from ..utils.data_integrity import enforce_event_league_relationship
from ..utils.database import execute_with_timeout
from ..utils.event_schema import get_event_schema
from ..utils.identity import generate_player_id
from ..utils.lock_validation import check_write_permission


"""Bulk player upload service.

Extracted from backend/routes/players.py (upload_players) as a pure refactor.
"""


def upload_players_service(*, request: Request, req: Any, current_user: Dict[str, Any]):
    try:
        enforce_event_league_relationship(event_id=req.event_id)
        
        # Check scoped write permission (membership role is authoritative).
        check_write_permission(
            event_id=req.event_id,
            user_id=current_user["uid"],
            operation_name="upload players"
        )
            
        event_id = req.event_id
        
        # FETCH SCHEMA FOR VALIDATION
        schema = get_event_schema(event_id)
        
        players = req.players
        required_fields = ["first_name", "last_name"]
        
        # DYNAMIC DRILL FIELDS FROM SCHEMA
        drill_fields = [d.key for d in schema.drills]
        
        # --- PRE-FLIGHT GUARD: PREVENT SILENT FAILURE ---
        # If mode is 'scores_only', strictly require that the payload contains at least one drill key.
        # This prevents the "Success (0 scores)" bug where users map to the wrong template.
        if req.mode == 'scores_only' and len(players) > 0:
            p0 = players[0]
            has_potential_scores = False
            
            # 1. Check nested scores
            if p0.get("scores") and isinstance(p0.get("scores"), dict) and len(p0.get("scores")) > 0:
                has_potential_scores = True
            
            # 2. Check flat keys against schema
            if not has_potential_scores:
                for k in p0.keys():
                    if k in drill_fields:
                        has_potential_scores = True
                        break
            
            if not has_potential_scores:
                logging.warning(f"[IMPORT_GUARD] Blocked import. Mode={req.mode}, Payload Keys={list(p0.keys())}, Schema Keys={drill_fields}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Import blocked: No valid drill scores found. Your column mappings do not match this event's schema ({len(drill_fields)} drills). Please check that you are importing into the correct Event Type (e.g. Basketball vs Football)."
                )

        errors = []
        
        if players and isinstance(players, list) and len(players) > 0 and isinstance(players[0], dict):
            # Log minimal debug info for support (schema mismatch diagnosis) without flooding logs
             p0 = players[0]
             # Only log if we suspect an issue (e.g. no scores found in a roster+scores import)
             # or just log the keys once per batch for traceability
             logging.info(f"[IMPORT_START] Event={event_id}, Mode={req.mode}, Rows={len(players)}, Schema={drill_fields}, Row1_Keys={list(p0.keys())}")
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
        # Track first occurrence row number and player data for better error messages
        seen_keys = {}  # Changed from set() to dict: key -> (row_number, player_data)
        
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
                         # Try common synonyms (including player_number which is common in CSVs)
                         for alias in ["player_number", "jersey", "number", "no", "No", "#", "Jersey #"]:
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
            
            # Firestore 'in' query limit is 10
            for i in range(0, len(unique_exts), 10):
                chunk = unique_exts[i:i+10]
                try:
                    q = db.collection("events").document(event_id).collection("players").where("external_id", "in", chunk)
                    docs = q.stream()
                    for doc in docs:
                        data = doc.to_dict()
                        data['id'] = doc.id
                        ext_key = str(data.get('external_id')).strip()
                        external_id_map[ext_key] = data
                        existing_docs_map[doc.id] = data # Also populate ID map
                except Exception as e:
                    logging.warning(f"Failed to fetch by external_id chunk: {e}")

        # 2. Fetch by Generated ID (Name+Number Fallback)
        if ids_to_fetch:
            # Unique IDs only
            unique_ids = list(set(ids_to_fetch))
            
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

        # DEBUG: Log first player receipt to verify frontend→backend payload integrity
        if players:
            first_player = players[0]
            logging.info(f"[UPLOAD_RECEIPT] Received {len(players)} players for event {event_id}")
            logging.info(f"[UPLOAD_RECEIPT] First player raw keys: {list(first_player.keys())}")
            logging.info(f"[UPLOAD_RECEIPT] First player identity fields: first_name={first_player.get('first_name')}, last_name={first_player.get('last_name')}, number={first_player.get('number')}")
        
        batch = db.batch()
        batch_count = 0
        
        for idx, player in enumerate(players):
            # CRITICAL: Normalize jersey_number to number (backward compatibility)
            # Backend canonical is 'number' but accept legacy 'jersey_number' from older clients
            if "jersey_number" in player and "number" not in player:
                player["number"] = player["jersey_number"]
            elif "jersey_number" in player and "number" in player:
                # Both present - keep number as canonical, remove jersey_number
                del player["jersey_number"]
            
            row_errors = []
            for field in required_fields:
                if player.get(field) in (None, ""):
                    row_errors.append(f"Missing {field}")
            
            num = None
            num_source = None
            try:
                # UPDATED: Check 'number' first (canonical field), then fall back to aliases
                raw_num = player.get("number")
                num_source = "number" if raw_num is not None else None
                
                if raw_num is None:
                    # Try common synonyms for backward compatibility
                    for alias in ["player_number", "jersey", "jersey_number", "no", "No", "#", "Jersey #"]:
                        if player.get(alias) is not None:
                            raw_num = player.get(alias)
                            num_source = alias
                            break
                            
                num = int(float(str(raw_num).strip())) if raw_num not in (None, "") else None
                
                # DEBUG: Log number extraction for first player
                if idx == 0:
                    logging.info(f"[NUMBER_EXTRACT] Row 1: Extracted {num} from field '{num_source}' (raw: {raw_num})")
                
                # DEBUG: Log number extraction details
                if num is None:
                    logging.warning(f"[NUMBER_EXTRACT] Row {idx + 1}: No number found! Checked: number, player_number, jersey, jersey_number, etc. Player data keys: {list(player.keys())}")
                else:
                    logging.info(f"[NUMBER_EXTRACT] Row {idx + 1}: Extracted {num} from field '{num_source}' (raw_value='{raw_num}')")
                
                # Validation: number is OPTIONAL, but if present must be valid
                if num is not None and (num < 0 or num > 9999):
                    row_errors.append("number must be between 0 and 9999")
            except Exception as e:
                logging.warning(f"[NUMBER_EXTRACT] Row {idx + 1}: Could not parse number (non-fatal, treating as None): {e}, player keys: {list(player.keys())}")
                num = None  # Number is optional — don't fail the row
                
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
            else:
                # Priority 2: Name + Number Match (Deterministic ID)
                player_id = generate_player_id(event_id, first_name, last_name, num)
                previous_state = existing_docs_map.get(player_id)
            
            # Check local batch duplicates
            # Note: We use Name+Number key for local dup check usually, but what if ext_id matches?
            # Let's keep the name+number check for simplicity, or should we check ID?
            key = (first_name.lower(), last_name.lower(), num)
            
            # DEBUG: Log identity key for duplicate detection
            logging.info(f"[DEDUPE] Row {idx + 1}: Identity key = {key} (first={first_name}, last={last_name}, number={num})")
            
            if key in seen_keys:
                first_row_num, first_player = seen_keys[key]
                
                # CRITICAL FIX: Enhanced error handling for missing jersey numbers
                # When num is None, multiple players with the same name generate identical IDs,
                # causing Firestore batch write failures that result in 500 errors.
                # Return clear 400 validation error instead.
                if num is None:
                    error_msg = (
                        f"Duplicate identity: {first_name} {last_name} without jersey number matches Row {first_row_num}. "
                        f"Players with the same name MUST have unique jersey numbers for identification. "
                        f"SOLUTION: The Import Results UI should auto-assign jersey numbers. "
                        f"If you're seeing this error, please report it as a bug - the frontend auto-assignment failed."
                    )
                    errors.append({
                        "row": idx + 1,
                        "message": error_msg,
                        "requires_jersey_number": True,
                        "duplicate_of_row": first_row_num,
                        "identity_key": {
                            "first_name": first_name,
                            "last_name": last_name,
                            "jersey_number": None
                        }
                    })
                    continue
                
                # Build detailed error message with context
                age_group = (player.get("age_group") or "").strip()
                jersey_display = f"#{num}" if num is not None else "(no jersey number)"
                age_display = f"({age_group})" if age_group else ""
                
                error_msg = (
                    f"Duplicate: {first_name} {last_name} {jersey_display} {age_display} "
                    f"matches Row {first_row_num}. "
                    f"Players are matched by name + jersey number (age group is ignored). "
                    f"If the same athlete plays in multiple age groups, use a different jersey number or add a suffix to the name. "
                )
                
                # Add contextual tip based on scenario
                if num is None:
                    error_msg += "TIP: Assign unique jersey numbers to differentiate players with the same name."
                elif age_group and first_player.get('age_group') and age_group != first_player.get('age_group'):
                    error_msg += f"TIP: Age groups differ ({first_player.get('age_group')} vs {age_group}) but same name+number still creates a duplicate. Change the jersey number or merge into a single row."
                else:
                    error_msg += "TIP: Remove this duplicate row or assign a different jersey number."
                
                errors.append({
                    "row": idx + 1, 
                    "message": error_msg,
                    "data": player,
                    "duplicate_of_row": first_row_num,
                    "identity_key": {
                        "first_name": first_name,
                        "last_name": last_name,
                        "jersey_number": num
                    }
                })
                continue
            
            # Store first occurrence with player data for context
            seen_keys[key] = (idx + 1, player)

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
            else:
                created_players += 1
                # Also log why it might have failed - check if we tried to fetch it?
                if player_id not in ids_to_fetch and not incoming_ext_id:
                     pass

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
            if idx == 0 and len(incoming_scores) == 0 and len(drill_fields) > 0:
                 # Only warn if we expected scores but found none
                 pass

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
                        
                        # Also set legacy field for football compatibility if it matches
                        if drill_key in ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]:
                            player_data[drill_key] = val_float
                    except (ValueError, TypeError):
                        pass
            
            player_data["scores"] = scores
            
            # DEBUG: Log first player storage data
            if idx == 0:
                logging.info(f"[STORAGE] Row 1 player_data being written:")
                logging.info(f"[STORAGE]   - player_id: {player_id}")
                logging.info(f"[STORAGE]   - name: {player_data.get('name')}")
                logging.info(f"[STORAGE]   - first: {player_data.get('first')}")
                logging.info(f"[STORAGE]   - last: {player_data.get('last')}")
                logging.info(f"[STORAGE]   - number: {player_data.get('number')}")
                logging.info(f"[STORAGE]   - age_group: {player_data.get('age_group')}")
                logging.info(f"[STORAGE]   - scores keys: {list(player_data.get('scores', {}).keys())}")
                logging.info(f"[STORAGE]   - operation: {'UPDATE (merge with existing)' if previous_state else 'CREATE (new player)'}")
            
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
            
        # FINAL SUMMARY LOG
        logging.info(f"[UPLOAD_COMPLETE] ═══════════════════════════════════════")
        logging.info(f"[UPLOAD_COMPLETE] Event: {event_id}")
        logging.info(f"[UPLOAD_COMPLETE] Mode: {req.mode}")
        logging.info(f"[UPLOAD_COMPLETE] Players received: {len(players)}")
        logging.info(f"[UPLOAD_COMPLETE] Created (new): {created_players}")
        logging.info(f"[UPLOAD_COMPLETE] Updated (existing): {updated_players}")
        logging.info(f"[UPLOAD_COMPLETE] Errors/Rejected: {len(errors)}")
        logging.info(f"[UPLOAD_COMPLETE] Total scores written: {scores_written_total}")
        logging.info(f"[UPLOAD_COMPLETE] ═══════════════════════════════════════")
        
        return {
            "added": added, 
            "created_players": created_players,
            "updated_players": updated_players,
            "rejected_count": len(errors),  # NEW: Count of rejected rows for UX clarity
            "rejected_rows": errors,         # NEW: Full error details with row numbers and context
            "errors": errors,                # Keep for backward compatibility
            "undo_log": undo_log,
            "players_received": len(players),
            "players_matched": players_matched,
            "scores_written_total": scores_written_total,
            "scores_written_by_drill": scores_written_by_drill
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logging.error(f"[UPLOAD_ERROR] Exception during player upload: {e}")
        logging.error(f"[UPLOAD_ERROR] Full traceback:\n{error_details}")
        logging.error(f"[UPLOAD_ERROR] Event ID: {req.event_id if hasattr(req, 'event_id') else 'unknown'}")
        logging.error(f"[UPLOAD_ERROR] Number of players in request: {len(req.players) if hasattr(req, 'players') and req.players else 0}")
        # Return more detailed error to help with debugging
        raise HTTPException(status_code=500, detail=f"Failed to upload players: {str(e)}")

