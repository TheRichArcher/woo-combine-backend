from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import csv
import io
import logging

from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import write_rate_limit, read_rate_limit
from ..utils.importers import DataImporter
from ..utils.validation import DRILL_SCORE_RANGES
from ..utils.data_integrity import enforce_event_league_relationship
from ..utils.database import execute_with_timeout
from ..utils.identity import generate_player_id
from ..firestore_client import db
from ..security.access_matrix import require_permission

router = APIRouter()

class ImportParseResponse(BaseModel):
    valid_rows: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]
    summary: Dict[str, int]
    detected_sport: str = "football"
    confidence: str = "low"

@router.post("/events/{event_id}/parse-import")
@write_rate_limit()
@require_permission("events", "update", target="event", target_param="event_id")
def parse_import_file(
    request: Request,
    event_id: str,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    current_user=Depends(require_role("organizer", "coach"))
):
    """
    Parse an uploaded file (CSV/Excel) or pasted text into structured data 
    for review before importing. Does NOT save to database.
    Now includes:
    - Sport detection
    - Smart error correction
    - Duplicate detection
    """
    try:
        # Enforce access
        enforce_event_league_relationship(event_id=event_id)
        
        result = None
        
        if file:
            content = file.file.read()
            filename = file.filename.lower()
            
            if filename.endswith('.csv'):
                result = DataImporter.parse_csv(content)
            elif filename.endswith(('.xls', '.xlsx')):
                result = DataImporter.parse_excel(content)
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format. Please use CSV or Excel.")
                
        elif text:
            result = DataImporter.parse_text(text)
            
        else:
            raise HTTPException(status_code=400, detail="No file or text provided")
            
        # --- DUPLICATE DETECTION ---
        # Fetch existing players to check for conflicts
        # This is efficient for typical event sizes (< 500 players)
        players_ref = db.collection("events").document(event_id).collection("players")
        existing_players = execute_with_timeout(
            lambda: list(players_ref.stream()),
            timeout=10,
            operation_name="fetch players for duplicate check"
        )
        
        # Create a set of existing IDs for fast lookup
        existing_ids = {p.id for p in existing_players}
        
        # Check each valid row
        for row in result.valid_rows:
            data = row["data"]
            first = data.get("first_name", "")
            last = data.get("last_name", "")
            number = data.get("jersey_number")
            
            # Generate ID deterministically
            pid = generate_player_id(event_id, first, last, number)
            
            if pid in existing_ids:
                row["is_duplicate"] = True
                row["existing_player_id"] = pid
                # We could also fetch the existing data to show diffs, 
                # but that might be too much data for this response.
            else:
                row["is_duplicate"] = False
                row["existing_player_id"] = None

        return {
            "valid_rows": result.valid_rows,
            "errors": result.errors,
            "summary": {
                "total_rows": len(result.valid_rows) + len(result.errors),
                "valid_count": len(result.valid_rows),
                "error_count": len(result.errors)
            },
            "detected_sport": result.detected_sport,
            "confidence": result.confidence
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Import parse error for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse import data: {str(e)}")

@router.get("/meta/schema")
@read_rate_limit()
def get_import_schema(
    request: Request,
    sport: Optional[str] = "football"
):
    """
    Return the schema definition for import mapping.
    Currently supports 'football' (default).
    """
    # In Phase 2, we will switch on 'sport' to return different schemas.
    # For Phase 1, we return the global drill ranges.
    
    schema = []
    
    # Player Identity Fields
    schema.append({
        "key": "first_name",
        "label": "First Name",
        "required": True,
        "type": "string",
        "aliases": ["first", "fname", "firstname"]
    })
    schema.append({
        "key": "last_name",
        "label": "Last Name",
        "required": True,
        "type": "string",
        "aliases": ["last", "lname", "lastname"]
    })
    schema.append({
        "key": "jersey_number",
        "label": "Jersey Number",
        "required": False,
        "type": "number",
        "aliases": ["jersey", "number", "no", "#"]
    })
    schema.append({
        "key": "age_group",
        "label": "Age Group",
        "required": False,
        "type": "string",
        "aliases": ["age", "group", "division"]
    })
    
    # Drill Fields
    for key, ranges in DRILL_SCORE_RANGES.items():
        schema.append({
            "key": key,
            "label": key.replace("_", " ").title(), # Simple label generation
            "required": False,
            "type": "number",
            "min": ranges["min"],
            "max": ranges["max"],
            "unit": ranges["unit"]
        })
        
    return {"sport": sport, "fields": schema}

@router.get("/events/{event_id}/import-template")
@read_rate_limit()
@require_permission("events", "read", target="event", target_param="event_id")
def get_import_template(
    request: Request,
    event_id: str,
    format: str = "csv", # csv or excel (future)
    current_user=Depends(require_role("organizer", "coach"))
):
    """
    Download a pre-filled template with existing players (if any)
    and correct columns for the event.
    """
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        # Define headers
        identity_headers = ["First Name", "Last Name", "Jersey Number", "Age Group"]
        drill_headers = [k.replace("_", " ").title() for k in DRILL_SCORE_RANGES.keys()]
        all_headers = identity_headers + drill_headers
        
        # Fetch existing players
        players_ref = db.collection("events").document(event_id).collection("players")
        players = execute_with_timeout(
            lambda: list(players_ref.stream()),
            timeout=10,
            operation_name="fetch players for template"
        )
        
        # Sort players (by name? number?)
        players_list = [p.to_dict() for p in players]
        players_list.sort(key=lambda x: (x.get('last', ''), x.get('first', '')))
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(all_headers)
        
        for p in players_list:
            row = [
                p.get('first', ''),
                p.get('last', ''),
                p.get('number', ''),
                p.get('age_group', '')
            ]
            # Empty drill columns
            row.extend(['' for _ in drill_headers])
            writer.writerow(row)
            
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=event_{event_id}_template.csv"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Template generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate template")
