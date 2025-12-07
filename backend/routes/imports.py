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
from ..services.schema_registry import SchemaRegistry
from ..utils.event_schema import get_event_schema

router = APIRouter()

class ImportParseResponse(BaseModel):
    valid_rows: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]
    summary: Dict[str, int]
    detected_sport: str = "football"
    confidence: str = "low"
    sheets: List[Dict[str, Any]] = []

@router.post("/events/{event_id}/parse-import")
@write_rate_limit()
@require_permission("events", "update", target="event", target_param="event_id")
def parse_import_file(
    request: Request,
    event_id: str,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    current_user=Depends(require_role("organizer", "coach"))
):
    """
    Parse an uploaded file (CSV/Excel) or pasted text into structured data 
    for review before importing. Does NOT save to database.
    Now includes:
    - Sport detection
    - Smart error correction
    - Duplicate detection
    - Multi-sheet Excel support
    - Image OCR
    - URL Import (Google Sheets)
    """
    try:
        # Enforce access
        enforce_event_league_relationship(event_id=event_id)
        
        result = None
        
        # Fetch disabled drills from event configuration
        disabled_drills = []
        try:
            event_ref = db.collection("events").document(event_id)
            event_doc = execute_with_timeout(lambda: event_ref.get(), timeout=5)
            if event_doc.exists:
                disabled_drills = event_doc.to_dict().get("disabled_drills", [])
        except Exception:
            # Fallback if fetch fails, proceed with full schema
            pass
        
        if file:
            content = file.file.read()
            filename = file.filename.lower()
            
            if filename.endswith('.csv'):
                result = DataImporter.parse_csv(content, event_id=event_id, disabled_drills=disabled_drills)
            elif filename.endswith(('.xls', '.xlsx')):
                result = DataImporter.parse_excel(content, sheet_name=sheet_name, event_id=event_id, disabled_drills=disabled_drills)
            elif filename.endswith(('.jpg', '.jpeg', '.png', '.heic')):
                result = DataImporter.parse_image(content, event_id=event_id, disabled_drills=disabled_drills)
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format. Please use CSV, Excel, or Image.")
                
        elif url:
            from ..utils.sheets import fetch_url_content
            try:
                content = fetch_url_content(url)
                # Assume CSV content from URL
                result = DataImporter.parse_csv(content, event_id=event_id, disabled_drills=disabled_drills)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        
        elif text:
            result = DataImporter.parse_text(text, event_id=event_id, disabled_drills=disabled_drills)
            
        else:
            raise HTTPException(status_code=400, detail="No file, text, or URL provided")
        
        # Handle multi-sheet response (pause parsing)
        if result.sheets:
            return {
                "valid_rows": [],
                "errors": [],
                "summary": {"total_rows": 0, "valid_count": 0, "error_count": 0},
                "detected_sport": "unknown",
                "confidence": "low",
                "sheets": result.sheets
            }
            
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
            
            # Robust parsing for jersey number to match players.py logic
            try:
                raw_num = data.get("jersey_number")
                number = int(float(str(raw_num).strip())) if raw_num not in (None, "") else None
            except:
                number = None
            
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
            "confidence": result.confidence,
            "sheets": []
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
    Fully schema-driven.
    """
    schema_def = SchemaRegistry.get_schema(sport)
    if not schema_def:
        schema_def = SchemaRegistry.get_schema("football")
        
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
    
    # Drill Fields from Schema
    for drill in schema_def.drills:
        schema.append({
            "key": drill.key,
            "label": drill.label,
            "required": False,
            "type": "number",
            "min": drill.min_value,
            "max": drill.max_value,
            "unit": drill.unit
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
        
        # Fetch Schema for Event
        schema = get_event_schema(event_id)
        
        # Define headers
        identity_headers = ["First Name", "Last Name", "Jersey Number", "Age Group"]
        drill_headers = [d.label for d in schema.drills]
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

@router.get("/events/{event_id}/history")
@read_rate_limit()
@require_permission("events", "read", target="event", target_param="event_id")
def get_import_history(
    request: Request,
    event_id: str,
    limit: int = 20,
    current_user=Depends(require_role("organizer", "coach"))
):
    """
    Get import audit history for the event.
    """
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        imports_ref = db.collection("events").document(event_id).collection("imports")
        query = imports_ref.order_by("timestamp", direction=db.Query.DESCENDING).limit(limit)
        
        history = execute_with_timeout(
            lambda: list(query.stream()),
            timeout=5,
            operation_name="fetch import history"
        )
        
        return [dict(doc.to_dict(), id=doc.id) for doc in history]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching import history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch import history")
