"""
Draft API Routes
Handles draft creation, management, picks, and real-time state.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from ..auth import get_current_user
from ..firestore_client import get_firestore_client
from google.cloud.firestore_v1 import FieldFilter
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/drafts", tags=["drafts"])

# ============================================================================
# Pydantic Models
# ============================================================================

class DraftCreate(BaseModel):
    name: str
    event_id: str
    age_group: Optional[str] = None  # U8, U10, U12, etc. None = all
    draft_type: str = "snake"  # snake | linear
    num_rounds: Optional[int] = None  # Auto-calculate if not provided
    pick_timer_seconds: int = 60  # 0 = no timer
    auto_pick_on_timeout: bool = True
    trades_enabled: bool = False
    trade_window: str = "during_draft"  # during_draft | post_draft | both
    trades_require_approval: bool = True
    visibility: str = "coaches"  # coaches | public

class DraftUpdate(BaseModel):
    name: Optional[str] = None
    draft_type: Optional[str] = None
    num_rounds: Optional[int] = None
    pick_timer_seconds: Optional[int] = None
    auto_pick_on_timeout: Optional[bool] = None
    trades_enabled: Optional[bool] = None
    trade_window: Optional[str] = None
    trades_require_approval: Optional[bool] = None
    visibility: Optional[str] = None

class TeamCreate(BaseModel):
    team_name: str
    coach_user_id: Optional[str] = None
    coach_name: Optional[str] = None

class TeamUpdate(BaseModel):
    team_name: Optional[str] = None
    coach_user_id: Optional[str] = None
    coach_name: Optional[str] = None

class PickCreate(BaseModel):
    player_id: str

class RankingsUpdate(BaseModel):
    ranked_player_ids: List[str]

class PreSlotCreate(BaseModel):
    player_id: str
    team_id: str
    reason: Optional[str] = None  # e.g., "Coach's child"

# ============================================================================
# Helper Functions
# ============================================================================

def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def calculate_snake_order(team_order: List[str], round_num: int) -> List[str]:
    """Returns team order for a given round in snake draft."""
    if round_num % 2 == 1:
        return team_order
    else:
        return list(reversed(team_order))

def get_pick_team(draft: dict, overall_pick: int) -> str:
    """Determine which team picks at a given overall pick number."""
    num_teams = len(draft.get("team_order", []))
    if num_teams == 0:
        return None
    
    round_num = ((overall_pick - 1) // num_teams) + 1
    pick_in_round = ((overall_pick - 1) % num_teams)
    
    if draft.get("draft_type") == "snake":
        order = calculate_snake_order(draft["team_order"], round_num)
    else:
        order = draft["team_order"]
    
    return order[pick_in_round]

# ============================================================================
# Draft CRUD
# ============================================================================

@router.post("")
async def create_draft(draft_in: DraftCreate, user: dict = Depends(get_current_user)):
    """Create a new draft for an event."""
    db = get_firestore_client()
    
    # Verify event exists and user has access
    event_ref = db.collection("events").document(draft_in.event_id)
    event_doc = event_ref.get()
    if not event_doc.exists:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event_data = event_doc.to_dict()
    league_id = event_data.get("league_id")
    
    # Check user is admin/organizer of the league
    # (Simplified - in production, check league membership)
    
    draft_id = generate_id("draft_")
    draft_data = {
        "id": draft_id,
        "event_id": draft_in.event_id,
        "league_id": league_id,
        "name": draft_in.name,
        "age_group": draft_in.age_group,
        "status": "setup",
        "draft_type": draft_in.draft_type,
        "num_teams": 0,
        "num_rounds": draft_in.num_rounds,
        "pick_timer_seconds": draft_in.pick_timer_seconds,
        "auto_pick_on_timeout": draft_in.auto_pick_on_timeout,
        "trades_enabled": draft_in.trades_enabled,
        "trade_window": draft_in.trade_window,
        "trades_require_approval": draft_in.trades_require_approval,
        "visibility": draft_in.visibility,
        "team_order": [],
        "current_round": 0,
        "current_pick": 0,
        "current_team_id": None,
        "pick_deadline": None,
        "created_at": now_iso(),
        "started_at": None,
        "completed_at": None,
        "created_by": user["uid"]
    }
    
    db.collection("drafts").document(draft_id).set(draft_data)
    logger.info(f"Draft created: {draft_id} for event {draft_in.event_id}")
    
    return draft_data

@router.get("/{draft_id}")
async def get_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Get draft details."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return draft_doc.to_dict()

@router.patch("/{draft_id}")
async def update_draft(draft_id: str, draft_in: DraftUpdate, user: dict = Depends(get_current_user)):
    """Update draft settings. Only allowed in 'setup' status."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "setup":
        raise HTTPException(status_code=400, detail="Cannot modify draft after it has started")
    
    updates = {k: v for k, v in draft_in.dict().items() if v is not None}
    updates["updated_at"] = now_iso()
    
    draft_ref.update(updates)
    
    return {**draft_data, **updates}

