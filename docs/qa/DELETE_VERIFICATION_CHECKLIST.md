# Event Deletion Verification Checklist

**Purpose**: Verify that the bulletproof deletion system correctly validates target integrity at every layer.

**Date**: January 5, 2026  
**Test Environment**: Production  
**Tester**: ________________

---

## Pre-Test Setup

### Requirements
- [ ] Browser DevTools open with Network tab visible
- [ ] Console tab open for logging verification
- [ ] At least 2 events created: "Event A" and "Event B"
- [ ] Event A selected as currently active event

---

## CRITICAL VERIFICATION: Deletion Target Integrity

### Layer 1: Immutable Target Snapshot ✅

**What This Tests**: Frontend creates immutable snapshot at flow start.

**Steps**:
1. Select "Event A" in header dropdown
2. Navigate to Admin Tools → Danger Zone
3. Open browser console
4. Click "Delete Entire Event"
5. Complete Layer 1 (acknowledge warning)
6. Type "Event A" exactly in Layer 2
7. Click "Continue to Final Confirmation"

**Verification**:
- [ ] Layer 3 modal shows "Event A" in event name field
- [ ] Even if header dropdown shows "Event B", modal still shows "Event A"
- [ ] Console log shows: `DELETE_EVENT_LAYER_2_COMPLETE` with `target_event_id: <Event A ID>`
- [ ] **PASS** if modal always shows Event A regardless of context

---

### Layer 2: Client-Side Assertion ✅

**What This Tests**: Client blocks if selectedEvent == targetEvent after context switch.

**Steps**:
1. Follow Layer 1 steps above
2. In console, check for `DELETE_FLOW_SAFETY_FAILURE` log (should NOT appear in normal flow)
3. Click "Delete Permanently"

**Verification**:
- [ ] No `DELETE_FLOW_SAFETY_FAILURE` error (context was properly switched)
- [ ] Console log shows: `DELETE_EVENT_INITIATED` with `context_safely_switched: true`
- [ ] **PASS** if safety check passes (context was switched before delete)

---

### Layer 3: Server-Side Header Validation (REQUIRED) ✅

**What This Tests**: Server enforces X-Delete-Target-Event-Id header.

#### Test 3.1: Header Present and Matches
**Steps**:
1. Complete full deletion flow
2. In Network tab, find DELETE request to `/api/leagues/{league_id}/events/{event_id}`
3. Click on request → Headers tab

**Verification**:
- [ ] Request Headers section shows: `X-Delete-Target-Event-Id: <Event A ID>`
- [ ] URL path contains same Event ID as header
- [ ] Response status: `200 OK`
- [ ] Backend logs show: `Target Match: True`
- [ ] **PASS** if header matches route parameter

#### Test 3.2: Header Missing (Must Fail)
**Steps**:
1. Using Postman/cURL, send DELETE request WITHOUT header:
   ```bash
   DELETE /api/leagues/{league_id}/events/{event_A_id}
   Authorization: Bearer {token}
   # Note: X-Delete-Target-Event-Id header intentionally missing
   ```

**Verification**:
- [ ] Response status: `400 Bad Request`
- [ ] Error message: "Missing deletion target validation header (X-Delete-Target-Event-Id)"
- [ ] Backend logs show: `[AUDIT] CRITICAL: Missing deletion target header`
- [ ] Event NOT deleted
- [ ] **PASS** if deletion blocked without header

#### Test 3.3: Header Mismatch (Must Fail)
**Steps**:
1. Using Postman/cURL, send DELETE request with MISMATCHED header:
   ```bash
   DELETE /api/leagues/{league_id}/events/{event_A_id}
   Authorization: Bearer {token}
   X-Delete-Target-Event-Id: {event_B_id}  # Intentional mismatch
   ```

**Verification**:
- [ ] Response status: `400 Bad Request`
- [ ] Error message: "Deletion target mismatch. Route event_id (...) does not match declared target (...)"
- [ ] Backend logs show: `[AUDIT] CRITICAL: Deletion target mismatch`
- [ ] Sentry captured the error
- [ ] Event A NOT deleted
- [ ] Event B NOT deleted
- [ ] **PASS** if deletion blocked on mismatch

---

### Layer 4: Delete Intent Token (Optional but Recommended) ✅

**What This Tests**: Token-based validation prevents replay attacks and drift.

#### Test 4.1: Request Token After Layer 2
**Steps**:
1. Complete Layer 1 + Layer 2 of deletion flow
2. In Network tab, find POST request to `/api/leagues/{league_id}/events/{event_id}/delete-intent-token`

**Verification**:
- [ ] Response status: `200 OK`
- [ ] Response body contains: `{"token": "eyJ...", "expires_in_minutes": 5, "target_event_id": "..."}`
- [ ] Token is a valid JWT (check at jwt.io)
- [ ] **PASS** if token issued successfully

#### Test 4.2: Token Validated on Delete
**Steps**:
1. Complete full deletion flow with token
2. In Network tab, find DELETE request
3. Check request headers

**Verification**:
- [ ] Request Headers show: `X-Delete-Intent-Token: eyJ...`
- [ ] Backend logs show: `Token Validated: True`
- [ ] Response status: `200 OK`
- [ ] **PASS** if token validated

#### Test 4.3: Expired Token Rejected
**Steps**:
1. Request delete intent token
2. Wait 6 minutes (token expires after 5 minutes)
3. Attempt to delete with expired token

