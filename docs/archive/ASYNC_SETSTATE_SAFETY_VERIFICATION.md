# Async setState Safety Verification - React #130 Fix

## ✅ CONFIRMED: No Synchronous setState Assumptions

### Pattern Analysis

Our implementation **does NOT rely on synchronous setState** visibility. Here's why it's safe:

---

## 1. Status Gating During League Fetch

### The Code (AuthContext.jsx lines 186-197)

```javascript
// DEFENSIVE PATTERN: Allow league fetch during ROLE_REQUIRED state
// This is CRITICAL because React state updates are async/batched:
// - transitionTo(READY) calls setStatus(READY)
// - But the next line sees OLD status value (ROLE_REQUIRED)
// - By allowing ROLE_REQUIRED here, we don't rely on synchronous setState
const allowedStatuses = [STATUS.READY, STATUS.FETCHING_CONTEXT, STATUS.ROLE_REQUIRED];
if (!allowedStatuses.includes(status)) {
  authLogger.debug(`Skipping league fetch - auth not ready (status: ${status})`);
  return;
}

authLogger.debug(`League fetch allowed with status: ${status} (role: ${userRole})`);
```

### Why This Works

**Scenario**: User selects role, `refreshUserRole()` is called:

```javascript
// Line 871: transitionTo(READY) is called
transitionTo(STATUS.READY, 'Role selected');

// Line 876: fetchLeaguesConcurrently is called immediately
await fetchLeaguesConcurrently(user, newRole);
```

**What Happens**:
1. `transitionTo(READY)` calls `setStatus(READY)` (async state update)
2. Next line executes **before** React batches the update
3. Inside `fetchLeaguesConcurrently`, `status` variable still holds `ROLE_REQUIRED`
4. **This is fine** - our `allowedStatuses` includes `ROLE_REQUIRED`
5. League fetch proceeds successfully ✅

**If we only allowed `STATUS.READY`**:
```javascript
// ❌ BROKEN PATTERN - would fail due to async setState
if (status !== STATUS.READY) return; // status is still ROLE_REQUIRED!
```

This would block the fetch even though we just transitioned to READY.

---

## 2. Stale Response Protection

### The Code (AuthContext.jsx lines 248, 304-307)

```javascript
// Fetch key includes role - changes when role changes
const fetchKey = `${firebaseUser.uid}:${userRole}:${tokenVersion}`;

// ... later, after fetch completes ...

// CRITICAL: Check if fetch is still valid before committing state
if (lastFetchKeyRef.current !== fetchKey) {
  authLogger.debug('Discarding stale league fetch response (key changed)');
  return;
}
```

### Why This Works

**Scenario**: User rapidly changes roles (edge case):

1. Select "coach" → fetchKey = `user123:coach:token1`
2. Start league fetch for coach
3. Before fetch completes, user changes to "organizer"
4. New fetchKey = `user123:organizer:token2`
5. Coach fetch completes → sees `lastFetchKeyRef !== fetchKey` → discards response ✅

**Defense in depth**: Even if status transitions incorrectly, stale data won't corrupt state.

---

## 3. No Synchronous Assumptions in Components

### Home.jsx - Deterministic Gates (lines 38-42)

```javascript
React.useEffect(() => {
  // ✅ Depends on actual state values, not assumed transitions
  if ((userRole === 'organizer' || userRole === 'coach') 
      && !leaguesLoading 
      && selectedLeagueId) {
    navigate('/coach', { replace: true });
  }
}, [userRole, navigate, leaguesLoading, selectedLeagueId]);
```

**Why This Works**:
- Effect runs when dependencies **actually change** in React's state
- Doesn't assume "we just called setUserRole, so userRole must be X"
- Re-evaluates when React batches and commits the state update

---

## 4. League Fetch Guard Parameters

### Function Signature (AuthContext.jsx line 168)

```javascript
const fetchLeaguesConcurrently = useCallback(async (firebaseUser, userRole) => {
```

**Key Insight**: We pass `userRole` as a **parameter**, not reading it from state:

```javascript
// ✅ CORRECT - uses parameter, not closure
await fetchLeaguesConcurrently(user, newRole);

// ❌ BROKEN - would use stale userRole from closure
await fetchLeaguesConcurrently(user, userRole); // userRole might be old!
```

This ensures we're using the **just-set role value**, not waiting for React to update state.

---

## Build Verification

```
✅ Build successful: ✓ built in 11.83s
✅ Zero linting errors
✅ Bundle: dist/assets/index-DtjVmmrt.js (1,899.32 kB)
```

---

## PROD Verification Checklist

### Console Logs to Verify (screenshot)

**After role selection, expect**:
```
[AuthContext] State Transition: ROLE_REQUIRED -> READY (Role selected)
Fetching leagues after role selection (status may still be ROLE_REQUIRED due to async setState)
League fetch allowed with status: ROLE_REQUIRED (role: organizer)
Leagues loaded concurrently: 0
```

**Key indicator of correct behavior**:
- ✅ "League fetch allowed with status: ROLE_REQUIRED" → proves we don't assume synchronous setState
- ✅ Fetch proceeds successfully despite status not yet being READY

### Network Tab (screenshot)

After role selection:
```
POST /api/users/role → 200 OK
GET /api/users/me → 200 OK
GET /api/leagues/me → 200 OK (empty array or user's leagues)
```

**Must verify**:
- ✅ Exactly ONE league fetch (no duplicates)
- ✅ No 404s or "Skipping league fetch" logs

### Error Verification

**Must NOT see**:
- ❌ `Minified React error #130`
- ❌ `Skipping league fetch - auth not ready (status: ROLE_REQUIRED)`
- ❌ ErrorBoundary activations
- ❌ Sentry events

---

## Why This Pattern is Robust

### 1. **No Timing Dependencies**
- Zero `setTimeout` delays
- Zero "wait for state to update" assumptions
- Pure state-based gates

### 2. **Defense in Depth**
- Status gate allows ROLE_REQUIRED (async-safe)
- Fetch key deduplication (prevents races)
- Stale response discard (prevents corruption)
- AbortController (cleans up abandoned requests)

### 3. **Explicit Parameter Passing**
```javascript
// ✅ Pass fresh value as parameter
await fetchLeaguesConcurrently(user, newRole);

// ❌ Don't rely on closure capturing updated state
await fetchLeaguesConcurrently(user, userRole); // stale!
```

### 4. **Effect Dependencies**
```javascript
// ✅ React re-runs when state ACTUALLY changes
}, [userRole, leaguesLoading, selectedLeagueId]);

// ❌ Empty deps would miss state updates
}, []);
```

---

## Alternative Pattern (if issues persist)

If we still see blocking, we can switch to fully role-agnostic gating:

```javascript
// Instead of checking status at all:
const allowedStatuses = [STATUS.READY, STATUS.FETCHING_CONTEXT, STATUS.ROLE_REQUIRED];

// Allow fetch if we simply have a role (status-independent):
if (!userRole) {
  authLogger.debug('Skipping league fetch - no role assigned yet');
  return;
}
// No status check needed!
```

This removes **all** status dependencies from the fetch path.

---

## Summary

✅ **No synchronous setState assumptions**  
✅ **Status gate allows ROLE_REQUIRED** (async-safe)  
✅ **Stale response discard** (race-safe)  
✅ **Parameter passing** (not closure-dependent)  
✅ **Deterministic useEffect deps** (React-managed)

**Expected behavior**: League fetch proceeds immediately after role selection, regardless of whether React has batched the ROLE_REQUIRED → READY transition yet.

**Ready for PROD deployment** - pattern is async-safe by design.

