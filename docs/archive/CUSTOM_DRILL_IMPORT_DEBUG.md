# Debug Investigation: Custom Drill Import Warning

## Issue Summary

**User Report**: Users see confusing "data will not be imported" warning during CSV import even though:
- Columns like "40yd Dash", "30m Sprint", "Shooting Accuracy" appear auto-mapped in preview
- Dropdowns show selections and values render correctly
- Preview looks perfect

**Root Cause Hypothesis**: Auto-mapping matches header → drill label, but the validation logic thinks those columns are "unmapped" because it's checking for drill IDs rather than labels.

## System Architecture

### Frontend Flow

1. **Schema Fetch** (Line 19-29):
   ```javascript
   api.get(`/events/${selectedEvent.id}/schema`)
     .then(res => {
       setServerDrills(res.data.drills);  // Contains: [{ key, label, unit, ... }]
     })
   ```

2. **Auto-Mapping** (Line 309-335):
   ```javascript
   const { mapping, confidence } = generateDefaultMapping(sourceKeys, effectiveDrills);
   // Returns: { [drillKey]: csvHeader }
   // Example: { "x7hG4kL9mN2pQ8vW": "40yd Dash" }
   ```

3. **Validation** (Line 404-415):
   ```javascript
   const validKeys = new Set([
     ...STANDARD_FIELDS.map(f => f.key),
     ...effectiveDrills.map(d => d.key)  // Should include custom drill keys
   ]);
   
   const invalidMappings = activeMappings.filter(([sourceKey, targetKey]) => {
     return !validKeys.has(targetKey);  // Checks if targetKey is in schema
   });
   ```

4. **Warning Trigger** (Line 444-463):
   ```javascript
   if (invalidMappings.length > 0 && hasDataLossRisk) {
     window.confirm(`⚠️ WARNING: Potential Data Loss...`);
   }
   ```

### Backend Expectation

From `backend/routes/players.py` (Line 532-538):
```python
# Backend checks for drill keys in flat payload
for drill_key in drill_fields:  # drill_fields = [d.key for d in schema.drills]
    if drill_key in player:
        incoming_scores[drill_key] = player[drill_key]
```

Backend expects keys like `x7hG4kL9mN2pQ8vW`, not labels like `"40yd Dash"`.

## Debug Logging Added

### Location 1: Auto-Mapping Step (Line 326-336)
```javascript
console.log("[ImportResultsModal] Processing mapping:", {
    targetKey,        // Should be: "x7hG4kL9mN2pQ8vW"
    sourceHeader,     // CSV header: "40yd Dash"
    isDrillKey,       // Should be: true
    intent,           // "roster_and_scores"
    willMap           // Should be: true
});
```

**Expected Output** (for custom drills):
```
targetKey: "x7hG4kL9mN2pQ8vW"
sourceHeader: "40yd Dash"
isDrillKey: true
willMap: true
```

### Location 2: Validation Check (Line 404-429)
```javascript
console.log("[ImportResultsModal] Validation Setup:", {
    validKeysCount,              // Should include all drills
    validKeys,                   // Array of all valid keys
    effectiveDrillsCount,        // Number of drills in schema
    effectiveDrills,             // Full drill objects with key+label
    keyMappingEntries            // What was actually mapped
});

// Per invalid mapping:
console.log("[ImportResultsModal] Invalid mapping detected:", {
    sourceKey,                   // CSV header
    targetKey,                   // What it mapped to
    validKeysHas,               // false = problem!
    matchingDrill               // Should find drill or undefined
});
```

## Possible Root Causes

### Theory 1: effectiveDrills Missing Drill Keys
**Symptom**: `effectiveDrills.map(d => d.key)` returns empty or incomplete array
**Check**: Does `effectiveDrills` contain custom drill objects?
**Fix**: Ensure schema response includes all custom drills

### Theory 2: generateDefaultMapping Returns Labels Instead of Keys
**Symptom**: `targetKey` in mapping is `"40yd Dash"` instead of `"x7hG4kL9mN2pQ8vW"`
**Check**: Does `generateDefaultMapping` return drill keys or labels?
**Fix**: Update `csvUtils.js` to return keys, not labels

