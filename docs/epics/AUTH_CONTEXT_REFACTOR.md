# Epic: AuthContext Refactor & Stabilization
**Status**: Planned
**Priority**: High
**Target**: Next Stability Sprint

## 🚨 Current Risks & Symptoms
The current `AuthContext.jsx` contains multiple "CRITICAL FIX" patches and is a known source of fragility.
- **Race Conditions**: Login can complete before league data fetching initiates, leading to "No Leagues Found" errors.
- **Infinite Loops**: Circular dependencies between auth state updates and navigation/routing hooks have caused render loops in the past.
- **Stuck States**: Users report getting stuck on "Loading..." spinners during cold starts or network hiccups.
- **Complexity**: logic is spread across multiple `useEffect` hooks with complex dependency arrays.

## 🎯 Goals
1. **Deterministic Startup**: The sequence `Auth Check -> User Profile -> League List -> Ready` must be linear and predictable.
2. **Fast Startup**: Preserve the "parallel warmup" optimization while ensuring data consistency.
3. **Debuggable**: Clear state machine transitions (e.g., `IDLE` -> `CHECKING_AUTH` -> `FETCHING_LEAGUES` -> `READY`).
4. **Multi-Tab Safety**: Better handling of session expiry or role changes across tabs.

## 🛠 Technical Plan

### 1. Responsibility Boundaries
`AuthContext` should strictly manage:
- **Identity**: Who is the user? (Firebase User)
- **Profile**: What is their DB profile? (Firestore User)
- **Scope**: What leagues can they access? (Leagues List)
- **Context**: Which league is currently active? (Selected League ID)

It should **NOT** manage:
- **Event Data**: This belongs in `EventContext`.
- **UI Routing**: It should expose state (`isAuthenticated`, `isLoading`), but the Router component should handle redirects, not the Context itself.

### 2. Dependency Management
- **Input**: Firebase Auth State (external).
- **Output**: User Object, League List, Selected League ID.
- **Warmup**: The `warmup` API call should be a side effect of *successful* auth, fire-and-forget, not a blocker for UI rendering.

### 3. State Machine Approach
Refactor the boolean flags (`loading`, `authChecked`, `roleChecked`) into a single explicit status enum:
```javascript
const STATUS = {
  INITIALIZING: 'INITIALIZING', // Checking Firebase
  AUTHENTICATING: 'AUTHENTICATING', // Fetching DB Profile
  FETCHING_CONTEXT: 'FETCHING_CONTEXT', // Loading Leagues
  READY: 'READY', // App is usable
  UNAUTHENTICATED: 'UNAUTHENTICATED' // Guest mode
};
```

## ✅ Test Matrix

### Single-Tab Flows
| Scenario | Pre-Condition | Action | Expected Result |
|----------|---------------|--------|-----------------|
| **Cold Login** | Cleared Storage | Login | `READY` state, Leagues loaded, Default League selected. |
| **Warm Start** | Valid Token in LocalStorage | Refresh Page | Immediate `READY` (optimistic), background refresh of leagues. |
| **Logout** | Logged In | Click Logout | State resets to `UNAUTHENTICATED`, Storage cleared, Redirect to Login. |
| **League Switch** | Multiple Leagues | Select League B | `selectedLeagueId` updates, `EventContext` clears stale events. |

### Multi-Tab Flows
| Scenario | Tab 1 Action | Tab 2 State | Expected Result |
|----------|--------------|-------------|-----------------|
| **Concurrent Login** | Login | Login Page | Tab 2 detects session (via Storage/Firebase) and auto-redirects to Dashboard. |
| **Logout Sync** | Logout | Dashboard | Tab 2 detects logout (listener) and redirects to Login. |
| **Context Switch** | Switch League | Dashboard | Tab 2 remains on old league *until* refresh (or explicitly syncs if we add listeners). |

### Edge Cases
- **Network Failure**: Disconnect internet -> Login. Should show "Network Error" UI, not infinite spinner.
- **Deleted Account**: Login with deleted user. Should catch 404/403 and force logout.
- **Zero Leagues**: Login as new user. Should land on "Create League" / Onboarding flow without errors.
