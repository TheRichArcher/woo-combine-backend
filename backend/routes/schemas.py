from fastapi import APIRouter, HTTPException, Depends
from typing import List
from ..schemas import SportSchema
from ..services.schema_registry import SchemaRegistry
from ..middleware.rate_limiting import read_rate_limit

router = APIRouter()

@router.get("/sports/{sport_id}/schema", response_model=SportSchema)
@read_rate_limit()
def get_sport_schema(sport_id: str):
    """
    Get the authoritative schema for a specific sport.
    This schema defines all drills, scoring rules, and presets.
    """
    schema = SchemaRegistry.get_schema(sport_id)
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema not found for sport: {sport_id}")
    return schema

@router.get("/schemas", response_model=List[SportSchema])
@read_rate_limit()
def list_all_schemas():
    """List all available sport schemas"""
    return SchemaRegistry.get_all_schemas()

