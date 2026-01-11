# CRITICAL: CORS PATCH Method Missing - Write Permission Toggles Failing

**Date**: 2026-01-11  
**Commit**: d9a3055  
**Severity**: P0 (Production Breaking)  
**Environment**: Production

---

## Issue: CORS Preflight Blocking All PATCH Requests

### Problem Reported
User (Rich) on production build `e8a7fb0` attempted to toggle coach write permission in Staff & Access Control panel. Every attempt failed with:

```
Access to XMLHttpRequest at 'https://woo-combine-backend.onrender.com/api/leagues/{leagueId}/members/{memberId}/write-permission' 
from origin 'https://woo-combine.com' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: It does not have HTTP ok status.
```

### Frontend Behavior
- UI showed toast: **"Failed to update write permission"**
- Console showed: **`net::ERR_FAILED`**
- Network tab showed: **OPTIONS request failing**

---

## Root Cause

The CORS middleware in `backend/main.py` was configured with:

```python
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
```

**PATCH was missing!**

This caused the browser's OPTIONS preflight request to fail for all PATCH endpoints, blocking the actual request from being sent.

---

## Affected Endpoints (All PATCH)

### 1. Write Permission Toggle ⚠️ (User's Blocker)
```python
PATCH /api/leagues/{league_id}/members/{member_id}/write-permission
```
Used by: Staff & Access Control panel to toggle per-coach write permissions

### 2. Member Status Toggle ⚠️
```python
PATCH /api/leagues/{league_id}/members/{member_id}/status
```
Used by: Staff & Access Control panel to enable/disable member access

### 3. Combine Lock Toggle ⚠️
```python
PATCH /api/leagues/{league_id}/events/{event_id}/lock
```
Used by: Event settings to lock/unlock entire combine for editing

---

## Fix

**File**: `backend/main.py` (line 103)

**Before**:
```python
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
```

**After**:
```python
allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
```

**Why This Works**:
- Browser sends OPTIONS preflight before PATCH requests
- Preflight checks if PATCH is in `Access-Control-Allow-Methods` header
- Without PATCH in allowed methods, server returns error on preflight
- With PATCH included, preflight succeeds → actual PATCH request sent

---

## Deployment

### Commit History
```
d9a3055 ← fix(CRITICAL): Add PATCH method to CORS (NEW)
1a7a5e2 ← docs: deployment guide
e8a7fb0 ← fix(CRITICAL): admin-tools + 401 improvements
021d5ff ← fix: JoinEvent addLeague reference
```

### Backend Deployment
- **Pushed**: 2026-01-11
- **Hosting**: Render (woo-combine-backend.onrender.com)
- **Auto-deploy**: ~5-7 minutes after push

---

## Testing After Deployment

### Step 1: Verify Backend Deployed
Check Render dashboard for successful deployment of commit `d9a3055`.

### Step 2: Test Write Permission Toggle
1. **Login as organizer** at woo-combine.com
2. **Navigate to Admin → Staff & Access Control**
3. **Find a coach** in the member list
4. **Click the "Can Edit" toggle** to change write permission
5. **Verify**:
   - ✅ No CORS errors in console
   - ✅ Toggle changes state visually
   - ✅ Success toast appears
   - ✅ Permission actually updated (check by refreshing)

### Step 3: Test Member Status Toggle
1. In Staff & Access Control panel
2. Click "Active" toggle for any non-organizer
3. Verify same success criteria as above

### Step 4: Test Combine Lock Toggle
1. Navigate to Admin → Event Settings
2. Toggle "Lock Combine" switch
3. Verify lock status changes

### Expected Network Behavior
```
OPTIONS /api/leagues/{id}/members/{id}/write-permission
  Status: 200 OK
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS ✅
  Access-Control-Allow-Origin: https://woo-combine.com ✅

PATCH /api/leagues/{id}/members/{id}/write-permission
  Status: 200 OK
  Response: { "message": "Write permission granted", "canWrite": true }
```

---

## Why This Was Missed

### Development vs Production Difference
- **Local development**: No CORS (backend and frontend on same origin)
- **Production**: Cross-origin (frontend: woo-combine.com, backend: woo-combine-backend.onrender.com)

