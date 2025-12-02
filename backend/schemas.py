from typing import List, Dict, Optional, Union, Literal
from pydantic import BaseModel, Field

class DrillDefinition(BaseModel):
    key: str
    label: str
    unit: str
    lower_is_better: bool = Field(default=False, description="If true, lower values are better (e.g., sprint times)")
    category: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    default_weight: float = 0.0
    description: Optional[str] = None

class PresetDefinition(BaseModel):
    name: str
    description: str
    weights: Dict[str, float]

class SportSchema(BaseModel):
    id: str
    sport: str
    name: str
    description: str
    drills: List[DrillDefinition]
    presets: Dict[str, PresetDefinition] = Field(default_factory=dict)
    
    # Helper to get a drill by key
    def get_drill(self, key: str) -> Optional[DrillDefinition]:
        for drill in self.drills:
            if drill.key == key:
                return drill
        return None

