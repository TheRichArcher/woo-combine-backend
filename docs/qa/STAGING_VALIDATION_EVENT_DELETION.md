# Staging Validation: Event Deletion Flow

**Feature:** Bulletproof Event Deletion  
**Date:** January 5, 2026  
**Tester:** ________________  
**Environment:** Staging (woo-combine-staging.onrender.com)  
**Status:** 🔄 PENDING VALIDATION

---

## Pre-Test Setup

### Test Accounts Required
- [ ] **Organizer Account:** Has events with varying data states
- [ ] **Coach Account:** Member of same league as organizer
- [ ] **Viewer Account:** Member of same league as organizer
- [ ] **Unauthenticated:** No login

### Test Events Required
Create these test events in staging:

1. **Event A:** "Empty Test Event"
   - 0 players
   - No scores
   - Not currently selected

2. **Event B:** "Small Test Event"
   - 5-10 players
   - No scores
   - Not currently selected

3. **Event C:** "Full Test Event"
   - 20+ players
   - Has drill scores
   - Not currently selected

4. **Event D:** "Active Test Event"
   - 10+ players
   - Has scores
   - **Currently selected in UI**

5. **Event E:** "Live Entry Active"
   - 10+ players
   - Live Entry mode active
   - Not currently selected

---

## REQUIRED STAGING VALIDATION

### ✅ Test 1: Organizer-Only Visibility

**Objective:** Confirm no delete affordances for Coach/Viewer, including via direct URL

#### Test 1.1: Organizer Can See Delete UI
- [ ] Login as **Organizer**
- [ ] Navigate to Admin Tools → Event Setup
- [ ] Scroll to bottom "Danger Zone" section
- [ ] **VERIFY:** "Delete Entire Event" section is visible
- [ ] **VERIFY:** Section has red border and warning styling
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 1.2: Coach Cannot See Delete UI
- [ ] Login as **Coach**
- [ ] Navigate to Admin Tools → Event Setup
- [ ] Scroll to bottom
- [ ] **VERIFY:** "Danger Zone" section shows ONLY "Reset Player Data"
- [ ] **VERIFY:** NO "Delete Entire Event" section visible
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 1.3: Viewer Cannot Access Admin Tools
- [ ] Login as **Viewer**
- [ ] Attempt to navigate to `/admin-tools`
- [ ] **VERIFY:** Access denied or redirected
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 1.4: Direct URL Access Blocked for Non-Organizers
- [ ] Login as **Coach**
- [ ] Manually navigate to `/admin-tools`
- [ ] **VERIFY:** Cannot see delete UI even if Admin Tools accessible
- [ ] Open browser dev console
- [ ] Attempt to call delete API directly:
  ```javascript
  fetch('/api/leagues/{league_id}/events/{event_id}', {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  ```
- [ ] **VERIFY:** Returns 403 Forbidden
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

### ✅ Test 2: Typed Name Confirmation Blocks Copy/Paste

**Objective:** No autofill, no accidental submit via paste shortcuts

#### Test 2.1: Paste is Blocked
- [ ] Login as **Organizer**
- [ ] Start deletion flow for "Empty Test Event"
- [ ] Reach Layer 2 (typed confirmation)
- [ ] Copy event name "Empty Test Event" to clipboard
- [ ] Attempt to paste into input field (Ctrl+V / Cmd+V)
- [ ] **VERIFY:** Paste is blocked
- [ ] **VERIFY:** Error message appears: "Paste is blocked. You must type the event name manually"
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 2.2: Autofill is Disabled
- [ ] In Layer 2 typed confirmation
- [ ] Start typing event name
- [ ] **VERIFY:** Browser does NOT show autofill suggestions
- [ ] **VERIFY:** `autocomplete="off"` is working
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 2.3: Button Disabled Until Exact Match
- [ ] In Layer 2 typed confirmation
- [ ] Type partial event name (e.g., "Empty Test")
- [ ] **VERIFY:** "Continue to Final Confirmation" button is disabled
- [ ] **VERIFY:** Orange text shows "Keep typing..."
- [ ] Complete typing exact name "Empty Test Event"
- [ ] **VERIFY:** Button becomes enabled
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 2.4: Case-Insensitive Matching Works
- [ ] In Layer 2 typed confirmation
- [ ] Type event name in different case: "empty test event"
- [ ] **VERIFY:** Button enables (case-insensitive match works)
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 2.5: Enter Key Doesn't Bypass Validation
- [ ] In Layer 2 typed confirmation
- [ ] Type partial event name
- [ ] Press Enter key
- [ ] **VERIFY:** Does NOT proceed to Layer 3
- [ ] Type complete event name
- [ ] Press Enter key
- [ ] **VERIFY:** Proceeds to Layer 3 (Enter works when valid)
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

