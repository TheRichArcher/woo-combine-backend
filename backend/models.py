# Firestore is now used for all data storage.
# See the approved Firestore schema for collections and document structure.

from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime

# Pydantic schemas for API responses
class PlayerSchema(BaseModel):
    id: str  # Firestore document ID
    name: str
    number: Optional[int] = None
    age_group: Optional[str] = None
    photo_url: Optional[str] = None
    event_id: Optional[str] = None
    created_at: Optional[str] = None
    # Drill scores
    drill_40m_dash: Optional[float] = None
    vertical_jump: Optional[float] = None
    catching: Optional[float] = None
    throwing: Optional[float] = None
    agility: Optional[float] = None
    composite_score: Optional[float] = None

class DrillResultSchema(BaseModel):
    id: str
    player_id: str
    type: str
    value: float
    created_at: str

class EventSchema(BaseModel):
    id: str
    name: str
    date: str
    created_at: str
    league_id: Optional[str] = None

class LeagueSchema(BaseModel):
    id: str
    name: str
    created_by_user_id: str
    created_at: str

class UserSchema(BaseModel):
    id: str  # Firebase UID
    email: str
    role: Optional[str] = None
    created_at: str 