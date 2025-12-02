from fastapi import APIRouter, Depends, HTTPException, Request, Path
from fastapi.responses import StreamingResponse
from ..auth import require_role
from ..middleware.rate_limiting import read_rate_limit
from ..utils.data_integrity import enforce_event_league_relationship
from ..utils.stats import calculate_event_stats
from ..utils.pdf_generator import generate_event_pdf
from ..firestore_client import db
import logging

router = APIRouter()

@router.get("/events/{event_id}/stats")
@read_rate_limit()
def get_event_stats_endpoint(
    request: Request,
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(require_role("organizer", "coach"))
):
    """
    Get standardized stats for an event.
    """
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        stats = calculate_event_stats(event_id)
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Stats error for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate stats")

@router.get("/events/{event_id}/export-pdf")
@read_rate_limit()
def export_event_pdf(
    request: Request,
    event_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(require_role("organizer", "coach"))
):
    """
    Generate and download PDF report.
    """
    try:
        enforce_event_league_relationship(event_id=event_id)
        
        # Fetch event data
        event_ref = db.collection("events").document(event_id)
        event_doc = event_ref.get()
        if not event_doc.exists:
            raise HTTPException(status_code=404, detail="Event not found")
        event_data = event_doc.to_dict()
        
        # Fetch stats
        stats = calculate_event_stats(event_id)
        
        # Fetch players for full table
        players_ref = db.collection("events").document(event_id).collection("players")
        players = [p.to_dict() for p in players_ref.stream()]
        
        pdf_buffer = generate_event_pdf(event_data, stats, players)
        
        filename = f"WooCombine_Results_{event_data.get('name', event_id).replace(' ', '_')}.pdf"
        
        return StreamingResponse(
            iter([pdf_buffer.getvalue()]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"PDF export error for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate PDF")

