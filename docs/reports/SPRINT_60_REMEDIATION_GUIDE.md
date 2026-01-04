# Remediation Guide: Existing Baseball Events Missing sprint_60 Data

**Date:** January 4, 2026  
**Issue:** Events imported before sprint_60 synonym fix have missing 60-yard sprint data  
**Solution:** Re-import with `scores_only` mode to backfill drill scores

---

## Problem Statement

Events created before this fix that had CSVs with "60-Yard Sprint" columns likely have:
- ✅ Player roster data (names, numbers, age groups)
- ❌ Missing `sprint_60` scores (displayed as 0.0 or "No score")
- ✅ Other drill scores (exit velocity, throwing velocity, etc.) if they mapped correctly

The data existed in the CSV but wasn't mapped to `sprint_60` due to missing synonyms.

---

## Remediation Strategy: Re-Import with Scores Only Mode

### Why This Works

The WooCombine import system supports **upsert behavior** with two modes:

1. **`create_or_update`** (default)
   - Creates new players or updates all fields for existing players
   - Overwrites roster data (name, number, age_group)
   - Merges drill scores

2. **`scores_only`** ← USE THIS
   - Only updates drill scores in `player.scores` map
   - **Preserves identity fields** (name, number, age_group, external_id)
   - Perfect for backfilling missing drill data

**Backend Code Reference** (`backend/routes/players.py` lines 573-579):
```python
if req.mode == "scores_only":
    # Keep only scores and non-identity fields from payload
    identity_fields = ["name", "first", "last", "number", "age_group", "team_name", "position", "photo_url", "external_id"]
    for f in identity_fields:
        if f in player_data:
            del player_data[f]  # Preserve existing identity data
```

---

## Step-by-Step Remediation Process

### Prerequisites
- ✅ Original CSV file with 60-yard sprint data
- ✅ Event ID of the affected event
- ✅ Organizer role access

### Step 1: Prepare the CSV

**Option A: Use Original CSV (Recommended)**
- Locate the original import file with all columns
- No modifications needed - will re-import with new synonyms

**Option B: Create Scores-Only CSV**
If original file is lost, create a minimal CSV:
```csv
First Name,Last Name,60-Yard Sprint
John,Doe,7.5
Jane,Smith,8.2
Mike,Johnson,7.8
```

**Requirements:**
- Must include `First Name` and `Last Name` for player matching
- Include `Jersey Number` if multiple players share same name
- Include only the drill columns you want to update

### Step 2: Navigate to Import Modal

1. Log in as League Operator
2. Navigate to the affected event
3. Go to **Players** page
4. Click **Import Players** or **Add/Import** button

### Step 3: Configure Import Settings

**Critical Settings:**

1. **Import Intent:** Select **"Update Drill Scores Only"**
   - This sets `mode: "scores_only"` in the API call
   - Preserves all existing player data
   - Only updates `scores` map

2. **File Upload:** Select your CSV file

3. **Column Mapping:**
   - The system will now auto-map "60-Yard Sprint" → `sprint_60` ✅
   - Verify the mapping shows high confidence (green indicator)
   - If manual mapping needed, select dropdown: `60-Yard Sprint → 60-Yard Sprint (sprint_60)`

4. **Preview:** Review that players are matched correctly
   - Players matched by: `first_name` + `last_name` + `jersey_number`
   - Status should show "Update" (not "Create")

### Step 4: Execute Import

1. Click **Import** button
2. Wait for success confirmation
3. Check the import summary:
   ```
   ✓ 25 players updated
   ✓ 25 scores written for sprint_60
   ✓ 0 new players created
   ```

### Step 5: Verify Remediation

**Immediate Verification:**
1. Go to Players page
2. Click on a player who should have sprint_60 data
3. View their scorecard
4. Confirm: **"60-Yard Sprint: 7.5 sec"** (not 0.0)

**Firestore Verification (Optional):**
```javascript
// Browser console
api.get(`/players?event_id=${eventId}`).then(res => {
  const player = res.data[0];
  console.log("Before:", player.scores);
  // Before: { exit_velocity: 85, throwing_velocity: 78 }
  // After:  { exit_velocity: 85, throwing_velocity: 78, sprint_60: 7.5 }
});
```

---

## Batch Remediation: Multiple Events

### For League Operators Managing Multiple Events

If you have multiple Baseball events affected:

1. **Identify affected events:**
   - Events created before January 4, 2026
   - Baseball sport type
   - Missing sprint_60 scores in player scorecards

2. **Prepare CSV files:**
   - One CSV per event (if CSVs differ)
   - OR use same CSV with all players if roster is consistent

3. **Re-import each event:**
   - Switch to each event (event selector in navigation)
   - Follow Steps 2-5 above
   - Takes ~2-3 minutes per event

4. **Bulk verification script** (optional):
```javascript
// Browser console - check all events at once
const eventIds = ['event1', 'event2', 'event3'];

for (const eventId of eventIds) {
  const res = await api.get(`/players?event_id=${eventId}`);
  const playersWithSprint60 = res.data.filter(p => p.scores?.sprint_60);
  console.log(`Event ${eventId}: ${playersWithSprint60.length} players have sprint_60`);
}
```

---

## Player Matching Logic

### How Re-Import Finds Existing Players

