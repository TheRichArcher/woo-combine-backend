# Backend Contract Verification - Complete Analysis

## 1) Backend: "no leagues" is 200 and contract-stable ✅

### All Return Paths Analyzed

#### Path 1: Fast Path (User Has Leagues in New System)
**File**: `backend/routes/leagues.py` Line 64
```python
return {"leagues": user_leagues}  # ✅ Object with leagues key
```

#### Path 2: Legacy Path (User Has Leagues in Old System)
**File**: `backend/routes/leagues.py` Line 127
```python
return {"leagues": user_leagues}  # ✅ Object with leagues key
```

#### Path 3: No Leagues Found (New User)
**File**: `backend/routes/leagues.py` Line 113
```python
return {"leagues": []}  # ✅ Object with empty array
```

### Verification Checklist

✅ **Truly new user (no leagues)**: Returns `200 {"leagues": []}`  
✅ **Existing user (has leagues)**: Returns `200 {"leagues": [...]}`  
✅ **Never returns `[]` at top level**: All 3 paths return object with `leagues` key  
✅ **Contract is stable**: Same shape in all code paths

### Edge Case: Error Handling

**Lines 129-137**: Exception handlers
```python
except HTTPException:
    raise  # Re-raise HTTP exceptions (don't wrap)
except Exception as e:
    # Timeout → 504 Gateway Timeout (retryable)
    # Other errors → 500 Internal Server Error (app bug)
```

**Note**: If 500s occur during cold start, this is a **backend bug** that should be fixed, not masked with retries. The 500 error handling is correct - it's a signal that something is wrong with app initialization.

---

## 2) Frontend: Only one league call per (uid, role) ✅

### In-Flight Promise Cache Implementation

**File**: `frontend/src/context/AuthContext.jsx` Lines 158-282

#### De-Duplication Key
```javascript
const fetchKey = `${firebaseUser.uid}:${userRole}`;
```

**Why keyed by uid + role**:
- Different users should trigger new fetch
- Same user with changed role should refetch (e.g., role upgrade)
- Same user with same role should use cached promise

#### Cache Check
```javascript
// Line 192-196
if (leagueFetchInProgress && lastFetchKeyRef.current === fetchKey 
    && leagueFetchPromiseRef.current) {
  authLogger.debug('Returning existing in-flight league fetch promise');
  return leagueFetchPromiseRef.current;
}
```

**What this prevents**:
- ✅ React StrictMode double-invoke (dev)
- ✅ Multiple rapid state transitions (prod)
- ✅ Accidental double calls from multiple code paths

#### Promise Creation and Caching
```javascript
// Line 207-277: Async IIFE creates promise
const fetchPromise = (async () => {
  // ... fetch logic ...
  try {
    // Fetch implementation
  } finally {
    setLeagueFetchInProgress(false);
    // CRITICAL: Clear cache after completion
    if (leagueFetchPromiseRef.current === fetchPromise) {
      leagueFetchPromiseRef.current = null;
    }
  }
})();

// Line 279-281: Cache the promise
leagueFetchPromiseRef.current = fetchPromise;
return fetchPromise;
```

### Cache Clearing Verification ✅

#### Clears on Success
```javascript
// Line 270-276 (finally block)
finally {
  setLeagueFetchInProgress(false);
  // Clear promise cache after completion
  if (leagueFetchPromiseRef.current === fetchPromise) {
    leagueFetchPromiseRef.current = null;
  }
}
```

**This runs regardless of**:
- ✅ Success (leagues fetched)
- ✅ Failure (network error, timeout, etc.)
- ✅ Early return (no data in response)

**Result**: Cache never "locks" - future fetches work correctly

#### Clears on Key Change
```javascript
// Line 198-201
if (lastFetchKeyRef.current !== fetchKey) {
  leagueFetchPromiseRef.current = null;
  lastFetchKeyRef.current = fetchKey;
}
```

**Ensures**: If user or role changes, old promise is discarded

### StrictMode Behavior Verification

**React StrictMode** (dev only) intentionally double-invokes:
- Effects
- State updates
- Render functions

**Our implementation**:
1. First invoke: Creates promise, caches it
2. Second invoke (immediate): Detects same fetchKey, returns cached promise
3. **Result**: Single network call despite double-invoke

**Test in dev**:
```bash
npm run dev
# Open DevTools → Network
# Login
# Verify: ONE /api/leagues/me request (not two)
```

---

## 3) Cold Start 500 Error Handling - Judgment Call ✅

### Current Implementation: No Retry on 500

**File**: `frontend/src/lib/api.js`

```javascript
// Never retry 500 Internal Server Error or 501 Not Implemented
if (statusCode === 500 || statusCode === 501) {
  return Promise.reject(error);
}
```

### Why This Is Correct

**Philosophy**: 500 = Application Bug, Not Infrastructure Issue

If 500 occurs during cold start, it means:
- ❌ App initialization is broken (bug)
- ❌ Database connection failed (config issue)
- ❌ Missing environment variables (deployment issue)
- ❌ Code error during startup (exception)

**These won't fix themselves on retry** - they need backend fixes.

### Backend Cold Start Error Mapping

**File**: `backend/routes/leagues.py` Lines 134-137

```python
if "timeout" in str(e).lower():
    raise HTTPException(status_code=504, detail="Database operation timed out...")
else:
    raise HTTPException(status_code=500, detail="Failed to retrieve leagues...")
```

**Proper mapping**:
- Timeout → **504** (infrastructure, retryable) ✅
- Other errors → **500** (application bug, not retryable) ✅

