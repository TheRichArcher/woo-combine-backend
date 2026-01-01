# Endpoint Base Path Fix Summary

## Problem Identified

The frontend was hitting `/leagues/me` endpoint before the user had a role selected, causing 404 errors and cascading timeouts.

### Root Causes

1. **"Fetch while roleless" behavior**: `fetchLeagues()` was being called with `userRole = null` during the "hot path" initialization in AuthContext
2. **Missing role guard**: No check existed to prevent league fetching when user hadn't selected a role yet
3. **Incorrect environment setup**: Frontend wasn't configured with proper backend URL (`VITE_API_BASE`)

## Backend Endpoint Structure (CONFIRMED)

The backend routes are correctly configured as:

```
main.py:
  - app.include_router(leagues_router, prefix="/api", tags=["Leagues"])

routes/leagues.py:
  - router = APIRouter(prefix="/leagues")
  - @router.get('/me')
```

**Result**: The actual endpoint is `/api/leagues/me` (NOT `/api/v1/leagues/me`)

This is correct and matches what the frontend was calling.

## Fixes Applied

### A) Fixed "fetch while roleless" behavior in AuthContext

**File**: `frontend/src/context/AuthContext.jsx`

1. **Added role guard to `fetchLeaguesConcurrently()`**:
   ```javascript
   // CRITICAL GUARD: Do not fetch leagues if user has no role yet
   if (!userRole) {
     authLogger.debug('Skipping league fetch - user has no role yet (awaiting /select-role)');
     return;
   }
   ```

2. **Removed "hot path" call with null role**:
   - OLD: `fetchLeaguesConcurrently(firebaseUser, null)` ❌
   - NEW: Skipped until role is confirmed ✅

3. **Updated all fetchLeagues calls to pass role**:
   - Fast exit path: `fetchLeaguesConcurrently(firebaseUser, cachedRoleQuick)`
   - Cached role path: `fetchLeaguesConcurrently(firebaseUser, cachedRole)`
   - Standard path: `fetchLeaguesConcurrently(firebaseUser, userRole)`

4. **Reduced retry attempts**: Changed from 3 attempts to 1 to prevent timeout cascades

### B) Fixed frontend API base URL

**File**: `frontend/src/lib/api.js`

Added production fallback logic:
```javascript
// If we're on the production domain, use the Render backend
if (hostname === 'woo-combine.com' || hostname === 'www.woo-combine.com') {
  return 'https://woo-combine-backend.onrender.com/api';
}
```

This ensures the frontend always knows where to find the backend, even without environment variables.

### C) Environment Variable Setup (RECOMMENDED)

To set `VITE_API_BASE` on Render for the frontend service:

1. Go to Render Dashboard → Your Frontend Service
2. Navigate to "Environment" tab
3. Add environment variable:
   - **Key**: `VITE_API_BASE`
   - **Value**: `https://woo-combine-backend.onrender.com/api`

**Note**: Vite only injects env vars at build time that start with `VITE_`. The code now includes a runtime fallback, so this is optional but recommended for clarity.

## Expected Behavior After Fix

### Before Fix:
```
1. User logs in → Firebase auth succeeds
2. AuthContext calls fetchLeagues(user, null) ← NO ROLE YET
3. Frontend hits /api/leagues/me with no role
4. Backend returns 404 (user not in any leagues yet OR no role)
5. Retry logic triggers → 3 attempts with delays
6. 404 cascade continues for 15+ seconds
7. User stuck on loading screen
```

### After Fix:
```
1. User logs in → Firebase auth succeeds
2. AuthContext skips league fetch (no role yet)
3. Backend checks /users/me → returns null role
4. Frontend redirects to /select-role
5. User selects role → role saved
6. AuthContext now calls fetchLeagues(user, 'organizer') ← WITH ROLE
7. Backend returns leagues (or empty array for new users)
8. User proceeds to dashboard ✅
```

## Testing Checklist

- [ ] New user signup → email verification → role selection → dashboard (no 404s)
- [ ] Existing user login → dashboard loads without delay
- [ ] User without leagues → proper "no leagues" state (not 404 cascade)
- [ ] Backend logs show single `/leagues/me` call (not repeated 404s)
- [ ] Cold start scenario still works (45s timeout allows for Render startup)

## Files Changed

1. `frontend/src/context/AuthContext.jsx` - Role guard and fetch timing fixes
2. `frontend/src/lib/api.js` - Production URL fallback

## Related Memories

This fix resolves the following documented issues:
- 404 errors on `/api/users/role` and `/leagues/me` during onboarding
- Timeout cascades causing 30-50 second delays
- Users stuck on loading screens after login

