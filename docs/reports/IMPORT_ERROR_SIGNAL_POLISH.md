# Import Results Modal - Error Signal Polish

**Commit:** 20eb839  
**Date:** January 3, 2026  
**Type:** UX Polish (Approved under IMPORTER_UX_LOCKED.md)

---

## Problem

Before required fields (names) were mapped, the UI showed alarming error signals that made users think their data was broken:

**Visual Signals (Before Fix):**
- 🔴 "50 Errors" in red
- 🔴 "0 Valid Rows" 
- 🔴 Row status: "Missing First Name; Missing Last Name"
- 🔴 Red error backgrounds on all rows

**User Perception:**
- "My CSV is broken"
- "The import failed"
- "Something went wrong with my data"

**Reality:**
- Data was fine
- User was mid-configuration (Step 1)
- Name mapping simply not complete yet

---

## Solution

Conditional messaging based on required field completion state.

### Before Mapping Complete (New Behavior)

**Summary Cards:**
- ⚠️ "Action Required" (amber) instead of "Errors" (red)
- ⏳ "Awaiting Mapping" (—) instead of "0 Valid Rows"
- Total Rows unchanged

**Row Status:**
- 🕐 "Waiting for name mapping" (gray with clock icon)
- Not "Missing First Name; Missing Last Name" (red with error icon)

**Row Backgrounds:**
- Neutral gray (not red error state)

**Helper Text (Added to Step 1):**
> "Until names are mapped, rows are marked as incomplete — this is expected."

### After Mapping Complete (Unchanged Behavior)

**Validation activates:**
- Real errors show as "Errors" (red)
- Valid rows show as "Valid Rows" (green)
- Duplicates show as "Duplicates" (amber)
- Row-level error messages display

---

## Implementation Details

### Summary Card Logic

```javascript
{requiredFieldsComplete ? summary.valid_count : '—'}
{requiredFieldsComplete ? 'Valid Rows' : 'Awaiting Mapping'}

{requiredFieldsComplete ? summary.error_count : summary.total_rows}
{requiredFieldsComplete ? 'Errors' : 'Action Required'}
```

### Row Status Logic

```javascript
{!requiredFieldsComplete ? (
    // Before required fields mapped
    <div className="text-xs text-gray-500 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Waiting for name mapping
    </div>
) : isErr ? (
    // After mapping, show actual errors
    <div className="text-xs text-red-600 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {row.errors[0]}
    </div>
) : ...}
```

### Row Background Logic

```javascript
className={`${
    !requiredFieldsComplete ? 'bg-gray-50' : // Neutral when waiting
    isDup ? 'bg-amber-50/30' : 
    isErr ? 'bg-red-50/30' : ''
}`}
```

---

## User Impact

**Before Polish:**
1. Upload CSV with `player_name` column
2. See Review screen
3. **Panic:** "50 Errors! My data is broken!"
4. Try to figure out what went wrong
5. Eventually discover column headers are interactive

**After Polish:**
1. Upload CSV with `player_name` column
2. See Review screen
3. **Understand:** "Action Required: 50 rows awaiting mapping"
4. Read helper text: "rows are marked as incomplete — this is expected"
5. Map names in Step 1 as intended
6. See validation results change to normal error states

---

## What Changed

| Element | Before | After |
|---------|--------|-------|
| Valid card | "0 Valid Rows" (green) | "Awaiting Mapping" (gray dash) |
| Error card | "50 Errors" (red) | "Action Required" (amber) |
| Row status | "Missing First Name; Missing Last Name" (red) | "Waiting for name mapping" (gray) |
| Row background | Red error state | Neutral gray |
| Helper text | None | "rows marked incomplete — expected" |

---

## What Didn't Change

✅ **Importer structure unchanged** - Step 1/Step 2 flow identical  
✅ **Required Fields panel unchanged** - Same validation logic  
✅ **Table interaction unchanged** - Still disabled until mapping complete  
✅ **Validation logic unchanged** - Same error detection after mapping  
✅ **Import button unchanged** - Still disabled until valid  

**This is messaging polish only** - no functional changes.

---

## Approval Justification

Per `docs/product/IMPORTER_UX_LOCKED.md`:

**Approved scenarios (do NOT require PM sign-off):**
> 1. Bug fixes - If importer crashes or validation fails incorrectly

**This qualifies as:** False error signals during legitimate configuration → confusing UX bug

**Also allowed:**
> Acceptable fixes: Clearer error messaging

**This is:** Conditional messaging based on configuration state

---

## Testing Checklist

- [x] Upload CSV with single `player_name` column
- [x] Review screen shows "Action Required" (not "Errors")
- [x] Review screen shows "Awaiting Mapping" (not "0 Valid")
- [x] Row status shows "Waiting for name mapping"
- [x] Rows have neutral gray background (not red)
- [x] Helper text visible in Step 1
- [x] Map name field → cards change to "Valid/Errors"
- [x] Map name field → rows show actual validation status
- [x] Real errors (after mapping) still show as red errors
- [x] Build succeeds (0 errors)
- [x] Deployed to production

---

## Files Modified

- `frontend/src/components/Players/ImportResultsModal.jsx`
  - +42 lines
  - -13 lines
  - Net: +29 lines

---

## Bundle Impact

**Before:** index-DtKQmyeB-1767487221133.js (1,921.74 kB)  
**After:** index-DmOQKt97-1767496077437.js (1,922.17 kB)  

**Impact:** +430 bytes (negligible)

---

## Deployment

**Status:** ✅ Live on production  
**Commit:** 20eb839  
**Build:** Success (11.96s)  
**Bundle:** index-DmOQKt97-1767496077437.js

---

## Next Steps

**Importer is now:**
- ✅ Functionally correct (commit 80fb72c)
- ✅ Visually confidence-safe (commit 20eb839)
- ✅ Production-ready and locked

**No further importer work needed** unless real users report issues.

**Focus shifts to:** Post-import success flows (per `NEXT_HIGH_LEVERAGE_AREAS.md`)

