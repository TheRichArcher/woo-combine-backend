# P0 Validation Bug - Postmortem

**Date:** January 7, 2025  
**Severity:** P0 (Production Critical)  
**Status:** ✅ RESOLVED (Commit a4abb9b)

---

## Incident Summary

Users in production were seeing incorrect drill validation messages:
- **"2.1 sec is unusually high for 60-Yard Sprint"** (should be "low")
- **"Expected range: null–null sec"** (should show "6.0-10.0 sec")

This persisted even after we added `min: 6.0, max: 10.0` to `drillTemplates.js` and fixed the validation logic in `LiveEntry.jsx`.

---

## Root Cause Analysis

### What We Thought Was Happening
1. Frontend validates scores using drill definitions from `drillTemplates.js`
2. We added `min`/`max` ranges to all drills in `drillTemplates.js`
3. Validation should display those ranges

### What Was Actually Happening
1. **`useDrills` hook fetches drill schema from backend API** (`/events/:id/schema`)
2. **Backend returns drill list WITHOUT `min`/`max` validation metadata**
3. **`useDrills` was REPLACING local templates with backend data**
4. Local `DRILL_TEMPLATES` (with `min`/`max`) were only used as **fallback on API failure**
5. When backend call **succeeded**, it overwrote all our validation ranges with `undefined`

### The Critical Code Path

**Before Fix (`useDrills.js` lines 50-61):**
```javascript
const { data } = await api.get(endpoint);

const normalizedDrills = (data.drills || []).map(d => ({
  ...d,  // Backend data (no min/max)
  lowerIsBetter: d.lowerIsBetter !== undefined ? d.lowerIsBetter : d.lower_is_better,
  min: d.min !== undefined ? d.min : d.min_value,  // Both undefined → min = undefined
  max: d.max !== undefined ? d.max : d.max_value,  // Both undefined → max = undefined
}));
```

**Result:** All drills had `min: undefined, max: undefined`, causing validation to display `null–null`.

---

## Why Previous "Fixes" Didn't Work

### Fix Attempt #1 (Commit 565361b)
- ✅ Added `min`/`max` to all drills in `drillTemplates.js`
- ✅ Fixed validation display logic in `LiveEntry.jsx`
- ❌ **Did NOT fix the data flow issue**

The frontend code was correct, but it never received the min/max data because `useDrills` was discarding it.

### Fix Attempt #2 (User hard refresh)
- Browser cache was NOT the issue
- Vite already generates cache-busted filenames with `Date.now()` timestamps
- Users were correctly loading the latest bundle
- **The bug was in the runtime data flow, not the deployed code**

---

## The Actual Fix (Commit a4abb9b)

Changed `useDrills` to **MERGE** backend data with local templates instead of replacing them:

```javascript
const templateId = selectedEvent.drillTemplate;
const localTemplate = templateId ? DRILL_TEMPLATES[templateId] : null;

const normalizedDrills = (data.drills || []).map(d => {
  // Find matching drill in local template
  const localDrill = localTemplate?.drills?.find(ld => ld.key === d.key);
  
  return {
    ...localDrill,  // ✅ Start with local template (has min/max/validation)
    ...d,           // ✅ Overlay backend data (authoritative for status)
    lowerIsBetter: d.lowerIsBetter ?? d.lower_is_better ?? localDrill?.lowerIsBetter,
    min: d.min ?? d.min_value ?? localDrill?.min,  // ✅ Falls back to local min
    max: d.max ?? d.max_value ?? localDrill?.max,  // ✅ Falls back to local max
  };
});
```

**Now:**
- Backend provides authoritative drill list (which drills are enabled/disabled)
- Local templates provide validation metadata (`min`, `max`, `lowerIsBetter`)
- Merge gives us best of both worlds

---

## Verification Steps

### For Production Validation
1. **Hard refresh** the app (Cmd/Ctrl + Shift + R) to bypass browser cache
2. Navigate to **Live Entry**
3. Select **60-Yard Sprint** drill
4. Enter **`2.1`** as the score
5. **Expected Behavior:**
   - Warning: "2.1 sec is **unusually low** for 60-Yard Sprint."
   - Range: "Expected range: **6.0-10.0 sec**."
6. Enter **`15.0`** as the score
7. **Expected Behavior:**
   - Warning: "15.0 sec is **unusually high** for 60-Yard Sprint."
   - Range: "Expected range: **6.0-10.0 sec**."

### Check Current Production Bundle
```bash
# View deployed bundle names (should have recent timestamp)
ls -la frontend/dist/assets/
```

Current build timestamp: **1767808846028** (generated at deploy time)

---

## Prevention Measures

### Already in Place
✅ Pre-deploy checklist (`PRE_DEPLOY_CHECKLIST.md`)  
✅ Smoke test suite (`SMOKE_TEST_LIVE_ENTRY.md`)  
✅ ESLint guard for TDZ errors (`no-use-before-define`)  

### Additional Recommendations

1. **Backend Should Store Validation Ranges**
   - Consider adding `min_value`, `max_value` fields to drill schema in Firestore
   - Allows organizers to customize validation per event
   - Reduces frontend/backend data mismatch risks

2. **Add Integration Test for Validation**
   ```javascript
   // Test that useDrills preserves local template metadata
   test('useDrills merges backend data with local min/max', async () => {
     const { drills } = await useDrills(mockEvent);
     const sprint = drills.find(d => d.key === 'sprint_60');
     expect(sprint.min).toBe(6.0);
     expect(sprint.max).toBe(10.0);
   });
   ```

3. **Add Console Warning for Missing Ranges**
   ```javascript
   if (!drill.min || !drill.max) {
     console.warn(`[Validation] Drill ${drill.key} missing min/max ranges`);
   }
   ```

---

## Timeline

| Time | Event |
|------|-------|
| **Dec 2024** | Phase 1 features deployed (Edit Last, Rapid Entry) |
| **Jan 6, 2025** | Phase 2 features deployed (Drill validation) |
| **Jan 7, 09:00** | User reports: "2.1 sec unusually high, null-null range" |
| **Jan 7, 09:15** | Fix deployed: Added min/max to drillTemplates.js (565361b) |
| **Jan 7, 10:00** | User confirms bug still present after hard refresh |
| **Jan 7, 10:05** | Root cause identified: useDrills overwrites local data |
| **Jan 7, 10:15** | Emergency fix deployed: Merge logic in useDrills (a4abb9b) |
| **Jan 7, 10:20** | Build verified, pushed to production |

---

## Lessons Learned

1. **Data Flow > Code Correctness**
   - Frontend code was correct
   - Data flow architecture was the issue
   - Always trace the full data path, not just the UI logic

2. **Backend API Can Be a Silent Failure**
   - Backend returning incomplete data (no min/max) didn't throw errors
   - Frontend silently accepted `undefined` values
   - Guard against "successful" API calls that return incomplete data

3. **Fallback Logic Can Hide Issues**
   - Local templates worked perfectly... when backend failed
   - Backend success path was broken, but hard to detect
   - Test both success AND failure paths

4. **User Feedback Is Gold**
   - User's report: "null-null after multiple hard refreshes" ruled out caching
   - Screenshot evidence prevented wild goose chase
   - Fast turnaround requires clear, specific bug reports

---

## Status

✅ **RESOLVED**  
Commit: `a4abb9b`  
Deployed: January 7, 2025  
Verified: Build passes, logic confirmed  

Users should see correct validation messages after hard refresh.

---

**End of Postmortem**

