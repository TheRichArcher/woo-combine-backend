#!/usr/bin/env python3
"""
Quick script to check what drills are configured for an event.
Run this to verify your event has the basketball drills.
"""

import sys
import requests
import json

def check_event_schema(base_url, league_id, event_id, token):
    """Fetch and display the event schema"""
    
    # Construct the schema endpoint URL
    schema_url = f"{base_url}/leagues/{league_id}/events/{event_id}/schema"
    
    print(f"\n{'='*80}")
    print(f"Checking Event Schema")
    print(f"{'='*80}")
    print(f"Event ID: {event_id}")
    print(f"League ID: {league_id}")
    print(f"URL: {schema_url}")
    print(f"{'='*80}\n")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(schema_url, headers=headers)
        response.raise_for_status()
        schema = response.json()
        
        drills = schema.get("drills", [])
        
        print(f"✅ Schema fetched successfully!")
        print(f"\n📊 Event: {schema.get('name', 'Unknown')}")
        print(f"🏀 Sport: {schema.get('sport', 'Unknown')}")
        print(f"\n📋 Total Drills: {len(drills)}")
        
        # Categorize drills
        standard_drills = [d for d in drills if d.get("category") != "custom"]
        custom_drills = [d for d in drills if d.get("category") == "custom"]
        
        print(f"   - Standard drills: {len(standard_drills)}")
        print(f"   - Custom drills: {len(custom_drills)}")
        
        # Show all drills
        print(f"\n{'='*80}")
        print("AVAILABLE DRILLS:")
        print(f"{'='*80}")
        
        for i, drill in enumerate(drills, 1):
            category_badge = "🔧" if drill.get("category") == "custom" else "⚡"
            print(f"{i:2}. {category_badge} {drill.get('label', 'Unknown')}")
            print(f"    Key: {drill.get('key', 'N/A')}")
            print(f"    Unit: {drill.get('unit', 'N/A')}")
            print(f"    Category: {drill.get('category', 'N/A')}")
            print()
        
        # Check for specific basketball drills
        print(f"{'='*80}")
        print("BASKETBALL DRILL CHECK:")
        print(f"{'='*80}")
        
        expected_basketball = [
            ("lane_agility", "Lane Agility"),
            ("three_point", "3-Point Shooting %"),
            ("free_throws", "Free Throw %"),
            ("vertical_jump", "Vertical Jump"),
            ("dribbling", "Ball Handling"),
            ("defensive_slide", "Defensive Slides")
        ]
        
        drill_keys = {d.get("key"): d.get("label") for d in drills}
        
        found_count = 0
        for key, expected_label in expected_basketball:
            if key in drill_keys:
                print(f"✅ {expected_label} ({key})")
                found_count += 1
            else:
                print(f"❌ {expected_label} ({key}) - NOT FOUND")
        
        print(f"\nFound {found_count}/{len(expected_basketball)} expected basketball drills")
        
        if found_count == 0:
            print("\n⚠️  WARNING: No basketball drills found!")
            print("   This event might be using a different sport template.")
            print("   Check the event settings and ensure it's set to 'Basketball'")
        
        return schema
        
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}")
        print(f"   Status Code: {e.response.status_code}")
        print(f"   Response: {e.response.text}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

if __name__ == "__main__":
    # Configuration - UPDATE THESE VALUES
    BASE_URL = "https://api.woo-combine.com"  # Or your local dev URL
    
    print("\n" + "="*80)
    print("EVENT SCHEMA CHECKER")
    print("="*80)
    print("\nThis script will check what drills are configured for your event.")
    print("You need to provide:")
    print("  1. League ID")
    print("  2. Event ID") 
    print("  3. Auth Token (JWT)")
    print("\n" + "="*80)
    
    # Get inputs
    if len(sys.argv) == 4:
        league_id = sys.argv[1]
        event_id = sys.argv[2]
        token = sys.argv[3]
    else:
        print("\nUsage: python3 check_event_schema.py <league_id> <event_id> <auth_token>")
        print("\nOr enter values interactively:\n")
        
        league_id = input("League ID: ").strip()
        event_id = input("Event ID: ").strip()
        token = input("Auth Token (from browser DevTools): ").strip()
    
    if not league_id or not event_id or not token:
        print("\n❌ All values are required!")
        sys.exit(1)
    
    schema = check_event_schema(BASE_URL, league_id, event_id, token)
    
    if schema:
        print("\n" + "="*80)
        print("✅ Schema check complete!")
        print("="*80)
    else:
        print("\n" + "="*80)
        print("❌ Schema check failed!")
        print("="*80)