### ✅ Test 3: Currently Selected Event Hard-Blocked

**Objective:** Attempting to delete currently selected event shows clear instruction

#### Test 3.1: Block Deletion of Active Event
- [ ] Login as **Organizer**
- [ ] Select "Active Test Event" (Event D) in header dropdown
- [ ] Navigate to Admin Tools → Event Setup
- [ ] Scroll to "Delete Entire Event" section
- [ ] **VERIFY:** Orange warning box appears
- [ ] **VERIFY:** Message: "Cannot Delete Currently Selected Event"
- [ ] **VERIFY:** Message: "You must switch to a different event before deleting this one"
- [ ] **VERIFY:** Button says "Switch to Different Event" (not "I Understand")
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 3.2: Button Navigates to Event Switcher
- [ ] Click "Switch to Different Event" button
- [ ] **VERIFY:** Navigates to `/select-league` or opens event switcher
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 3.3: Can Delete After Switching
- [ ] Switch to different event (Event A or B)
- [ ] Return to Admin Tools → Event Setup
- [ ] Scroll to "Delete Entire Event" section
- [ ] **VERIFY:** Orange warning is gone
- [ ] **VERIFY:** Normal red warning with "I Understand" button appears
- [ ] **VERIFY:** Can proceed with deletion flow
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

### ✅ Test 4: Soft-Deleted Events Behavior

**Objective:** Events disappear immediately, are inaccessible, don't break EventContext

#### Test 4.1: Complete Deletion of Empty Event
- [ ] Login as **Organizer**
- [ ] Select different event (not Event A)
- [ ] Start deletion flow for "Empty Test Event" (Event A)
- [ ] Complete all 3 layers
- [ ] **VERIFY:** Success message shows
- [ ] **VERIFY:** Message includes "Recovery available for 30 days"
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 4.2: Event Disappears from All Selectors
- [ ] After deleting Event A
- [ ] Check header event dropdown
- [ ] **VERIFY:** "Empty Test Event" is NOT in list
- [ ] Navigate to `/select-league`
- [ ] **VERIFY:** "Empty Test Event" is NOT in event list
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 4.3: Direct Navigation to Deleted Event Fails
- [ ] Note the event ID of deleted Event A
- [ ] Manually navigate to `/admin-tools` with that event selected
- [ ] **VERIFY:** Event not found or redirected to event selection
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 4.4: EventContext Doesn't Break
- [ ] After deleting Event A
- [ ] Navigate between different pages (Dashboard, Players, Admin Tools)
- [ ] **VERIFY:** No JavaScript errors in console
- [ ] **VERIFY:** No "Cannot read property of undefined" errors
- [ ] **VERIFY:** Other events still load correctly
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 4.5: Logout/Login Doesn't Restore Deleted Event
- [ ] After deleting Event A
- [ ] Logout
- [ ] Login again as same organizer
- [ ] Check event list
- [ ] **VERIFY:** Deleted event still not visible
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

### ✅ Test 5: Backend Enforcement via Manual API Call

**Objective:** Non-organizer API calls must fail with proper error

#### Test 5.1: Coach Cannot Call Delete API
- [ ] Login as **Coach**
- [ ] Open browser dev console
- [ ] Get auth token from localStorage or network tab
- [ ] Attempt to delete Event B via API:
  ```javascript
  const token = localStorage.getItem('authToken'); // or get from network tab
  fetch('https://woo-combine-staging.onrender.com/api/leagues/{league_id}/events/{event_b_id}', {
    method: 'DELETE',
    headers: { 
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  }).then(r => r.json()).then(console.log)
  ```
- [ ] **VERIFY:** Returns 403 Forbidden
- [ ] **VERIFY:** Error message: "Insufficient permissions" or similar
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 5.2: Viewer Cannot Call Delete API
- [ ] Login as **Viewer**
- [ ] Repeat Test 5.1 with viewer credentials
- [ ] **VERIFY:** Returns 403 Forbidden
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 5.3: Unauthenticated Request Fails
- [ ] Logout (or use incognito window)
- [ ] Attempt to call delete API without auth token
- [ ] **VERIFY:** Returns 401 Unauthorized
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

