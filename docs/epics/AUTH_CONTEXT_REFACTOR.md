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

## 🔗 Dependency Analysis (Pre-Refactor)

### Direct Consumers
- **`App.jsx`**: `ProtectedRoute` relies on `loading` (auth initialization) to block rendering.
- **`EventContext.jsx`**: Strictly waits for `authChecked && roleChecked` before fetching data. This ordering **MUST** be preserved.
- **`CoachDashboard.jsx`**: Consumes `selectedLeagueId` to fetch rankings.
- **`Players.jsx`**: Consumes `userRole` for "View Only" mode logic.
- **`SelectRole.jsx`**: Consumes `user` to update profile.

### Warmup Flow
- **Current**: Fires fire-and-forget `api.get('/warmup')` inside `onAuthStateChanged`.
- **Target**: Should fire on transition from `INITIALIZING` -> `AUTHENTICATING`.

### High Risk Flows
- **Deep Linking**: `/join-event/:code` relies on Auth initializing *fast* so it can capture the URL code before a redirect (or persist it).
- **Cold Start**: If `STATUS` hangs on `FETCHING_CONTEXT` (leagues), the app will look broken. We need a fallback/timeout.

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

## ⏱️ Performance Measurement (Fast Startup)
To ensure we don't regress "Time to Dashboard", we will measure:
1.  **Metric**: Time from `main.jsx` mount to `CoachDashboard` ready state.
2.  **Method**: `performance.mark('app-init')` in `main.jsx` and `performance.mark('dashboard-ready')` in `CoachDashboard` effect. Calculate duration.
3.  **Baseline**: Capture 5 runs on Staging (average) before starting Milestone 2.
4.  **Target**: Post-refactor average must be within 10% of baseline.
5.  **Environment**: Test on Desktop Chrome and Mobile (simulated Slow 4G) to catch waterfall issues.

## 📅 Milestones

### Milestone 1: State Machine & Logging (Foundation)
**Goal**: Introduce the `STATUS` enum and logging infrastructure without changing current behavior.
- **Tasks**:
  - Define `STATUS` constants (IDLE, AUTHENTICATING, etc.).
  - Add a `status` state variable to `AuthContext` that mirrors the current boolean flags.
  - Add structured logging transitions (e.g., "AuthContext: Transitioning IDLE -> AUTHENTICATING").
- **Risk**: Low (Parallel state only).
- **Estimate**: 3-5 hours.

### Milestone 2: Migration & Deterministic Flow
**Goal**: Move the actual logic to drive off `STATUS` instead of loose `useEffect`s.
- **Tasks**:
  - Rewrite the main effect to strictly follow the state machine.
  - Remove circular dependencies (e.g., `roleChecked` waiting on `authChecked` waiting on `user`).
  - Implement the "Linear Sequence": `Firebase Auth` -> `Firestore Profile` -> `Leagues` -> `Ready`.
- **Risk**: High (Core logic change). Needs full regression test.
- **Estimate**: 8-12 hours.
- **Focus Flows**: Login redirect, Page Refresh (Cold Start), Logout.

### Milestone 3: Cleanup & Optimization
**Goal**: Remove the "temporary hacks" and race-condition guards that are no longer needed.
- **Tasks**:
  - Remove `setTimeout` delays used for "warmup".
  - Remove defensive `if (!user) return` checks in downstream components (relying on `STATUS === READY` instead).
  - Verify "Fast Startup" metrics are maintained.
- **Risk**: Medium (Regression chance).
- **Estimate**: 3-5 hours.