**Verification**:
- [ ] Response status: `400 Bad Request`
- [ ] Error message: "Delete intent token has expired"
- [ ] Event NOT deleted
- [ ] **PASS** if expired token rejected

#### Test 4.4: Token Claims Validated
**Steps**:
1. Request token for Event A
2. Attempt to use that token to delete Event B (different target_event_id)

**Verification**:
- [ ] Response status: `400 Bad Request`
- [ ] Error message: "Invalid delete intent token: Token target_event_id mismatch"
- [ ] Event B NOT deleted
- [ ] **PASS** if token claims validated

---

## COMPREHENSIVE VERIFICATION MATRIX

### Normal Flow (All Systems Operational)

| Component | Check | Expected Result | Status |
|-----------|-------|----------------|--------|
| Frontend | `targetEvent` immutable | Event A shown in modal | [ ] Pass |
| Frontend | Client assertion passes | No safety failure error | [ ] Pass |
| Frontend | Header sent | `X-Delete-Target-Event-Id: Event A ID` | [ ] Pass |
| Frontend | Token sent (optional) | `X-Delete-Intent-Token: eyJ...` | [ ] Pass |
| Backend | Header validated | Route ID == Header ID | [ ] Pass |
| Backend | Token validated (optional) | Token claims == Route params | [ ] Pass |
| Backend | Audit log complete | All IDs logged + match status | [ ] Pass |
| Database | Correct event deleted | Event A marked `deleted_at` | [ ] Pass |
| Database | Wrong event safe | Event B unchanged | [ ] Pass |

### Attack Scenarios (Must All Fail)

| Attack | Method | Expected Defense | Status |
|--------|--------|-----------------|--------|
| UI drift | Context switch changes target | Immutable snapshot prevents | [ ] Blocked |
| Missing header | DELETE without header | 400 Bad Request | [ ] Blocked |
| Header mismatch | DELETE with wrong ID in header | 400 Bad Request | [ ] Blocked |
| Expired token | DELETE with old token | 400 Bad Request | [ ] Blocked |
| Token replay | Use token for different event | 400 Bad Request | [ ] Blocked |
| Active context | Delete current event | Client assertion blocks | [ ] Blocked |
| Malicious API | Direct API call with wrong params | Server validation blocks | [ ] Blocked |

---

## DEVTOOLS NETWORK VERIFICATION

### Successful Delete Request Example

```
DELETE /api/leagues/{league_id}/events/{event_id}
Status: 200 OK

Request Headers:
  Authorization: Bearer eyJhbGc...
  X-Delete-Target-Event-Id: {event_id}      # MUST match URL event_id
  X-Delete-Intent-Token: eyJhbGc...         # Optional but recommended

Response:
  {
    "message": "Event deleted successfully",
    "deleted_at": "2026-01-05T12:34:56.789Z",
    "recovery_window": "30 days"
  }
```

**Verification Checklist**:
- [ ] URL `event_id` == Request Header `X-Delete-Target-Event-Id`
- [ ] Backend logs show: `Target Match: True`
- [ ] Backend logs show: `Token Validated: True` (if token sent)
- [ ] Correct event marked as deleted in database

---

## BACKEND LOGS VERIFICATION

### Expected Log Sequence for Successful Delete

```
[AUDIT] Delete intent token issued - Event: {event_id}, League: {league_id}, User: {user_id}
[AUDIT] Event deletion initiated - Event: {event_id}, Declared Target: {event_id}, Target Match: True, Token Validated: True
[AUDIT] Delete intent token validated successfully - Event: {event_id}
[AUDIT] Event deletion completed - Event: {event_id}, User: {user_id}, Timestamp: {timestamp}
```

**Verification Checklist**:
- [ ] All 4 log entries present
- [ ] `Declared Target` matches `Event ID`
- [ ] `Target Match: True`
- [ ] `Token Validated: True` (if token used)
- [ ] No error logs

---

## FINAL SIGN-OFF

### All Layers Verified
- [ ] Layer 1: Immutable target snapshot ✅ Pass / ❌ Fail
- [ ] Layer 2: Client-side assertion ✅ Pass / ❌ Fail
- [ ] Layer 3: Server-side header validation (REQUIRED) ✅ Pass / ❌ Fail
- [ ] Layer 4: Delete intent token (optional) ✅ Pass / ❌ Fail

### Attack Scenarios Blocked
- [ ] All 7 attack scenarios blocked ✅ Pass / ❌ Fail

### Audit Trail Complete
- [ ] Backend logs show all validations ✅ Pass / ❌ Fail
- [ ] Sentry captures validation failures ✅ Pass / ❌ Fail

---

## PRODUCTION READINESS

**All Critical Verifications Passed:** ☐ YES / ☐ NO  
**Optional Token System Works:** ☐ YES / ☐ NO / ☐ NOT TESTED  
**Attack Scenarios All Blocked:** ☐ YES / ☐ NO

**System is Bulletproof:** ☐ YES / ☐ NO

**Tester Signature:** ________________  
**Date:** ________________  
**Notes:**

---

**Document Version:** 1.0  
**Last Updated:** January 5, 2026

---

## Summary

This checklist verifies that deletion target integrity is protected by:

1. **Immutable snapshot** (UI cannot drift)
2. **Client assertion** (blocks dangerous scenarios)
3. **Required header** (server enforces target declaration)
4. **Optional token** (prevents replay attacks)
5. **Audit logging** (complete forensic trail)

**Result**: Impossible to delete wrong event, not just unlikely.

