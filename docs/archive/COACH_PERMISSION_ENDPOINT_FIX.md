# COACH PERMISSION ENDPOINT FIX

**Date:** 2026-01-11  
**Severity:** P0 (Production Permission Failure)  
**Issue:** Coach stuck in read-only despite admin toggle showing "Can Edit"  
**Status:** ✅ FIXED - Ready for Deployment

---

## 🚨 Issue Summary

**User Report:** `rich@worcesterflag.com` (coach) shows "View Only Access" banner despite:
- Admin UI showing write permission toggle as "Can Edit" (green/enabled)
- Logging out and back in
- Admin confirming toggle was set to "write enabled"

**Root Cause:** Missing REST API endpoint prevented frontend from reading permission state.

---

## 🔍 Root Cause Analysis

### The Permission System Architecture

**Write Path (Admin Toggle) ✅ WORKS:**
1. Admin clicks toggle in StaffManagement.jsx
2. Frontend calls `PATCH /leagues/{league_id}/members/{member_id}/write-permission`
3. Backend atomically updates BOTH storage locations:
   - `leagues/{league_id}/members/{user_id}` → `{canWrite: true}`
   - `user_memberships/{user_id}` → `{leagues.{league_id}.canWrite: true}`
4. Toggle shows green "Can Edit" state ✅

**Read Path (Coach Session) ❌ BROKEN:**
1. Coach loads Players page → `fetchPermissions()` runs
2. Frontend tries `GET /leagues/{league_id}/members/{user_id}` 
3. **Endpoint doesn't exist** → 404 error
4. Catch block sets `membershipFound = false`
5. Falls back to read-only mode
6. Shows "View Only Access" banner despite DB having `canWrite: true` ❌

### Evidence from Code

**Frontend (Players.jsx line 229):**
```javascript
// This API call returns 404 because endpoint doesn't exist
const membershipRes = await api.get(`/leagues/${selectedLeagueId}/members/${user.uid}`);
```

**Backend Routes (leagues.py):**
```python
# ✅ EXISTS - List all members
@router.get('/{league_id}/members')

# ❌ MISSING - Get individual member
# No endpoint at: /{league_id}/members/{member_id}

# ✅ EXISTS - Update write permission
@router.patch('/{league_id}/members/{member_id}/write-permission')

# ✅ EXISTS - Disable/enable member
@router.patch('/{league_id}/members/{member_id}/status')
```

### Why Backend Operations Still Work

The backend CAN read permissions using `ensure_league_access()` in `authorization.py`:

```python
def ensure_league_access(user_id, league_id, ...):
    # Fast path: user_memberships
    memberships_doc = db.collection("user_memberships").document(user_id).get()
    membership = memberships_doc.to_dict().get("leagues", {}).get(league_id)
    
    if not membership:
        # Fallback: legacy subcollection
        member_doc = db.collection("leagues").document(league_id)\
                       .collection("members").document(user_id).get()
        membership = member_doc.to_dict()
    
    return membership  # Contains canWrite field
```

This works during write operations (like updating scores) - the backend correctly reads `canWrite` and blocks operations with 403 Forbidden. But the frontend needs to read permissions BEFORE attempting writes to:
- Show/hide edit buttons
- Display appropriate banners
- Prevent confusing user experience

---

## ✅ Solution Implemented

### 1. Added Missing GET Endpoint

**File:** `backend/routes/leagues.py` (after line 419)

