# P0 Investigation: Coach Score Submission While Locked

**Date:** January 11, 2026  
**Severity:** P0 - Data Integrity / Security  
**Status:** 🔍 INVESTIGATING

---

## Issue Report

**User:** rich@worcesterflag.com (coach)  
**Timestamp:** ~7:38:11 PM  
**Action:** Vertical Jump = 15 in recorded  
**Expected:** 403 Forbidden (combine locked)  
**Actual:** Score appears to have been recorded

**Screenshots Show:**
1. Admin → Staff & Access Control → Coach set to "Read-Only / View Only"
2. Mobile Live Entry → Recent entry at 7:38:11 PM

---

## Backend Audit Results

### ✅ Lock Enforcement IS Present

**ALL write endpoints have proper lock validation:**

#### 1. POST /drill-results/ (Create Score)
```python
# backend/routes/drills.py:47-54
check_write_permission(
    event_id=result.event_id,
    user_id=current_user["uid"],
    user_role=user_role,
    operation_name="create drill result"
)
```

#### 2. DELETE /drill-results/{id} (Undo)
```python
# backend/routes/drills.py:156-162
check_write_permission(
    event_id=event_id,
    user_id=current_user["uid"],
    user_role=user_role,
    operation_name="delete drill result"
)
```

#### 3. PUT /players/{id} (Update Player)
```python
# backend/routes/players.py:231-237
check_write_permission(
    event_id=event_id,
    user_id=current_user["uid"],
    user_role=user_role,
    operation_name="update player"
)
```

#### 4. POST /events/{id}/evaluations (Multi-Evaluator)
```python
# backend/routes/evaluators.py:122-127
check_write_permission(
    event_id=event_id,
    user_id=current_user["uid"],
    user_role=user_role,
    operation_name="submit drill evaluation"
)
```

---

### ✅ Lock Validation Logic IS Correct

**`backend/utils/lock_validation.py` properly implements:**

```python
# Lines 67-79
event_data = event_doc.to_dict()
is_locked = event_data.get("isLocked", False)

if is_locked:
    if user_role != "organizer":
        logging.warning(
            f"[LOCK] User {user_id} ({user_role}) attempted {operation_name} on locked event {event_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="This combine has been locked. Results are final and cannot be edited. Contact the organizer if corrections are needed."
        )
```

**This should block ALL coaches when `event.isLocked === true`**

---

## Possible Explanations

### Theory 1: Event Was NOT Actually Locked at 7:38 PM ⭐ MOST LIKELY

**Scenario:**
1. Coach submitted score at 7:38 PM → event was **unlocked** → succeeded
2. Organizer locked combine **AFTER** 7:38 PM
3. Screenshots taken showing locked state
4. User thinks submission happened while locked (but it happened before lock)

**How to Verify:**
- Check Render backend logs for `[AUDIT] Combine LOCKED` message
- Compare timestamp of lock vs 7:38 PM submission
- Check event history in Firestore (if available)

---

### Theory 2: Coach Was Read-Only, Not Event Locked

**Important Distinction:**
- **Per-Coach Read-Only** (Staff & Access Control)
- **Global Event Lock** (Combine Lock Control)

**If only per-coach read-only was set:**
- Screenshot shows "Read-Only / View Only" toggle
- This is `membership.canWrite = false`
- Backend enforces this at lines 104-115 in `lock_validation.py`

**But the user said "combine should be locked"**
- Need clarification: Was **global combine lock** enabled?
- Or just **per-coach read-only** for this coach?

---

### Theory 3: Client-Side Timestamp Mismatch

**Scenario:**
- Coach's device clock was wrong
- Submission actually happened earlier
- Device showed 7:38 PM but server received it at 7:30 PM (before lock)

**How to Verify:**
- Check `created_at` timestamp in Firestore drill_result document
- Compare to event lock timestamp
- Check if user's device had time zone issues

---

### Theory 4: Cached/Queued Submission

**Scenario:**
- Coach entered score while offline/slow connection
- Submission queued in browser
- Coach locked combine
- Queued submission sent later (after lock visible in UI)

**How to Verify:**
- Check Network tab for submission timestamp
- Look for delayed/retry requests in logs

---

## Required Information to Diagnose

