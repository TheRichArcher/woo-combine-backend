# Comprehensive Audit: Drill Scores Not Saving Issue

**Date**: December 7, 2025
**Issue**: When uploading a file with drill scores, mapping them correctly, and saving, drill scores are not being persisted to the database.

---

## Executive Summary

After conducting a comprehensive audit of the entire import pipeline (from file upload to database persistence), I have identified **MULTIPLE POTENTIAL ROOT CAUSES** that could result in drill scores silently failing to save:

1. **Custom Drill Key Mismatch** - The most likely culprit
2. **Header Normalization Issues** - Potential for standard drill name variations
3. **Mapping Not Preserved** - Frontend → Backend data transformation issues
4. **Schema Synchronization** - Different schemas used at parse vs save time

---

## Complete Data Flow Analysis

### Step 1: Schema Fetch (Frontend)

**File**: `frontend/src/hooks/useDrills.js` (Lines 27-63)
**Endpoint**: `/leagues/{league_id}/events/{event_id}/schema`

```javascript
const endpoint = selectedEvent.league_id 
  ? `/leagues/${selectedEvent.league_id}/events/${selectedEvent.id}/schema`
  : `/events/${selectedEvent.id}/schema`;
const { data } = await api.get(endpoint);
```

**Backend Handler**: `backend/routes/events.py` (Lines 682-740)

```python
schema = get_event_schema(event_id, league_id=league_id)
return {
    "drills": [
        {
            "key": drill.key,  # CRITICAL: Custom drills use their Firestore doc ID
            "label": drill.label,
            ...
        }
        for drill in schema.drills
    ]
}
```

**Schema Building**: `backend/utils/event_schema.py` (Lines 43-94)

```python
# Custom drills fetched from subcollection
custom_drill_defs.append(DrillDefinition(
    key=data.get("id", cd.id),  # Uses Firestore document ID as key
    label=data.get("name", "Unknown Drill"),
    ...
))
final_drills = active_base_drills + custom_drill_defs
```

**✅ VERIFIED**: Custom drills use their Firestore document ID as the `key` field.

---

### Step 2: File Upload & Parsing

**File**: `frontend/src/components/Players/ImportResultsModal.jsx` (Lines 138-228)
**Endpoint**: `/events/{event_id}/parse-import`

**Frontend Request**:
```javascript
const response = await api.post(`/events/${selectedEvent.id}/parse-import`, formData);
```

**Backend Handler**: `backend/routes/imports.py` (Lines 31-165)

```python
result = DataImporter.parse_csv(content, event_id=event_id, disabled_drills=disabled_drills)
# OR parse_excel, parse_text, parse_image
```

**Parser Logic**: `backend/utils/importers.py` (Lines 361-463)

```python
def _process_rows(rows, field_map, sport_id, event_id, disabled_drills):
    # CRITICAL FIX: Uses event_id to fetch schema with custom drills
    if event_id:
        from ..utils.event_schema import get_event_schema
        schema = get_event_schema(event_id)  # Line 372
    else:
        schema = SchemaRegistry.get_schema(sport_id)
    
    drill_keys = set(d.key for d in schema.drills)  # Line 381
    
    # Process each row
    for original_key, value in row.items():
        mapped_key = field_map.get(original_key)  # Line 396
        if mapped_key in drill_keys and clean_val:  # Line 402
            # Save the drill score
```

**⚠️ POTENTIAL ISSUE #1: Header Normalization**

The `_normalize_header` function (lines 50-108) uses fuzzy matching:
- Checks exact matches first
- Falls back to fuzzy matching for known patterns
- **BUT**: Custom drills may not be in `schema_drills` parameter if not passed correctly

**Check**: Is `schema_drills` being populated correctly with custom drill keys?

---

### Step 3: Column Mapping (Frontend)

**File**: `frontend/src/components/Players/ImportResultsModal.jsx` (Lines 184-220)

```javascript
const { mapping: suggestedMapping } = generateDefaultMapping(sourceKeys, availableDrills);

// Apply suggested mappings
Object.entries(suggestedMapping).forEach(([targetKey, sourceHeader]) => {
    if (sourceHeader) {
        initialMapping[sourceHeader] = targetKey;  // Maps source → target
    }
});
```

**Mapping Application** (Lines 284-291):
```javascript
const mappedData = {};
Object.keys(mergedData).forEach(k => {
    const targetKey = keyMapping[k] || k;  // CRITICAL: Uses keyMapping
    if (targetKey !== '__ignore__') {
        mappedData[targetKey] = mergedData[k];
    }
});
```

**⚠️ POTENTIAL ISSUE #2: Custom Drill Keys Not in Mapping Options**

