# Combine Lock State Testing Guide

**Purpose:** Verify that lock toggle UI updates immediately after backend confirmation

---

## Pre-Deployment Testing (Local)

### Setup
1. Start backend: `cd backend && uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open browser console (F12) to view `[LOCK]` logs

### Test Case 1: Lock from Unlocked State

**Steps:**
1. Login as organizer
2. Navigate to Admin Tools → Event Setup
3. Scroll to "Combine Lock Control" section
4. Verify initial state shows:
   - "🔓 Combine Results Unlocked" header (green gradient)
   - "Lock Combine Results" button (red)
5. Click "Lock Combine Results"
6. In confirmation modal, enter optional reason
7. Click "Yes, Lock Combine"

**Expected Results:**
- ✅ Console shows:
  ```
  [LOCK] Sending lock toggle request: {eventId, currentState: false, newState: true}
  [LOCK] Backend response: {isLocked: true, changed: true, verified: true}
  [LOCK] Calling refreshEvents() to sync UI...
  [LOCK] refreshEvents() completed
  ```
- ✅ Success toast appears: "Combine locked successfully..."
- ✅ **UI immediately updates** (no manual refresh needed):
  - Header changes to "🔒 Combine Results Locked" (red gradient)
  - Button changes to "Unlock Combine Results" (green)
  - Lock icon appears
  - Timestamp shows "Locked on [date/time]"

**Failure Indicators:**
- ❌ UI still shows "Unlocked" after success toast
- ❌ Console shows `verified: false` in backend response
- ❌ Must refresh page to see locked state

---

### Test Case 2: Unlock from Locked State

**Steps:**
1. With combine locked from Test Case 1
2. Click "Unlock Combine Results" button (green)
3. No confirmation modal - immediately processes

**Expected Results:**
- ✅ Console shows:
  ```
  [LOCK] Sending lock toggle request: {currentState: true, newState: false}
  [LOCK] Backend response: {isLocked: false, changed: true, verified: true}
  [LOCK] Calling refreshEvents() to sync UI...
  [LOCK] refreshEvents() completed
  ```
- ✅ Success toast: "Combine unlocked. Coaches can now edit..."
- ✅ **UI immediately updates:**
  - Header changes to "🔓 Combine Results Unlocked" (green)
  - Button changes to "Lock Combine Results" (red)
  - Unlock icon appears

---

### Test Case 3: State Persistence

**Steps:**
1. Lock the combine (Test Case 1)
2. Refresh browser (F5 or Cmd+R)
3. Navigate back to Admin Tools

**Expected Results:**
- ✅ Locked state persists after page refresh
- ✅ Shows "🔒 Combine Results Locked" without needing to re-lock
- ✅ Shows "Unlock Combine Results" button

---

### Test Case 4: Rapid Toggle

**Steps:**
1. Lock combine
2. Immediately unlock
3. Immediately lock again
4. Observe console for any race conditions

**Expected Results:**
- ✅ Each toggle completes before next one starts
- ✅ UI stays synchronized with final state
- ✅ No console errors about stale state
- ✅ Backend logs show sequential lock operations

---

## Production Testing

### Backend Log Verification

**SSH into Render backend:**
```bash
# View live logs
render logs --tail -f
```

**Look for these patterns:**

**Successful Lock:**
```
[LOCK] Lock toggle request - Event: abc123, Current: False, Requested: True
[LOCK] Updating league subcollection: /leagues/xyz/events/abc123
[LOCK] Updating global collection: /events/abc123
[LOCK] Verification successful - Event abc123 isLocked=True
[AUDIT] Combine LOCKED - Event: abc123 (Baseball Tryouts), User: user456
```

**Failure Pattern (if persisting issue):**
```
[LOCK] Lock toggle request - Event: abc123, Current: False, Requested: True
[LOCK] VERIFICATION FAILED - Event abc123 shows isLocked=False, expected True
```

---

### Test Case 5: Coach Read-Only Enforcement

**Steps:**
1. As organizer, lock the combine
2. Open incognito/private browser window
3. Login as coach with event access
4. Navigate to Players page

**Expected Results:**
- ✅ Coach sees "Combine Locked" badge in UI
- ✅ Edit buttons disabled
- ✅ Attempting to modify scores shows error: "This combine has been locked. Results are final..."
- ✅ Coach can still view rankings and export data

**Clean Up:**
- Unlock combine as organizer
- Verify coach regains edit access (refresh their page)

---

### Test Case 6: Multiple Organizers

**Steps:**
1. Open 2 browser windows as different organizers (or 2 incognito)
2. Both navigate to Admin Tools → Event Setup
3. Organizer A locks the combine
4. Organizer B refreshes their page

**Expected Results:**
- ✅ Organizer B sees locked state after refresh
- ✅ Both organizers can see lock timestamp
- ✅ Either can unlock (last one wins)

---

## Troubleshooting

### Issue: UI shows unlocked after lock success

**Diagnosis:**
```javascript
// Check console for these logs
[LOCK] Backend response: {verified: false}  // ← Backend write failed
// OR
[LOCK] refreshEvents() completed  // Missing - refresh didn't run
```

**Solutions:**
1. If `verified: false` → Check backend logs for Firestore write errors
2. If refresh logs missing → Check EventContext.refreshEvents() execution
3. Check browser console for errors during state update

---

### Issue: Lock state inconsistent across pages

**Diagnosis:**
- Lock shows in Admin Tools but not in Players page
- Or vice versa

**Solutions:**
1. Verify `selectedEvent` vs `events` array consistency
2. Check if component reads from stale localStorage
3. Clear browser cache and test again

---

### Issue: Backend logs show verification failed

**Diagnosis:**
```
[LOCK] VERIFICATION FAILED - Event abc123 shows isLocked=False, expected True
```

**Solutions:**
1. Check Firestore permissions in Firebase Console
2. Verify event exists in both `/leagues/{id}/events/{id}` and `/events/{id}`
3. Check if event is soft-deleted (`deleted_at` field)
4. Verify Firestore index for `isLocked` field

---

## Success Criteria Summary

✅ **All Test Cases Pass:**
- [ ] Lock from unlocked state - UI updates immediately
- [ ] Unlock from locked state - UI updates immediately
- [ ] State persists after page refresh
- [ ] Rapid toggles work without race conditions
- [ ] Coach read-only enforcement works
- [ ] Multiple organizers see consistent state

✅ **Backend Logs Clean:**
- [ ] All lock operations show `verified: true`
- [ ] No VERIFICATION FAILED errors
- [ ] Audit logs capture all lock changes

✅ **No Console Errors:**
- [ ] No React warnings about stale state
- [ ] No 404/500 errors during lock toggle
- [ ] `[LOCK]` logs show complete flow

---

**Ready for Production:** When all criteria met ✅

