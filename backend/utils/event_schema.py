from typing import Optional, List
from ..firestore_client import db
from ..services.schema_registry import SchemaRegistry
from ..schemas import SportSchema, DrillDefinition
import logging

def get_event_schema(event_id: str, league_id: Optional[str] = None) -> SportSchema:
    """
    Fetch the complete drill schema for an event, merging:
    1. Base Sport Template (e.g. Football, Soccer)
    2. Custom Drills (from subcollection)
    3. Disabled Drills (filtering out disabled keys)
    
    Returns a single authoritative Schema object.
    """
    try:
        # 1. Fetch Event Document to get template and settings
        event_doc = None
        
        # Strategy A: Try league subcollection first if league_id is provided (More specific)
        if league_id:
            league_event_ref = db.collection("leagues").document(league_id).collection("events").document(event_id)
            event_doc = league_event_ref.get()
            
        # Strategy B: Fallback to root collection if not found or no league_id
        if not event_doc or not event_doc.exists:
            event_doc = db.collection("events").document(event_id).get()
            
        if not event_doc.exists:
            logging.warning(f"Event {event_id} not found for schema fetch (league_id={league_id}). Defaulting to football.")
            return SchemaRegistry.get_schema("football")
            
        event_data = event_doc.to_dict()
        template_id = event_data.get("drillTemplate", "football")
        
        # 2. Get Base Schema
        base_schema = SchemaRegistry.get_schema(template_id)
        # Fallback if template ID is invalid
        if not base_schema:
            logging.warning(f"Invalid template '{template_id}' for event {event_id}. Fallback to football.")
            base_schema = SchemaRegistry.get_schema("football")

        # 3. Fetch Custom Drills (Subcollection)
        # Note: This is a separate read operation. For high-traffic, caching might be needed.
        custom_drills_ref = db.collection("events").document(event_id).collection("custom_drills")
        # Use stream() to get all docs (usually small number < 20)
        custom_drills_stream = custom_drills_ref.stream()
        
        custom_drill_defs = []
        for cd in custom_drills_stream:
            data = cd.to_dict()
            # Map CustomDrillSchema fields to DrillDefinition fields
            # Custom drills use their Firestore ID as the 'key'
            custom_drill_defs.append(DrillDefinition(
                key=data.get("id", cd.id),
                label=data.get("name", "Unknown Drill"),
                unit=data.get("unit", ""),
                lower_is_better=data.get("lower_is_better", False),
                category=data.get("category", "custom"),
                min_value=data.get("min_val"),
                max_value=data.get("max_val"),
                default_weight=0.0,  # Custom drills default to 0 weight
                description=data.get("description")
            ))
            
        # 4. Filter Disabled Drills from Base Schema
        disabled_drills = event_data.get("disabled_drills", [])
        active_base_drills = [d for d in base_schema.drills if d.key not in disabled_drills]
        
        # 5. Merge Base and Custom Drills
        # Custom drills are appended to the list
        final_drills = active_base_drills + custom_drill_defs
        
        # 6. Return New Schema Instance
        # We use copy() to avoid mutating the singleton registry instance
        # IMPORTANT: We must explicitly handle the list of DrillDefinition objects
        # Pydantic's copy(update={}) might need dicts if not careful, but here we pass valid objects
        merged_schema = base_schema.copy(update={"drills": final_drills})
        
        # Ensure the drills are actually updated (Pydantic V1/V2 nuance check)
        # Force the update if copy didn't take it (safe redundancy)
        merged_schema.drills = final_drills
        
        return merged_schema
            
    except Exception as e:
        logging.error(f"Failed to build schema for event {event_id}: {e}")
        # Fail safe to basic football template
        return SchemaRegistry.get_schema("football")
