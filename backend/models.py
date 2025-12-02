# Firestore is now used for all data storage.
# See the approved Firestore schema for collections and document structure.

from pydantic import BaseModel, Field, model_validator
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
    
    # Dynamic Scores Map (Phase 2)
    # This replaces the fixed fields below for all new sports/drills
    scores: Dict[str, float] = Field(default_factory=dict)
    
    # LEGACY FIELDS (Deprecated - Maintained for Football backward compatibility)
    drill_40m_dash: Optional[float] = Field(None, alias="40m_dash")
    vertical_jump: Optional[float] = None
    catching: Optional[float] = None
    throwing: Optional[float] = None
    agility: Optional[float] = None
    
    composite_score: Optional[float] = None
    
    class Config:
        populate_by_name = True  # Replaces allow_population_by_field_name in V2
        validate_assignment = True

    @model_validator(mode='after')
    def sync_scores_and_legacy_fields(self):
        """
        Bidirectional sync between dynamic 'scores' map and legacy fields.
        Ensures older clients see fields, and newer logic sees map.
        """
        # 1. Map Legacy Fields -> Scores Map (if scores is empty/incomplete)
        legacy_map = {
            "40m_dash": self.drill_40m_dash,
            "vertical_jump": self.vertical_jump,
            "catching": self.catching,
            "throwing": self.throwing,
            "agility": self.agility
        }
        
        for key, value in legacy_map.items():
            if value is not None and key not in self.scores:
                self.scores[key] = value

        # 2. Map Scores Map -> Legacy Fields (for backward compatibility)
        # Only if the legacy field exists on the model and is None
        if "40m_dash" in self.scores: self.drill_40m_dash = self.scores["40m_dash"]
        if "vertical_jump" in self.scores: self.vertical_jump = self.scores["vertical_jump"]
        if "catching" in self.scores: self.catching = self.scores["catching"]
        if "throwing" in self.scores: self.throwing = self.scores["throwing"]
        if "agility" in self.scores: self.agility = self.scores["agility"]
        
        return self

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
    live_entry_active: bool = False  # Controls locking of custom drills
    drillTemplate: Optional[str] = "football" # Track which schema this event uses

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

class CustomDrillSchema(BaseModel):
    id: str
    event_id: str
    name: str
    unit: str
    category: str
    lower_is_better: bool
    min_val: float
    max_val: float
    description: Optional[str] = None
    created_at: str
    created_by: str
    is_locked: Optional[bool] = False  # Derived from event status

class CustomDrillCreateRequest(BaseModel):
    name: str
    unit: str
    category: str
    lower_is_better: bool
    min_val: float
    max_val: float
    description: Optional[str] = None

class CustomDrillUpdateRequest(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    lower_is_better: Optional[bool] = None
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    description: Optional[str] = None