@router.delete("/{draft_id}")
async def delete_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Delete a draft. Only allowed in 'setup' status."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "setup":
        raise HTTPException(status_code=400, detail="Cannot delete draft after it has started")
    
    # Delete associated teams and picks
    teams = db.collection("draft_teams").where(filter=FieldFilter("draft_id", "==", draft_id)).stream()
    for team in teams:
        team.reference.delete()
    
    draft_ref.delete()
    
    return {"status": "deleted", "draft_id": draft_id}

@router.get("")
async def list_drafts(
    event_id: Optional[str] = Query(None),
    league_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """List drafts, optionally filtered by event or league."""
    db = get_firestore_client()
    
    query = db.collection("drafts")
    
    if event_id:
        query = query.where(filter=FieldFilter("event_id", "==", event_id))
    elif league_id:
        query = query.where(filter=FieldFilter("league_id", "==", league_id))
    
    drafts = []
    for doc in query.stream():
        drafts.append(doc.to_dict())
    
    return drafts

# ============================================================================
# Draft Control
# ============================================================================

@router.post("/{draft_id}/start")
async def start_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Start the draft. Requires at least 2 teams."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "setup":
        raise HTTPException(status_code=400, detail="Draft already started or completed")
    
    # Get teams
    teams_query = db.collection("draft_teams").where(filter=FieldFilter("draft_id", "==", draft_id)).stream()
    teams = [t.to_dict() for t in teams_query]
    
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 teams to start draft")
    
    # Sort by pick_order
    teams.sort(key=lambda t: t.get("pick_order", 999))
    team_order = [t["id"] for t in teams]
    
    # Calculate rounds if not set
    num_rounds = draft_data.get("num_rounds")
    if not num_rounds:
        # Get player count for age group
        players_query = db.collection("players").where(filter=FieldFilter("event_id", "==", draft_data["event_id"]))
        if draft_data.get("age_group"):
            players_query = players_query.where(filter=FieldFilter("age_group", "==", draft_data["age_group"]))
        player_count = len(list(players_query.stream()))
        num_rounds = max(1, player_count // len(teams))
    
    # Set pick deadline if timer enabled
    pick_deadline = None
    if draft_data.get("pick_timer_seconds", 0) > 0:
        pick_deadline = (datetime.now(timezone.utc) + timedelta(seconds=draft_data["pick_timer_seconds"])).isoformat()
    
    updates = {
        "status": "active",
        "team_order": team_order,
        "num_teams": len(teams),
        "num_rounds": num_rounds,
        "current_round": 1,
        "current_pick": 1,
        "current_team_id": team_order[0],
        "pick_deadline": pick_deadline,
        "started_at": now_iso()
    }
    
    draft_ref.update(updates)
    
    logger.info(f"Draft started: {draft_id} with {len(teams)} teams, {num_rounds} rounds")
    
    return {**draft_data, **updates}

@router.post("/{draft_id}/pause")
async def pause_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Pause an active draft."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")
    
    draft_ref.update({
        "status": "paused",
        "pick_deadline": None  # Clear timer while paused
    })
    
    return {"status": "paused", "draft_id": draft_id}

@router.post("/{draft_id}/resume")
async def resume_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Resume a paused draft."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "paused":
        raise HTTPException(status_code=400, detail="Draft is not paused")
    
    # Reset timer if enabled
    pick_deadline = None
    if draft_data.get("pick_timer_seconds", 0) > 0:
        pick_deadline = (datetime.now(timezone.utc) + timedelta(seconds=draft_data["pick_timer_seconds"])).isoformat()
    
    draft_ref.update({
        "status": "active",
        "pick_deadline": pick_deadline
    })
    
    return {"status": "active", "draft_id": draft_id}

# ============================================================================
# Teams
# ============================================================================

@router.post("/{draft_id}/teams")
async def add_team(draft_id: str, team_in: TeamCreate, user: dict = Depends(get_current_user)):
    """Add a team to the draft."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "setup":
        raise HTTPException(status_code=400, detail="Cannot add teams after draft has started")
    
    # Get current team count for pick order
    teams_query = db.collection("draft_teams").where(filter=FieldFilter("draft_id", "==", draft_id)).stream()
    current_count = len(list(teams_query))
    
    team_id = generate_id("dteam_")
    team_data = {
        "id": team_id,
        "draft_id": draft_id,
        "team_name": team_in.team_name,
        "coach_user_id": team_in.coach_user_id,
        "coach_name": team_in.coach_name,
        "pick_order": current_count + 1,
        "pre_slotted_player_ids": [],
        "created_at": now_iso()
    }
    
    db.collection("draft_teams").document(team_id).set(team_data)
    
    # Update draft team count
    draft_ref.update({"num_teams": current_count + 1})
    
    return team_data

@router.get("/{draft_id}/teams")
async def list_teams(draft_id: str, user: dict = Depends(get_current_user)):
    """List all teams in a draft."""
    db = get_firestore_client()
    
    teams_query = db.collection("draft_teams").where(filter=FieldFilter("draft_id", "==", draft_id)).stream()
    teams = [t.to_dict() for t in teams_query]
    teams.sort(key=lambda t: t.get("pick_order", 999))
    
    return teams

@router.patch("/{draft_id}/teams/{team_id}")
async def update_team(draft_id: str, team_id: str, team_in: TeamUpdate, user: dict = Depends(get_current_user)):
    """Update a team."""
    db = get_firestore_client()
    
    team_ref = db.collection("draft_teams").document(team_id)
    team_doc = team_ref.get()
    
    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")
    
    updates = {k: v for k, v in team_in.dict().items() if v is not None}
    updates["updated_at"] = now_iso()
    
    team_ref.update(updates)
    
    return {**team_doc.to_dict(), **updates}

@router.delete("/{draft_id}/teams/{team_id}")
async def remove_team(draft_id: str, team_id: str, user: dict = Depends(get_current_user)):
    """Remove a team from the draft."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft_doc.to_dict().get("status") != "setup":
        raise HTTPException(status_code=400, detail="Cannot remove teams after draft has started")
    
    team_ref = db.collection("draft_teams").document(team_id)
    if not team_ref.get().exists:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team_ref.delete()
    
    # Update team count
    teams_query = db.collection("draft_teams").where(filter=FieldFilter("draft_id", "==", draft_id)).stream()
    new_count = len(list(teams_query))
    draft_ref.update({"num_teams": new_count})
    
    return {"status": "deleted", "team_id": team_id}

@router.post("/{draft_id}/teams/reorder")
async def reorder_teams(draft_id: str, team_ids: List[str], user: dict = Depends(get_current_user)):
    """Reorder teams for the draft."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft_doc.to_dict().get("status") != "setup":
        raise HTTPException(status_code=400, detail="Cannot reorder teams after draft has started")
    
    # Update pick_order for each team
    for i, team_id in enumerate(team_ids):
        db.collection("draft_teams").document(team_id).update({"pick_order": i + 1})
    
    return {"status": "reordered", "order": team_ids}

# ============================================================================
# Picks
# ============================================================================

@router.post("/{draft_id}/picks")
async def make_pick(draft_id: str, pick_in: PickCreate, user: dict = Depends(get_current_user)):
    """Make a draft pick."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")
    
    current_team_id = draft_data.get("current_team_id")
    
    # Verify it's user's turn (or user is admin)
    team_doc = db.collection("draft_teams").document(current_team_id).get()
    if not team_doc.exists:
        raise HTTPException(status_code=500, detail="Current team not found")
    
    team_data = team_doc.to_dict()
    is_admin = draft_data.get("created_by") == user["uid"]
    is_coach = team_data.get("coach_user_id") == user["uid"]
    
    if not is_admin and not is_coach:
        raise HTTPException(status_code=403, detail="Not your turn to pick")
    
    # Check player isn't already drafted
    existing_pick = db.collection("draft_picks").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).where(
        filter=FieldFilter("player_id", "==", pick_in.player_id)
    ).limit(1).stream()
    
    if len(list(existing_pick)) > 0:
        raise HTTPException(status_code=400, detail="Player already drafted")
    
    # Calculate overall pick number
    current_round = draft_data.get("current_round", 1)
    num_teams = draft_data.get("num_teams", 1)
    pick_in_round = draft_data.get("current_pick", 1) - ((current_round - 1) * num_teams)
    overall_pick = draft_data.get("current_pick", 1)
    
    # Record the pick
    pick_id = generate_id("pick_")
    pick_data = {
        "id": pick_id,
        "draft_id": draft_id,
        "round": current_round,
        "pick_number": overall_pick,
        "pick_in_round": pick_in_round,
        "team_id": current_team_id,
        "player_id": pick_in.player_id,
        "picked_by": user["uid"],
        "pick_type": "manual",
        "created_at": now_iso()
    }
    
    db.collection("draft_picks").document(pick_id).set(pick_data)
    
    # Advance draft state
    next_pick = overall_pick + 1
    total_picks = draft_data.get("num_rounds", 1) * num_teams
    
    if next_pick > total_picks:
        # Draft complete
        draft_ref.update({
            "status": "completed",
            "completed_at": now_iso(),
            "current_pick": overall_pick,
            "pick_deadline": None
        })
        
        # Create team rosters
        await _create_team_rosters(db, draft_id, draft_data)
        
        logger.info(f"Draft completed: {draft_id}")
    else:
        # Advance to next pick
        next_round = ((next_pick - 1) // num_teams) + 1
        next_team_id = get_pick_team(draft_data, next_pick)
        
        pick_deadline = None
        if draft_data.get("pick_timer_seconds", 0) > 0:
            pick_deadline = (datetime.now(timezone.utc) + timedelta(seconds=draft_data["pick_timer_seconds"])).isoformat()
        
        draft_ref.update({
            "current_round": next_round,
            "current_pick": next_pick,
            "current_team_id": next_team_id,
            "pick_deadline": pick_deadline
        })
    
    logger.info(f"Pick made: {pick_id} - Player {pick_in.player_id} to team {current_team_id}")
    
    return pick_data

@router.get("/{draft_id}/picks")
async def list_picks(draft_id: str, user: dict = Depends(get_current_user)):
    """Get all picks for a draft."""
    db = get_firestore_client()
    
    picks_query = db.collection("draft_picks").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).order_by("pick_number").stream()
    
    picks = [p.to_dict() for p in picks_query]
    return picks

