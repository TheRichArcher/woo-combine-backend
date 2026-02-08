# Diagnosis: Why Basketball Import Shows "0 players, 0 scores"

## What We Know From Screenshot:

1. ✅ **Parse succeeded**: 40 valid rows, 0 errors
2. ❌ **Validation failed**: "Lane Agility (sec)" and "3PT Spot Shooting (%)" not mapped to valid fields
3. ❌ **Result**: "Imported 0 players, wrote 0 scores"

## Root Cause Analysis:

The validation error means `availableDrills` (from `useDrills` hook) doesn't contain basketball drills.

### Possible Causes:

**A. Event has wrong template** (football instead of basketball)
- Would explain why basketball drills aren't in schema
- Check: `event.drillTemplate` should be `"basketball"`

**B. Schema fetch failed**
- `useDrills` hook might be using fallback/cache
- Check browser network tab for `/leagues/{id}/events/{id}/schema` request

**C. Timing issue**
- Import modal opens before schema finishes loading
- Drills might still be empty array when validation runs

## Debug Steps:

### 1. Check Event Template (Browser Console):

```javascript
// On the event page, check what template is configured
const event = JSON.parse(localStorage.getItem('selectedEvent'));
console.log('Event:', event?.name);
console.log('Template:', event?.drillTemplate);
console.log('Expected: basketball (for Lane Agility, 3PT drills)');

// Or fetch fresh
fetch(window.location.pathname)
  .then(r => r.json())
  .then(event => {
    console.log('Event Template:', event.drillTemplate);
    console.log('✅ Correct?' , event.drillTemplate === 'basketball');
  });
```

### 2. Check Available Drills (Browser Console):

```javascript
// When import modal is open, check what drills are available
console.log('Available Drills:', window.availableDrills);
// Should see: lane_agility, three_point, free_throws, etc.

// Or manually check
fetch(`/leagues/${leagueId}/events/${eventId}/schema`)
  .then(r => r.json())
  .then(schema => {
    console.log('Schema Sport:', schema.sport);
    console.log('Total Drills:', schema.drills.length);
    schema.drills.forEach(d => console.log(`  - ${d.label} (${d.key})`));
  });
```

### 3. Check Network Tab:

1. Open DevTools → Network tab
2. Filter by "schema"
3. Look for GET request to `/events/{id}/schema` or `/leagues/{id}/events/{id}/schema`
4. Check the response - does it include basketball drills?

## Quick Fixes:

### If Event Has Wrong Template:

**Browser Console:**
```javascript
const eventId = 'YOUR_EVENT_ID';
const leagueId = 'YOUR_LEAGUE_ID';

fetch(`/leagues/${leagueId}/events/${eventId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Event Name', // Keep existing name
    drillTemplate: 'basketball'  // ← Change to basketball
  })
}).then(() => location.reload());
```

### If Schema Not Loading:

**Force refresh:**
```javascript
// Trigger a re-fetch of event data
window.location.reload();

// Or programmatically
const eventContext = document.querySelector('[data-event-context]');
if (eventContext) {
  eventContext.dispatchEvent(new CustomEvent('refreshEvent'));
}
```

## Expected Fix:

Once the event template is set to `basketball`, the schema should include:
- `lane_agility` → "Lane Agility"
- `three_point` → "3-Point Shooting %"
- `free_throws` → "Free Throw %"
- `vertical_jump` → "Vertical Jump"
- `dribbling` → "Ball Handling"
- `defensive_slide` → "Defensive Slides"

Then the import mapping will work correctly.