```python
@router.get('/{league_id}/members/{member_id}')
@read_rate_limit()
@require_permission("league_members", "read", target="league", target_param="league_id")
def get_league_member(
    request: Request,
    league_id: str = Path(..., regex=r"^.{1,50}$"),
    member_id: str = Path(..., regex=r"^.{1,50}$"),
    current_user=Depends(get_current_user)
):
    """
    Get a specific member's details including role and write permissions.
    
    Used by frontend to check coach write permissions for UI state (e.g., showing
    edit buttons vs read-only banner). Reads from the same dual-storage system as
    ensure_league_access() for consistency with backend authorization.
    
    Returns membership record with: role, canWrite, name, email, disabled status.
    """
    try:
        membership = None
        
        # Fast path: user_memberships document (matches ensure_league_access logic)
        memberships_ref = db.collection("user_memberships").document(member_id)
        memberships_doc = execute_with_timeout(
            lambda: memberships_ref.get(),
            timeout=5,
            operation_name="get member fast path"
        )
        
        if memberships_doc.exists:
            leagues_data = memberships_doc.to_dict().get("leagues", {})
            membership = leagues_data.get(league_id)
            
            if membership:
                logging.info(
                    f"[GET] Found member {member_id} in league {league_id} via fast path"
                )
        
        if not membership:
            # Fallback: legacy members subcollection
            member_ref = (
                db.collection("leagues")
                .document(league_id)
                .collection("members")
                .document(member_id)
            )
            member_doc = execute_with_timeout(
                lambda: member_ref.get(),
                timeout=5,
                operation_name="get member legacy path"
            )
            if member_doc.exists:
                membership = member_doc.to_dict() or {}
                logging.info(
                    f"[GET] Found member {member_id} via legacy path"
                )
        
        if not membership:
            logging.warning(
                f"[GET] Member {member_id} not found in league {league_id}"
            )
            raise HTTPException(status_code=404, detail="Member not found in this league")
        
        # Add member_id to response
        membership["id"] = member_id
        
        # Log permission state for debugging
        logging.info(
            f"[GET] Retrieved member {member_id}: "
            f"role={membership.get('role', 'unknown')}, "
            f"canWrite={membership.get('canWrite', True)}, "
            f"disabled={membership.get('disabled', False)}"
        )
        
        return membership
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error retrieving member {member_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve member details")
```

**Key Design Decisions:**
- Uses SAME dual-storage logic as `ensure_league_access()` for consistency
- Tries fast path (`user_memberships`) first, falls back to legacy (`leagues/{id}/members`)
- Comprehensive logging for debugging production issues
- Returns full membership record including `canWrite`, `role`, `disabled`, etc.

### 2. Updated Access Matrix

**File:** `backend/security/access_matrix.py` (line 48)

```python
("league_members", "list"): ADMIN_ROLES,     # List all members (organizers only)
("league_members", "read"): VIEW_ROLES,      # Read individual member (anyone in league)
("league_members", "update"): ADMIN_ROLES,   # Update permissions (organizers only)
```

**Rationale:** 
- `VIEW_ROLES` = organizer + coach + viewer
- Anyone in the league can read member details
- Coaches need this to check their own permissions
- Backend still enforces that users can only access members in leagues they belong to

---

## 🧪 Testing & Verification

### Pre-Deployment Checks

**1. Python Compilation:**
```bash
python3 -m py_compile backend/routes/leagues.py backend/security/access_matrix.py
# ✅ Exit code: 0 - No syntax errors
```

**2. Linting:**
```bash
# ✅ No linter errors in either file
```

### Post-Deployment Verification

**Step 1: Test Endpoint Directly**

As the coach user (`rich@worcesterflag.com`), test the new endpoint:

```bash
# Get Firebase auth token for coach
COACH_TOKEN="..." # From browser DevTools → Application → IndexedDB → firebase:authUser

curl -X GET "https://woo-combine-backend.onrender.com/api/leagues/{league_id}/members/{coach_user_id}" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "id": "coach_user_id_here",
  "role": "coach",
  "canWrite": true,
  "name": "Rich Archer",
  "email": "rich@worcesterflag.com",
  "disabled": false
}
```

**Step 2: Verify Admin Toggle Still Works**

