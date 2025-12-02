from typing import Optional, List
from ..firestore_client import db
from ..services.schema_registry import SchemaRegistry
from ..schemas import SportSchema
import logging

def get_event_schema(event_id: str) -> SportSchema:
    """Fetch the schema for an event. Defaults to football if not found."""
    try:
        # Optimally, we should cache this or pass it down if we already fetched the event
        event_doc = db.collection("events").document(event_id).get()
        if not event_doc.exists:
            return SchemaRegistry.get_schema("football")
            
        event_data = event_doc.to_dict()
        # Use drillTemplate field (e.g. "soccer", "basketball") or fallback to football
        template_id = event_data.get("drillTemplate", "football")
        schema = SchemaRegistry.get_schema(template_id)
        schema = schema if schema else SchemaRegistry.get_schema("football")

        # Filter out disabled drills
        disabled_drills = event_data.get("disabled_drills", [])
        if disabled_drills and schema:
            # Create a copy of the schema with filtered drills
            new_drills = [d for d in schema.drills if d.key not in disabled_drills]
            # Use copy with update for Pydantic v1 compatibility
            return schema.copy(update={"drills": new_drills})
            
        return schema
    except Exception as e:
        logging.warning(f"Failed to fetch schema for event {event_id}: {e}. Using default.")
        return SchemaRegistry.get_schema("football")

