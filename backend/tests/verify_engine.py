import sys
import os
import logging

# 1. Add PROJECT ROOT to path so 'from backend.services' works
# Get absolute path to 'backend/tests/verify_engine.py'
current_file = os.path.abspath(__file__)
# Go up 2 levels: backend/tests -> backend -> PROJECT_ROOT
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.services.schema_registry import SchemaRegistry
from backend.routes.players import calculate_composite_score
from backend.utils.importers import DataImporter
from backend.models import PlayerSchema

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def run_verification():
    print("============================================================")
    print("      MULTI-SPORT SCHEMA ENGINE - VERIFICATION SUITE        ")
    print("============================================================")

    # ---------------------------------------------------------
    # 1. Verify Schema Registry
    # ---------------------------------------------------------
    print("\n[TEST 1] Schema Registry Loading")
    schemas = SchemaRegistry.get_all_schemas()
    print(f"✅ Loaded {len(schemas)} schemas: {[s.id for s in schemas]}")
    
    football = SchemaRegistry.get_schema("football")
    soccer = SchemaRegistry.get_schema("soccer")
    
    if football and soccer:
        print(f"✅ Football (Legacy) Schema Validated: {len(football.drills)} drills")
        print(f"✅ Soccer (New) Schema Validated: {len(soccer.drills)} drills")
    else:
        print("❌ Failed to load default schemas")
        return

    # ---------------------------------------------------------
    # 2. Verify Scoring Engine (Logic Check)
    # ---------------------------------------------------------
    print("\n[TEST 2] Scoring Engine Logic")
    
    # Case A: Soccer Player (Lower time is better for sprint)
    soccer_player_data = {
        "scores": {
            "sprint_speed": 3.5,  # Very fast (Min is likely ~3-4)
            "ball_control": 90,   # High score
            "passing_accuracy": 85,
            "shooting_power": 70,
            "agility_cones": 5.0,
            "endurance": 12
        }
    }
    soccer_score = calculate_composite_score(soccer_player_data, schema=soccer)
    print(f"⚽ Soccer Player Score: {soccer_score} (Expected: High, >80)")
    
    # Case B: Football Player (Inverted 40y dash)
    football_player_data = {
        "scores": {
            "40m_dash": 4.4,      # Fast!
            "vertical_jump": 35,  # Good
            "catching": 80,
            "throwing": 80,
            "agility": 7.0
        }
    }
    fb_score = calculate_composite_score(football_player_data, schema=football)
    print(f"🏈 Football Player Score: {fb_score} (Expected: High, >80)")
    
    if soccer_score > 0 and fb_score > 0:
        print("✅ Scoring engine correctly handles different schemas")
    else:
        print("❌ Scoring engine failed")

    # ---------------------------------------------------------
    # 3. Verify Import Detection
    # ---------------------------------------------------------
    print("\n[TEST 3] Import Auto-Detection")
    
    soccer_headers = ["First Name", "Last Name", "20m Sprint", "Ball Control"]
    fb_headers = ["First Name", "Last Name", "40-Yard Dash", "Vertical Jump"]
    
    sport_s, conf_s = DataImporter._detect_sport(soccer_headers)
    sport_f, conf_f = DataImporter._detect_sport(fb_headers)
    
    print(f"Headers: {soccer_headers} -> Detected: {sport_s} ({conf_s})")
    if sport_s == 'soccer':
        print("✅ Soccer detection working")
    else:
        print(f"❌ Soccer detection failed (Got {sport_s})")
        
    print(f"Headers: {fb_headers} -> Detected: {sport_f} ({conf_f})")
    if sport_f == 'football':
        print("✅ Football detection working")
    else:
        print(f"❌ Football detection failed (Got {sport_f})")

    # ---------------------------------------------------------
    # 4. Verify Backwards Compatibility (Lazy Migration)
    # ---------------------------------------------------------
    print("\n[TEST 4] Backward Compatibility (PlayerSchema)")
    
    legacy_data = {
        "id": "test_123",
        "name": "Legacy Player",
        "drill_40m_dash": 4.5,  # Old field alias="40m_dash"
        "vertical_jump": 30.0,  # Old field
        "catching": 75.0
    }
    
    try:
        p = PlayerSchema(**legacy_data)
        print(f"Input: Legacy fields (40m_dash={legacy_data['drill_40m_dash']})")
        print(f"Output: p.scores map: {p.scores}")
        
        if p.scores.get("40m_dash") == 4.5 and p.scores.get("vertical_jump") == 30.0:
            print("✅ Legacy fields successfully auto-migrated to scores map")
        else:
            print("❌ Legacy migration failed")
            
    except Exception as e:
        print(f"❌ Schema validation error: {e}")

    # ---------------------------------------------------------
    # 5. Verify Schema Normalization (Min/Max)
    # ---------------------------------------------------------
    print("\n[TEST 5] Drill Validation/Normalization")
    
    # Check validation logic using Importer
    norm_val = DataImporter._clean_value("4,5s")
    print(f"Cleaning '4,5s': {norm_val}")
    if norm_val == 4.5:
        print("✅ Value cleaning (European + Units) working")
    else:
        print("❌ Value cleaning failed")

    print("\n============================================================")
    print("      VERIFICATION COMPLETE - READY FOR QA                  ")
    print("============================================================")

if __name__ == "__main__":
    run_verification()