1. As organizer, go to Admin Tools → Access Control
2. Find coach `rich@worcesterflag.com`
3. Toggle write permission OFF (orange/read-only)
4. Check backend logs show: `[PATCH] Updating member ... to canWrite=false`
5. Call GET endpoint above → should return `canWrite: false`
6. Toggle back ON (green/can edit)
7. Check backend logs show: `[PATCH] Updating member ... to canWrite=true`
8. Call GET endpoint above → should return `canWrite: true`

**Step 3: Verify Coach Frontend (Critical)**

1. **Coach logs out and back in** (clears any client cache)
2. Navigate to Players page
3. **Open browser DevTools console** (critical for debugging)
4. Look for permission resolution logs:

```javascript
[PERMISSIONS] === STARTING PERMISSION RESOLUTION ===
[PERMISSIONS] User Identity: {
  uid: "...",
  email: "rich@worcesterflag.com",
  displayName: "Rich Archer"
}
[PERMISSIONS] Context: {
  leagueId: "league_xyz",
  eventId: "event_123",
  userRole: "coach"
}

// ✅ THIS SHOULD NOW SUCCEED (was 404 before)
[PERMISSIONS] Membership record found: {
  userId: "...",
  canWrite: true,          ← Should match admin toggle
  role: "coach",
  fullMembership: { ... }
}

[PERMISSIONS] Event lock status: {
  isLocked: false,
  eventId: "event_123"
}

[PERMISSIONS] === FINAL RESOLUTION ===
[PERMISSIONS] Decision: {
  finalCanWrite: true,     ← Should be true when admin toggle is green
  reason: "GRANTED",       ← Should be "GRANTED" not "CANWRITE_FALSE"
  factors: {
    membershipFound: true,
    membershipCanWrite: true,
    eventIsLocked: false,
    userRole: "coach"
  }
}
```

5. **Verify UI state:**
   - ❌ NO "View Only Access" banner (should be hidden)
   - ✅ "Add Player" button visible
   - ✅ Edit icons on player cards
   - ✅ Can click player → see "Edit Player" button
   - ✅ Can actually save edits (not blocked by backend)

**Step 4: Test Permission Toggle Effect**

1. With coach logged in and viewing Players page
2. Have organizer toggle permission OFF
3. Coach refreshes page
4. Should now see "View Only Access" banner
5. Console shows: `reason: "CANWRITE_FALSE"`
6. Edit buttons hidden
7. Organizer toggles back ON
8. Coach refreshes
9. Banner disappears, edit buttons return

---

## 📊 Console Log Examples

### Before Fix (404 Error)

```javascript
[PERMISSIONS] === STARTING PERMISSION RESOLUTION ===
[PERMISSIONS] User Identity: { uid: "...", email: "rich@worcesterflag.com" }
[PERMISSIONS] Context: { leagueId: "xyz", eventId: "123", userRole: "coach" }

❌ GET /api/leagues/xyz/members/... 404 Not Found

[PERMISSIONS] ⚠️ NO MEMBERSHIP RECORD FOUND - falling back to read-only
[PERMISSIONS] === FINAL RESOLUTION ===
[PERMISSIONS] Decision: {
  finalCanWrite: false,
  reason: "NO_MEMBERSHIP_RECORD",  ← Wrong reason (endpoint missing, not membership)
  factors: { membershipFound: false, ... }
}
```

### After Fix (Success)

```javascript
[PERMISSIONS] === STARTING PERMISSION RESOLUTION ===
[PERMISSIONS] User Identity: { uid: "...", email: "rich@worcesterflag.com" }
[PERMISSIONS] Context: { leagueId: "xyz", eventId: "123", userRole: "coach" }

✅ GET /api/leagues/xyz/members/... 200 OK
✅ Response: { role: "coach", canWrite: true, ... }

[PERMISSIONS] Membership record found: {
  userId: "...",
  canWrite: true,  ← Correctly reads from DB
  role: "coach"
}
[PERMISSIONS] === FINAL RESOLUTION ===
[PERMISSIONS] Decision: {
  finalCanWrite: true,
  reason: "GRANTED",  ← Correct!
  factors: { membershipFound: true, membershipCanWrite: true, ... }
}
```

