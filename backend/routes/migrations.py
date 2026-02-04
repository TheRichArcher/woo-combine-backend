from fastapi import APIRouter, Depends, HTTPException, Request
from ..auth import require_role
from ..firestore_client import db
import logging

router = APIRouter()

@router.post("/migrations/migrate-scores")
def migrate_legacy_scores_to_map(
    request: Request,
    current_user=Depends(require_role("admin", "organizer"))
):
    """
    One-time migration script to move legacy fixed fields (40m_dash, vertical_jump, etc.)
    into the new dynamic 'scores' map for all players in all events.
    """
    try:
        logging.info("[MIGRATION] Starting score migration...")
        batch = db.batch()
        count = 0
        total_updated = 0
        
        # 1. Get all events
        events_ref = db.collection("events")
        events = list(events_ref.stream())
        
        for event in events:
            event_id = event.id
            logging.info(f"[MIGRATION] Processing event: {event_id}")
            
            # 2. Get players for this event
            players_ref = events_ref.document(event_id).collection("players")
            players = list(players_ref.stream())
            
            for player in players:
                p_data = player.to_dict()
                updates = {}
                scores = p_data.get("scores", {})
                
                # Legacy field mapping
                legacy_map = {
                    "40m_dash": p_data.get("40m_dash"),
                    "vertical_jump": p_data.get("vertical_jump"),
                    "catching": p_data.get("catching"),
                    "throwing": p_data.get("throwing"),
                    "agility": p_data.get("agility")
                }
                
                changed = False
                for key, value in legacy_map.items():
                    if value is not None and value != "":
                        try:
                            # Ensure numeric
                            float_val = float(value)
                            # If not already in scores, or different, update it
                            if key not in scores or scores[key] != float_val:
                                scores[key] = float_val
                                changed = True
                        except ValueError:
                            continue
                
                if changed:
                    updates["scores"] = scores
                    batch.update(player.reference, updates)
                    count += 1
                    total_updated += 1
                
                # Commit batch if full (500 limit, keep it safe at 400)
                if count >= 400:
                    batch.commit()
                    batch = db.batch()
                    count = 0
                    
        # Commit remaining
        if count > 0:
            batch.commit()
            
        logging.info(f"[MIGRATION] Completed. Updated {total_updated} players.")
        return {"status": "success", "updated_count": total_updated}
        
    except Exception as e:
        logging.error(f"[MIGRATION] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {e}")

