# Jersey Auto-Map Regression Test

**Purpose:** Verify that jersey auto-mapping guards prevent mapping to name columns  
**Commit:** 7452d05  
**Date:** January 3, 2026  
**Status:** ✅ Ready for Production Verification

---

## Test Setup

### Test File
Use the provided test file: `baseball_import_50_players_with_names.csv`

**Columns:**
- `player_name` (full names like "Cole Anderson", "Ethan Johnson")
- `player_number` (numeric IDs: 1000, 1001, 1002, etc.)
- `age_group` (15U, 14U, 16U, etc.)
- `60yd_dash_sec`, `exit_velocity_mph`, `throw_velocity_mph`, `fielding_score`, `pop_time_sec` (drill scores)

**Expected Auto-Mapping:**
- ✅ `player_name` → Full Name mode (auto-split)
- ✅ `player_number` → jersey_number
- ✅ `age_group` → age_group
- ✅ Drill columns → drill keys

**Should NEVER Map:**
- ❌ `player_name` → jersey_number (this was the bug)

---

## Test Cases

### ✅ Test Case 1: Correct Auto-Detection
**Steps:**
1. Navigate to `/players?action=import`
2. Upload `baseball_import_50_players_with_names.csv`
3. Wait for parsing and auto-detection

**Expected Results:**
- [x] Required Fields panel shows:
  - Name mapping mode: "Single Full Name (auto-split)" selected
  - Full Name column: `player_name` (in dropdown)
  - Jersey # column: `player_number` (in dropdown)
  - Age Group column: `age_group` (in dropdown)
- [x] Panel background: **Green** (valid mapping)
- [x] No error messages in panel
- [x] Table shows 50 players with correct data
- [x] Summary cards show:
  - "50 Ready to Import" (green)
  - "0 Pending Review" (blue)

**FAIL Condition:** If Jersey # shows `player_name` instead of `player_number`

---

### ✅ Test Case 2: Name-Splitting Transform
**Steps:**
1. Continue from Test Case 1 (correct auto-detection)
2. Scroll down to verify drill columns auto-mapped
3. Click "Import Data" button

**Expected Results:**
- [x] No "unmapped drill columns" banner (all drill columns auto-mapped)
- [x] Import succeeds without errors
- [x] Success screen shows:
  - "50 players imported"
  - "0 errors"
  - "5 drill scores per player" (or similar)
- [x] Backend receives:
  - `first_name: "Cole", last_name: "Anderson"`
  - `first_name: "Ethan", last_name: "Johnson"`
  - `jersey_number: 1000, 1001, 1002...` (numeric)
  - NOT `jersey_number: "Cole Anderson"` (string name)

**FAIL Condition:** 
- "Missing first_name, Missing last_name" errors
- "Invalid jersey_number" errors
- Import failure

---

### ✅ Test Case 3: Manual Override (Edge Case)
**Steps:**
1. Upload `baseball_import_50_players_with_names.csv`
2. In Required Fields panel, try to manually select:
   - Jersey # → `player_name` (attempt to replicate the bug)
3. Click "Import Data"

**Expected Results:**
- [x] System SHOULD allow manual override (user knows best)
- [x] But backend validation SHOULD fail with:
  - "Invalid jersey_number: expected numeric, got string"
- [x] Error rows shown in red
- [x] User can fix by changing Jersey # back to `player_number`

**FAIL Condition:** If import succeeds with string names in jersey_number field

**Note:** This tests that guards prevent **auto-detection** errors, not manual user overrides. Backend validation is the final safety net for manual errors.

---

### ✅ Test Case 4: CSV Without Jersey Column
**Steps:**
1. Create a CSV with only: `player_name, age_group, 60yd_dash_sec, exit_velocity_mph`
2. Upload to Import Results modal

**Expected Results:**
- [x] Required Fields panel shows:
  - Name mapping: `player_name` → Full Name (auto-split)
  - Jersey # dropdown: "Not mapped" (default)
  - Age Group: `age_group`
