"""
Batch Operations Router for WooCombine API

Provides optimized batch endpoints to reduce API call overhead
and improve performance for frontend operations.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Dict, Any
from pydantic import BaseModel
from ..auth import get_current_user
from ..middleware.rate_limiting import bulk_rate_limit
from ..firestore_client import db
from ..utils.database import execute_with_timeout
import logging

router = APIRouter()
MAX_ITEMS_PER_BATCH = 200

class BatchPlayerRequest(BaseModel):
    event_ids: List[str]

class BatchEventRequest(BaseModel):
    league_ids: List[str]

class BatchEventsByIdsRequest(BaseModel):
    event_ids: List[str]

@router.post("/batch/players")
@bulk_rate_limit()
def get_batch_players(
    request: Request,
    payload: BatchPlayerRequest,
    current_user=Depends(get_current_user)
):
    """
    Get players for multiple events in a single request
    Reduces API call overhead for pages that need data from multiple events
    """
    try:
        MAX_ITEMS_PER_BATCH = 200
        if len(payload.event_ids) > MAX_ITEMS_PER_BATCH:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_ITEMS_PER_BATCH} items per batch request"
            )
        
        batch_results = {}
        
        for event_id in payload.event_ids:
            try:
                # Validate event exists
                event = execute_with_timeout(
                    db.collection("events").document(str(event_id)).get,
                    timeout=3,
                    operation_name=f"event validation for {event_id}"
                )
                
                if event.exists:
                    # Get players for this event
                    def get_players_stream():
                        return list(db.collection("events").document(str(event_id)).collection("players").stream())
                    
                    players_stream = execute_with_timeout(
                        get_players_stream,
                        timeout=10,
                        operation_name=f"players fetch for {event_id}"
                    )
                    
                    players = []
                    for player in players_stream:
                        player_dict = player.to_dict()
                        player_dict["id"] = player.id
                        players.append(player_dict)
                    
                    batch_results[event_id] = {
                        "success": True,
                        "players": players,
                        "count": len(players)
                    }
                else:
                    batch_results[event_id] = {
                        "success": False,
                        "error": "Event not found",
                        "players": [],
                        "count": 0
                    }
                    
            except Exception as e:
                logging.error(f"Error fetching players for event {event_id}: {e}")
                batch_results[event_id] = {
                    "success": False,
                    "error": str(e),
                    "players": [],
                    "count": 0
                }
        
        return {
            "success": True,
            "results": batch_results,
            "total_events": len(payload.event_ids),
            "successful_events": sum(1 for r in batch_results.values() if r["success"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in batch players request: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch batch players")

@router.post("/batch/events")
@bulk_rate_limit()
def get_batch_events(
    request: Request,
    payload: BatchEventRequest,
    current_user=Depends(get_current_user)
):
    """
    Get events for multiple leagues in a single request
    Optimizes dashboard loading and multi-league views
    """
    try:
        MAX_ITEMS_PER_BATCH = 200
        if len(payload.league_ids) > MAX_ITEMS_PER_BATCH:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_ITEMS_PER_BATCH} items per batch request"
            )
        
        batch_results = {}
        
        for league_id in payload.league_ids:
            try:
                # Get events for this league
                events_ref = db.collection("leagues").document(str(league_id)).collection("events")
                events_stream = execute_with_timeout(
                    lambda: list(events_ref.stream()),
                    timeout=8,
                    operation_name=f"events fetch for league {league_id}"
                )
                
                events = []
                for event in events_stream:
                    event_dict = event.to_dict()
                    event_dict["id"] = event.id
                    events.append(event_dict)
                
                batch_results[league_id] = {
                    "success": True,
                    "events": events,
                    "count": len(events)
                }
                
            except Exception as e:
                logging.error(f"Error fetching events for league {league_id}: {e}")
                batch_results[league_id] = {
                    "success": False,
                    "error": str(e),
                    "events": [],
                    "count": 0
                }
        
        return {
            "success": True,
            "results": batch_results,
            "total_leagues": len(payload.league_ids),
            "successful_leagues": sum(1 for r in batch_results.values() if r["success"])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in batch events request: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch batch events")

@router.post("/batch/events-by-ids")
@bulk_rate_limit()
def get_batch_events_by_ids(
    request: Request,
    payload: BatchEventsByIdsRequest,
    current_user=Depends(get_current_user)
):
    """
    Get multiple events by their event IDs.
    """
    try:
        MAX_ITEMS_PER_BATCH = 200
        if len(payload.event_ids) > MAX_ITEMS_PER_BATCH:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_ITEMS_PER_BATCH} items per batch request"
            )

        results: Dict[str, Any] = {}
        for event_id in payload.event_ids:
            try:
                ref = db.collection("events").document(event_id)
                doc = execute_with_timeout(
                    ref.get,
                    timeout=5,
                    operation_name=f"event fetch {event_id}"
                )
                if doc.exists:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    results[event_id] = {"success": True, "event": data}
                else:
                    results[event_id] = {"success": False, "error": "Not found"}
            except Exception as ex:
                logging.error(f"Error fetching event {event_id}: {ex}")
                results[event_id] = {"success": False, "error": str(ex)}

        return {"success": True, "results": results, "total_events": len(payload.event_ids)}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in events-by-ids batch request: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch events by ids")

@router.get("/batch/dashboard-data/{league_id}")
@bulk_rate_limit()
def get_dashboard_data(
    request: Request,
    league_id: str,
    current_user=Depends(get_current_user)
):
    """
    Get all dashboard data in a single optimized request
    Includes league info, events, and player counts
    """
    try:
        dashboard_data = {
            "league": None,
            "events": [],
            "player_stats": {},
            "recent_activity": []
        }
        
        # Get league info
        league_doc = execute_with_timeout(
            db.collection("leagues").document(str(league_id)).get,
            timeout=5,
            operation_name="league info fetch"
        )
        
        if league_doc.exists:
            dashboard_data["league"] = {
                **league_doc.to_dict(),
                "id": league_doc.id
            }
        else:
            raise HTTPException(status_code=404, detail="League not found")
        
        # Get events for this league
        events_ref = db.collection("leagues").document(str(league_id)).collection("events")
        events_stream = execute_with_timeout(
            lambda: list(events_ref.stream()),
            timeout=8,
            operation_name="dashboard events fetch"
        )
        
        events = []
        for event in events_stream:
            event_dict = event.to_dict()
            event_dict["id"] = event.id
            
            # Get player count for each event
            try:
                players_count = execute_with_timeout(
                    lambda: len(list(db.collection("events").document(event.id).collection("players").stream())),
                    timeout=3,
                    operation_name=f"player count for event {event.id}"
                )
                event_dict["player_count"] = players_count
            except:
                event_dict["player_count"] = 0
            
            events.append(event_dict)
            
        dashboard_data["events"] = events
        
        # Calculate aggregate stats
        total_players = sum(event.get("player_count", 0) for event in events)
        dashboard_data["player_stats"] = {
            "total_events": len(events),
            "total_players": total_players,
            "avg_players_per_event": round(total_players / len(events), 1) if events else 0
        }
        
        return dashboard_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching dashboard data for league {league_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard data")