# Role Selection Onboarding Fix

## Problem
Users completing login were stuck on the global "Verifying identity / Server is waking up" loader when navigating to `/select-role`. The SelectRole UI never rendered because the auth state machine treated `role === null` as "still initializing" instead of a valid state requiring user action.

## Root Cause
1. `AuthContext` had no explicit state for "user authenticated but needs to select role"
2. `BootGate` only allowed rendering when `status === 'READY'` or `status === 'UNAUTHENTICATED'`
3. Users with `role === null` were stuck in initialization limbo
4. The global loading screen blocked the SelectRole UI from ever appearing

## Solution

### 1. Added `ROLE_REQUIRED` Status to State Machine

**File: `frontend/src/context/AuthContext.jsx`**

Added new status to the auth state machine:

```javascript
const STATUS = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  AUTHENTICATING: 'AUTHENTICATING',
  ROLE_REQUIRED: 'ROLE_REQUIRED', // ← NEW: User needs to select role
  FETCHING_CONTEXT: 'FETCHING_CONTEXT',
  READY: 'READY',
  UNAUTHENTICATED: 'UNAUTHENTICATED'
};
```

### 2. Transition to ROLE_REQUIRED When Role is Null

**File: `frontend/src/context/AuthContext.jsx`** (Line ~627)

When `/users/me` returns `role === null`, transition to the new state:

```javascript
if (!userRole) {
  authLogger.debug('No user role found - redirecting to select-role');
  setUserRole(null);
  localStorage.removeItem('userRole');
  setLeagues([]);
  setRole(null);
  setRoleChecked(true);
  
  // CRITICAL FIX: Transition to ROLE_REQUIRED state instead of READY
  transitionTo(STATUS.ROLE_REQUIRED, 'User needs to select role');
  
  // ... navigate to /select-role
  setInitializing(false);
  return;
}
```

### 3. Updated BootGate to Allow ROLE_REQUIRED

**File: `frontend/src/components/BootGate.jsx`**

Modified the boot gate to pass through when status is `ROLE_REQUIRED`:

```javascript
// Allow ROLE_REQUIRED to pass through BootGate so SelectRole UI can render
const isAuthSettled = status === 'READY' || status === 'UNAUTHENTICATED' || status === 'ROLE_REQUIRED';

// Skip league/event checks when in ROLE_REQUIRED state
const isLeaguesSettled = status === 'ROLE_REQUIRED' || !user || (!leaguesLoading || (leagues && leagues.length > 0));
const isEventSettled = status === 'ROLE_REQUIRED' || !user || !eventsLoading;
```

### 4. Transition from ROLE_REQUIRED → READY After Role Selection

**File: `frontend/src/context/AuthContext.jsx`** (`refreshUserRole` function)

After user selects a role, transition to READY and fetch leagues:

```javascript
// CRITICAL FIX: Transition from ROLE_REQUIRED to READY after role is set
if (newRole && status === STATUS.ROLE_REQUIRED) {
  authLogger.debug('Role selected, transitioning to READY state');
  transitionTo(STATUS.READY, 'Role selected');
  
  // Now that we have a role, fetch leagues
  authLogger.debug('Fetching leagues after role selection');
  await fetchLeaguesConcurrently(user, newRole);
}
```

**File: `frontend/src/pages/SelectRole.jsx`**

Updated to call `refreshUserRole()` after saving the role:

```javascript
// Save role to backend
await api.post('/users/role', { role: roleToSave });

// CRITICAL FIX: Call refreshUserRole to transition from ROLE_REQUIRED to READY
await refreshUserRole();

// Navigate to appropriate destination
```

## State Machine Flow

### Before Fix
```
Login → AUTHENTICATING → role === null → stuck in initializing → global loader never dismisses
```

### After Fix
```
Login → AUTHENTICATING → role === null → ROLE_REQUIRED → SelectRole UI renders
                                          ↓
                        User selects role → READY → fetch leagues → dashboard
```

## Acceptance Criteria ✅

- [x] New user logs in → immediately sees role selection UI (no global loader)
- [x] No global loading screen blocks `/select-role`
- [x] After role submission:
  - [x] Role is saved to backend
  - [x] Auth state transitions from `ROLE_REQUIRED` → `READY`
  - [x] `/api/leagues/me` is called once with the new role
  - [x] User lands on appropriate destination (dashboard or create-league)

## Testing Steps

1. **New User Flow**:
   - Sign up with new email
   - Verify email
   - Should immediately see SelectRole UI (no loading spinner)
   - Select role
   - Should proceed to dashboard/create-league

2. **Returning User Flow**:
   - User with cached role logs in
   - Should skip SelectRole and go straight to dashboard

3. **Invited User Flow**:
   - Use QR code to join event
   - Should see SelectRole with restricted options
   - After selection, should proceed to event join flow

## Files Modified

1. `frontend/src/context/AuthContext.jsx` - Added ROLE_REQUIRED state and transitions
2. `frontend/src/components/BootGate.jsx` - Allow ROLE_REQUIRED through boot gate
3. `frontend/src/pages/SelectRole.jsx` - Call refreshUserRole after role selection

## Build Status

✅ Frontend builds successfully (3177 modules transformed)
✅ No linting errors
✅ Ready for deployment