The backend uses **deterministic ID generation** for matching:

```python
# backend/routes/players.py
player_id = generate_player_id(event_id, first_name, last_name, jersey_number)
# Returns: hash of event_id + first + last + number
```

**Matching Priority:**
1. **External ID** (if CSV includes `external_id` column) ← HIGHEST
2. **Generated ID** (first_name + last_name + jersey_number)
3. **Name-only** (if jersey_number is null)

**Best Practices:**
- Include jersey_number in remediation CSV for accurate matching
- Use external_id if available (bib numbers, player IDs)
- Match is case-sensitive for names

### Example Matching Scenarios

**Scenario 1: Perfect Match**
```csv
Existing Player:  John Doe, #12
CSV Row:         John,Doe,12,7.5
Result:          ✓ Matched by generated ID → Updates scores.sprint_60 = 7.5
```

**Scenario 2: Name Match (No Number)**
```csv
Existing Player:  Jane Smith, #null
CSV Row:         Jane,Smith,,8.2
Result:          ✓ Matched by name → Updates scores.sprint_60 = 8.2
```

**Scenario 3: No Match (Creates New)**
```csv
Existing Player:  Mike Johnson, #15
CSV Row:         Michael,Johnson,15,7.8
Result:          ✗ Not matched (name mismatch) → Creates new player
                 ⚠️ Warning: Duplicate detected
```

**Fix for Scenario 3:** Ensure CSV names exactly match existing players.

---

## Edge Cases & Troubleshooting

### Issue 1: Import Creates Duplicates Instead of Updating

**Cause:** Name mismatch between CSV and existing player

**Diagnosis:**
```javascript
// Fetch existing player names
api.get(`/players?event_id=${eventId}`).then(res => {
  const names = res.data.map(p => ({ name: p.name, number: p.number }));
  console.table(names);
});

// Compare against CSV first_name + last_name
```

**Solution:**
- Ensure CSV names match exactly (case-sensitive)
- Include jersey_number for reliable matching
- Or use external_id if available

### Issue 2: Some Sprint Scores Still Show 0.0

**Possible Causes:**
1. Player wasn't included in remediation CSV
2. CSV had empty/null value for that player
3. Player name didn't match (created new player instead)

**Diagnosis:**
```javascript
// Check which players got updated
api.get(`/players?event_id=${eventId}`).then(res => {
  const missing = res.data.filter(p => !p.scores?.sprint_60);
  console.log("Still missing sprint_60:", missing.map(p => p.name));
});
```

**Solution:** Re-import with CSV containing those specific players.

### Issue 3: Other Drill Scores Got Overwritten

**Cause:** Used `create_or_update` mode instead of `scores_only`

**Prevention:** Always use **"Update Drill Scores Only"** mode for remediation

**Recovery:** The system maintains import history:
1. Go to Admin Tools → Import History
2. Find the problematic import
3. Click "Undo" to revert
4. Re-import with correct mode

---

## Automated Remediation Script (Future Enhancement)

**Not implemented yet**, but for future consideration:

```python
# Backend migration script concept
def backfill_sprint_60_from_import_history(event_id):
    """
    Analyze import history logs, extract original CSV data,
    re-process with updated synonyms, and backfill missing scores.
    """
    # 1. Fetch import history from /events/{event_id}/imports
    # 2. Find imports with "60-Yard Sprint" or similar column
    # 3. Extract raw CSV data from import log
    # 4. Re-process with current synonym dictionary
    # 5. Update only sprint_60 scores for matched players
    pass
```

**Why not included:** 
- Import logs don't store original CSV data (only metadata)
- Users typically have original files
- Manual re-import is simple and safe

---

## Communication Template

### For Affected Customers

**Subject:** Action Required: Update Baseball Combine Sprint Times

**Body:**
```
Hi [Customer Name],

We've identified and fixed an issue where 60-yard sprint times from your 
CSV import weren't being stored correctly. Your player roster data is 
intact, but sprint times may show as 0.0 on scorecards.

To restore the missing data:

1. Locate your original CSV import file
2. Go to your Baseball event in WooCombine
3. Click "Import Players" → Select "Update Drill Scores Only"
4. Upload your original CSV file
5. Verify the mapping shows "60-Yard Sprint → 60-Yard Sprint"
6. Click Import

This will backfill the missing sprint times without affecting any other 
data. The process takes less than 2 minutes.

If you need assistance or don't have the original file, please contact 
support and we'll help recover the data.

Thank you for your patience!
The WooCombine Team
```

---

## Verification Checklist

After remediation for each event:

- [ ] Import completed successfully (no errors)
- [ ] Import summary shows: `N scores written for sprint_60`
- [ ] Import summary shows: `0 new players created` (all matched existing)
- [ ] Random sample of 3-5 scorecards display correct sprint_60 values
- [ ] Rankings page shows sprint_60 contributing to composite scores
- [ ] PDF scorecards export with correct drill values
- [ ] No duplicate player entries created

---

## Prevention

To prevent similar issues in future sport templates:

1. **Always add synonyms** when creating new sport schemas
2. **Test CSV import** with various column name formats
3. **Monitor import logs** for "Expected drill keys not received" warnings
4. **Add UI validation** that warns if numeric columns aren't mapped

---

**Status:** Remediation process documented and ready for user communication

