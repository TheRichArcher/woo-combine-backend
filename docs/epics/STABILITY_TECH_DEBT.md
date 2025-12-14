# Epic: Stability & Tech Debt Cleanup
**Status**: Open
**Priority**: Medium
**Created**: December 13, 2025

This epic tracks technical debt cleanup and stability improvements identified during the "Create New Event" bug fix.

## Scope

### 1. EventContext Cleanup (Schema 401s)
- **Problem**: `selectedEvent` persists in `localStorage` even after switching leagues or logging out. This causes the dashboard to attempt fetching schema for an event the user no longer has access to, resulting in 401 errors.
- **Impact**: Benign (handled by fallback), but pollutes logs/Sentry and could mask real issues.
- **Task**: 
  - Update `EventContext.jsx` to validate `selectedEvent` against `selectedLeagueId` on initialization.
  - Clear `selectedEvent` if it doesn't belong to the current league.
  - Refactor `useDrills` to avoid fetching if context is mismatched.
- **Implementation Specs**:
  - **Validation**: In `EventContext.jsx`, inside the `useEffect` dependent on `selectedLeagueId`, add a check: `if (selectedEvent && selectedEvent.league_id !== selectedLeagueId)`.
  - **Action**: If mismatch found, `localStorage.removeItem('selectedEvent')` and `setSelectedEvent(null)`.
  - **UX**: If cleared, the Dashboard will naturally fall back to the "Select an Event" state (or auto-select the first valid event if available).
- **Estimate**: 2-3 hours (includes testing cold-start scenarios).
- **Reference**: `docs/reports/SCHEMA_401_INVESTIGATION.md`

### 4. Create Event / Schema Follow-ups (Monitoring)
**Status**: Monitoring
- **Check**: Monitor Sentry for any remaining `/schema` 401 errors.
- **Criteria**: If 401s persist *outside* of the known "stale local storage" pattern (which is now fixed), investigate potentially expired Firebase tokens being sent to the backend.
- **Action**: If a spike occurs, log specific browser/user context here.

### 2. Sentry Monitoring & Auth Hardening
- **Problem**: Need to ensure we distinguish between "expected" 401s and real auth failures.
- **Task**:
  - Monitor Sentry for `Uncaught ReferenceError` or similar state-missing crashes.
  - Tag expected 401s in Sentry to separate signal from noise.

### 3. Component State Audits
- **Problem**: Some components might rely on implied props or context without local safety checks.
- **Task**:
  - Periodically review "At-Risk Components" listed in `docs/qa/MANUAL_CHECKLIST.md`.
  - Enforce ESLint rules for undefined variables if possible.