### 1. Event ID & League ID

**Please provide:**
```
eventId: ???
leagueId: ???
```

### 2. Exact Timestamps

**From screenshots:**
- Submission timestamp: ~7:38:11 PM (what timezone?)
- When were screenshots taken?
- When did organizer click "Lock Combine Results"?

### 3. Backend Logs

**Check Render logs for:**

**Lock event:**
```
[AUDIT] Combine LOCKED - Event: {eventId}, User: {organizerUid}, Timestamp: {iso8601}
```

**Submission attempt:**
```
[LOCK] Write permission granted for {coachUid} (coach) on event {eventId} for create drill result
```

**Or rejection:**
```
[LOCK] User {coachUid} (coach) attempted create drill result on locked event {eventId}
```

### 4. Firestore Event Document

**Check current state:**
```
/events/{eventId}
{
  "isLocked": true/false,
  "lock_updated_at": "timestamp",
  "lock_updated_by": "uid"
}
```

### 5. Firestore Drill Result Document

**Check the specific submission:**
```
/events/{eventId}/players/{playerId}/drill_results/{resultId}
{
  "type": "vertical_jump",
  "value": 15,
  "created_at": "2026-01-11T??:??:??",
  "created_by": "{coachUid}"
}
```

---

## Diagnostic Commands

### Check Backend Logs (Render)

```bash
# Filter for lock-related logs around 7:38 PM
render logs --tail 1000 | grep "\[LOCK\]" | grep "7:38\|19:38"

# Check audit logs for lock events
render logs --tail 1000 | grep "\[AUDIT\]"

# Check all submissions from this coach
render logs --tail 1000 | grep "{coachUid}"
```

### Check Firestore Event

```bash
# Using Firebase CLI
firebase firestore:get events/{eventId}
```

### Check Drill Result

```bash
# Find recent drill results
firebase firestore:get events/{eventId}/players/{playerId}/drill_results \
  --order-by created_at --limit 5
```

---

## Next Steps

### Step 1: Confirm Event Was Actually Locked

**Action:** Check Render logs for `[AUDIT] Combine LOCKED` message
**Expected:** Timestamp BEFORE 7:38 PM if bug is real
**If after 7:38 PM:** No bug - submission happened before lock

### Step 2: Check Submission Logs

**Action:** Search logs for coach UID + event ID around 7:38 PM
**Expected if working:** `[LOCK] User ... attempted ... on locked event` (403)
**Expected if not locked:** `[LOCK] Write permission granted` (200)

### Step 3: Verify Firestore State

**Action:** Check event document `isLocked` field
**Action:** Check drill_result document `created_at` timestamp
**Compare:** Lock time vs submission time

---

## If Bug is Confirmed

### Potential Backend Bypass (Unlikely)

**Would need to find:**
1. Alternative endpoint not calling `check_write_permission()`
2. Race condition in lock check
3. Caching issue in Firestore reads

**All main endpoints audited - all have proper validation**

### Potential Frontend Bypass

**Could happen if:**
1. Frontend sends `recorded_at` field with past timestamp
2. Backend accepts it and records historical submission

**Check:**
- Does `recorded_at` vs `created_at` differ?
- Backend uses `created_at` = server time (line 85-92 in drills.py)
- Backend accepts `recorded_at` from client but for display only

---

## Temporary Workaround

**If urgent data integrity concern:**

```python
# Add extra validation in create_drill_result
# After line 54 in backend/routes/drills.py

# Double-check lock status right before write
event_doc_fresh = execute_with_timeout(
    lambda: event_ref.get(),
    timeout=5,
    operation_name="final lock check"
)
if event_doc_fresh.to_dict().get("isLocked", False):
    raise HTTPException(
        status_code=403,
        detail="COMBINE_LOCKED: Results finalized during submission"
    )
```

**This would catch race conditions between lock check and write**

---

## Conclusion

**Backend enforcement IS implemented correctly** ✅

**Most likely explanation:** Submission happened BEFORE lock was enabled

**To confirm:** Need event ID, exact timestamps, and backend logs

**If confirmed bug:** Very unlikely given code audit, but would need logs to diagnose further

---

**Please provide the requested information so we can verify what actually happened at 7:38 PM.**

