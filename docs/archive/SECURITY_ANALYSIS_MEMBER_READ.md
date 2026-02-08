# COACH PERMISSION FIX - SECURITY ANALYSIS

**Date:** 2026-01-11  
**Issue:** Access control verification for new GET endpoint  
**Status:** ⚠️ SECURITY GAP IDENTIFIED - FIX REQUIRED

---

## ANALYSIS SUMMARY

### ✅ What's Correct
1. Frontend/backend identifier match (Firebase UID)
2. Endpoint exists and returns correct data
3. Basic league membership verification works

### ⚠️ What Needs Fixing
1. **Coaches can read other coaches' permissions** (privacy leak)
2. **Role check is incomplete** (global role vs league role)

---

## 1️⃣ Frontend Identifier Match ✅ CORRECT

**Frontend:** `user.uid` (Firebase UID)  
**Backend:** `member_id` (Firebase UID)  
**Storage:** Both paths use Firebase UID as document key

**Verdict:** Perfect match - no 404 risk from ID mismatch

---

## 2️⃣ Access Control ⚠️ SECURITY GAP

### Current Implementation

```python
@router.get('/{league_id}/members/{member_id}')
@require_permission("league_members", "read", target="league", target_param="league_id")
# Allows: VIEW_ROLES (organizer, coach, viewer)
```

### What It Currently Checks

✅ User is authenticated (Firebase JWT valid)  
✅ User is a member of the league  
✅ User has VIEW_ROLES (organizer/coach/viewer)  
❌ **Does NOT check if coach is reading their own record**

### Security Gap

**Scenario:**
- Coach A (rich@worcesterflag.com) 
- Coach B (another@coach.com)
- Both in same league

**Current behavior:**
```bash
# Coach A can read Coach B's permissions
GET /leagues/{league_id}/members/{coach_b_uid}
Authorization: Bearer {coach_a_token}

Response 200: {
  "role": "coach",
  "canWrite": false,  ← Coach A sees Coach B is read-only
  "disabled": true    ← Coach A sees Coach B is disabled
}
```

**Risk Level:** Low-Medium
- Coaches can enumerate other members' permission states
- Could be used to identify who has edit vs read-only access
- Privacy concern but no data modification risk

---

## ✅ SOLUTION: Add Self-Read Enforcement

### Option A: Simple Check (Recommended)

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
    """Get member details. Coaches can only read their own; organizers can read any."""
    
    # SECURITY: Verify organizer status by checking league membership
    # We can't use current_user["role"] because that's GLOBAL role, not league-specific
    # A user can be organizer in League A but coach in League B
    
    try:
        # Get current user's membership in THIS league
        current_user_membership = None
        memberships_ref = db.collection("user_memberships").document(current_user["uid"])
        memberships_doc = execute_with_timeout(
            lambda: memberships_ref.get(),
            timeout=5,
            operation_name="check current user league role"
        )
        
        if memberships_doc.exists:
            leagues_data = memberships_doc.to_dict().get("leagues", {})
            current_user_membership = leagues_data.get(league_id)
        
        if not current_user_membership:
            # Fallback to legacy
            member_ref = db.collection("leagues").document(league_id)\
                          .collection("members").document(current_user["uid"])
            member_doc = execute_with_timeout(
                lambda: member_ref.get(),
                timeout=5,
                operation_name="check current user legacy role"
            )
            if member_doc.exists:
                current_user_membership = member_doc.to_dict()
        
        current_user_league_role = current_user_membership.get("role") if current_user_membership else None
        
        # AUTHORIZATION CHECK
        if current_user_league_role != "organizer":
            # Non-organizers can only read their own membership
            if current_user["uid"] != member_id:
                logging.warning(
                    f"[SECURITY] User {current_user['uid']} (league role: {current_user_league_role}) "
                    f"attempted to read member {member_id}'s permissions without authorization"
                )
                raise HTTPException(
                    status_code=403,
                    detail="You can only view your own permission details. Contact an organizer if you need to see other members' information."
                )
        
        # ... rest of existing code to fetch and return membership
```

### Option B: Create Separate Endpoints (Over-Engineering)

```python
# Self-read endpoint (any member)
@router.get('/{league_id}/members/me')
def get_my_membership(...):
    member_id = current_user["uid"]
    # ... fetch membership

# Admin-read endpoint (organizers only)  
@router.get('/{league_id}/members/{member_id}')
@require_permission("league_members", "admin_read", target="league", ...)
def get_any_membership(...):
    # ... organizers can read anyone