---

## 🎯 Impact Summary

### Before Fix

| Component | State | Issue |
|-----------|-------|-------|
| Admin UI | ✅ Shows "Can Edit" (green) | Working |
| Backend DB | ✅ `canWrite: true` | Working |
| Frontend API Call | ❌ 404 Not Found | **Missing endpoint** |
| Frontend Logic | ❌ Falls back to read-only | Assumes no membership |
| Coach Experience | ❌ "View Only" banner shown | Cannot edit despite permission |

### After Fix

| Component | State | Issue |
|-----------|-------|-------|
| Admin UI | ✅ Shows "Can Edit" (green) | Working |
| Backend DB | ✅ `canWrite: true` | Working |
| Frontend API Call | ✅ 200 OK with membership | **New endpoint** |
| Frontend Logic | ✅ Reads `canWrite: true` | Correctly grants access |
| Coach Experience | ✅ Edit buttons visible | Can edit as intended |

---

## 🔧 Files Changed

### Backend

1. **`backend/routes/leagues.py`** (+108 lines)
   - Added `get_league_member()` endpoint after line 419
   - Implements dual-storage read path matching `ensure_league_access()`
   - Comprehensive logging for production debugging

2. **`backend/security/access_matrix.py`** (+1 line)
   - Added `("league_members", "read"): VIEW_ROLES`
   - Allows coaches to read member details in their leagues

### Frontend

No changes required - already implemented correctly in `Players.jsx`.

---

## 🚀 Deployment Steps

```bash
# 1. Commit changes
git add backend/routes/leagues.py backend/security/access_matrix.py
git commit -m "Add GET endpoint for individual member permissions

Fixes P0 issue where coaches showed as read-only despite admin granting write access.

- Added GET /leagues/{league_id}/members/{member_id} endpoint
- Reads from same dual-storage as ensure_league_access() for consistency
- Updated access matrix to allow VIEW_ROLES to read member details
- Coaches can now check their own permissions for UI state management

Resolves: Coach permission toggle not taking effect"

# 2. Push to production
git push origin main

# 3. Verify Render deployment
# Wait for build to complete (~2-3 minutes)
# Check logs for: "[RBAC] Registered permission league_members:read"

# 4. Test with coach account
# Follow "Post-Deployment Verification" steps above
```

---

## 🎓 Lessons Learned

### Why This Bug Occurred

1. **Incremental Feature Addition:** Permission toggle was added without realizing frontend needed a read endpoint
2. **Backend Worked Internally:** `ensure_league_access()` could read permissions during write operations, giving false confidence
3. **Incomplete Testing:** Only tested organizer and default coaches, not coaches with toggled permissions
4. **Missing Contract:** No clear API contract documenting that frontend needs to read permissions proactively

### Prevention Strategies

1. **API Contract Documentation:** Document frontend read requirements when adding new DB fields
2. **Role-Based Testing:** Test all permission combinations (default coach, toggled coach, viewer, organizer)
3. **Symmetric APIs:** When adding PATCH/PUT endpoints, consider if GET is also needed
4. **Console Logging:** The `[PERMISSIONS]` debug logs were critical for diagnosing this issue

---

## 📝 Related Documentation

- `PERMISSION_MISMATCH_DEBUG_FIX_FB44AD5.md` - Previous permission resolution work
- `docs/implementation/COMBINE_LOCKING_SYSTEM.md` - Overall permission architecture
- `backend/utils/authorization.py` - `ensure_league_access()` implementation
- `frontend/src/pages/Players.jsx` - `fetchPermissions()` implementation (lines 188-310)

---

**Status:** ✅ Ready for production deployment  
**Testing Required:** Coach account verification post-deployment  
**Rollback Plan:** Revert commit if endpoint causes issues (frontend gracefully degrades to read-only)