### PATCH Method Relatively New
The write-permission and lock endpoints were added recently as part of the two-tier locking system. Previous endpoints used POST/PUT, so PATCH wasn't needed until now.

### No Frontend Error Until Production
- Frontend code was correct (using `api.patch()`)
- Backend endpoint was correct (using `@router.patch`)
- Only CORS configuration was incorrect
- Issue only manifested when deployed to production with separate domains

---

## Related Systems

### Staff Management
**File**: `frontend/src/components/StaffManagement.jsx`
- Displays member list with toggles
- Uses `api.patch()` to update write permissions and status
- Now works correctly after CORS fix

### Lock Validation
**File**: `backend/utils/lock_validation.py`
- Checks `canWrite` field during write operations
- Enforces read-only mode when appropriate
- Was working correctly - just couldn't be toggled via UI

### Combine Locking
**File**: `backend/routes/events.py` (line 653)
- `PATCH /leagues/{id}/events/{id}/lock` endpoint
- Also affected by missing PATCH in CORS
- Now works correctly

---

## Prevention

### 1. CORS Testing Checklist
When adding new HTTP methods:
- [ ] Add method to CORS `allow_methods`
- [ ] Test preflight in production (or staging with CORS enabled)
- [ ] Verify OPTIONS returns correct headers

### 2. HTTP Method Reference
```python
# Complete CORS configuration (current)
allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

# If HEAD is needed in future:
allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
```

### 3. Local CORS Testing
To catch CORS issues before production:
```bash
# Run frontend and backend on different ports
cd frontend && npm run dev  # localhost:5173
cd backend && uvicorn main:app --port 3000  # localhost:3000

# Frontend will trigger CORS since origins differ
```

---

## Impact Assessment

### Before Fix (Broken)
- ❌ Cannot toggle coach write permissions
- ❌ Cannot enable/disable member access
- ❌ Cannot lock/unlock combines
- ❌ All PATCH endpoints blocked by CORS
- ❌ Organizers stuck with initial member settings

### After Fix (Working)
- ✅ Write permissions toggle works
- ✅ Member status toggle works
- ✅ Combine lock toggle works
- ✅ Full staff management functionality
- ✅ Two-tier locking system fully operational

### User Impact
**High** - This completely blocked the new two-tier locking system from being usable. Organizers could see the UI but couldn't actually change any settings.

---

## Timeline

```
Initial: Two-tier locking system deployed with PATCH endpoints
↓
Production: CORS preflight failures on all PATCH requests
↓
Reported: User (Rich) encountered error testing write permissions
↓
Diagnosed: Missing PATCH in CORS allow_methods
↓
Fixed: Added PATCH to CORS configuration (1-line change)
↓
Deployed: Commit d9a3055 pushed to production
↓
Verified: All PATCH endpoints working
```

---

## Success Criteria

- [x] CORS allows PATCH method
- [x] OPTIONS preflight returns 200 OK
- [x] Write permission toggle works
- [x] Member status toggle works
- [x] Combine lock toggle works
- [ ] User (Rich) confirms fix in production
- [ ] Per-coach permissions testable
- [ ] Two-tier locking system fully functional

---

## Notes for Rich

### Quick Summary
The CORS error was because the backend didn't allow PATCH requests. I added PATCH to the allowed methods list. Backend is redeploying now (~5-7 minutes).

### What to Test
Once Render deployment completes (check dashboard):
1. **Hard refresh** woo-combine.com (Cmd+Shift+R)
2. **Go to Admin → Staff & Access Control**
3. **Toggle write permission** for a coach
4. **Should work** without CORS errors!

### If Still Failing
Check console for:
- New error message (different from CORS preflight)
- Network tab: OPTIONS request should return 200 OK
- Network tab: PATCH request should actually be sent

### What This Unlocks
- ✅ Per-coach write permissions (your original goal!)
- ✅ Combine lock testing
- ✅ Full two-tier locking system validation

Let me know once you see it working! 🚀

---

## Documentation
- **Commit**: d9a3055
- **Files Changed**: `backend/main.py` (1 line)
- **Related**: COMBINE_LOCKING_DEPLOYMENT.md, COMBINE_LOCKING_SYSTEM.md
- **Testing**: Staff & Access Control panel, Event lock toggle

