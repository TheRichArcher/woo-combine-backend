# Schema 401 Investigation & Cleanup

## Current Behavior
The `/schema` endpoint occasionally returns 401 Unauthorized errors in the logs. This happens because the `selectedEvent` persists in `localStorage` across sessions or league switches.

When a user switches leagues or logs in, `EventContext` initializes `selectedEvent` from `localStorage`. If this event belongs to a different league or the user's token is not yet fully validated for that scope, components like `CoachDashboard` (via `useDrills`) trigger a fetch to `/leagues/{league_id}/events/{event_id}/schema` which fails.

The app recovers gracefully because `EventContext` eventually detects the mismatch and clears the selection, and `useDrills` has a try/catch block that falls back to local templates. However, this creates noise in the logs and could mask genuine auth issues.

## Proposed Solution

1. **Strict Initialization Validation**:
   Modify `EventContext.jsx` initialization to check if the stored `selectedEvent` matches the current `selectedLeagueId` (if available) before setting it to state.

2. **Guard `useDrills` Hook**:
   Update `useDrills` to only trigger the fetch if `selectedEvent.league_id` matches the currently active league context.

3. **Distinct Error Logging**:
   Adjust `useDrills` error logging to distinguish between "expected" 401s (mismatched context) and actual API failures, reducing noise in Sentry/logs.

## Impact
- **Severity**: Low (Non-blocking, handled by fallbacks)
- **Priority**: Medium (Cleanup)
- **Risk**: Low