At lines 95-103:
```javascript
const drillMappingOptions = useMemo(() => {
    return [{
        label: "Event Drills",
        options: (availableDrills || []).map(d => ({ key: d.key, label: d.label }))
    }];
}, [availableDrills]);
```

**Question**: Are `availableDrills` actually populated with custom drills?

**Verification Needed**: Check if `useDrills` hook is returning custom drills properly.

---

### Step 4: Upload to Backend

**File**: `frontend/src/components/Players/ImportResultsModal.jsx` (Line 313)

```javascript
const response = await api.post('/players/upload', {
    event_id: selectedEvent.id,
    players: playersToUpload,  // Contains mappedData
    ...
});
```

**Backend Handler**: `backend/routes/players.py` (Lines 260-513)

```python
schema = get_event_schema(event_id)  # Line 275
drill_fields = [d.key for d in schema.drills]  # Line 281

# CRITICAL LOGGING (Line 284):
logging.info(f"[IMPORT_DEBUG] Server Drill Fields for Event {event_id}: {drill_fields}")

for drill_key in drill_fields:
    value = player.get(drill_key, "")  # Line 428
    
    if value and str(value).strip() != "":
        val_float = float(value)
        scores[drill_key] = val_float  # Line 436
        scores_written_total += 1
        scores_written_by_drill[drill_key] += 1

player_data["scores"] = scores  # Line 449
batch.set(player_ref, player_data, merge=True)  # Line 466
```

**⚠️ POTENTIAL ISSUE #3: Key Mismatch**

If the keys in `player` dict don't match the keys in `drill_fields`, scores won't be saved.

Example:
- Frontend maps to: `"custom_drill_abc123"` (Firestore doc ID)
- Backend expects: `"custom_drill_abc123"`
- **BUT** if CSV header was normalized differently, keys won't match!

---

## Root Cause Analysis

### Most Likely Culprit: Custom Drill Key Normalization

**Scenario**:
1. User creates a custom drill with name "Bench Press" (Firestore ID: `x7hG4kL9mN2pQ8vW`)
2. Frontend fetches schema, gets `key: "x7hG4kL9mN2pQ8vW"`, `label: "Bench Press"`
3. User's CSV has column header: `"Bench Press"`
4. **Parse step** (backend):
   - `_normalize_header("Bench Press")` → `"bench_press"` (line 55)
   - Checks if `"bench_press"` is in `schema_drills` (line 62-63)
   - **IF** `schema_drills` doesn't contain custom drill keys, it won't recognize it!
   - Returns `"bench_press"` as normalized key
5. **Mapping step** (frontend):
   - Tries to map `"Bench Press"` → tries to find drill with key `"bench_press"`
   - **Doesn't find** `"x7hG4kL9mN2pQ8vW"` because that's not `"bench_press"`
   - Either maps to wrong key or defaults to `__ignore__`
6. **Upload step**: 
   - Data arrives with key `"bench_press"` or ignored
   - Backend looks for `"x7hG4kL9mN2pQ8vW"` in drill_fields
   - **No match** → score not saved!

---

## Critical Code Issues Identified

### Issue 1: `_normalize_header` Doesn't Check Custom Drill Labels

**File**: `backend/utils/importers.py` (Lines 50-108)

```python
@staticmethod
def _normalize_header(header: str, schema_drills: List[str] = None) -> str:
    clean = str(header).strip().lower().replace(' ', '_').replace('-', '_')
    
    # Check exact matches first
    if clean in DataImporter.FIELD_MAPPING:
        return DataImporter.FIELD_MAPPING[clean]
        
    # Check if it matches any known schema drill keys (if provided)
    if schema_drills and clean in schema_drills:
        return clean
    
    # ... fuzzy matching for known drills ...
    
    return clean  # Returns normalized version, NOT original key!
```

**PROBLEM**: If `schema_drills` contains `"x7hG4kL9mN2pQ8vW"` but header is `"Bench Press"`:
- `clean = "bench_press"`
- `"bench_press"` not in `schema_drills` (which has `"x7hG4kL9mN2pQ8vW"`)
- Returns `"bench_press"` instead of `"x7hG4kL9mN2pQ8vW"`

**FIX NEEDED**: Must reverse-map from normalized label to actual drill key.

---

### Issue 2: `schema_drills` Parameter Not Always Passed

**File**: `backend/utils/importers.py`

At line 194:
```python
normalized_field_map = {
    field: DataImporter._normalize_header(field, schema_drills) 
    for field in reader.fieldnames
}
```

**BUT**: `schema_drills` is only populated at line 191:
```python
schema_drills = [d.key for d in schema.drills] if schema else []
```

This gives us a list of keys: `["40m_dash", "vertical_jump", "x7hG4kL9mN2pQ8vW"]`

**PROBLEM**: We need both keys AND labels to do proper reverse mapping!

---

### Issue 3: Frontend Mapping May Not Handle Custom Drill Keys

