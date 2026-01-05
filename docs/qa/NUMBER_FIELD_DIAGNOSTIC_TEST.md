# Diagnostic Logging Test Guide - Number Field Validation

**Purpose:** Trace complete data flow from CSV → Frontend → Backend to verify canonical field migration

## What We're Testing

1. ✅ Frontend maps `player_number` → `number` (not `jersey_number`)
2. ✅ Payload includes `number` field (not missing)
3. ✅ Backend extracts `number` correctly
4. ✅ Duplicate detection uses actual numbers (not `None`)

## Test Steps

### 1. Upload CSV with player_number Column

Use: `baseball_import_50_players_with_names.csv`

Headers:
```csv
player_name,player_number,age_group,60yd_dash_sec,...
```

### 2. Open Chrome DevTools Console

**Before uploading:**
- Press `F12` or `Cmd + Option + I`
- Click "Console" tab
- Clear console (trash icon)

### 3. Upload CSV and Monitor Console

#### Expected Frontend Logs

**A. Canonical Field Check (✅ Success Pattern):**
```javascript
[ImportResultsModal] Canonical field check: number=true, jersey_number=false
✅ Canonical 'number' is in validKeys
❌ Legacy 'jersey_number' is NOT in validKeys
```

**🚨 Failure Pattern (SHOULD NOT SEE):**
```javascript
[ImportResultsModal] ❌ CRITICAL: 'number' not in validKeys!
[ImportResultsModal] ⚠️ WARNING: 'jersey_number' in validKeys
```

**B. Mapping Generation:**
```javascript
[csvUtils] Final mapping: Object
  {
    player_name: "name",
    player_number: "number",  ← Should map to 'number', not 'jersey_number'
    age_group: "age_group",
    ...
  }
```

**C. Payload Audit (✅ Success Pattern):**
```javascript
[ImportResultsModal] ✅ All 50 players have 'number' field

[ImportResultsModal] Final payload sample (first 3):
[
  {
    first_name: "Cole",
    last_name: "Anderson",
    number: 1000,          ← Field is 'number', value is present
    age_group: "15U",
    sprint_60: 7.29,
    ...
  },
  {
    first_name: "Ethan",
    last_name: "Johnson",
    number: 1001,
    ...
  },
  ...
]
```

**🚨 Failure Pattern (SHOULD NOT SEE):**
```javascript
[ImportResultsModal] ⚠️ 2 players missing 'number' field:

Missing number example 1: {
  player_data: {
    first_name: "Ethan",
    last_name: "Garcia",
    age_group: "15U",
    // ❌ NO 'number' field
  },
  raw_csv_source: {
    player_name: "Ethan Garcia",
    player_number: "1010",   ← Data exists in CSV
    age_group: "15U"
  }
}
```

### 4. Check Backend Logs (Render Dashboard)

Navigate to: Render → woo-combine-backend → Logs

#### Expected Backend Logs

**A. Number Extraction (✅ Success Pattern):**
```
[NUMBER_EXTRACT] Row 1: Extracted 1000 from field 'number' (raw_value='1000')
[NUMBER_EXTRACT] Row 2: Extracted 1001 from field 'number' (raw_value='1001')
[NUMBER_EXTRACT] Row 3: Extracted 1002 from field 'number' (raw_value='1002')
...
[NUMBER_EXTRACT] Row 11: Extracted 1010 from field 'number' (raw_value='1010')
```

**🚨 Failure Pattern (SHOULD NOT SEE):**
```
[NUMBER_EXTRACT] Row 11: No number found! Checked: number, player_number, jersey, jersey_number, etc. 
Player data keys: ['first_name', 'last_name', 'age_group', 'sprint_60', ...]
```

**B. Duplicate Detection (✅ Success Pattern):**
```
[DEDUPE] Row 3: Identity key = ('ethan', 'garcia', 1002)
[DEDUPE] Row 11: Identity key = ('ethan', 'garcia', 1010)
```

Different numbers → Different keys → ✅ NOT duplicates!