@router.post("/{draft_id}/picks/auto")
async def auto_pick(draft_id: str, user: dict = Depends(get_current_user)):
    """
    Trigger auto-pick for the current team if timer has expired.
    Uses coach's rankings if available, otherwise uses composite score.
    Can be called by anyone (timer validation happens server-side).
    """
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    if draft_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Draft is not active")
    
    if not draft_data.get("auto_pick_on_timeout"):
        raise HTTPException(status_code=400, detail="Auto-pick is disabled for this draft")
    
    # Check if timer has actually expired
    pick_deadline = draft_data.get("pick_deadline")
    if pick_deadline:
        deadline_dt = datetime.fromisoformat(pick_deadline.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) < deadline_dt:
            raise HTTPException(status_code=400, detail="Timer has not expired yet")
    
    current_team_id = draft_data.get("current_team_id")
    
    # Get coach's rankings for this team
    team_doc = db.collection("draft_teams").document(current_team_id).get()
    if not team_doc.exists:
        raise HTTPException(status_code=500, detail="Current team not found")
    
    team_data = team_doc.to_dict()
    coach_user_id = team_data.get("coach_user_id")
    
    # Try to get coach rankings
    ranked_player_ids = []
    if coach_user_id:
        ranking_query = db.collection("coach_rankings").where(
            filter=FieldFilter("draft_id", "==", draft_id)
        ).where(
            filter=FieldFilter("coach_user_id", "==", coach_user_id)
        ).limit(1).stream()
        
        rankings = list(ranking_query)
        if rankings:
            ranked_player_ids = rankings[0].to_dict().get("ranked_player_ids", [])
    
    # Get available players
    event_id = draft_data.get("event_id")
    age_group = draft_data.get("age_group")
    
    players_query = db.collection("players").where(filter=FieldFilter("event_id", "==", event_id))
    if age_group:
        players_query = players_query.where(filter=FieldFilter("age_group", "==", age_group))
    
    all_players = {p.id: p.to_dict() for p in players_query.stream()}
    
    # Get already drafted players
    picks_query = db.collection("draft_picks").where(filter=FieldFilter("draft_id", "==", draft_id)).stream()
    drafted_ids = {p.to_dict().get("player_id") for p in picks_query}
    
    # Filter to available players
    available_ids = [pid for pid in all_players.keys() if pid not in drafted_ids]
    
    if not available_ids:
        raise HTTPException(status_code=400, detail="No players available")
    
    # Select best available player
    selected_player_id = None
    
    # First, try coach rankings
    for pid in ranked_player_ids:
        if pid in available_ids:
            selected_player_id = pid
            break
    
    # Fallback to highest composite score
    if not selected_player_id:
        available_players = [(pid, all_players[pid]) for pid in available_ids]
        available_players.sort(
            key=lambda x: x[1].get("composite_score") or x[1].get("scores", {}).get("composite", 0) or 0,
            reverse=True
        )
        selected_player_id = available_players[0][0]
    
    # Record the pick
    current_round = draft_data.get("current_round", 1)
    overall_pick = draft_data.get("current_pick", 1)
    num_teams = draft_data.get("num_teams", 1)
    
    pick_id = generate_id("pick_")
    pick_data = {
        "id": pick_id,
        "draft_id": draft_id,
        "round": current_round,
        "pick_number": overall_pick,
        "team_id": current_team_id,
        "player_id": selected_player_id,
        "picked_by": "system",
        "pick_type": "auto",
        "created_at": now_iso()
    }
    
    db.collection("draft_picks").document(pick_id).set(pick_data)
    
    # Advance draft state
    next_pick = overall_pick + 1
    total_picks = draft_data.get("num_rounds", 1) * num_teams
    
    if next_pick > total_picks:
        # Draft complete
        draft_ref.update({
            "status": "completed",
            "completed_at": now_iso(),
            "current_pick": overall_pick,
            "pick_deadline": None
        })
        await _create_team_rosters(db, draft_id, draft_data)
        logger.info(f"Draft completed via auto-pick: {draft_id}")
    else:
        # Advance to next pick
        next_round = ((next_pick - 1) // num_teams) + 1
        next_team_id = get_pick_team(draft_data, next_pick)
        
        pick_deadline = None
        if draft_data.get("pick_timer_seconds", 0) > 0:
            pick_deadline = (datetime.now(timezone.utc) + timedelta(seconds=draft_data["pick_timer_seconds"])).isoformat()
        
        draft_ref.update({
            "current_round": next_round,
            "current_pick": next_pick,
            "current_team_id": next_team_id,
            "pick_deadline": pick_deadline
        })
    
    logger.info(f"Auto-pick made: {pick_id} - Player {selected_player_id} to team {current_team_id}")
    
    return {
        **pick_data,
        "player_name": all_players.get(selected_player_id, {}).get("name", "Unknown")
    }

@router.post("/{draft_id}/picks/undo")
async def undo_last_pick(draft_id: str, user: dict = Depends(get_current_user)):
    """Undo the last pick. Admin only."""
    db = get_firestore_client()
    
    draft_ref = db.collection("drafts").document(draft_id)
    draft_doc = draft_ref.get()
    
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    
    # Admin only
    if draft_data.get("created_by") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only draft admin can undo picks")
    
    if draft_data.get("status") not in ["active", "paused"]:
        raise HTTPException(status_code=400, detail="Cannot undo picks in current draft state")
    
    # Get last pick
    picks_query = db.collection("draft_picks").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).order_by("pick_number", direction="DESCENDING").limit(1).stream()
    
    picks = list(picks_query)
    if len(picks) == 0:
        raise HTTPException(status_code=400, detail="No picks to undo")
    
    last_pick = picks[0]
    last_pick_data = last_pick.to_dict()
    
    # Delete the pick
    last_pick.reference.delete()
    
    # Revert draft state
    num_teams = draft_data.get("num_teams", 1)
    reverted_pick = last_pick_data.get("pick_number")
    reverted_round = ((reverted_pick - 1) // num_teams) + 1
    reverted_team_id = last_pick_data.get("team_id")
    
    draft_ref.update({
        "current_round": reverted_round,
        "current_pick": reverted_pick,
        "current_team_id": reverted_team_id,
        "status": "active" if draft_data.get("status") == "completed" else draft_data.get("status")
    })
    
    logger.info(f"Pick undone: {last_pick_data.get('id')} from draft {draft_id}")
    
    return {"status": "undone", "pick_id": last_pick_data.get("id")}

# ============================================================================
# Rankings
# ============================================================================

@router.get("/{draft_id}/rankings")
async def get_my_rankings(draft_id: str, user: dict = Depends(get_current_user)):
    """Get the current user's player rankings for this draft."""
    db = get_firestore_client()
    
    ranking_query = db.collection("coach_rankings").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).where(
        filter=FieldFilter("coach_user_id", "==", user["uid"])
    ).limit(1).stream()
    
    rankings = list(ranking_query)
    if len(rankings) == 0:
        return {"draft_id": draft_id, "ranked_player_ids": []}
    
    return rankings[0].to_dict()

