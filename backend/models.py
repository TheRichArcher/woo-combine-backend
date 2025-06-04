# Firestore is now used for all data storage.
# See the approved Firestore schema for collections and document structure.

from pydantic import BaseModel
from datetime import datetime
import uuid

# Pydantic schemas for API
class PlayerSchema(BaseModel):
    id: int
    uuid: uuid.UUID
    name: str
    number: int | None = None
    age_group: str | None = None
    photo_url: str | None = None
    created_at: datetime
    class Config:
        from_attributes = True

class DrillResultSchema(BaseModel):
    id: int
    player_id: int
    type: str
    value: float
    created_at: datetime
    class Config:
        from_attributes = True

class EventSchema(BaseModel):
    id: int
    name: str
    date: datetime
    created_at: datetime
    class Config:
        from_attributes = True 