### Theory 3: keyMapping State Corruption
**Symptom**: Initial mapping is correct but gets overwritten
**Check**: Are there multiple setState calls affecting keyMapping?
**Fix**: Trace all setKeyMapping calls

### Theory 4: Schema API Returns Wrong Format
**Symptom**: Backend returns drills without `key` field
**Check**: Does `/events/{id}/schema` return `key` field for custom drills?
**Fix**: Update backend serialization

## Expected Console Output (Normal Flow)

```
[csvUtils] generateDefaultMapping called with:
  headers: ["First Name", "Last Name", "40yd Dash", "Bench Press"]
  drillCount: 8
  drillKeys: ["40m_dash", "vertical_jump", "x7hG4kL9mN2pQ8vW", "y8iH5lM0nO3qR9wX"]
  drillLabels: ["40M Dash", "Vertical Jump", "40yd Dash", "Bench Press"]

[ImportResultsModal] Processing mapping:
  targetKey: "x7hG4kL9mN2pQ8vW"
  sourceHeader: "40yd Dash"
  isDrillKey: true
  willMap: true

[ImportResultsModal] Validation Setup:
  validKeysCount: 16
  validKeys: ["first_name", "last_name", ..., "x7hG4kL9mN2pQ8vW", "y8iH5lM0nO3qR9wX"]
  effectiveDrills: [
    { key: "x7hG4kL9mN2pQ8vW", label: "40yd Dash" },
    { key: "y8iH5lM0nO3qR9wX", label: "Bench Press" }
  ]
  keyMappingEntries: [
    ["First Name", "first_name"],
    ["Last Name", "last_name"],
    ["40yd Dash", "x7hG4kL9mN2pQ8vW"],
    ["Bench Press", "y8iH5lM0nO3qR9wX"]
  ]

// NO invalid mapping logs = SUCCESS
```

## Expected Console Output (Bug Scenario)

```
[ImportResultsModal] Processing mapping:
  targetKey: "40yd Dash"  // ❌ WRONG - Should be key, not label
  sourceHeader: "40yd Dash"
  isDrillKey: false       // ❌ Can't find drill because checking label not key
  willMap: true

[ImportResultsModal] Validation Setup:
  validKeysCount: 13
  validKeys: ["first_name", "last_name", ..., "x7hG4kL9mN2pQ8vW"]  // ✅ Has key
  keyMappingEntries: [
    ["40yd Dash", "40yd Dash"]  // ❌ Mapped to itself (label), not to key
  ]

[ImportResultsModal] Invalid mapping detected:
  sourceKey: "40yd Dash"
  targetKey: "40yd Dash"      // ❌ Label, not key
  validKeysHas: false          // ❌ "40yd Dash" not in validKeys
  matchingDrill: undefined     // ❌ Can't find drill with key="40yd Dash"
```

## Next Steps

1. ✅ **Deploy debug logging** - Build successful, ready for testing
2. **User tests import** - Ask user to import CSV with custom drills
3. **Analyze console logs** - Identify which theory is correct
4. **Apply targeted fix** - Based on root cause findings
5. **Verify warning disappears** - Test with same CSV

## Testing Instructions for User

1. Open browser console (F12 → Console tab)
2. Navigate to Import Results modal
3. Upload a CSV with custom drill columns (e.g., "40yd Dash", "Bench Press")
4. Wait for auto-mapping to complete
5. Copy ALL console logs starting with `[ImportResultsModal]` or `[csvUtils]`
6. Click "Import Data" button
7. Note if warning appears
8. Share console logs for analysis

## Files Modified

- `frontend/src/components/Players/ImportResultsModal.jsx`
  - Added 3 console.log statements for diagnostic purposes
  - Lines 326-336: Auto-mapping process logging
  - Lines 404-429: Validation setup and invalid mapping detection

## Deployment Status

✅ Build successful (3,177 modules)
✅ No linting errors
✅ Ready for production testing