@router.put("/{draft_id}/rankings")
async def save_rankings(draft_id: str, rankings_in: RankingsUpdate, user: dict = Depends(get_current_user)):
    """Save the current user's player rankings."""
    db = get_firestore_client()
    
    # Check if ranking exists
    ranking_query = db.collection("coach_rankings").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).where(
        filter=FieldFilter("coach_user_id", "==", user["uid"])
    ).limit(1).stream()
    
    rankings = list(ranking_query)
    
    ranking_data = {
        "draft_id": draft_id,
        "coach_user_id": user["uid"],
        "ranked_player_ids": rankings_in.ranked_player_ids,
        "updated_at": now_iso()
    }
    
    if len(rankings) > 0:
        rankings[0].reference.update(ranking_data)
        ranking_data["id"] = rankings[0].id
    else:
        ranking_id = generate_id("ranking_")
        ranking_data["id"] = ranking_id
        ranking_data["created_at"] = now_iso()
        db.collection("coach_rankings").document(ranking_id).set(ranking_data)
    
    return ranking_data

# ============================================================================
# Players (Draft Context)
# ============================================================================

@router.get("/{draft_id}/players")
async def get_available_players(draft_id: str, user: dict = Depends(get_current_user)):
    """Get available (undrafted) players for this draft."""
    db = get_firestore_client()
    
    draft_doc = db.collection("drafts").document(draft_id).get()
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft_data = draft_doc.to_dict()
    event_id = draft_data.get("event_id")
    age_group = draft_data.get("age_group")
    
    # Get all players for event
    players_query = db.collection("players").where(filter=FieldFilter("event_id", "==", event_id))
    if age_group:
        players_query = players_query.where(filter=FieldFilter("age_group", "==", age_group))
    
    all_players = {p.id: p.to_dict() for p in players_query.stream()}
    
    # Get drafted player IDs
    picks_query = db.collection("draft_picks").where(filter=FieldFilter("draft_id", "==", draft_id)).stream()
    drafted_ids = {p.to_dict().get("player_id") for p in picks_query}
    
    # Filter to available players
    available = [p for pid, p in all_players.items() if pid not in drafted_ids and p.get("id") not in drafted_ids]
    
    return available

