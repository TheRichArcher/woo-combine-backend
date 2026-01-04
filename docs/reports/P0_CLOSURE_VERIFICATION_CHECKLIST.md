# P0 Closure: Empirical Verification Checklist

**Issue:** Baseball 60-yard sprint data showing as 0.0 on scorecards  
**Fix:** Added `sprint_60` synonyms to CSV import mapper  
**Status:** Code ready, awaiting empirical verification

---

## Required Evidence for P0 Closure

### ✅ Confirmation 1: Code Fix Complete
- [x] `sprint_60` synonyms added to `frontend/src/utils/csvUtils.js`
- [x] Build passes (0 errors)
- [x] Linting passes
- [x] Write-path documentation complete
- [x] Duplicate avoidance mechanism confirmed (deterministic hash-based IDs)

### ⏳ Confirmation 2: Real-World Write Verification (Post-Deployment)

**Must capture evidence for 1 test player after deploying fix:**

#### Step 1: Deploy to Production
```bash
cd /Users/richarcher/Desktop/WooCombine\ App
git add frontend/src/utils/csvUtils.js
git commit -m "Fix: Add sprint_60 synonyms for Baseball 60-yard sprint CSV mapping"
git push origin main
```

Wait for Render deployment (~2-3 minutes)

#### Step 2: Import Test CSV

**Test CSV (provided by user):**
- Contains "60-Yard Sprint" column with numeric values
- At least 1 player with known name (e.g., "John Doe, #12, 7.5")

**Import Steps:**
1. Navigate to Baseball event
2. Players → Import Players
3. Upload CSV
4. Verify mapping shows: `"60-Yard Sprint" → sprint_60` (high confidence)
5. Submit import

#### Step 3: Capture Evidence

**Evidence #1: Network Request Payload**
```javascript
// Browser DevTools → Network tab
// Filter: /players/upload
// Request Payload:

{
  "event_id": "xyz123",
  "players": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "jersey_number": 12,
      "sprint_60": "7.5",      // ← MUST SEE sprint_60 key (not "60-Yard Sprint")
      "age_group": "15U"
    }
  ]
}
```

**Screenshot requirements:**
- Request payload showing `sprint_60` key
- Player data with numeric value
- Clear timestamp/URL visible

**Evidence #2: Firestore Document**
```javascript
// Browser console after import:
const eventId = "YOUR_EVENT_ID";
const playerId = "YOUR_PLAYER_ID";

api.get(`/players?event_id=${eventId}`).then(res => {
  const john = res.data.find(p => p.name === "John Doe");
  console.log("Player ID:", john.id);
  console.log("Player scores:", john.scores);
  console.log("sprint_60 value:", john.scores?.sprint_60);
});

// Expected output:
// Player ID: a7b3c5d8e1f2g4h6i9j0
// Player scores: { sprint_60: 7.5, exit_velocity: 85, ... }
// sprint_60 value: 7.5
```

**Screenshot requirements:**
- Console output showing `scores.sprint_60 = 7.5`
- Numeric value (not null, not 0, not string)
- Player ID visible for reference

**Alternative:** Firestore Console
```
Navigate to:
Firebase Console → Firestore Database
/events/{event_id}/players/{player_id}

Verify document contains:
{
  "name": "John Doe",
  "scores": {
    "sprint_60": 7.5    // ← MUST SEE THIS
  }
}
```

**Evidence #3: Scorecard Display**
```javascript
// Navigate to player scorecard
// Click "View Stats & Weights" for John Doe
// Or generate PDF scorecard
```

**Screenshot requirements:**
- Scorecard showing "60-Yard Sprint: 7.5 sec" (NOT 0.0)
- Player name visible
- Clear drill performance section

---

## Verification Commands

### Quick Test Script (Browser Console)

```javascript
// After import completion
const eventId = "YOUR_EVENT_ID"; // Get from URL

// Check import summary
console.log("=== IMPORT VERIFICATION ===");

// 1. Verify players endpoint returns sprint_60
const players = await api.get(`/players?event_id=${eventId}`);
console.log("\n1. PLAYER DATA:");
players.data.forEach(p => {
  console.log(`${p.name}: sprint_60 = ${p.scores?.sprint_60 ?? p.sprint_60}`);
});

// 2. Check for any 0.0 values that should have data
const withZeros = players.data.filter(p => 
  (p.scores?.sprint_60 === 0 || p.sprint_60 === 0) && 
  Object.keys(p.scores || {}).length > 1
);
console.log("\n2. PLAYERS WITH 0.0 (should be empty):", withZeros.length);

// 3. Verify storage structure
const sample = players.data[0];
console.log("\n3. SAMPLE PLAYER STRUCTURE:");
console.log("  Has scores map:", !!sample.scores);
console.log("  Has sprint_60 in scores:", 'sprint_60' in (sample.scores || {}));
console.log("  Has sprint_60 flattened:", 'sprint_60' in sample);
console.log("  Value:", sample.scores?.sprint_60 ?? sample.sprint_60);

// 4. Check backend logs
console.log("\n4. CHECK BACKEND LOGS FOR:");
console.log("  [IMPORT_INFO] sprint_60: N scores");
console.log("  Expected N = number of players imported");
```

