# Recent Fixes Index - Last 7 Days

**Last Updated**: January 11, 2026  
**Current Production Build**: d9a3055

This document indexes all critical fixes from the past week for quick reference.

---

## 📋 **Quick Summary**

| Date | Issue | Status | Commit | Priority |
|------|-------|--------|--------|----------|
| Jan 11 | CORS PATCH method missing | ✅ Fixed | d9a3055 | P0 |
| Jan 11 | Admin tools blank page | ✅ Fixed | e8a7fb0 | P0 |
| Jan 11 | JoinEvent addLeague crash | ✅ Fixed | 021d5ff | P0 |
| Jan 11 | 401 logout loops | ✅ Fixed | e8a7fb0 | P1 |

**All production blockers resolved.**

---

## 🔥 **Critical Fixes (Last 24 Hours)**

### **1. CORS PATCH Method Missing → Permission Toggles Failed**

**Date**: January 11, 2026  
**Commit**: [d9a3055](https://github.com/TheRichArcher/woo-combine-backend/commit/d9a3055)  
**Priority**: P0 (Production Breaking)

#### Problem
Write permission toggles in Staff & Access Control failed with CORS preflight errors:
```
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status
```

Affected endpoints:
- `PATCH /api/leagues/{id}/members/{id}/write-permission` (write permission toggle)
- `PATCH /api/leagues/{id}/members/{id}/status` (member status toggle)
- `PATCH /api/leagues/{id}/events/{id}/lock` (combine lock toggle)

#### Root Cause
CORS middleware in `backend/main.py` was missing PATCH from allowed methods:
```python
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
# PATCH was missing! ❌
```

#### Fix
```python
allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
# Added PATCH ✅
```

#### Verification
1. Navigate to Admin → Staff & Access Control
2. Toggle any coach's write permission
3. Should succeed without CORS errors
4. Network tab: OPTIONS returns 200, PATCH request succeeds

#### Documentation
- **Technical Details**: [`CORS_PATCH_METHOD_FIX.md`](./CORS_PATCH_METHOD_FIX.md)
- **Files Changed**: `backend/main.py` (1 line)

---

### **2. Blank `/admin-tools` Page → No Route Match**

**Date**: January 11, 2026  
**Commit**: [e8a7fb0](https://github.com/TheRichArcher/woo-combine-backend/commit/e8a7fb0)  
**Priority**: P0 (Production Breaking)

#### Problem
Navigating to `/admin-tools` showed completely blank page. Console error:
```
No routes matched location '/admin-tools'
```

Broken links in `CoachDashboard.jsx`:
- "Event Settings" button (line 342)
- "Select or Create Event" button (line 353)

#### Root Cause
- `App.jsx` only defined `/admin` route
- Links pointed to `/admin-tools` (non-existent route)

#### Fix
1. Added redirect route in `App.jsx`:
```jsx
<Route path="/admin-tools" element={<Navigate to="/admin" replace />} />
```

2. Updated `CoachDashboard.jsx` links to use `/admin` directly

#### Verification
1. Navigate to `https://woo-combine.com/admin-tools`
2. Should redirect to `/admin` 
3. Admin page loads correctly

#### Documentation
- **Technical Details**: [`ADMIN_TOOLS_401_FIX.md`](./ADMIN_TOOLS_401_FIX.md)
- **Files Changed**: 
  - `frontend/src/App.jsx` (added redirect)
  - `frontend/src/pages/CoachDashboard.jsx` (2 links fixed)

---

### **3. Coach Join Flow Crash → `addLeague` Undefined**

**Date**: January 11, 2026  
**Commit**: [021d5ff](https://github.com/TheRichArcher/woo-combine-backend/commit/021d5ff)  
**Priority**: P0 (Production Breaking)

#### Problem
Scanning coach QR codes or clicking invite links crashed with:
```
ReferenceError: addLeague is not defined
```
Stack trace pointed to `JoinEvent.jsx` line 221.

#### Root Cause
useEffect dependency array included `addLeague` but it was never imported from `useAuth()`:
```jsx
}, [leagueId, eventId, role, user, leagues, navigate, 
    setSelectedEvent, addLeague, setSelectedLeagueId, ...]);
    //                ^^^^^^^^^ Referenced but not imported!
```

Component uses `refreshLeagues()` instead, so `addLeague` was unnecessary.

#### Fix
Removed `addLeague` from dependency array:
```jsx
}, [leagueId, eventId, role, user, leagues, navigate, 
    setSelectedEvent, setSelectedLeagueId, userRole, initializing]);
    // addLeague removed ✅
```

#### Verification
1. Generate fresh coach QR code in admin
2. Open in incognito window
3. Complete signup → role selection → join flow
4. Should succeed without errors

#### Documentation
- **Technical Details**: [`PRODUCTION_DEPLOYMENT_THREE_FIXES.md`](./PRODUCTION_DEPLOYMENT_THREE_FIXES.md)
- **Files Changed**: `frontend/src/pages/JoinEvent.jsx` (dependency array)

---

### **4. Premature 401 Logout → False Auth Failures**

**Date**: January 11, 2026  
**Commit**: [e8a7fb0](https://github.com/TheRichArcher/woo-combine-backend/commit/e8a7fb0)  
**Priority**: P1 (Major UX Issue)

#### Problem
Schema/leagues fetch 401 errors triggered immediate user logout:
```
[API] Token refresh after 401 failed
→ User logged out → Redirected to /welcome
```

Happened during:
- `/api/leagues/me` calls
- `/api/leagues/{id}/events/{id}/schema` calls
- Context mismatches (stale event in localStorage)

#### Root Cause
401 error handler was too aggressive:
- All 401s triggered logout attempt
- Couldn't distinguish true auth failures from permission/context issues
- Schema 401s (context mismatches) were treated as auth failures

#### Fix
Enhanced 401 handling in `frontend/src/lib/api.js`:

1. **Schema-specific bypass**:
```javascript
if (isSchemaPath) {
  // Let component handle with fallback templates
  return Promise.reject(error);
}
```

2. **Smarter refresh failure detection**:
```javascript
const refreshFailed = refreshError?.message?.includes('Token refresh unavailable') || 
                      !auth.currentUser;
if (refreshFailed) {
  // Only logout on TRUE auth failures
}
```

3. **Check current user before logout**:
```javascript
if (!auth.currentUser) {
  // True auth failure - logout
} else {
  // Permission/context issue - don't logout
}
```

#### Verification
1. Login and navigate normally
2. Monitor console for 401 errors
3. Should see: "401 on schema endpoint - likely context mismatch"
4. Should NOT see: Forced logouts or redirect loops

#### Documentation
- **Technical Details**: [`ADMIN_TOOLS_401_FIX.md`](./ADMIN_TOOLS_401_FIX.md)
- **Files Changed**: `frontend/src/lib/api.js` (enhanced error handling)

---

## 🔍 **How to Use This Index**

### **For Debugging**
If you encounter an issue:
1. Check if it matches any problem in this index
2. Verify you're on the latest build (d9a3055 or later)
3. Follow verification steps to confirm fix is working

### **For Code Review**
When reviewing recent changes:
1. Reference this index to understand context
2. Check related documentation for technical details
3. Verify all tests pass for affected areas

### **For New Team Members**
To understand recent stability work:
1. Read through each fix to understand common issues
2. Note patterns (CORS, dependencies, 401 handling)
3. Learn debugging techniques used

---

## 📊 **Fix Timeline**

```
Jan 11, 2026
├─ 10:00 AM - CORS PATCH issue identified
├─ 10:15 AM - Fix committed (d9a3055)
├─ 10:20 AM - Deployed to production
├─ 11:30 AM - Admin route issue identified
├─ 11:45 AM - Fix committed (e8a7fb0)
├─ 12:00 PM - Deployed to production
├─ 12:30 PM - JoinEvent crash identified (already fixed in 021d5ff)
└─ 01:00 PM - All fixes verified in production ✅
```

---

## 🧪 **Testing Checklist**

After each deployment, verify:

### **CORS PATCH Fix**
- [ ] Toggle write permission in Staff & Access Control
- [ ] Toggle member status (Active)
- [ ] Toggle combine lock in Event Settings
- [ ] No CORS errors in console
- [ ] All toggles visually update

### **Admin Route Fix**
- [ ] Navigate to `/admin-tools` URL directly
- [ ] Click "Event Settings" in CoachDashboard
- [ ] Click "Select or Create Event"
- [ ] All redirect to `/admin` successfully
- [ ] Admin page loads without errors

### **Join Flow Fix**
- [ ] Generate coach QR code
- [ ] Scan in incognito window
- [ ] Complete signup flow
- [ ] Select role (Coach)
- [ ] Join event successfully
- [ ] No console errors
- [ ] Dashboard loads

### **401 Handling Fix**
- [ ] Login and browse normally
- [ ] Check console for 401 patterns
- [ ] Schema 401s don't trigger logout
- [ ] Context mismatches handled gracefully
- [ ] True auth failures still logout properly

---

## 📚 **Related Documentation**

### **Detailed Fix Reports**
- [`CORS_PATCH_METHOD_FIX.md`](./CORS_PATCH_METHOD_FIX.md) - CORS PATCH issue
- [`ADMIN_TOOLS_401_FIX.md`](./ADMIN_TOOLS_401_FIX.md) - Admin route + 401 fixes
- [`PRODUCTION_DEPLOYMENT_THREE_FIXES.md`](./PRODUCTION_DEPLOYMENT_THREE_FIXES.md) - All three fixes

### **System Documentation**
- [`ONBOARDING_QUICK_START.md`](./ONBOARDING_QUICK_START.md) - New team member guide
- [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) - Developer setup
- [`docs/guides/PM_ONBOARDING_OVERVIEW.md`](./docs/guides/PM_ONBOARDING_OVERVIEW.md) - PM guide

### **Operations**
- [`docs/runbooks/Incident-Response.md`](./docs/runbooks/Incident-Response.md)
- [`docs/qa/MANUAL_CHECKLIST.md`](./docs/qa/MANUAL_CHECKLIST.md)

---

## 🚀 **Deployment Status**

**Current Production**: All fixes live and verified
- Frontend Build: e8a7fb0
- Backend Build: d9a3055
- Status: ✅ Stable
- Known Issues: None

**Next Deployment**: TBD
- Monitor: No critical issues pending
- Planned: Feature enhancements (non-blocking)

---

## 💬 **Questions?**

If you encounter issues not covered here:
1. Check full documentation in `/docs`
2. Review Render logs for backend errors
3. Check browser console for frontend errors
4. Reference this index for similar past issues

---

**Last Verified**: January 11, 2026, 2:00 PM  
**Verified By**: Production testing  
**Status**: All systems operational ✅

