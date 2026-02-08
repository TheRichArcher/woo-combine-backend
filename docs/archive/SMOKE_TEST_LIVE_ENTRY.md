# Live Entry Smoke Test

**Purpose**: Verify `/live-entry` is functional in production  
**Time Required**: < 2 minutes  
**Run**: Before every deploy touching LiveEntry.jsx or core flows

---

## Quick Test Sequence

### Step 1: Load (30 seconds)
1. Login to https://woo-combine.com
2. Navigate to `/live-entry`
3. **✅ PASS**: Page loads without crash
4. **❌ FAIL**: White screen, console error, or crash → **DO NOT DEPLOY**

### Step 2: Select Drill (15 seconds)
1. Click drill dropdown
2. Select any drill (e.g., "40-Yard Dash")
3. Click "Start Entry"
4. **✅ PASS**: Form appears with player input
5. **❌ FAIL**: Crash or infinite loop → **DO NOT DEPLOY**

### Step 3: Enter Score (30 seconds)
1. Type a player number (e.g., `1201`)
2. Press Tab or click score input
3. Type a score (e.g., `7.2`)
4. Click "Submit & Next"
5. **✅ PASS**: Score saves, form resets, "Recent Entries" shows entry
6. **❌ FAIL**: Error modal, crash, or no save → **DO NOT DEPLOY**

### Step 4: Edit Last (15 seconds)
1. Click "Edit Last" button
2. **✅ PASS**: Form pre-fills with last entry, score input focused
3. **❌ FAIL**: Crash or button missing → **DO NOT DEPLOY**

### Step 5: Duplicate Handling (15 seconds)
1. Enter same player + different score
2. **✅ PASS**: Duplicate modal appears with "Replace" button
3. Press Enter or click "Replace"
4. **✅ PASS**: Score updates
5. **❌ FAIL**: No modal or crash → **DO NOT DEPLOY**

### Step 6: Drill Switch (15 seconds)
1. Click different drill pill button
2. **✅ PASS**: Confirmation modal appears (if entries > 0) OR switches immediately (if 0 entries)
3. Confirm switch
4. **✅ PASS**: Drill changes, form resets
5. **❌ FAIL**: Crash or no confirmation → **DO NOT DEPLOY**

---

## Pass Criteria

**All 6 steps must pass.**

If ANY step fails:
1. Note the exact error in console
2. Fix the issue
3. Re-run full smoke test
4. Only deploy after ALL steps pass

---

## Expected Results Summary

```
✅ Page loads without crash
✅ Drill selection works
✅ Score submission works
✅ Edit Last pre-fills form
✅ Duplicate modal appears and works
✅ Drill switch confirmation works (if entries > 0)
```

**Total Time**: ~2 minutes  
**Prevents**: Production crashes, broken scoring flow, TDZ errors

---

## Production Verification

After deploying to production:

1. Run this same test on https://woo-combine.com/live-entry
2. Verify all 6 steps pass
3. If production fails where local passed, investigate environment differences

---

## What This Test Catches

- ✅ Component crashes (TDZ errors, undefined refs)
- ✅ Broken state management
- ✅ Missing API endpoints
- ✅ Form submission failures
- ✅ Modal rendering issues
- ✅ Navigation/routing problems

---

## Historical Context

**TDZ Incident (dd0449e):**
- Would have been caught in Step 1 (page crashed on load)
- Took 10 minutes to fix once reported
- Would have been prevented by running this test in preview mode

**Prevention**: Always run `npm run build && npm run preview` → then run this test before deploying.

---

## Related Checklists

- [Full Pre-Deploy Checklist](./PRE_DEPLOY_CHECKLIST.md) - Comprehensive checks
- [TDZ Hotfix Incident Report](./HOTFIX_TDZ_INCIDENT.md) - What we're preventing

---

**Remember**: 2 minutes of testing prevents hours of production downtime.

