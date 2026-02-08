# PRODUCTION TESTING GUIDE - Coach Permission Fix

**Deploy SHA:** f462baa  
**Date:** 2026-01-11  
**Issue:** Coach read-only despite admin toggle

---

## ✅ DEPLOYED SUCCESSFULLY

Changes pushed to `main` branch and deploying to Render backend.

---

## 🧪 IMMEDIATE TESTING STEPS

### Step 1: Wait for Render Deployment

1. Go to: https://dashboard.render.com
2. Check backend service deployment status
3. Wait for "Live" status (~2-3 minutes)
4. Check deploy logs for: `[RBAC] Registered permission league_members:read`

### Step 2: Test New Endpoint Directly

**Coach Credentials:** `rich@worcesterflag.com`

```bash
# From browser DevTools console (to get auth token):
firebase.auth().currentUser.getIdToken().then(token => console.log(token))

# Test the new endpoint:
curl -X GET \
  "https://woo-combine-backend.onrender.com/api/leagues/{LEAGUE_ID}/members/{USER_ID}" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "id": "user_id",
  "role": "coach",
  "canWrite": true,
  "name": "Rich Archer",
  "email": "rich@worcesterflag.com",
  "disabled": false
}
```

### Step 3: Coach Session Test (CRITICAL)

1. **Coach logs out completely** from woo-combine.com
2. **Coach logs back in**
3. Navigate to Players page
4. **Open DevTools Console** (F12 → Console tab)

**Look for these logs:**

```javascript
✅ SUCCESS PATTERN:
[PERMISSIONS] === STARTING PERMISSION RESOLUTION ===
[PERMISSIONS] Membership record found: {
  canWrite: true,  ← Should be true
  role: "coach"
}
[PERMISSIONS] === FINAL RESOLUTION ===
[PERMISSIONS] Decision: {
  finalCanWrite: true,
  reason: "GRANTED",  ← Should be "GRANTED"
}
```

```javascript
❌ FAILURE PATTERN (means fix didn't work):
[PERMISSIONS] ⚠️ NO MEMBERSHIP RECORD FOUND
[PERMISSIONS] Decision: {
  finalCanWrite: false,
  reason: "NO_MEMBERSHIP_RECORD"  ← Still failing
}
```

### Step 4: Verify UI State

**When canWrite=true (admin toggle ON):**
- ❌ NO "View Only Access" orange banner
- ✅ "Add Player" button visible
- ✅ Edit icons on player cards
- ✅ Can click player → "Edit Player" button present
- ✅ Can save edits successfully

**When canWrite=false (admin toggle OFF):**
- ✅ "View Only Access" orange banner shown
- ❌ "Add Player" button hidden
- ❌ No edit icons
- ❌ View-only mode

### Step 5: Test Admin Toggle Integration

1. **Organizer:** Go to Admin Tools → Access Control
2. Find coach `rich@worcesterflag.com`
3. **Toggle OFF** (orange/read-only)
4. **Coach:** Refresh Players page
5. Should see "View Only Access" banner
6. Console shows: `reason: "CANWRITE_FALSE"`
7. **Organizer:** Toggle ON (green/can edit)
8. **Coach:** Refresh Players page
9. Banner disappears
10. Console shows: `reason: "GRANTED"`

---

## 📋 VERIFICATION CHECKLIST

- [ ] Render deployment shows "Live" status
- [ ] Backend logs show: `[RBAC] Registered permission league_members:read`
- [ ] Curl test returns 200 OK with membership data
- [ ] Coach login → Console shows `[PERMISSIONS] Membership record found`
- [ ] Console shows `reason: "GRANTED"` when toggle is ON
- [ ] NO "View Only" banner when toggle is ON
- [ ] Edit buttons visible when toggle is ON
- [ ] Can actually save edits (backend accepts changes)
- [ ] Toggle OFF → banner appears + console shows `reason: "CANWRITE_FALSE"`
- [ ] Toggle ON → banner disappears + edit access restored

---

## 🚨 TROUBLESHOOTING

### Issue: Still seeing 404 on member endpoint

**Check:**
1. Render deployment actually completed (not stuck)
2. Using correct URL: `/api/leagues/{id}/members/{member_id}` (singular "members")
3. Auth token is valid and fresh

**Fix:** Wait for deployment or check Render logs for startup errors

### Issue: Console shows "NO_MEMBERSHIP_RECORD"

**Check:**
1. Coach actually has membership in the league (check Admin → Access Control)
2. League ID and User ID are correct in URL
3. Database has either:
   - `user_memberships/{user_id}/leagues/{league_id}`
   - OR `leagues/{league_id}/members/{user_id}`

**Fix:** Verify membership exists in database

### Issue: Console shows "CANWRITE_FALSE" even when admin toggle is ON

**Check:**
1. Admin actually saved the toggle (click, wait for success message)
2. Backend logs show: `[PATCH] Updating member ... to canWrite=true`
3. Database shows `canWrite: true` in both locations

**Fix:** Re-toggle admin switch, verify backend logs confirm write

### Issue: Backend logs show permission denied

**Check:**
1. Access matrix has: `("league_members", "read"): VIEW_ROLES`
2. Coach is actually a member of the league (not just an invited user)
3. `ensure_league_access()` is being called correctly

**Fix:** Verify code changes deployed correctly

---

## 🎯 SUCCESS CRITERIA

**The fix is working when:**

1. ✅ Coach `rich@worcesterflag.com` can log in
2. ✅ Players page loads without errors
3. ✅ Console shows `[PERMISSIONS] Membership record found`
4. ✅ Console shows `reason: "GRANTED"` (NOT "NO_MEMBERSHIP_RECORD")
5. ✅ NO "View Only Access" banner
6. ✅ Edit buttons visible and functional
7. ✅ Admin can toggle OFF → coach sees read-only mode
8. ✅ Admin can toggle ON → coach regains edit access

---

## 📞 CONTACT

**If issues persist:**
1. Share full console log output showing `[PERMISSIONS]` logs
2. Share curl test response (GET member endpoint)
3. Share admin UI screenshot of toggle state
4. Share backend logs showing `[PATCH]` write operation
5. Confirm Render deployment completed successfully

**Files to Check:**
- Backend logs: Render dashboard → Logs tab
- Frontend console: Browser DevTools → Console
- Database: Firebase Console → Firestore → `user_memberships` + `leagues/.../members`

---

**Deploy Time:** 2026-01-11  
**Commit:** f462baa  
**Expected Fix Time:** Immediate after deployment completes

