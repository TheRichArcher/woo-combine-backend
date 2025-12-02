from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..auth import get_current_user, require_role
from ..middleware.rate_limiting import write_rate_limit, read_rate_limit
from ..utils.importers import DataImporter
from ..utils.validation import DRILL_SCORE_RANGES, get_unit_for_drill
from ..utils.data_integrity import enforce_event_league_relationship
from ..security.access_matrix import require_permission
import logging

router = APIRouter()

class ImportParseResponse(BaseModel):
    valid_rows: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]
    summary: Dict[str, int]

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
    """
    try:
        # Enforce access
        # Note: require_permission decorator handles permission check, but we ensure event/league relationship
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
                # Try CSV fallback for other extensions? Or fail.
                raise HTTPException(status_code=400, detail="Unsupported file format. Please use CSV or Excel.")
                
        elif text:
            result = DataImporter.parse_text(text)
            
        else:
            raise HTTPException(status_code=400, detail="No file or text provided")
            
        return {
            "valid_rows": result.valid_rows,
            "errors": result.errors,
            "summary": {
                "total_rows": len(result.valid_rows) + len(result.errors),
                "valid_count": len(result.valid_rows),
                "error_count": len(result.errors)
            }
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

