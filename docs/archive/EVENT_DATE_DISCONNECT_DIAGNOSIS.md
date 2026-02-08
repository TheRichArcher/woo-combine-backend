# Event Date Disconnect - Root Cause Analysis

## Issue Report
Dashboard shows "Football Combine Beta 3.1 — No date set" despite date being set during EventSetup.

## Investigation Summary

### Files Checked
1. ✅ `frontend/src/components/EventFormModal.jsx` - Event create/edit form
2. ✅ `backend/routes/events.py` - Event API endpoints
3. ✅ `frontend/src/pages/Home.jsx` - Dashboard display
4. ✅ `frontend/src/components/EventSetup.jsx` - Event setup display
5. ✅ `frontend/src/context/EventContext.jsx` - Event state management

### Data Flow Analysis

**CREATE/EDIT FLOW:**
```
EventFormModal (line 74-117)
  → Converts date to ISO: new Date(date).toISOString().slice(0, 10)
  → Sends to: PUT /leagues/{leagueId}/events/{eventId}
  → Backend stores: { date: "2026-01-15", ... }
  → Updates EventContext.setEvents() ✅
  → Updates EventContext.setSelectedEvent() ✅
  → Invalidates cache: cacheInvalidation.eventsUpdated() ✅
```

**DISPLAY FLOW:**
```
Home.jsx (lines 22-24)
  → Reads: selectedEvent.date
  → Checks: !isNaN(Date.parse(selectedEvent.date))
  → Formats: new Date(selectedEvent.date).toLocaleDateString()
  → Falls back to: "No date set" if invalid
```

### Root Cause Identified

**ISSUE: LocalStorage Staleness + Context Update Race Condition**

When editing an event:
1. EventFormModal updates the in-memory EventContext.selectedEvent ✅
2. EventFormModal updates the in-memory EventContext.events array ✅
3. **BUT** localStorage still contains the OLD event data ⚠️
4. On next page load or context refresh, EventContext reads from localStorage
5. The stale cached event (with old/missing date) overwrites the updated event

### Evidence

**EventContext.jsx line 14-21:**
```javascript
const [selectedEvent, setSelectedEvent] = useState(() => {
  try {
    const stored = localStorage.getItem('selectedEvent');
    return stored ? JSON.parse(stored) : null;  // ← READS STALE DATA
  } catch {
    return null;
  }
});
```

**EventFormModal.jsx line 127-128:**
```javascript
// Update selected event if it's the one being edited
setSelectedEvent(prev => prev && prev.id === event.id ? updatedEvent : prev);
```

**PROBLEM:** This updates React state but does NOT update localStorage. The localStorage still has the old event data.

**EventContext.jsx also initializes from localStorage on mount**, so any refresh or navigation will restore the stale data.

## The Fix

### Solution 1: Update localStorage when editing events

**In EventFormModal.jsx after line 128:**
```javascript
// Update selected event if it's the one being edited
setSelectedEvent(prev => {
  if (prev && prev.id === event.id) {
    // CRITICAL: Also update localStorage to prevent staleness
    localStorage.setItem('selectedEvent', JSON.stringify(updatedEvent));
    return updatedEvent;
  }
  return prev;
});
```

### Solution 2: Force EventContext to refresh from backend

**Alternative: Invalidate selectedEvent in localStorage on edit:**
```javascript
// After successful edit
localStorage.removeItem('selectedEvent');
setSelectedEvent(null);
// Then let EventContext.loadEvents() refetch from backend
```

## Recommendation

**Implement Solution 1** because:
- ✅ Maintains consistent state across React context + localStorage
- ✅ No additional API calls
- ✅ Immediate UI update
- ✅ Persists across page refreshes

Solution 2 would work but requires an extra API call and causes a brief loading state.

## Files to Modify

1. **frontend/src/components/EventFormModal.jsx** (line 128)
   - Update localStorage when updating selectedEvent

## Verification Steps

After fix:
1. Edit event date in EventSetup
2. Save changes
3. Navigate to Dashboard
4. Verify date displays correctly
5. Refresh page
6. Verify date still displays correctly (localStorage test)

## Additional Considerations

The same pattern should be applied to:
- Event name changes
- Event location changes
- Event notes changes

All event metadata needs to be synced between:
1. React Context (EventContext.selectedEvent)
2. LocalStorage ('selectedEvent' key)
3. Backend database (Firestore)