- [x] No errors about missing jersey (it's optional)
- [x] Import succeeds
- [x] Players created with no jersey numbers

**FAIL Condition:** If Jersey # tries to map to `player_name` (should stay "Not mapped")

---

### ✅ Test Case 5: CSV With Ambiguous Column Names
**Steps:**
1. Create a CSV with columns: `name, number, age, sprint, jump, catch`
2. Upload to Import Results modal

**Expected Results:**
- [x] Auto-detection should:
  - `name` → Full Name (auto-split)
  - `number` → jersey_number (IF numeric data detected)
  - `age` → age_group
  - `sprint, jump, catch` → drill mappings
- [x] If `number` column contains names (e.g., "Player 1"), jersey should default to "Not mapped"
- [x] No mapping of name-like columns to jersey

**FAIL Condition:** If `name` or `number` (when containing string names) maps to jersey_number

---

## Guard System Validation

### Auto-Detection Guards (csvUtils.js)
**Code Location:** `frontend/src/utils/csvUtils.js` lines 431-451

**Verification:**
- [x] Open browser DevTools → Console
- [x] Upload test CSV
- [x] Check console logs for: `[csvUtils] Final mapping:`
- [x] Verify output shows:
  ```javascript
  mapping: {
    name: "player_name",
    jersey_number: "player_number", // NOT "player_name"
    age_group: "age_group",
    ...
  }
  ```

**FAIL Condition:** If mapping shows `jersey_number: "player_name"`

---

### UI Initialization Guards (ImportResultsModal.jsx)
**Code Location:** `frontend/src/components/Players/ImportResultsModal.jsx` lines 452-472

**Verification:**
- [x] After upload, inspect Required Fields panel state
- [x] Jersey # dropdown should show `player_number`
- [x] If auto-detection somehow failed, it should show "Not mapped" (safe default)
- [x] Should NEVER show `player_name` in Jersey # dropdown

---

### Name-Splitting Transform (ImportResultsModal.jsx)
**Code Location:** `frontend/src/components/Players/ImportResultsModal.jsx` lines 742-757

**Verification:**
- [x] After successful import, check Players page
- [x] Each player should show:
  - First name: "Cole", "Ethan", "Kevin", etc.
  - Last name: "Anderson", "Johnson", "Smith", etc.
- [x] NOT full names like "Cole Anderson" in last_name field

---

## Regression Prevention

### What To Watch For

1. **Synonym Expansion:** If jersey synonyms are expanded (e.g., adding "player_number", "player #"), ensure guards still work
2. **New Name Formats:** If users upload CSVs with columns like "player", "athlete", "participant", ensure guards exclude these from jersey mapping
3. **Auto-Detection Refactors:** If `generateDefaultMapping()` is refactored, ensure jersey guards are preserved
4. **validKeys Changes:** If `validKeys` set is modified, ensure `'name'` is still included for name-splitting transform

### Anti-Patterns

❌ **DO NOT:**
- Remove jersey guards "to be less restrictive"
- Remove `'name'` from validKeys "because it's not a standard field"
- Bypass guards for "smart detection" without type validation
- Assume auto-detection is always correct

✅ **DO:**
- Keep multiple layers of guards (auto-detection + UI initialization)
- Default to "Not mapped" when uncertain
- Validate column types (numeric for jersey)
- Trust backend validation as final safety net

---

## Success Criteria

**This fix is working correctly if:**
- ✅ Upload of `baseball_import_50_players_with_names.csv` succeeds on first attempt
- ✅ Jersey # auto-maps to `player_number` (numeric column)
- ✅ Player names are correctly split: first_name + last_name
- ✅ All 50 players imported with 0 errors
- ✅ No "Invalid jersey_number" errors
- ✅ No "Missing first_name, Missing last_name" errors

**This fix has regressed if:**
- ❌ Jersey # auto-maps to `player_name` (name column)
- ❌ Import fails with "Invalid jersey_number" on valid numeric columns
- ❌ Import fails with "Missing first_name, Missing last_name" when using Full Name mode
- ❌ 50% or higher failure rate on standard CSV formats

---

## Production Readiness

**Deployment Status:** ✅ Deployed (commit 7452d05)

**Verification Checklist:**
- [ ] Test Case 1 passes (correct auto-detection)
- [ ] Test Case 2 passes (name-splitting transform)
- [ ] Test Case 3 passes (manual override blocked by backend)
- [ ] Test Case 4 passes (optional jersey handling)
- [ ] Test Case 5 passes (ambiguous column names)
- [ ] Guards validated in console logs
- [ ] Players page shows correctly split names
- [ ] No regression in existing CSVs (first_name + last_name format)

**Sign-off:**
- [ ] PM tested on production
- [ ] No errors in Sentry for jersey/name mapping
- [ ] Build passes (3177 modules)
- [ ] Documentation complete

---

## Related Resources

- **Fix Report:** `docs/reports/IMPORT_JERSEY_NAME_AUTOMAP_FIX.md`
- **PM Guide:** `docs/guides/PM_ONBOARDING_OVERVIEW.md` (§5.1.5)
- **Test File:** `baseball_import_50_players_with_names.csv`
- **Commit:** 7452d05
- **Related Commits:**
  - 80fb72c (Required Fields Panel)
  - 20eb839 (Error Signal Polish)
  - dae296c (CTA Confidence)
  - aeeb86a (Drill Detection)