### ✅ Test 6: Live Entry Active Blocks Deletion

**Objective:** Deletion blocked with correct messaging when Live Entry active

#### Test 6.1: Activate Live Entry
- [ ] Login as **Organizer**
- [ ] Navigate to "Live Entry Active" event (Event E)
- [ ] Go to Live Entry mode
- [ ] **VERIFY:** Live Entry is active (green indicator or similar)
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 6.2: Attempt Deletion While Live Entry Active
- [ ] Switch to different event
- [ ] Navigate to Admin Tools → Event Setup
- [ ] Start deletion flow for Event E (Live Entry active)
- [ ] Complete Layer 1 and Layer 2
- [ ] Click "Delete Permanently" in Layer 3
- [ ] **VERIFY:** Error message appears
- [ ] **VERIFY:** Message: "Cannot delete event while Live Entry is active"
- [ ] **VERIFY:** Message: "Please deactivate Live Entry first"
- [ ] **VERIFY:** Event is NOT deleted
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 6.3: Can Delete After Deactivating Live Entry
- [ ] Deactivate Live Entry for Event E
- [ ] Attempt deletion again
- [ ] **VERIFY:** Deletion proceeds successfully
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

## NON-BLOCKING BUT REQUIRED BEFORE GA

### ✅ Test 7: Audit Logging Verification

**Objective:** Sentry breadcrumbs and logs capture deletion events

#### Test 7.1: Frontend Logs Present
- [ ] Login as **Organizer**
- [ ] Open browser dev console
- [ ] Start deletion flow for "Small Test Event" (Event B)
- [ ] Complete Layer 2 (typed confirmation)
- [ ] **VERIFY:** Console log: "DELETE_EVENT_LAYER_2_COMPLETE"
- [ ] Complete Layer 3 (final deletion)
- [ ] **VERIFY:** Console log: "DELETE_EVENT_INITIATED"
- [ ] **VERIFY:** Console log: "DELETE_EVENT_COMPLETED"
- [ ] Check log includes: event_id, event_name, player_count, timestamp
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 7.2: Backend Logs Present
- [ ] Access staging backend logs (Render dashboard or log aggregator)
- [ ] Search for "[AUDIT]" logs
- [ ] **VERIFY:** Log: "Event deletion initiated"
- [ ] **VERIFY:** Log: "Event deletion details" (name, date, created)
- [ ] **VERIFY:** Log: "Event deletion completed"
- [ ] Check logs include: event_id, league_id, user_uid, timestamp
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 7.3: Failed Deletion Logged
- [ ] Attempt to delete event with Live Entry active
- [ ] Check frontend console
- [ ] **VERIFY:** Log: "DELETE_EVENT_FAILED"
- [ ] Check backend logs
- [ ] **VERIFY:** Log: "Event deletion blocked - Live Entry active"
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

## ADDITIONAL VALIDATION TESTS

### ✅ Test 8: Event Stats Display

**Objective:** Layer 1 shows accurate event statistics

#### Test 8.1: Empty Event Stats
- [ ] Start deletion for "Empty Test Event" (0 players)
- [ ] In Layer 1, check event stats box
- [ ] **VERIFY:** Shows "Players: 0"
- [ ] **VERIFY:** No warning about scores (since none exist)
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 8.2: Event with Players and Scores
- [ ] Start deletion for "Full Test Event" (20+ players, has scores)
- [ ] In Layer 1, check event stats box
- [ ] **VERIFY:** Shows correct player count (e.g., "Players: 23")
- [ ] **VERIFY:** Shows warning: "This event has recorded drill scores that will be permanently lost"
- [ ] **VERIFY:** Shows warning: "All X player records will be permanently deleted"
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 8.3: Stats Loading State
- [ ] Start deletion flow
- [ ] Observe Layer 1 during stats fetch
- [ ] **VERIFY:** Shows "Loading event details..." while fetching
- [ ] **VERIFY:** Stats appear after load completes
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

### ✅ Test 9: User Experience Flow

**Objective:** Smooth UX without jarring transitions