@router.get("/{draft_id}/players/drafted")
async def get_drafted_players(draft_id: str, user: dict = Depends(get_current_user)):
    """Get all drafted players with their team assignments."""
    db = get_firestore_client()
    
    picks_query = db.collection("draft_picks").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).order_by("pick_number").stream()
    
    picks = [p.to_dict() for p in picks_query]
    
    # Enrich with player data
    player_ids = [p.get("player_id") for p in picks]
    players = {}
    for pid in player_ids:
        player_doc = db.collection("players").document(pid).get()
        if player_doc.exists:
            players[pid] = player_doc.to_dict()
    
    for pick in picks:
        pick["player"] = players.get(pick.get("player_id"), {})
    
    return picks

# ============================================================================
# Pre-Slotted Players
# ============================================================================

@router.post("/{draft_id}/pre-slots")
async def add_pre_slot(draft_id: str, slot_in: PreSlotCreate, user: dict = Depends(get_current_user)):
    """Pre-assign a player to a team (e.g., coach's child)."""
    db = get_firestore_client()
    
    draft_doc = db.collection("drafts").document(draft_id).get()
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft_doc.to_dict().get("status") != "setup":
        raise HTTPException(status_code=400, detail="Cannot add pre-slots after draft has started")
    
    team_ref = db.collection("draft_teams").document(slot_in.team_id)
    team_doc = team_ref.get()
    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team_data = team_doc.to_dict()
    pre_slotted = team_data.get("pre_slotted_player_ids", [])
    
    if slot_in.player_id not in pre_slotted:
        pre_slotted.append(slot_in.player_id)
        team_ref.update({"pre_slotted_player_ids": pre_slotted})
    
    return {"status": "added", "team_id": slot_in.team_id, "player_id": slot_in.player_id}

