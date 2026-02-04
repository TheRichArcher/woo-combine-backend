from typing import Optional
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
        custom_drill_defs = []
        try:
            custom_drills_ref = db.collection("events").document(event_id).collection("custom_drills")
            # Use stream() to get all docs (usually small number < 20)
            custom_drills_stream = custom_drills_ref.stream()
            
            for cd in custom_drills_stream:
                try:
                    data = cd.to_dict()
                    # Robust type conversion for numeric fields
                    min_val = data.get("min_val")
                    if min_val is not None:
                        try:
                            min_val = float(min_val)
                        except (ValueError, TypeError):
                            min_val = None
                            
                    max_val = data.get("max_val")
                    if max_val is not None:
                        try:
                            max_val = float(max_val)
                        except (ValueError, TypeError):
                            max_val = None

                    # Map CustomDrillSchema fields to DrillDefinition fields
                    # Custom drills use their Firestore ID as the 'key'
                    custom_drill_defs.append(DrillDefinition(
                        key=data.get("id", cd.id),
                        label=data.get("name", "Unknown Drill"),
                        unit=data.get("unit", ""),
                        lower_is_better=data.get("lower_is_better", False),
                        category=data.get("category", "custom"),
                        min_value=min_val,
                        max_value=max_val,
                        default_weight=0.0,  # Custom drills default to 0 weight
                        description=data.get("description")
                    ))
                except Exception as drill_err:
                    logging.warning(f"Skipping invalid custom drill {cd.id} for event {event_id}: {drill_err}")
        except Exception as cd_err:
            logging.error(f"Failed to fetch custom drills for event {event_id}: {cd_err}")
            # Continue with base schema
            
        # 4. Filter Disabled Drills from Base Schema
        disabled_drills = event_data.get("disabled_drills", [])
        active_base_drills = [d for d in base_schema.drills if d.key not in disabled_drills]
        
        # 5. Merge Base and Custom Drills
        # Custom drills are appended to the list
        final_drills = active_base_drills + custom_drill_defs
        
        logging.info(f"Schema built for {event_id}: {len(active_base_drills)} base + {len(custom_drill_defs)} custom = {len(final_drills)} total drills")
        
        # 6. Return New Schema Instance
        # Use construct for safety if copy is flaky, but copy should work for Pydantic V1/V2
        merged_schema = base_schema.copy(update={"drills": final_drills})
        
        # Ensure the drills are actually updated
        merged_schema.drills = final_drills
        
        return merged_schema
            
    except Exception as e:
        logging.error(f"Failed to build schema for event {event_id}: {e}")
        # If we fail completely, try to return at least the base schema if we identified it
        try:
            # Re-fetch minimal event data if variable scope is lost, or use defaults
            # But 'template_id' might be available in local scope if we crashed later
            # Safe fallback:
            return SchemaRegistry.get_schema("football")
        except Exception:
            return SchemaRegistry.get_schema("football")
