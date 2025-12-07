#!/usr/bin/env python3
"""
Quick fix to clear disabled_drills from an event.
Use this if drills are accidentally disabled and blocking imports.
"""

import sys
import requests

def fix_disabled_drills(base_url, league_id, event_id, token):
    """Clear disabled_drills array from an event"""
    
    print(f"\n{'='*80}")
    print("FIX DISABLED DRILLS")
    print(f"{'='*80}\n")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # First, check current state
    get_url = f"{base_url}/leagues/{league_id}/events/{event_id}"
    print(f"📋 Fetching event: {get_url}\n")
    
    try:
        response = requests.get(get_url, headers=headers)
        response.raise_for_status()
        event = response.json()
        
        print(f"Event: {event.get('name', 'Unknown')}")
        print(f"Template: {event.get('drillTemplate', 'Unknown')}")
        
        disabled = event.get('disabled_drills', [])
        print(f"\n❌ Currently Disabled Drills: {len(disabled)}")
        if disabled:
            for drill in disabled:
                print(f"   - {drill}")
        else:
            print("   (none - already cleared!)")
        
        if not disabled:
            print("\n✅ No drills are disabled. Event is clean!")
            return True
        
        # Ask for confirmation
        print(f"\n{'='*80}")
        confirm = input(f"\n⚠️  Clear all {len(disabled)} disabled drills? (yes/no): ").strip().lower()
        
        if confirm != 'yes':
            print("\n❌ Cancelled. No changes made.")
            return False
        
        # Update event to clear disabled_drills
        update_url = f"{base_url}/leagues/{league_id}/events/{event_id}"
        payload = {
            "name": event['name'],  # Required
            "disabled_drills": []    # Clear the list
        }
        
        print(f"\n🔧 Updating event...")
        response = requests.put(update_url, headers=headers, json=payload)
        response.raise_for_status()
        
        print(f"\n{'='*80}")
        print("✅ SUCCESS! All drills have been enabled.")
        print(f"{'='*80}\n")
        print("Next steps:")
        print("1. Refresh your browser")
        print("2. Try the import again")
        print("3. All drills should now be available\n")
        
        return True
        
    except requests.exceptions.HTTPError as e:
        print(f"\n❌ HTTP Error: {e}")
        print(f"   Status: {e.response.status_code}")
        print(f"   Response: {e.response.text}")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    BASE_URL = "https://api.woo-combine.com"  # Update if using local dev
    
    print("\n" + "="*80)
    print("DISABLED DRILLS FIXER")
    print("="*80)
    print("\nThis will clear the disabled_drills list from your event.")
    print("All template drills will become visible again.\n")
    print("="*80 + "\n")
    
    if len(sys.argv) == 4:
        league_id = sys.argv[1]
        event_id = sys.argv[2]
        token = sys.argv[3]
    else:
        print("Usage: python3 fix_disabled_drills.py <league_id> <event_id> <auth_token>\n")
        print("Or enter values now:\n")
        
        league_id = input("League ID: ").strip()
        event_id = input("Event ID: ").strip()
        token = input("Auth Token: ").strip()
    
    if not all([league_id, event_id, token]):
        print("\n❌ All values are required!")
        sys.exit(1)
    
    success = fix_disabled_drills(BASE_URL, league_id, event_id, token)
    sys.exit(0 if success else 1)
