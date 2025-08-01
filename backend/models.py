# Firestore is now used for all data storage.
# See the approved Firestore schema for collections and document structure.

from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
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
    drill_40m_dash: Optional[float] = Field(None, alias="40m_dash")
    vertical_jump: Optional[float] = None
    catching: Optional[float] = None
    throwing: Optional[float] = None
    agility: Optional[float] = None
    composite_score: Optional[float] = None
    
    class Config:
        allow_population_by_field_name = True

class DrillResultSchema(BaseModel):
    id: str
    player_id: str
    type: str
    value: float
    created_at: str
    evaluator_id: Optional[str] = None  # Firebase UID of evaluator
    evaluator_name: Optional[str] = None  # Display name of evaluator

class EvaluatorSchema(BaseModel):
    id: str  # Firebase UID
    name: str
    email: str
    role: str  # 'head_coach', 'assistant_coach', 'evaluator', 'scout'
    event_id: str
    added_by: str  # Firebase UID who added this evaluator
    added_at: str
    active: bool = True

class MultiEvaluatorDrillResult(BaseModel):
    """Aggregated drill result from multiple evaluators"""
    player_id: str
    drill_type: str
    evaluations: List[Dict[str, Any]]  # List of individual evaluations
    average_score: float
    median_score: float
    score_count: int
    score_variance: Optional[float] = None
    final_score: float  # The score used for rankings (usually average)
    updated_at: str

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