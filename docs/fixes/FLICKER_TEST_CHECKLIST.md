# Route Flicker Fix - Testing Checklist

## Quick Test Guide

### Test 1: Cold Load (Incognito) ✅

**Steps:**
1. Open Chrome Incognito window
2. Navigate to `https://woo-combine.com/admin`
3. Watch carefully during load

**Expected Result:**
- ✅ ONE loading screen appears
- ✅ Directly lands on appropriate page (no flashing)
- ❌ NO flashing through multiple screens

**Console Check:**
```
[RouteDecisionGate] ALL_STATE_READY: Proceeding
[RouteDecisionGate] ROUTE_DECISION: Making routing decision
```

---

### Test 2: Post-Delete Redirect ✅

**Steps:**
1. As organizer, go to `/admin`
2. Delete an event
3. Observe redirect behavior

**Expected Result:**
- ✅ Smooth transition (may show loading briefly)
- ✅ Lands directly on destination page
- ❌ NO flashing through dashboard → coach → admin

**Console Check:**
```
[NavigationLogger] ROUTE_CHANGE: /admin → /coach
(Should be ONE route change, not multiple)
```

---

### Test 3: Hard Refresh ✅

**Steps:**
1. While logged in, go to `/dashboard`
2. Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. Watch page reload

**Expected Result:**
- ✅ ONE loading screen
- ✅ Direct navigation to appropriate page
- ❌ NO intermediate screens visible

---

### Test 4: Slow Network (Most Important) ⚠️

**Steps:**
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Set throttling to "Fast 3G"
4. Navigate to `/admin` or hard refresh

**Expected Result:**
- ✅ Loading screen shows for ~5-10 seconds
- ✅ Still only ONE loading screen
- ✅ No screen flashing even with slow network
- ❌ NO quick flashes of other pages

**Why This Test Matters:**
This exaggerates any flicker issues. If there's NO flicker on Fast 3G, the fix is solid.

---

### Test 5: Different User Roles 👥

**Organizer:**
- Navigate to `/dashboard` → Should go to `/coach`
- ✅ Direct navigation, no flicker

**Coach:**
- Navigate to `/dashboard` → Should go to `/coach`
- ✅ Direct navigation, no flicker

**Viewer:**
- Navigate to `/dashboard` → Should stay on `/dashboard`
- ✅ Direct navigation, no flicker

---

## Console Log Patterns

### ✅ GOOD (Working Correctly)

```
[RouteDecisionGate] STATE: { authChecked: false, roleChecked: false, ... }
[RouteDecisionGate] WAITING: Still waiting for [authChecked, roleChecked]
[AuthContext] State Transition: INITIALIZING -> READY
[RouteDecisionGate] STATE: { authChecked: true, roleChecked: true, eventsLoaded: true }
[RouteDecisionGate] ALL_STATE_READY: Proceeding with route decision
[RouteDecisionGate] ROUTE_DECISION: Making routing decision for /admin
[RouteDecisionGate] NAV_FROM: RouteDecisionGate → /coach (organizer default)
[NavigationLogger] ROUTE_CHANGE: /admin → /coach
[RouteDecisionGate] RENDER_CHILDREN: Rendering route children for /coach
```

**What to look for:**
- ✅ ONE "NAV_FROM" line (single navigation)
- ✅ ONE "ROUTE_CHANGE" line (single transition)
- ✅ "ALL_STATE_READY" before navigation decision

### ❌ BAD (Flicker Still Present)

```
[AuthContext] NAV_FROM: AuthContext → /dashboard
[NavigationLogger] ROUTE_CHANGE: /admin → /dashboard
[Home] Component rendering
[Home] NAV_FROM: Home → /coach
[NavigationLogger] ROUTE_CHANGE: /dashboard → /coach
[CoachDashboard] Component rendering
[NavigationLogger] ROUTE_CHANGE: /coach → /admin
```

**Red flags:**
- ❌ Multiple "NAV_FROM" lines (multiple navigations)
- ❌ Multiple "ROUTE_CHANGE" lines (route bouncing)
- ❌ Components rendering before decision made

---

## Quick Debug Commands

### See all navigation attempts:
```javascript
// In browser console:
localStorage.setItem('debug_navigation', 'true');
```

### See RouteDecisionGate state:
```javascript
// Look for lines starting with:
[RouteDecisionGate] STATE:
```

### Count route transitions:
```javascript
// In browser console after page loads:
console.log('Route transitions:', 
  performance.getEntriesByType('navigation').length
);
```

---

## Pass/Fail Criteria

### ✅ PASS if:
1. User sees only ONE loading screen per session
2. No visible flashing of intermediate pages
3. Console shows ONE navigation decision
4. Works on slow network (Fast 3G)
5. Works after hard refresh
6. Works for all user roles

### ❌ FAIL if:
1. Multiple screens flash during load
2. Can see intermediate pages briefly
3. Console shows multiple NAV_FROM logs
4. Flicker visible on slow network
5. Different behavior on refresh
6. Role-specific issues

---

## Known Good Flows

### New User (No Auth):
```
/admin → LoadingScreen → /welcome
```

### Logged In, No Role:
```
/admin → LoadingScreen → /select-role
```

### Logged In, Organizer, No League:
```
/admin → LoadingScreen → /dashboard (shows LeagueFallback)
```

### Logged In, Organizer, Has League:
```
/dashboard → LoadingScreen → /coach
/admin → LoadingScreen → /admin (direct)
```

---

## Regression Tests

Make sure these still work:

- ✅ Login flow
- ✅ Signup flow  
- ✅ Email verification
- ✅ Password reset
- ✅ Role selection
- ✅ League creation
- ✅ Event creation
- ✅ QR code joining
- ✅ Logout flow

---

## If Tests Fail

1. **Check RouteDecisionGate is active:**
   ```
   Should see: [RouteDecisionGate] logs in console
   ```

2. **Verify state dependencies:**
   ```javascript
   // In RouteDecisionGate logs, check what's waiting:
   [RouteDecisionGate] WAITING: Still waiting for [authChecked, ...]
   ```

3. **Look for early renders:**
   ```
   If you see component names before "ALL_STATE_READY",
   something is bypassing the gate.
   ```

4. **Report to team:**
   - Which test failed
   - Console logs (full output)
   - Network throttling setting
   - User role being tested
   - Video/screenshot of flicker

---

## Quick Smoke Test (30 seconds)

1. Open incognito
2. Go to `/admin`
3. Set Network to "Fast 3G"
4. Hard refresh (Cmd+Shift+R)
5. Watch for ANY screen flashing

**If no flashing:** ✅ Fix is working!  
**If flashing visible:** ❌ Needs investigation

---

**Last Updated:** 2025-01-05  
**Status:** Ready for Production Testing