### Backend Log Verification

**SSH into Render or check logs:**
```bash
# Look for import success indicators
grep "IMPORT_SUMMARY" logs.txt
grep "sprint_60" logs.txt

# Expected output:
[IMPORT_INFO] Event xyz123: 25 total scores written across 5 drills
  - sprint_60: 25 scores
  - exit_velocity: 25 scores
  - throwing_velocity: 25 scores
  ...
```

---

## Success Criteria

### Required for P0 Closure

**All 3 pieces of evidence must show:**

✅ **Evidence #1: Payload contains `sprint_60` key**
- Not "60-Yard Sprint"
- Not "60_yard_sprint"
- Exactly: `sprint_60`

✅ **Evidence #2: Firestore stores numeric value**
- Document path: `/events/{id}/players/{id}`
- Field: `scores.sprint_60`
- Type: Number (not string, not null)
- Value: Matches CSV (e.g., 7.5)

✅ **Evidence #3: Scorecard displays value**
- Shows actual time (e.g., "7.5 sec")
- Not "0.0 sec"
- Not "No score"
- Matches Firestore value

### Additional Validation (Optional but Recommended)

- [ ] Backend logs show `sprint_60: N scores` where N > 0
- [ ] Rankings page includes sprint_60 in composite scores
- [ ] PDF scorecard export shows correct value
- [ ] No console errors during import
- [ ] Import summary shows 0 errors

---

## Fallback: If Evidence Shows Failure

### Scenario 1: Payload shows wrong key (e.g., "60_yard_sprint")

**Diagnosis:** Synonym matching failed

**Fix needed:**
- Check browser console for mapping logs
- Verify `generateDefaultMapping()` output
- Add missing synonym variation
- Re-test

### Scenario 2: Firestore stores null or 0

**Diagnosis:** Backend validation or storage failed

**Fix needed:**
- Check backend logs for errors
- Verify drill key exists in event schema
- Check CSV value is numeric
- Verify no parsing errors

### Scenario 3: Scorecard shows 0.0 but Firestore has value

**Diagnosis:** Frontend display logic issue (not mapping bug)

**Fix needed:**
- Check PlayerScorecardGenerator.jsx drill lookup
- Verify drills array includes sprint_60
- Check player.scores vs player[key] fallback

---

## Post-Verification Actions

### If All Evidence Confirms Success ✅

1. **Close P0 ticket** with evidence attached
2. **Update memory** with verification confirmation
3. **Notify affected customers** (if any exist) with remediation guide
4. **Document** in release notes

### If Evidence Shows Partial Success ⚠️

1. **Document specific failure** with screenshots
2. **Keep P0 open** until root cause identified
3. **Create focused test case** for failing scenario
4. **Iterate on fix** based on evidence

---

## Evidence Submission Format

```markdown
## P0 Verification Evidence: sprint_60 Fix

**Date:** [Date]
**Tester:** [Name]
**Event ID:** [ID]
**Test Player:** John Doe, #12

### Evidence #1: Network Payload
[Screenshot showing sprint_60 in request payload]
- Key: sprint_60 ✓
- Value: "7.5" ✓

### Evidence #2: Firestore Storage
[Screenshot of console output or Firestore console]
- Document: /events/xyz/players/abc
- scores.sprint_60: 7.5 ✓
- Type: Number ✓

### Evidence #3: Scorecard Display
[Screenshot of player scorecard]
- Display: "7.5 sec" ✓
- Not 0.0 ✓

### Conclusion
✅ All 3 evidence requirements met
✅ sprint_60 mapping works end-to-end
✅ P0 ready for closure
```

---

## Timeline

**Estimated time for verification:** 15-20 minutes
1. Deploy: 3 minutes
2. Import test CSV: 2 minutes
3. Capture evidence: 5 minutes
4. Verify scorecard: 2 minutes
5. Document evidence: 5 minutes

---

**Next Step:** Deploy fix → Import test CSV → Capture 3 pieces of evidence → Close P0

**Status:** Awaiting post-deployment verification

