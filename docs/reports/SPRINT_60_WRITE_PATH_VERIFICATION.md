# Write-Path Verification: sprint_60 CSV Import to Firestore

**Date:** January 4, 2026  
**Purpose:** Confirm sprint_60 values are correctly stored in Firestore and displayed on scorecards

---

## Complete Write Path Analysis

### Frontend: CSV → Mapped Payload

**File:** `frontend/src/utils/csvUtils.js`

```javascript
// Step 1: Parse CSV
CSV Column: "60-Yard Sprint" → header: "60-Yard Sprint"

// Step 2: Generate mapping with synonyms
generateDefaultMapping(headers, drillDefinitions)
  → Checks synonyms['sprint_60'] = ['60 yard sprint', '60-yard sprint', ...]
  → Match found: { sprint_60: "60-Yard Sprint" }

// Step 3: Apply mapping
applyMapping(rows, mapping, drillDefinitions)
  → Row: { "60-Yard Sprint": "7.5" }
  → Transformed: { sprint_60: "7.5" }
```

**Frontend Payload to Backend:**
```json
POST /players/upload
{
  "event_id": "xyz",
  "players": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "sprint_60": "7.5",  // ← CRITICAL: Must be sprint_60, not "60-Yard Sprint"
      "age_group": "15U"
    }
  ]
}
```

### Backend: Payload → Firestore

**File:** `backend/routes/players.py` (lines 530-588)

```python
# Step 1: Extract drill fields from schema (line 295)
schema = get_event_schema(event_id)
drill_fields = [d.key for d in schema.drills]  # ['sprint_60', 'exit_velocity', ...]

# Step 2: Process incoming scores (lines 530-538)
for drill_key in drill_fields:
    if drill_key in player:  # Check if 'sprint_60' exists in payload
        val = player.get(drill_key)
        if val is not None:
            incoming_scores[drill_key] = val  # incoming_scores['sprint_60'] = '7.5'

# Step 3: Validate and convert (lines 546-561)
for drill_key, raw_val in incoming_scores.items():
    if raw_val is not None and str(raw_val).strip() != "":
        val_float = float(raw_val)  # Convert '7.5' → 7.5
        scores[drill_key] = val_float  # scores['sprint_60'] = 7.5
        scores_written_total += 1
        scores_written_by_drill[drill_key] += 1

# Step 4: Store in player document (line 563)
player_data["scores"] = scores  # { "sprint_60": 7.5, "exit_velocity": 85.0, ... }

# Step 5: Write to Firestore (line 588)
player_ref = db.collection("events").document(event_id).collection("players").document(player_id)
batch.set(player_ref, player_data, merge=True)
```

**Firestore Document Structure:**
```
/events/{event_id}/players/{player_id}
{
  "name": "John Doe",
  "first": "John",
  "last": "Doe",
  "number": 12,
  "age_group": "15U",
  "scores": {
    "sprint_60": 7.5,          // ← STORED HERE
    "exit_velocity": 85.0,
    "throwing_velocity": 78.0,
    "fielding_accuracy": 92.0,
    "pop_time": 2.1
  },
  "created_at": "2026-01-04T10:30:00.000Z"
}
```

### Backend: Firestore → API Response

**File:** `backend/routes/players.py` (lines 99-147)

```python
# GET /players?event_id=xyz

# Step 1: Retrieve player document (line 132)
for player in players_stream:
    player_dict = player.to_dict()
    player_dict["id"] = player.id
    
    # Step 2: Flatten scores for frontend compatibility (lines 136-142)
    scores = player_dict.get("scores", {})  # { "sprint_60": 7.5, ... }
    if scores:
        for k, v in scores.items():
            if k not in player_dict:
                player_dict[k] = v  # player_dict['sprint_60'] = 7.5
```

**API Response:**
```json
{
  "id": "player123",
  "name": "John Doe",
  "age_group": "15U",
  "scores": {
    "sprint_60": 7.5,
    "exit_velocity": 85.0
  },
  "sprint_60": 7.5,      // ← Also flattened for convenience
  "exit_velocity": 85.0,
  "composite_score": 245.3
}
```