**File**: `frontend/src/components/Players/ImportResultsModal.jsx`

The `generateDefaultMapping` function (from `csvUtils.js`) may not know how to map:
- CSV column: `"Bench Press"`
- To drill key: `"x7hG4kL9mN2pQ8vW"`

Without seeing `csvUtils.js`, I suspect it does label matching, not key matching.

---

## Diagnostic Steps

To confirm the root cause, we need to:

### 1. Check if Custom Drills are in availableDrills

**Action**: Add console logging in `ImportResultsModal.jsx` after schema fetch.

**Current logging** (Line 84):
```javascript
console.log("[ImportResultsModal] availableDrills updated:", {
  count: availableDrills.length,
  names: availableDrills.map(d => d.label),
  ids: availableDrills.map(d => d.key)
});
```

**Verify**: Are custom drill keys appearing in the `ids` array?

---

### 2. Check Backend Parse Result

**Action**: Add logging in `parse_import_file` to see what keys are returned.

**Add after line 159** in `backend/routes/imports.py`:
```python
sample_row = result.valid_rows[0] if result.valid_rows else {}
logging.info(f"[PARSE_DEBUG] Sample parsed row keys: {list(sample_row.get('data', {}).keys())}")
```

**Verify**: Are drill score keys normalized correctly?

---

### 3. Check Frontend Mapping

**Action**: Add logging before submit in `ImportResultsModal.jsx`.

**Add before line 313**:
```javascript
console.log("[IMPORT_DEBUG] Key Mapping:", keyMapping);
console.log("[IMPORT_DEBUG] First player to upload:", playersToUpload[0]);
```

**Verify**: Are drill keys mapped correctly?

---

### 4. Check Backend Receipt

**Action**: Verify existing logging in `players.py`.

**Existing log** (Line 284):
```python
logging.info(f"[IMPORT_DEBUG] Server Drill Fields for Event {event_id}: {drill_fields}")
```

**Existing log** (Line 345):
```python
logging.info(f"[IMPORT_DEBUG] First Player Payload Keys: {list(player.keys())}")
```

**Verify**: 
- Are custom drill keys in `drill_fields`?
- Are custom drill keys in received player payload?

---

## Recommended Fixes

### Fix 1: Improve `_normalize_header` to Handle Custom Drills

**File**: `backend/utils/importers.py`

**Change signature** to accept full drill definitions:
```python
@staticmethod
def _normalize_header(header: str, schema_drills_map: Dict[str, DrillDefinition] = None) -> str:
    """
    Normalize header string to match canonical field names or schema drill keys.
    
    Args:
        header: The raw header from CSV/Excel
        schema_drills_map: Dict mapping drill.key -> DrillDefinition for reverse lookup
    """
    clean = str(header).strip().lower().replace(' ', '_').replace('-', '_')
    
    # Check exact matches first
    if clean in DataImporter.FIELD_MAPPING:
        return DataImporter.FIELD_MAPPING[clean]
    
    # NEW: Check if it matches any drill KEY exactly
    if schema_drills_map:
        if clean in schema_drills_map:
            return clean  # Already a valid key
        
        # NEW: Reverse lookup by label
        for key, drill in schema_drills_map.items():
            drill_label_normalized = drill.label.strip().lower().replace(' ', '_').replace('-', '_')
            if clean == drill_label_normalized:
                return key  # Map to actual key
    
    # ... rest of fuzzy matching ...
```

**Update callers** to pass dict instead of list.

---

### Fix 2: Ensure Frontend Mapping Includes Custom Drills

**File**: `frontend/src/utils/csvUtils.js`

**CONFIRMED ISSUE**: The `generateDefaultMapping` function does NOT create synonyms for custom drill labels.

**At line 307**, it gets synonyms:
```javascript
const keySynonyms = synonyms[key] || [key];
```

For custom drills with key `"x7hG4kL9mN2pQ8vW"`, this returns `["x7hG4kL9mN2pQ8vW"]`.

If CSV header is `"Bench Press"`, the match score is 0 because:
- `normalizeHeader("Bench Press")` = `"bench press"`
- `normalizeHeader("x7hG4kL9mN2pQ8vW")` = `"x7hg4kl9mn2pq8vw"`
- No match!

**FIX NEEDED**: Add drill labels as synonyms before matching.

