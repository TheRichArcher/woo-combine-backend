# COACH READ-ONLY PERMISSION BUG - DIAGNOSTIC REPORT

**Date:** 2026-01-11  
**Severity:** P0 (Production Permission Failure)  
**User:** rich@worcesterflag.com (coach)  
**Status:** ⚠️ ROOT CAUSE IDENTIFIED

---

## 🚨 CRITICAL ISSUE FOUND

### The Problem

**Admin Toggle Works ✅** → Writes to both:
1. `leagues/{league_id}/members/{user_id}` → `canWrite: true`
2. `user_memberships/{user_id}` → `leagues.{league_id}.canWrite: true`

**Coach Session FAILS ❌** → Cannot read the permission because:
**THE GET ENDPOINT DOESN'T EXIST**

---

## 🔍 Evidence

### Frontend Code (Players.jsx line 229)

```javascript
// ❌ THIS API CALL FAILS WITH 404
const membershipRes = await api.get(`/leagues/${selectedLeagueId}/members/${user.uid}`);
```

### Backend Routes Analysis

**EXISTS:**
- ✅ `GET /leagues/{league_id}/members` - List ALL members (line 393-419)
- ✅ `PATCH /leagues/{league_id}/members/{member_id}/write-permission` - Toggle write (line 489-575)
- ✅ `PATCH /leagues/{league_id}/members/{member_id}/status` - Disable/enable (line 421-486)

**MISSING:**
- ❌ `GET /leagues/{league_id}/members/{member_id}` - **DOES NOT EXIST**

### What Happens Now

1. Admin toggles write permission → Backend PATCH succeeds → Both DB locations updated ✅
2. Coach logs in → `Players.jsx` calls `fetchPermissions()` ✅
3. Frontend calls `GET /leagues/{league_id}/members/{user_id}` → **404 NOT FOUND** ❌
4. 404 error caught → `membershipFound = false` → Falls back to read-only ❌
5. Coach sees "View Only Access" banner despite having `canWrite: true` in DB ❌

---

## 📊 Backend Read Path (Authorization Layer)

The backend CAN read permissions using `ensure_league_access()` in `authorization.py`:

```python
# backend/utils/authorization.py line 52-79
def ensure_league_access(user_id, league_id, ...):
    # Fast path: user_memberships document
    memberships_ref = db.collection("user_memberships").document(user_id)
    memberships_doc = memberships_ref.get()
    
    if memberships_doc.exists:
        leagues_data = memberships_doc.to_dict().get("leagues", {})
        membership = leagues_data.get(league_id)  # ✅ Contains canWrite
    
    if not membership:
        # Fallback: legacy members subcollection
        member_ref = db.collection("leagues").document(league_id) \
                       .collection("members").document(user_id)
        member_doc = member_ref.get()
        membership = member_doc.to_dict()  # ✅ Contains canWrite
    
    return membership  # Returns full membership including canWrite
```

**This works internally** - but there's no REST endpoint exposing it to the frontend!

---

## ✅ SOLUTION

### Add Missing GET Endpoint