#### Test 9.1: Cancel at Each Layer
- [ ] Start deletion flow
- [ ] At Layer 1, scroll away without clicking
- [ ] **VERIFY:** No deletion occurs
- [ ] Start again, click "I Understand"
- [ ] At Layer 2, click "Cancel"
- [ ] **VERIFY:** Returns to Layer 1 (or closes flow)
- [ ] Start again, reach Layer 3
- [ ] Click "Cancel" in modal
- [ ] **VERIFY:** Modal closes, no deletion
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 9.2: Escape Key Closes Modal
- [ ] Start deletion flow
- [ ] Reach Layer 3 (final modal)
- [ ] Press Escape key
- [ ] **VERIFY:** Modal closes
- [ ] **VERIFY:** No deletion occurs
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 9.3: Loading State During Deletion
- [ ] Complete all 3 layers
- [ ] Click "Delete Permanently"
- [ ] **VERIFY:** Button shows loading spinner
- [ ] **VERIFY:** Button text changes to "Deleting..."
- [ ] **VERIFY:** Button is disabled during deletion
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 9.4: Success Message and Navigation
- [ ] Complete deletion successfully
- [ ] **VERIFY:** Green success toast appears
- [ ] **VERIFY:** Message includes event name
- [ ] **VERIFY:** Message includes "Recovery available for 30 days"
- [ ] **VERIFY:** Automatically navigates to `/select-league`
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

### ✅ Test 10: Edge Cases

**Objective:** Handle unusual scenarios gracefully

#### Test 10.1: Network Error During Deletion
- [ ] Open browser dev tools → Network tab
- [ ] Start deletion flow, reach Layer 3
- [ ] Set network to "Offline" mode
- [ ] Click "Delete Permanently"
- [ ] **VERIFY:** Error message appears
- [ ] **VERIFY:** Message is user-friendly (not raw error)
- [ ] **VERIFY:** Modal stays open (can retry)
- [ ] Re-enable network, retry
- [ ] **VERIFY:** Deletion succeeds on retry
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 10.2: Very Long Event Name
- [ ] Create event with long name (50+ characters)
- [ ] Start deletion flow
- [ ] **VERIFY:** Event name displays correctly in all layers
- [ ] **VERIFY:** Input field accommodates full name
- [ ] **VERIFY:** Typing full name enables button
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 10.3: Special Characters in Event Name
- [ ] Create event with special chars: "Test Event (2026) - #1"
- [ ] Start deletion flow
- [ ] Type exact name including special characters
- [ ] **VERIFY:** Matching works correctly
- [ ] **RESULT:** ✅ Pass / ❌ Fail

#### Test 10.4: Rapid Event Switching
- [ ] Rapidly switch between events in header dropdown
- [ ] **VERIFY:** Delete UI never appears in dropdown
- [ ] **VERIFY:** No accidental deletion triggers
- [ ] **RESULT:** ✅ Pass / ❌ Fail

---

## VALIDATION SUMMARY

### Required Tests (Must All Pass)
- [ ] Test 1: Organizer-only visibility ✅ Pass / ❌ Fail
- [ ] Test 2: Copy/paste blocking ✅ Pass / ❌ Fail
- [ ] Test 3: Currently selected event blocked ✅ Pass / ❌ Fail
- [ ] Test 4: Soft-deleted events behavior ✅ Pass / ❌ Fail
- [ ] Test 5: Backend enforcement ✅ Pass / ❌ Fail
- [ ] Test 6: Live Entry active blocks deletion ✅ Pass / ❌ Fail

### Non-Blocking (Required Before GA)
- [ ] Test 7: Audit logging ✅ Pass / ❌ Fail

### Additional Validation
- [ ] Test 8: Event stats display ✅ Pass / ❌ Fail
- [ ] Test 9: User experience flow ✅ Pass / ❌ Fail
- [ ] Test 10: Edge cases ✅ Pass / ❌ Fail

---

## SIGN-OFF

**All Required Tests Passed:** ☐ YES / ☐ NO  
**Non-Blocking Tests Passed:** ☐ YES / ☐ NO  
**Ready for Production:** ☐ YES / ☐ NO

**Tester Signature:** ________________  
**Date:** ________________  
**Notes:**

---

## PRODUCTION DEPLOYMENT CHECKLIST

Once all tests pass:

- [ ] Merge feature branch to main
- [ ] Deploy to production
- [ ] Monitor Sentry for errors (first 24 hours)
- [ ] Monitor audit logs for deletion patterns
- [ ] Create follow-up ticket for 30-day cleanup job
- [ ] Update user documentation with deletion process
- [ ] Notify support team about recovery process

---

**Document Version:** 1.0  
**Last Updated:** January 5, 2026

