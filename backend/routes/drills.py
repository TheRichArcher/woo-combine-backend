from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel
from backend.models import DrillResultSchema

router = APIRouter()

# Drill endpoints are now managed as subcollections under players in Firestore.
# Implement additional drill-related endpoints here if needed in the future.

class DrillResultCreate(BaseModel):
    player_id: int
    type: str
    value: float
    event_id: int

# TODO: Implement Firestore CRUD endpoints for drill results
# Example placeholder endpoint:
# @router.post("/drill-results/", response_model=DrillResultSchema)
# def create_drill_result(result: DrillResultCreate):
#     # Implement Firestore logic here
#     pass