Create `GET /leagues/{league_id}/members/{member_id}` that returns the membership record:

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
    
    Used by frontend to check coach write permissions for UI state.
    Reads from same dual-storage system as ensure_league_access().
    """
    try:
        # Use the SAME logic as ensure_league_access for consistency
        membership = None
        
        # Fast path: user_memberships document
        memberships_ref = db.collection("user_memberships").document(member_id)
        memberships_doc = execute_with_timeout(
            lambda: memberships_ref.get(),
            timeout=5,
            operation_name="get member fast path"
        )
        
        if memberships_doc.exists:
            leagues_data = memberships_doc.to_dict().get("leagues", {})
            membership = leagues_data.get(league_id)
        
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
        
        if not membership:
            raise HTTPException(status_code=404, detail="Member not found in this league")
        
        # Add member_id to response for frontend
        membership["id"] = member_id
        
        logging.info(
            f"[GET] Retrieved member {member_id} from league {league_id}: "
            f"role={membership.get('role')}, canWrite={membership.get('canWrite', True)}"
        )
        
        return membership
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error retrieving league member: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve member details")
```

---

## 🧪 Testing Instructions

### 1. Verify Admin Toggle Writes to DB

```bash
# Check both storage locations after admin toggles
firebase firestore:read leagues/{league_id}/members/{user_id}
# Should show: canWrite: true

firebase firestore:read user_memberships/{user_id}
# Should show: leagues.{league_id}.canWrite: true
```

### 2. Test New GET Endpoint

```bash
curl -X GET "https://woo-combine-backend.onrender.com/api/leagues/{league_id}/members/{user_id}" \
  -H "Authorization: Bearer {coach_token}"

# Expected response:
{
  "id": "user_id",
  "role": "coach",
  "canWrite": true,
  "name": "Rich Archer",
  "email": "rich@worcesterflag.com",
  "disabled": false
}
```

### 3. Verify Coach Frontend Logs

After deploying the fix, coach should see in console:

```
[PERMISSIONS] === STARTING PERMISSION RESOLUTION ===
[PERMISSIONS] User Identity: {
  uid: "...",
  email: "rich@worcesterflag.com"
}
[PERMISSIONS] Context: {
  leagueId: "...",
  eventId: "...",
  userRole: "coach"
}
[PERMISSIONS] Membership record found: {
  userId: "...",
  canWrite: true,          ← Now reads correct value
  role: "coach",
  fullMembership: { ... }
}
[PERMISSIONS] Event lock status: {
  isLocked: false
}
[PERMISSIONS] === FINAL RESOLUTION ===
[PERMISSIONS] Decision: {
  finalCanWrite: true,     ← ✅ GRANTED
  reason: "GRANTED",
  factors: {
    membershipFound: true,
    membershipCanWrite: true,
    eventIsLocked: false,
    userRole: "coach"
  }
}
```

---

## 📋 Deployment Checklist

- [ ] Add `GET /leagues/{league_id}/members/{member_id}` endpoint to `backend/routes/leagues.py`
- [ ] Test endpoint with coach credentials in production
- [ ] Verify admin toggle still works (PATCH endpoint)
- [ ] Have coach logout/login and verify "View Only" banner disappears
- [ ] Verify coach can now edit players and scores
- [ ] Check console logs show `reason: "GRANTED"`

---

## 🎯 Impact

**Before Fix:**
- Admin UI shows toggle as "Can Edit" (green) ✅
- Backend DB has `canWrite: true` ✅  
- Coach frontend calls missing endpoint → 404 ❌
- Frontend assumes no membership → falls back to read-only ❌
- Coach cannot edit despite having permission ❌

**After Fix:**
- Admin UI shows toggle as "Can Edit" (green) ✅
- Backend DB has `canWrite: true` ✅
- Coach frontend calls NEW endpoint → 200 with membership data ✅
- Frontend reads `canWrite: true` → grants edit access ✅
- Coach can edit players and scores ✅

---

## 🔧 Root Cause

The permission toggle feature was implemented with:
- ✅ Admin UI (frontend)
- ✅ PATCH endpoint (write path)
- ✅ Dual-storage write logic
- ✅ Backend authorization layer reads correctly for API operations

But **missing**:
- ❌ GET endpoint for frontend to read permissions proactively

The backend CAN read permissions (via `ensure_league_access`) but only does so DURING write operations when rejecting them. The frontend needs to read permissions BEFORE attempting writes to hide UI elements appropriately.

---

## 💡 Why This Wasn't Caught Earlier

1. **Organizers always have full access** - They never hit this code path
2. **Viewers explicitly blocked** - They're caught by `userRole === 'viewer'` check before API call
3. **Backend enforcement works** - Coaches get 403 when trying to write (catches at operation time)
4. **Only affects coaches with toggled permissions** - Coaches with default `canWrite: true` still fail the same way, but it's expected for read-only coaches

The symptom (read-only banner) matches expected behavior for read-only coaches, so it appeared to "work" until someone tried to grant a read-only coach write access and found it didn't take effect.

---

**Next Action:** Implement the GET endpoint and deploy to production.