```

**Verdict:** Option A is better - single endpoint with role-based logic

---

## 3️⃣ Permission Resolver Verification ✅ CORRECT

### Frontend Code (Players.jsx lines 224-238)

```javascript
// Fetch membership to get canWrite permission
try {
  const membershipRes = await api.get(`/leagues/${selectedLeagueId}/members/${user.uid}`);
  //                                                   ✅ NEW ENDPOINT ✅
  membershipFound = true;
  membershipCanWrite = membershipRes.data?.canWrite !== undefined 
                        ? membershipRes.data.canWrite 
                        : true;
  
  console.log('[PERMISSIONS] Membership record found:', {
    userId: user.uid,
    canWrite: membershipCanWrite,
    role: membershipRes.data?.role,
    fullMembership: membershipRes.data
  });
} catch (err) {
  if (err.response?.status === 404) {
    membershipFound = false;
    membershipCanWrite = false;
  }
}
```

**Verdict:** ✅ Frontend calls the correct new endpoint and handles responses properly

---

## 4️⃣ Production Verification Checklist

### Backend Verification

```bash
# Test as coach (self-read should work)
curl -X GET \
  "https://woo-combine-backend.onrender.com/api/leagues/{league_id}/members/{coach_uid}" \
  -H "Authorization: Bearer {coach_token}"

Expected: 200 OK
{
  "id": "coach_uid",
  "role": "coach",
  "canWrite": true,
  "name": "Rich Archer",
  "email": "rich@worcesterflag.com"
}
```

```bash
# Test as coach reading another coach (should fail with fix)
curl -X GET \
  "https://woo-combine-backend.onrender.com/api/leagues/{league_id}/members/{other_coach_uid}" \
  -H "Authorization: Bearer {coach_token}"

Expected (after fix): 403 Forbidden
{
  "detail": "You can only view your own permission details..."
}
```

```bash
# Test as organizer reading any coach (should work)
curl -X GET \
  "https://woo-combine-backend.onrender.com/api/leagues/{league_id}/members/{any_coach_uid}" \
  -H "Authorization: Bearer {organizer_token}"

Expected: 200 OK
{
  "id": "any_coach_uid",
  "role": "coach",
  "canWrite": false,
  ...
}
```

### Frontend Verification

1. Coach logs in and navigates to Players page
2. Open DevTools console
3. Look for:

```javascript
[PERMISSIONS] === STARTING PERMISSION RESOLUTION ===
[PERMISSIONS] Membership record found: {  // ✅ No 404
  canWrite: true,
  role: "coach"
}
[PERMISSIONS] === FINAL RESOLUTION ===
[PERMISSIONS] Decision: {
  finalCanWrite: true,
  reason: "GRANTED"  // ✅ Not "NO_MEMBERSHIP_RECORD"
}
```

4. Verify UI:
   - ❌ NO "View Only" banner
   - ✅ Edit buttons visible

---

## 5️⃣ Troubleshooting Guide

### Banner Still Shows After Deploy

**Most Likely Causes:**

#### A. Frontend Cache
```bash
# Clear browser cache
Ctrl+Shift+R (hard refresh)
# Or
Settings → Clear browsing data → Cached images and files
```

#### B. Wrong League/Event Context
```javascript
// Check console logs
[PERMISSIONS] Context: {
  leagueId: "...",  // ← Verify this matches admin UI
  eventId: "...",   // ← Verify this matches admin UI
  userRole: "coach"
}
```

#### C. Deployment Not Complete
```bash
# Check Render dashboard
Status: "Live" (green)
# Check logs
[RBAC] Registered permission league_members:read for ...
```

#### D. Member ID Type Mismatch (Unlikely but possible)
```bash
# If you see 404 in Network tab:
GET /api/leagues/{id}/members/{uid} → 404

# Check backend logs:
[GET] Member {uid} not found in league {id} (neither fast nor legacy path)

# This means membership doesn't exist - verify in Firebase:
user_memberships/{uid}/leagues/{league_id}
# OR
leagues/{league_id}/members/{uid}
```

---

## 🚨 IMMEDIATE ACTION REQUIRED

### Security Fix

The current implementation allows coaches to read other coaches' permissions. While low-risk, this should be fixed:

**File:** `backend/routes/leagues.py`  
**Function:** `get_league_member()` (line 425)  
**Add:** League-specific role check and self-read enforcement (see Option A above)

### Testing Priorities

1. **Critical:** Coach self-read works (fixes original issue)
2. **Important:** Coach cross-read blocked (security)
3. **Important:** Organizer can read any member (admin UI)
4. **Nice-to-have:** Viewer self-read works

---

## 📋 DEPLOYMENT RECOMMENDATION

### Current Status
- ✅ Fix deployed: GET endpoint exists
- ✅ Original issue resolved: Coaches can read their own permissions
- ⚠️ Security gap: Coaches can read others' permissions

### Options

**Option 1: Deploy security fix immediately (Recommended)**
- Add self-read enforcement to existing endpoint
- Test all scenarios
- Deploy as hotfix

**Option 2: Monitor and fix later**
- Current implementation fixes the urgent issue (coach read-only)
- Security gap is low-risk (no data modification)
- Can be addressed in next sprint

**Recommendation:** Option 1 - Add security fix now since we're already deploying

---

**Next Steps:**
1. Add self-read enforcement to `get_league_member()`
2. Test with curl (self-read, cross-read, organizer-read)
3. Commit and deploy
4. Verify in production with coach account

---

**Files to Update:**
- `backend/routes/leagues.py` - Add role check in `get_league_member()`

**Estimated Time:** 15 minutes (implementation + testing)

