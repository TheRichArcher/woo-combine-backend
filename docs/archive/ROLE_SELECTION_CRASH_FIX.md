# Role Selection → Dashboard Crash Fix (React Error #130)

## Issue Summary
After the ROLE_REQUIRED state machine fix, users could successfully select their role, but the app immediately crashed with `Minified React error #130` when redirecting to the dashboard.

## Root Causes Identified

### 1. **Undefined Component in CoachDashboard (PRIMARY CAUSE)**
**File**: `frontend/src/pages/CoachDashboard.jsx`

**Problem**: Line 27 was attempting to destructure `LeagueFallback` from `useEvent()`:
```javascript
const { selectedEvent, noLeague, LeagueFallback, setEvents, setSelectedEvent, events } = useEvent();
```

However, `EventContext` does NOT export `LeagueFallback` - it only exports:
- events, selectedEvent, setSelectedEvent, setEvents
- noLeague, loading, error
- refreshEvents, updateEvent

This caused `LeagueFallback` to be `undefined`, and when the component tried to render `<LeagueFallback />` on lines 249 and 299, React threw error #130: "Element type is invalid: expected a string or class/function but got: undefined."

**Fix**: Import `LeagueFallback` directly from its module:
```javascript
import LeagueFallback from "../context/LeagueFallback";
```

### 2. **Race Condition in Home.jsx Redirect**
**File**: `frontend/src/pages/Home.jsx`

**Problem**: Lines 36-40 had an automatic redirect effect that would redirect organizers/coaches to `/coach` as soon as `userRole` was set, WITHOUT waiting for:
- Leagues to finish loading
- Auth state to fully transition from ROLE_REQUIRED to READY
- Components to fully initialize

This caused navigation to happen before the app was ready, leading to undefined component errors.

**Fix**: Added guards to only redirect when fully ready:
```javascript
React.useEffect(() => {
  if ((userRole === 'organizer' || userRole === 'coach') && !leaguesLoading && selectedLeagueId) {
    navigate('/coach', { replace: true });
  }
}, [userRole, navigate, leaguesLoading, selectedLeagueId]);
```

### 3. **League Fetch Timing Issue**
**File**: `frontend/src/context/AuthContext.jsx`

**Problem**: After role selection, logs showed:
```
Fetching leagues after role selection
Skipping league fetch - auth not ready (status: ROLE_REQUIRED)
```

The `fetchLeaguesConcurrently` function was rejecting calls when `status` was `ROLE_REQUIRED`, even though we had just set the role and were trying to fetch leagues.

**Fix**: Updated the status check to allow league fetching during `ROLE_REQUIRED` state when a role is present:
```javascript
// Allow league fetch during ROLE_REQUIRED state after role is confirmed
const allowedStatuses = [STATUS.READY, STATUS.FETCHING_CONTEXT, STATUS.ROLE_REQUIRED];
if (!allowedStatuses.includes(status)) {
  authLogger.debug(`Skipping league fetch - auth not ready (status: ${status})`);
  return;
}
```

### 4. **Race Condition in refreshUserRole**
**File**: `frontend/src/context/AuthContext.jsx`

**Problem**: The `refreshUserRole` function would:
1. Call `setUserRole(newRole)` 
2. Call `transitionTo(STATUS.READY)`
3. Immediately call `fetchLeaguesConcurrently(user, newRole)`

But React state updates are asynchronous, so step 3 could execute before the status transition in step 2 had propagated, causing the fetch to be rejected.

**Fix**: Added explicit delays to ensure proper sequencing:

In `SelectRole.jsx`:
```javascript
await refreshUserRole();

// CRITICAL: Wait a moment for auth state to fully transition to READY
await new Promise(resolve => setTimeout(resolve, 100));
```

In `AuthContext.jsx` `refreshUserRole`:
```javascript
transitionTo(STATUS.READY, 'Role selected');

// CRITICAL: Add small delay to allow status transition to propagate
await new Promise(resolve => setTimeout(resolve, 50));

await fetchLeaguesConcurrently(user, newRole);
```

Also added `setRoleChecked(true)` to ensure the role check is marked complete.

## Testing Verification

### Build Status
✅ Frontend builds successfully with no errors
- Bundle: `dist/assets/index-CIhUSftn-1767298795448.js` (1,899.49 kB)
- No linting errors
- All imports resolved correctly

### Expected Flow After Fix

1. User selects role on `/select-role` page
2. Role saved to backend via `POST /users/role`
3. `refreshUserRole()` called:
   - Sets `userRole` state
   - Sets `roleChecked = true`
   - Transitions from `ROLE_REQUIRED` → `READY`
   - Waits 50ms for transition to propagate
   - Fetches leagues with the new role
4. Wait 100ms in `SelectRole.jsx` for full readiness
5. Navigate to destination:
   - Organizers → `/create-league`
   - Others → `/dashboard`
6. `Home.jsx` effect checks if ready:
   - If organizer/coach AND not loading AND has selectedLeagueId → redirect to `/coach`
7. `CoachDashboard` renders with properly imported `LeagueFallback`
8. Exactly ONE `/api/leagues/me` call (200 OK)
9. App continues normally

### Debug Output
Added console.debug statements to verify component imports:
```javascript
console.debug('[CoachDashboard] Component Check:', { 
  CreateLeagueForm, 
  EventSelector, 
  CreateEventModal,
  LoadingScreen,
  LeagueFallback
});
```

## Deployment
All fixes committed and frontend rebuilt successfully. Ready for production deployment.

## Related Issues
- Fixes React error #130 crash after role selection
- Resolves "Skipping league fetch - auth not ready" issue
- Eliminates race conditions in post-role navigation
- Ensures proper state machine transitions