```javascript
export function generateDefaultMapping(headers = [], drillDefinitions = []) {
  const mapping = {};
  const confidence = {};
  
  const allKeys = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  const drillKeys = drillDefinitions.map(drill => drill.key);
  allKeys.push(...drillKeys);
  
  const synonyms = getHeaderSynonyms();
  
  // NEW: Add drill labels as synonyms for each drill key
  drillDefinitions.forEach(drill => {
    if (!synonyms[drill.key]) {
      synonyms[drill.key] = [];
    }
    // Add the label as a synonym (if it's different from the key)
    const normalizedKey = normalizeHeader(drill.key);
    const normalizedLabel = normalizeHeader(drill.label);
    
    if (normalizedKey !== normalizedLabel && !synonyms[drill.key].includes(normalizedLabel)) {
      synonyms[drill.key].push(drill.label);
    }
    // Also add the key itself
    if (!synonyms[drill.key].includes(drill.key)) {
      synonyms[drill.key].push(drill.key);
    }
  });
  
  const usedHeaders = new Set();
  
  // ... rest of function unchanged ...
}
```

---

### Fix 3: Add Validation & User Feedback

**File**: `frontend/src/components/Players/ImportResultsModal.jsx`

**At submit time** (before line 313), validate that all mapped drill columns exist in schema:

```javascript
const unmappedDrills = Object.entries(keyMapping)
  .filter(([source, target]) => {
    if (target === '__ignore__') return false;
    const isDrill = !STANDARD_FIELDS.some(f => f.key === target);
    if (isDrill) {
      const drillExists = availableDrills.some(d => d.key === target);
      return !drillExists;
    }
    return false;
  });

if (unmappedDrills.length > 0) {
  console.error("[IMPORT_ERROR] Unmapped drills:", unmappedDrills);
  setError(`Cannot save scores for: ${unmappedDrills.map(([s]) => s).join(', ')}. These drills don't exist in the event schema.`);
  return;
}
```

---

### Fix 4: Add Comprehensive Import Summary

**File**: `backend/routes/players.py`

**After line 507**, add detailed logging:

```python
# Log summary by drill for debugging
logging.info(f"[IMPORT_SUMMARY] Event {event_id}: {scores_written_total} total scores written across {len(scores_written_by_drill)} drills")
for drill_key, count in scores_written_by_drill.items():
    logging.info(f"  - {drill_key}: {count} scores")

# Log any drills that were expected but not received
expected_drills = set(drill_fields)
received_drills = set(scores_written_by_drill.keys())
missing_drills = expected_drills - received_drills
if missing_drills:
    logging.warning(f"[IMPORT_WARNING] Expected but not received: {missing_drills}")
```

---

## Testing Protocol

### Test Case 1: Standard Drills Only

**Setup**: Event with only football template drills (no custom drills)

**CSV**:
```csv
First Name,Last Name,Jersey Number,40m Dash,Vertical Jump
John,Doe,10,4.5,32
```

**Expected**: Both scores save successfully

**Verify**: Check `scores_written_by_drill` in logs

---

### Test Case 2: Custom Drill with Exact Key Match

**Setup**: Event with custom drill (key: `test_drill_123`, label: `Test Drill`)

**CSV**:
```csv
First Name,Last Name,Jersey Number,test_drill_123
John,Doe,10,50
```

**Expected**: Score saves successfully

**Verify**: Check `scores_written_by_drill` includes `test_drill_123`

---

### Test Case 3: Custom Drill with Label Match

**Setup**: Same event as Test Case 2

**CSV**:
```csv
First Name,Last Name,Jersey Number,Test Drill
John,Doe,10,50
```

**Expected**: Score saves successfully (after Fix 1 implemented)

**Current State**: Likely FAILS

**Verify**: Check if `_normalize_header("Test Drill")` returns `"test_drill_123"`

---

### Test Case 4: Mixed Standard and Custom Drills

**Setup**: Event with football template + custom drill

**CSV**:
```csv
First Name,Last Name,Jersey Number,40m Dash,Bench Press
John,Doe,10,4.5,225
```

**Expected**: Both scores save

**Verify**: Check `scores_written_by_drill` includes both drill keys

---

## Immediate Action Items

1. ✅ Document current state (this file)
2. ⬜ Add diagnostic logging to all 4 checkpoints
3. ⬜ Run test with actual custom drill and capture logs
4. ⬜ Implement Fix 1 (improve `_normalize_header`)
5. ⬜ Test Fix 1 with all test cases
6. ⬜ Implement remaining fixes if needed
7. ⬜ Add integration test to prevent regression

---

## Conclusion

**Primary Root Cause**: Custom drill labels in CSV headers are not being correctly mapped to their Firestore document ID keys.

**Why It's Silent**: 
- No error is thrown because the mapping produces valid data
- Backend simply doesn't find matching keys and skips those columns
- Frontend shows "Import Complete" even when 0 scores were saved

**Critical Fix**: Implement reverse label-to-key mapping in `_normalize_header` function.

**Additional Recommendations**:
- Add pre-submit validation in frontend
- Add post-import summary showing which drills were saved
- Add warning if 0 scores were written but columns were mapped

---

**Next Steps**: Run diagnostic logging on a real import attempt to confirm hypothesis.