### Frontend: API Response → Scorecard Display

**File:** `frontend/src/components/PlayerScorecardGenerator.jsx` (lines 66-79)

```javascript
const drillAnalysis = React.useMemo(() => {
  return drills.map(drill => {
    // Try scores map first, then flattened key
    const playerScore = player.scores?.[drill.key] ?? player[drill.key];
    // playerScore = player.scores?.['sprint_60'] ?? player['sprint_60']
    // playerScore = 7.5 ✓
    
    if (playerScore === null || playerScore === undefined) {
      return { ...drill, playerScore: null, recommendation: 'No score recorded' };
    }
    
    return {
      ...drill,
      playerScore,  // 7.5
      rank: calculateRank(),
      percentile: calculatePercentile()
    };
  });
}, [player, drills]);
```

**Scorecard HTML Output:**
```html
<div class="drill-card">
  <div class="drill-title">60-Yard Sprint</div>
  <div class="score-large">7.5 sec</div>  <!-- ✓ DISPLAYS CORRECTLY -->
  <div class="rank-info">Rank: 3 of 25 (88th percentile)</div>
</div>
```

---

## Verification Test Plan

### Test 1: Auto-Mapped Column (60-Yard Sprint)

**CSV Input:**
```csv
First Name,Last Name,Age Group,60-Yard Sprint,Exit Velocity
John,Doe,15U,7.5,85
```

**Expected Behavior:**
1. Frontend mapping shows: `"60-Yard Sprint" → sprint_60` (high confidence)
2. Backend logs: `[IMPORT_INFO] sprint_60: 1 scores`
3. Firestore document:
   ```json
   { "scores": { "sprint_60": 7.5 } }
   ```
4. GET /players response:
   ```json
   { "sprint_60": 7.5, "scores": { "sprint_60": 7.5 } }
   ```
5. Scorecard displays: **"7.5 sec"** (not 0.0)

**Verification Commands:**
```javascript
// Browser console after import
console.log("[CSV] Mapping:", keyMapping);
// Should show: { "60-Yard Sprint": "sprint_60" }

// After import success
api.get(`/players?event_id=${eventId}`).then(res => {
  const player = res.data[0];
  console.log("Player scores:", player.scores);
  console.log("sprint_60 value:", player.scores?.sprint_60);
});
// Should show: { sprint_60: 7.5 }
```

### Test 2: Manual Mapping (60yd_dash_sec → sprint_60)

**CSV Input:**
```csv
First Name,Last Name,Age Group,60yd_dash_sec
Jane,Smith,15U,8.2
```

**User Action:**
1. Import modal shows unmapped column: `60yd_dash_sec`
2. User manually selects dropdown: `60yd_dash_sec → 60-Yard Sprint (sprint_60)`
3. Submit import

**Expected Behavior:**
1. Frontend payload includes: `{ "sprint_60": "8.2" }` (remapped)
2. Backend processes as sprint_60
3. Firestore stores: `{ "scores": { "sprint_60": 8.2 } }`
4. Scorecard displays: **"8.2 sec"**

**Verification:**
```javascript
// Check the transformed payload before upload
console.log("Transformed players:", transformedPlayers);
// Should show: [{ first_name: "Jane", sprint_60: "8.2" }]

// After import
api.get(`/players?event_id=${eventId}`).then(res => {
  const jane = res.data.find(p => p.name === "Jane Smith");
  console.log("Jane's sprint_60:", jane.scores?.sprint_60);
});
// Should show: 8.2
```

### Test 3: Multiple Drill Import

**CSV Input:**
```csv
First Name,Last Name,Age Group,60-Yard Sprint,Exit Velocity,Throwing Velocity
Mike,Johnson,15U,7.8,88,82
```

**Expected Backend Logs:**
```
[IMPORT_INFO] Event xyz123: 3 total scores written across 3 drills
  - sprint_60: 1 scores
  - exit_velocity: 1 scores
  - throwing_velocity: 1 scores
```

