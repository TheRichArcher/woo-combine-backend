# Admin Tools Route & 401 Logout Fix

**Date**: 2026-01-11  
**Build SHA**: 021d5ff → New build  
**Environment**: Production

## Issues Resolved

### 1. Blank `/admin-tools` Page (No Route Match)

**Problem:**
- Users navigating to `/admin-tools` encountered a completely blank page
- Browser console showed: `"No routes matched location '/admin-tools'"`
- The route was never defined in `App.jsx`

**Root Cause:**
- `App.jsx` only defined `/admin` route (line 198)
- `CoachDashboard.jsx` had 2 links pointing to `/admin-tools`:
  - Line 342: "Event Settings" button
  - Line 353: "Select or Create Event" button
- Route mismatch caused React Router to render nothing

**Solution:**
1. Added redirect route in `App.jsx`: `/admin-tools` → `/admin` (backward compatibility)
2. Updated both links in `CoachDashboard.jsx` to use `/admin` directly
3. Verified no other references to `/admin-tools` exist in codebase

**Files Changed:**
- `frontend/src/App.jsx` - Added `<Route path="/admin-tools" element={<Navigate to="/admin" replace />} />`
- `frontend/src/pages/CoachDashboard.jsx` - Changed 2 links from `/admin-tools` to `/admin`

---

### 2. Premature 401 Logout During Schema/Leagues Fetch

**Problem:**
- Multiple backend calls returned 401 during page load:
  - `/api/leagues/.../events/.../schema`
  - `/api/leagues/me`
  - `/api/leagues/.../events`
- Console showed: `"[API] Token refresh after 401 failed"`
- User immediately logged out and redirected to `/welcome` → `/login`

**Root Cause:**
The 401 handler in `api.js` was too aggressive:

1. **All 401s triggered logout**: Even schema 401s (which are often context mismatches)
2. **Insufficient error context**: Code couldn't distinguish between:
   - True auth failures (expired/invalid token)
   - Context mismatches (accessing event from wrong league)
   - Permission issues (valid auth, wrong role/scope)
3. **Token refresh failure = instant logout**: Any refresh error forced logout

**Technical Details:**

Schema 401s occur when:
- User switches leagues but `selectedEvent` in localStorage still references old league
- `EventContext` initializes with stale event
- Components like `CoachDashboard` (via `useDrills`) fetch schema with mismatched league/event IDs
- Backend correctly returns 401 (user doesn't have access to that event in current league)

The app **already handles this gracefully** with fallback templates, but the 401 interceptor was logging users out before the fallback could work.

**Solution:**

Enhanced 401 handling in `frontend/src/lib/api.js`:

```javascript
// 1. Schema-specific handling
if (isSchemaPath) {
  apiLogger.info('401 on schema endpoint - likely context mismatch, allowing component fallback');
  return Promise.reject(error); // Let component handle with fallback
}

// 2. Smarter refresh failure detection
.catch((refreshError) => {
  const refreshFailed = refreshError?.message?.includes('Token refresh unavailable') || 
                        !auth.currentUser;
  
  if (refreshFailed) {
    // Only logout on TRUE auth failures
    apiLogger.warn('Token refresh failed - forcing logout');
    // ... logout logic
  } else {
    // Permission issue, not auth failure
    apiLogger.info('401 after refresh but auth valid - likely permission/context issue');
  }
});

// 3. Only logout repeat 401s if no current user
if (!auth.currentUser) {
  // True auth failure
  apiLogger.warn('401 with no current user - forcing logout');
  // ... logout logic
} else {
  // User authenticated but 401 - permission/context issue
  apiLogger.info('401 with valid auth - likely permission or context mismatch');
}
```

**Key Improvements:**

1. **Schema 401s bypass logout**: Let components handle with fallback templates
2. **Distinguish refresh failures**: Only logout if token actually can't be refreshed
3. **Check current user**: Only logout if Firebase auth is truly invalid
4. **Better logging**: Clear context about why logout occurred (or didn't)

**Files Changed:**
- `frontend/src/lib/api.js` - Enhanced 401 error handling (lines 283-354)

---

## Testing

**Build Verification:**
```bash
✓ 3185 modules transformed
✓ built in 14.01s
No linter errors
```

**Test Cases:**

1. ✅ Navigate to `/admin-tools` → redirects to `/admin`
2. ✅ Click "Event Settings" in CoachDashboard → navigates to `/admin`
3. ✅ Schema 401 with stale event context → fallback template loads (no logout)
4. ✅ True auth failure (expired token) → token refresh → logout if refresh fails
5. ✅ Permission 401 with valid auth → error logged but no logout

---

## Related Documentation

- `docs/reports/SCHEMA_401_INVESTIGATION.md` - Background on schema 401 context mismatches
- `ENDPOINT_FIX_SUMMARY.md` - Previous API error handling improvements
- `frontend/src/hooks/useDrills.js` - Schema fetch with fallback handling

---

## Deployment Notes

**Pre-Deployment:**
- ✅ Build successful
- ✅ No linting errors
- ✅ All routes verified

**Post-Deployment Verification:**
1. Test `/admin-tools` URL → should redirect to `/admin`
2. Monitor logs for 401 patterns:
   - Should see: `"401 on schema endpoint - likely context mismatch"`
   - Should NOT see: Rapid logout loops
3. Verify users can access admin page without logout interruptions

**Rollback:**
If issues arise, revert commits:
- `App.jsx` - Remove admin-tools redirect route
- `CoachDashboard.jsx` - Revert to previous link paths
- `api.js` - Revert 401 handler changes

---

## Impact

**Severity**: P1 (Production-breaking)
- Users couldn't access admin tools (`/admin-tools` → blank page)
- Legitimate 401s caused unexpected logouts

**Risk**: Low
- Changes are surgical and well-scoped
- Build verified successfully
- Backward compatibility maintained (redirect route)

**User Experience:**
- ✅ Admin tools accessible via both `/admin` and `/admin-tools`
- ✅ No unexpected logouts during normal operation
- ✅ Schema context mismatches handled gracefully
- ✅ True auth failures still trigger proper logout

---

## Future Improvements

1. **EventContext Validation**: Add league ID validation when loading selectedEvent from localStorage (prevent schema 401s entirely)
2. **useDrills Guard**: Only fetch schema if event.league_id matches current league
3. **401 Metrics**: Track 401 patterns to distinguish infrastructure vs. application issues
4. **Route Audit**: Ensure all internal links use canonical routes (`/admin` not `/admin-tools`)