### If You See Transient 500s During Cold Start

**DON'T**: Mask with retries  
**DO**: Fix the backend so it returns:
- **502** for proxy/gateway issues (Render infrastructure)
- **503** for service unavailable (intentional hibernation)
- **504** for timeouts (slow cold start)

**Example Fix**:
```python
# If you see: "Firebase not initialized" → 500
# Fix by: Proper lazy initialization with 503 during warmup

if not firebase_initialized:
    raise HTTPException(status_code=503, detail="Service warming up")
```

### Exception: Legitimate Cold Start 500s

If Render/infrastructure causes 500s (not your app code), you'd see:
- Load balancer errors
- Container startup failures
- Memory issues

**In that case**: Those are actually infrastructure issues (503/502 territory)  
**Solution**: Report to Render support, they should return proper 5xx codes

---

## Production Testing Protocol

### Test 1: New User Contract (2 minutes)

**Setup**: Create brand new account

**Steps**:
1. Sign up → verify email → select role
2. Open DevTools → Network → XHR filter
3. Watch for `/api/leagues/me` call after role selection

**Expected**:
```
Request:
GET https://woo-combine-backend.onrender.com/api/leagues/me
Authorization: Bearer <token>

Response:
200 OK
{"leagues": []}
```

**Verify**:
- [ ] Status is 200 (not 404)
- [ ] Response is object with `leagues` key
- [ ] `leagues` value is empty array
- [ ] No retry attempts visible

---

### Test 2: Existing User Contract (2 minutes)

**Setup**: Use account with leagues

**Steps**:
1. Log in
2. Open DevTools → Network → XHR filter
3. Watch for `/api/leagues/me` call

**Expected**:
```
Request:
GET https://woo-combine-backend.onrender.com/api/leagues/me
Authorization: Bearer <token>

Response:
200 OK
{
  "leagues": [
    {"id": "...", "name": "...", "role": "...", ...},
    ...
  ]
}
```

**Verify**:
- [ ] Status is 200
- [ ] Response is object with `leagues` key
- [ ] `leagues` value is array of objects
- [ ] Each league has id, name, role fields

---

### Test 3: Single Call Per (uid, role) - Dev Mode (3 minutes)

**Setup**: Run in development with StrictMode

**Steps**:
```bash
cd frontend
npm run dev
```

1. Open http://localhost:5173
2. Open DevTools → Network → XHR filter
3. Clear network log
4. Log in
5. Count `/api/leagues/me` calls

**Expected**:
- **ONE** network request (not two)
- Console may show double logs (StrictMode)
- But network tab shows single call

**Verify**:
- [ ] Only ONE `/api/leagues/me` in network tab
- [ ] Console shows "Returning existing in-flight league fetch promise" on second invoke

---

### Test 4: Single Call Per (uid, role) - Production (3 minutes)

**Setup**: Test on production (woo-combine.com)

**Steps**:
1. Open https://woo-combine.com
2. Open DevTools → Network → XHR filter
3. Clear network log
4. Log in
5. Wait for dashboard to load
6. Count `/api/leagues/me` calls

**Expected**:
- **ONE** network request total
- No duplicate calls
- Fast load (leagues cached)

**Verify**:
- [ ] Only ONE `/api/leagues/me` in network tab
- [ ] No duplicate requests
- [ ] Dashboard loads with league data

---

### Test 5: Promise Cache Clearing (5 minutes)

**Setup**: Test cache doesn't "lock"

**Steps**:
1. Log in as User A
2. Verify leagues load
3. Log out
4. Log in as User B (different account)
5. Verify leagues load (different data)

**Expected**:
- User A: Fetches leagues successfully
- User B: Fetches fresh leagues (not User A's data)
- Cache cleared between users

**Verify**:
- [ ] User A sees their leagues
- [ ] User B sees their leagues (different from A)
- [ ] No stale data from cached promise
- [ ] Console shows new fetchKey for User B

---

### Test 6: Error Handling - Cache Clear on Failure (5 minutes)

**Setup**: Force a fetch failure

**Steps**:
1. Open DevTools → Network
2. Enable "Offline" mode
3. Log in (will use cached auth)
4. Try to load dashboard (leagues fetch will fail)
5. Disable "Offline" mode
6. Refresh dashboard
7. Verify leagues load successfully

**Expected**:
- First attempt: Network error
- Cache clears despite failure
- Second attempt: Success (not locked)

**Verify**:
- [ ] First fetch fails with network error
- [ ] Second fetch succeeds
- [ ] No "locked" cache preventing future fetches
- [ ] Console shows cache cleared in finally block

---

## Summary

### Backend Contract ✅
- ✅ Always returns `{"leagues": [...]}` 
- ✅ Never returns bare array `[]`
- ✅ 200 for empty state, not 404
- ✅ Consistent across all 3 code paths

### Frontend De-Duplication ✅
- ✅ In-flight promise cache by (uid, role)
- ✅ Prevents StrictMode double calls
- ✅ Clears on success AND failure
- ✅ Never locks future fetches

### Retry Strategy ✅
- ✅ No retry on 500 (app bugs should be fixed)
- ✅ Retry on 502/503/504 (infrastructure)
- ✅ Backend maps timeouts to 504 (correct)

### Cold Start 500s
- ⚠️ If you see transient 500s, fix backend to return proper codes
- ⚠️ Don't mask app bugs with retries
- ✅ Current implementation encourages proper error handling