**Firestore Document:**
```json
{
  "name": "Mike Johnson",
  "scores": {
    "sprint_60": 7.8,
    "exit_velocity": 88.0,
    "throwing_velocity": 82.0
  }
}
```

---

## Firestore Console Verification

### Direct Database Query

```bash
# Using Firestore console or CLI
gcloud firestore query \
  --collection-group=players \
  --filter='name==John Doe' \
  --project=woo-combine

# Expected output:
{
  "name": "John Doe",
  "scores": {
    "sprint_60": 7.5,
    ...
  }
}
```

### Browser DevTools

```javascript
// After import, inspect Network tab
// Filter for: /players/upload
// Check Response:
{
  "added": 1,
  "scores_written_total": 5,
  "scores_written_by_drill": {
    "sprint_60": 1,      // ✓ Confirms sprint_60 was written
    "exit_velocity": 1,
    ...
  }
}

// Then fetch player data
// Filter for: /players?event_id=xyz
// Check Response:
[
  {
    "id": "player123",
    "name": "John Doe",
    "scores": {
      "sprint_60": 7.5   // ✓ Confirms value is persisted
    },
    "sprint_60": 7.5     // ✓ Also flattened
  }
]
```

---

## Common Issues & Diagnostics

### Issue 1: Value Shows 0.0 on Scorecard

**Diagnostic:**
```javascript
// Check what the scorecard receives
const player = /* player object */;
const drill = { key: 'sprint_60' };

console.log("Scorecard reading:");
console.log("  player.scores:", player.scores);
console.log("  player.scores?.sprint_60:", player.scores?.sprint_60);
console.log("  player.sprint_60:", player.sprint_60);
console.log("  Final value:", player.scores?.sprint_60 ?? player.sprint_60);
```

**Possible Causes:**
- ❌ Mapping sent wrong key (e.g., "60_yard_sprint" instead of "sprint_60")
- ❌ Backend didn't recognize drill_key (not in schema.drills)
- ❌ Value was null/empty in CSV
- ❌ Float conversion failed (non-numeric value)

### Issue 2: Backend Logs "Missing drill_60"

**Diagnostic:**
```python
# Check backend logs for:
[IMPORT_WARNING] Expected drill keys not received: {'sprint_60'}
[IMPORT_WARNING] First row keys for debugging: ['first_name', 'last_name', 'sixty_yard_sprint']
```

**Fix:** Frontend mapping is incorrect. Check synonym match:
```javascript
// In browser console during import preview:
console.log("[csvUtils] Match scores:", matchScores);
// Should show: { header: "60-Yard Sprint", matches: [{ key: "sprint_60", score: 90 }] }
```

---

## Success Criteria Checklist

### For Test 1 (Auto-Mapped)
- [ ] Browser console shows mapping: `"60-Yard Sprint" → sprint_60`
- [ ] Backend logs: `sprint_60: 1 scores`
- [ ] Firestore document contains: `scores.sprint_60 = 7.5`
- [ ] GET /players returns: `sprint_60: 7.5`
- [ ] Scorecard displays: "7.5 sec" (not 0.0)
- [ ] PDF scorecard shows correct value

### For Test 2 (Manual Mapping)
- [ ] User can select `sprint_60` from dropdown
- [ ] Payload contains `sprint_60` key (not original column name)
- [ ] Firestore stores value under `scores.sprint_60`
- [ ] Scorecard displays correct value

### For Test 3 (Remediation)
- [ ] Re-import with updated CSV preserves existing data
- [ ] New sprint_60 scores are added/updated
- [ ] Other drills remain unchanged
- [ ] No duplicate player documents created

---

## Next Steps

1. **Deploy fix to production** (synonym additions)
2. **Import test CSV** with Baseball event containing 60-yard sprint
3. **Verify Firestore** document structure using console
4. **Check scorecard** display for at least 1 player
5. **Test manual mapping** with non-standard column name
6. **Document remediation** instructions for existing events (see Test 3)

---

**Status:** Documentation complete, ready for manual verification