@router.delete("/{draft_id}/pre-slots/{team_id}/{player_id}")
async def remove_pre_slot(draft_id: str, team_id: str, player_id: str, user: dict = Depends(get_current_user)):
    """Remove a pre-slotted player."""
    db = get_firestore_client()
    
    draft_doc = db.collection("drafts").document(draft_id).get()
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft_doc.to_dict().get("status") != "setup":
        raise HTTPException(status_code=400, detail="Cannot modify pre-slots after draft has started")
    
    team_ref = db.collection("draft_teams").document(team_id)
    team_doc = team_ref.get()
    if not team_doc.exists:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team_data = team_doc.to_dict()
    pre_slotted = team_data.get("pre_slotted_player_ids", [])
    
    if player_id in pre_slotted:
        pre_slotted.remove(player_id)
        team_ref.update({"pre_slotted_player_ids": pre_slotted})
    
    return {"status": "removed", "team_id": team_id, "player_id": player_id}

# ============================================================================
# Helper: Create Team Rosters on Draft Completion
# ============================================================================

async def _create_team_rosters(db, draft_id: str, draft_data: dict):
    """Create team roster records when draft completes."""
    
    # Get all picks grouped by team
    picks_query = db.collection("draft_picks").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).stream()
    
    team_players: Dict[str, List[str]] = {}
    for pick_doc in picks_query:
        pick = pick_doc.to_dict()
        team_id = pick.get("team_id")
        player_id = pick.get("player_id")
        if team_id not in team_players:
            team_players[team_id] = []
        team_players[team_id].append(player_id)
    
    # Get team details
    teams_query = db.collection("draft_teams").where(
        filter=FieldFilter("draft_id", "==", draft_id)
    ).stream()
    
    teams = {t.id: t.to_dict() for t in teams_query}
    
    # Create roster records
    for team_id, player_ids in team_players.items():
        team_data = teams.get(team_id, {})
        
        roster_id = generate_id("roster_")
        roster_data = {
            "id": roster_id,
            "draft_id": draft_id,
            "event_id": draft_data.get("event_id"),
            "league_id": draft_data.get("league_id"),
            "team_name": team_data.get("team_name"),
            "coach_user_id": team_data.get("coach_user_id"),
            "coach_name": team_data.get("coach_name"),
            "player_ids": player_ids,
            "created_at": now_iso(),
            "created_from": "draft"
        }
        
        db.collection("team_rosters").document(roster_id).set(roster_data)
    
    logger.info(f"Created {len(team_players)} team rosters from draft {draft_id}")