**🚨 Failure Pattern (SHOULD NOT SEE):**
```
[DEDUPE] Row 3: Identity key = ('ethan', 'garcia', None)
[DEDUPE] Row 11: Identity key = ('ethan', 'garcia', None)
```

Same name + `None` → Same key → ❌ False duplicate!

### 5. Verify Import Results

**Expected Success Result:**
- ✅ **50 NEW** players
- ✅ **0 UPDATED**
- ✅ **240 SCORES**
- ✅ **0 SKIPPED**

**No warnings about:**
- ❌ "(no jersey number)"
- ❌ "Duplicate player"

## Diagnostic Checklist

### ✅ Frontend Checks

- [ ] Console shows: `number=true, jersey_number=false`
- [ ] Mapping shows: `player_number: "number"` (not `"jersey_number"`)
- [ ] Payload audit: `✅ All 50 players have 'number' field`
- [ ] Sample payload includes: `"number": 1010`
- [ ] No warnings about missing number

### ✅ Backend Checks

- [ ] Logs show: `Extracted 1010 from field 'number'`
- [ ] Identity keys include actual numbers: `('ethan', 'garcia', 1010)`
- [ ] No warnings: "No number found!"
- [ ] No `None` in identity keys

### ✅ Import Success

- [ ] 50 NEW players (not 48)
- [ ] 0 SKIPPED (not 2)
- [ ] No "(no jersey number)" errors

## Troubleshooting

### If Console Shows: "❌ CRITICAL: 'number' not in validKeys"

**Problem:** Frontend still using old canonical field

**Check:**
1. Frontend deployed correctly? (Render dashboard)
2. Hard refresh browser: `Cmd + Shift + R`
3. Check `STANDARD_FIELDS` in ImportResultsModal.jsx - should be `'number'` not `'jersey_number'`

### If Payload Missing 'number' Field

**Problem:** Mapping or filtering issue

**Check Console For:**
1. `[csvUtils] Final mapping` - Does it map to `'number'`?
2. `[ImportResultsModal] Missing number example` - Shows raw CSV source
3. Are there edit conflicts? Check `merged_edits` in error log

**Likely Causes:**
- Mapping maps to wrong field (`jersey_number` instead of `number`)
- Field filtered out because not in `validKeys`
- Normalization checkpoint failed

### If Backend Shows: "No number found!"

**Problem:** Payload truly missing number field

**Check Backend Log:**
- `Player data keys: [...]` - What fields ARE present?
- If `jersey_number` present but not `number` → Normalization checkpoint failed

**Solution:** Check defensive normalization at line 422 of players.py

### If Identity Keys Show `None`

**Problem:** Number extraction failed

**Check:**
1. Backend log: What field was checked?
2. Is number a string vs numeric? (Should handle both: `"1010"` and `1010`)
3. Whitespace issues? (Should trim: `" 1010 "` → `1010`)

## Edge Cases to Test

### Numeric String vs Number

```json
{"number": "1010"}  ← String
{"number": 1010}    ← Number
```

**Both should work** - backend uses: `int(float(str(raw_num).strip()))`

### Leading Zeros

```csv
player_number
010
1010
```

**Result:**
- `"010"` → parses to `10`
- `"1010"` → parses to `1010`

**This is correct** - player numbers are numeric, not strings

### Whitespace

```csv
player_number
 1010 
1010
```

**Both should work** - backend trims: `.strip()`

### Mixed Headers

```csv
Player Number,player_number,jersey_number
1010,2020,3030
```

**Expected:** All variations map to canonical `'number'`

## Success Criteria

**All green checkmarks:**
- ✅ Frontend: `number=true`, `jersey_number=false`
- ✅ Frontend: `✅ All 50 players have 'number' field`
- ✅ Backend: 50x `Extracted {num} from field 'number'`
- ✅ Backend: Identity keys have actual numbers (not `None`)
- ✅ Import: 50 NEW, 0 SKIPPED
- ✅ No "(no jersey number)" errors

**If ALL checks pass** → Canonical field migration is working perfectly! 🎉

---

**Test Date:** January 4, 2026  
**Diagnostic Logging Commit:** 917ba57  
**Purpose:** Verify end-to-end data flow after canonical field migration

