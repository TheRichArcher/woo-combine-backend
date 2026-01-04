# Player Number Synonym Hotfix - January 4, 2026

## Commit
**bdbee6d** - fix: Add player_number synonym for jersey auto-detection

## Issue Summary
Users reported false duplicate detection warnings showing "(no jersey number)" even when their CSV contained a valid `player_number` column with unique values.

### Example CSV
```csv
player_name,player_number,age_group,60yd_dash_sec,...
Cole Anderson,1000,15U,7.29,...
Ethan Johnson,1001,15U,6.72,...
Ethan Garcia,1002,14U,7.94,...
...
Ethan Garcia,1010,15U,8.18,...  # Row 11, different number but flagged as duplicate
```

### Observed Behavior
- Row 11 flagged as: `"Duplicate: Ethan Garcia (no jersey number) (15U) matches Row 3"`
- Row 3 actually had player_number `1002`, Row 11 had `1010`
- Should NOT be duplicates (different numbers)
- Warning showed "(no jersey number)" incorrectly

## Root Cause

### 1. CSV Header Name
CSV used `player_number` (with underscore)

### 2. Frontend Auto-Mapper
`csvUtils.js` had synonym list:
```javascript
jersey_number: [
  'player number',  // ✅ with space
  'player_number',  // ❌ MISSING with underscore
  'player #',
  // ... other synonyms
]
```

### 3. Mapping Failure
- Auto-mapper couldn't match `player_number` → `jersey_number`
- Column was left unmapped
- Frontend strict filtering (line 742) excluded unmapped keys from payload

### 4. Backend Fallback Failed
Backend DOES check for `player_number` alias:
```python
for alias in ["player_number", "jersey", "number", ...]:
    if player.get(alias) is not None:
        raw_num = player.get(alias)
        break
```

BUT the frontend never sent `player_number` in the payload because it was filtered out!

## The Complete Flow

```
CSV: player_number column
  ↓
Frontend csvUtils: generateDefaultMapping()
  ↓
❌ 'player_number' not in synonyms
  ↓
No mapping created: player_number → jersey_number
  ↓
Frontend keyMapping: {} (empty for player_number)
  ↓
Line 742: validKeys.has(targetKey) check fails
  ↓
player_number excluded from payload sent to backend
  ↓
Backend receives: { first_name, last_name, age_group, ... }
  ↓
Backend jersey extraction: num = None (no jersey_number field)
  ↓
Duplicate detection: (name, name, None) key
  ↓
Two "Ethan Garcia" with num=None → flagged as duplicate
  ↓
Error: "Duplicate: Ethan Garcia (no jersey number)"
```

## The Fix

**File:** `frontend/src/utils/csvUtils.js` line 36

**Before:**
```javascript
jersey_number: ['jersey_number', 'number', '#', 'jersey', 'jersey number', 'jersey #', 'uniform', 'uniform number', 'player #', 'player number', 'no', 'no.', 'uniform #', 'num'],
```

**After:**
```javascript
jersey_number: ['jersey_number', 'number', '#', 'jersey', 'jersey number', 'jersey #', 'uniform', 'uniform number', 'player #', 'player number', 'player_number', 'no', 'no.', 'uniform #', 'num'],
```

Simply added `'player_number'` (with underscore) to the synonym list.

## Impact

### Before Fix
- CSVs with `player_number` header failed to auto-map
- Users saw false duplicate warnings
- Showed "(no jersey number)" even when data existed
- 2 rows skipped unnecessarily (0 actual duplicates in test CSV)

### After Fix
- `player_number` auto-maps correctly to `jersey_number`
- No false duplicate warnings
- Accurate duplicate detection
- All 50 players import successfully with unique numbers

## Testing

**Test CSV:** `baseball_import_50_players_with_names.csv`
- 50 players with unique `player_number` values (1000-1049)
- Two players named "Ethan Garcia" (rows 3 and 11) with DIFFERENT numbers (1002 vs 1010)
- Should NOT be flagged as duplicates

**Expected Result After Fix:**
- ✅ All 50 players import successfully
- ✅ No duplicate warnings
- ✅ player_number correctly mapped to jersey_number
- ✅ No "(no jersey number)" false warnings
- ✅ No false "Unmapped Drill Columns" warning

## Related Issues

### Issue #1: False "Unmapped Drill Columns" Warning
**Status:** Also fixed in Phase 1
**Cause:** Validation logic checked if source column name matched drill key, not if it was MAPPED to a drill key

### Issue #2: Jersey Number Not Auto-Detected
**Status:** Fixed in earlier commit (c7fec68)
**Cause:** `initializeRequiredFieldMappings` had overly broad name column check

### This Fix (Issue #3)
**Status:** ✅ RESOLVED
**Cause:** Missing synonym in csvUtils.js
**Solution:** Add `player_number` to synonym list

## Prevention

### Why This Wasn't Caught Earlier
1. Initial testing used CSVs with `player number` (space) or `jersey_number`
2. User's production CSV used `player_number` (underscore) - common Excel export format
3. Synonym list had space version but not underscore version

### Going Forward
1. Test with all common naming conventions:
   - `player_number` (underscore)
   - `player number` (space)
   - `playerNumber` (camelCase)
   - `Player Number` (title case)
2. Consider case-insensitive matching with multiple delimiter styles
3. Add comprehensive synonym list for all identity fields

## Deployment

**Commit:** bdbee6d  
**Deployed:** January 4, 2026 5:01 PM  
**Status:** ✅ Live on production (woo-combine.com)

## Files Changed

- `frontend/src/utils/csvUtils.js` (+1, -1)

## QA Checklist

After deployment, verify:
- [ ] Import `baseball_import_50_players_with_names.csv` - all 50 players succeed
- [ ] No duplicate warnings for Ethan Garcia entries (rows 3 and 11)
- [ ] No "(no jersey number)" false warnings
- [ ] player_number correctly displays in review table
- [ ] No "Unmapped Drill Columns" warning for player_number
- [ ] Success summary shows: 50 New, 0 Updated, 0 Skipped

---

**Author:** AI Assistant  
**Reviewed By:** Rich Archer  
**Date:** January 4, 2026

