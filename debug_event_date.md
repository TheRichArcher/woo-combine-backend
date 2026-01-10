# Event Date Debugging Guide

## Quick Diagnostic Steps

### 1. Check Console for Event Data
Open browser DevTools console on the Dashboard page and run:
```javascript
// Check what's in selectedEvent
console.log('Selected Event:', JSON.stringify(window.__selectedEvent, null, 2));

// Or if you have React DevTools:
// Find EventContext and inspect selectedEvent object
```

### 2. Check Backend Response
In Network tab, look for the API call to:
- `GET /leagues/{leagueId}/events/{eventId}`

Check the response body for the `date` field. It should look like:
```json
{
  "id": "abc123",
  "name": "Football Combine Beta 3.1",
  "date": "2026-01-15",  // ← Should be ISO date string
  "location": "...",
  ...
}
```

### 3. Expected vs Actual

**Expected behavior:**
- EventSetup saves date → Backend stores as ISO string → Dashboard reads ISO string → Displays formatted

**Actual behavior (your case):**
- Dashboard shows "No date set" despite date being set

## Root Causes Identified

### Issue #1: Date Field Validation Logic
The dashboard uses this check:
```javascript
selectedEvent && selectedEvent.date && !isNaN(Date.parse(selectedEvent.date))
```

This will show "No date set" if:
- `selectedEvent.date` is `null`
- `selectedEvent.date` is empty string `""`
- `selectedEvent.date` is `undefined`
- `selectedEvent.date` is an invalid date format

### Issue #2: Potential Cache Staleness
After editing an event, the EventContext might not be refreshing properly, showing old data.

## Files Involved

1. **frontend/src/components/EventFormModal.jsx** - Creates/edits events, converts date to ISO
2. **backend/routes/events.py** - Stores date field in Firestore
3. **frontend/src/pages/Home.jsx** - Displays dashboard event card
4. **frontend/src/components/EventSetup.jsx** - Shows event details
5. **frontend/src/context/EventContext.jsx** - Manages event state

## Next Steps

Run the diagnostic steps above and let me know:
1. What does the Network response show for the `date` field?
2. What does the console log show for `selectedEvent.date`?

Then I can implement the exact fix needed.

