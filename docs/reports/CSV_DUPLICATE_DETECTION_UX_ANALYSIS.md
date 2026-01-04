# CSV Import Duplicate Detection – UX Analysis & Improvement Plan

**Date:** January 4, 2026  
**Status:** Investigation Complete  
**Priority:** P1 (UX Enhancement)  
**Related:** Sprint_60 Fix Verification

---

## Executive Summary

During verification of the sprint_60 fix, we confirmed that the CSV importer is flagging **"Duplicate player in file"** errors even when spreadsheets appear valid to users. This is technically correct behavior but creates significant UX confusion because:

1. ✅ **What Works:** The duplicate detection correctly identifies when multiple rows resolve to the same identity
2. ❌ **What's Confusing:** Users don't understand which fields caused the collision or why rows appear different to them
3. ❌ **What's Missing:** No actionable guidance on how to fix the issue

---

## Current Implementation

### Backend Duplicate Detection Logic

**Location:** `backend/routes/players.py` lines 465-472

```python
# Check local batch duplicates
key = (first_name.lower(), last_name.lower(), num)
if key in seen_keys:
    errors.append({"row": idx + 1, "message": "Duplicate player in file"})
    continue
seen_keys.add(key)
```

**Identity Key Components:**
1. **First Name** (case-insensitive, normalized)
2. **Last Name** (case-insensitive, normalized)
3. **Jersey Number** (normalized, handles float → int conversion)

### Player ID Generation

**Location:** `backend/utils/identity.py` lines 5-44

```python
def generate_player_id(event_id: str, first: str, last: str, number: Optional[int]) -> str:
    """Generate deterministic ID for deduplication"""
    f = (first or "").strip().lower()
    l = (last or "").strip().lower()
    
    # Clean invisible characters (Zero Width Space, etc.)
    f = "".join(c for c in f if c.isprintable())
    l = "".join(c for c in l if c.isprintable())
    
    n = "nonum" if number is None else str(int(float(str(number).strip())))
    
    raw = f"{event_id}:{f}:{l}:{n}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:20]
```

**Normalization Applied:**
- ✅ Case normalization (`John` = `JOHN` = `john`)
- ✅ Whitespace stripping
- ✅ Invisible character removal (Zero Width Space `\u200b`)
- ✅ Number format normalization (`12` = `12.0` = `"12"`)
- ✅ Age group is NOT part of identity (by design)

---

## Why Users Are Confused

### Scenario 1: Age Group Doesn't Differentiate

**What User Sees:**
```csv
first_name, last_name, age_group, jersey_number
Ryan, Johnson, 12U, 1038
Ryan, Johnson, 14U, 1038
```

**What System Sees:**
- Identity key: `('ryan', 'johnson', 1038)`
- Both rows → **SAME IDENTITY** ❌

**User Confusion:** *"These are different players in different age groups!"*

**Why This Happens:** Age group is intentionally NOT part of identity to allow players to participate in multiple age groups (e.g., playing up).

---

### Scenario 2: Invisible Characters

**What User Sees:**
```csv
John Smith
John Smith
```

**What System Sees:**
- Row 1: `"john\u200bsmith"` (contains Zero Width Space)
- Row 2: `"johnsmith"` (clean)
- After normalization → **SAME IDENTITY** ✅

**User Confusion:** *"These look identical, why is one an error?"*

**Why This Happens:** CSV exports from Excel/Google Sheets can contain invisible characters that are cleaned during normalization.

---

### Scenario 3: Number Format Variations

**What User Sees:**
```csv
first_name, last_name, jersey_number
Mike, Davis, 12
Mike, Davis, 12.0
```

**What System Sees:**
- Row 1: number = `12` (int)
- Row 2: number = `12.0` (float)
- After normalization → **SAME IDENTITY** ✅

**User Confusion:** *"12 and 12.0 are not the same!"*

**Why This Happens:** CSV parsers interpret numbers differently; our system normalizes `12.0` → `12`.

---

## Current Error Message Issues

### What Users See Now

```
❌ Import Error (Row 37)
Duplicate player in file
```

**Problems:**
1. ❌ No indication of which fields caused collision
2. ❌ No visibility into what the "first" matching row was
3. ❌ No guidance on how to fix
4. ❌ Users must manually search entire spreadsheet to find the original

### Import Summary Ambiguity

```
✅ Import Complete
48 new players created
0 players updated
```

**Problems:**
1. ❌ No mention that 5 rows were rejected as duplicates
2. ❌ Users assume success means ALL rows imported
3. ❌ No actionable data in the summary

---

## Proposed Improvements

### 1. Enhanced Error Messages ⭐ **HIGH PRIORITY**

**Current:**
```
Duplicate player in file
```

**Proposed:**
```
Duplicate: Ryan Johnson #1038 (14U) matches Row 24
→ Players are matched by name + jersey number, regardless of age group
→ TIP: Change jersey number or merge into a single row
```

**Implementation:**
- Track first occurrence row number in `seen_keys` dictionary
- Include all identity components in error message
- Add contextual explanation about matching logic
- Provide actionable resolution guidance

**Code Changes Required:**
```python
# backend/routes/players.py
seen_keys = {}  # Change from set() to dict to track row numbers

key = (first_name.lower(), last_name.lower(), num)
if key in seen_keys:
    first_row = seen_keys[key]
    error_msg = (
        f"Duplicate: {first_name} {last_name} #{num} ({age_group or 'No age group'}) "
        f"matches Row {first_row}. Players are matched by name + jersey number. "
        f"TIP: Assign different jersey numbers or merge into a single row."
    )
    errors.append({"row": idx + 1, "message": error_msg, "data": player})
    continue
seen_keys[key] = idx + 1  # Store row number
```

---

### 2. Import Summary Transparency ⭐ **HIGH PRIORITY**

**Current:**
```
✅ 48 new / 0 updated
```

**Proposed:**
```
✅ Import Complete
48 new players created
0 players updated
5 rows skipped (duplicates)

⚠️ Review Rejected Rows:
• Row 37: Duplicate Ryan Johnson #1038 matches Row 24
• Row 58: Duplicate Sarah Lee #2045 matches Row 12
• Row 62: Duplicate Mike Davis #3012 matches Row 55
```

**Implementation:**
- Add `rejected_count` and `rejected_details` to response
- Display rejected rows in collapsible section
- Provide download option for rejected rows CSV

**Code Changes Required:**
```python
# backend/routes/players.py
return {
    "created_players": created_players,
    "updated_players": updated_players,
    "rejected_count": len(errors),
    "rejected_rows": errors,  # Include full error details
    "scores_written_total": scores_written_total,
    "errors": errors
}
```

---

### 3. Scores-Only Mode: Allow Duplicate Identities? 🤔 **DISCUSSION NEEDED**

**Question:** Should `scores_only` mode allow duplicate identities and merge scores instead of erroring?

**Current Behavior:**
- Upload mode: `scores_only`
- Two rows with same identity → **ERROR** (2nd row rejected)

**Proposed Behavior (Option A):**
- Upload mode: `scores_only`
- Two rows with same identity → **MERGE** scores from both rows
- Use case: Importing partial drill results from multiple sessions

**Example:**
```csv
first_name, last_name, jersey_number, sprint_60, exit_velocity
Ryan, Johnson, 1038, 7.2, 
Ryan, Johnson, 1038, , 85.5
```

**After merge:**
```
Ryan Johnson #1038:
  sprint_60: 7.2
  exit_velocity: 85.5
```

**Pros:**
- ✅ Allows importing drill results from multiple sources
- ✅ Enables split data collection (one coach records sprint, another records bat speed)
- ✅ Reduces import errors for valid use cases

**Cons:**
- ❌ Adds complexity to upload logic
- ❌ Risk of unintentional overwrites if same drill present in both rows
- ❌ Unclear behavior if scores conflict (which value wins?)

**Recommendation:** **DEFER** until we have real user request for this use case. Current behavior is simpler and safer.

---

### 4. Overwrite/Merge Options UI 🔧 **MEDIUM PRIORITY**

**Question:** Do we want explicit "overwrite existing row" or "merge duplicate rows" options during import?

**Proposed UI Enhancement:**

```
⚠️ Duplicate Rows Detected (5 duplicates)

How should we handle duplicates?
○ Skip duplicates (keep first occurrence only)
○ Overwrite earlier rows (keep last occurrence only)  
○ Merge scores (combine non-empty values)
○ Review each duplicate manually

[Continue Import]
```

**Implementation Complexity:** Medium  
**User Value:** High for power users, potentially confusing for casual users

**Recommendation:** Implement **phased approach**:
1. **Phase 1** (Now): Improve error messages (#1) and summary transparency (#2)
2. **Phase 2** (v2): Add merge options after gathering user feedback
3. **Phase 3** (v3): Add manual review interface for conflicts

---

## Frontend Validation Considerations

**Current Frontend Validation:** None for within-file duplicates

**Potential Enhancement:**
- Frontend could detect duplicate identity keys during preview
- Show warning badge on duplicate rows BEFORE upload
- Allow users to fix in the mapping UI before submission

**Pros:**
- ✅ Faster feedback (no round-trip to backend)
- ✅ Users can fix before upload

**Cons:**
- ❌ Duplicates frontend logic (normalization must match backend exactly)
- ❌ Adds complexity to already-heavy import modal

**Recommendation:** **NOT NOW.** Backend validation is sufficient, focus on better error messages.

---

## Implementation Plan

### Phase 1: Quick Wins (This PR) ⭐

**Estimated Effort:** 2-3 hours  
**Priority:** P1

✅ **Task 1.1:** Enhance backend error messages
- Change `seen_keys` from set to dict to track row numbers
- Include identity components in error message
- Add contextual explanation and resolution tips

✅ **Task 1.2:** Improve import summary
- Add rejected_count to response
- Return rejected_rows with full details
- Update frontend ImportResultsModal to display rejected section

✅ **Task 1.3:** Update documentation
- Document identity key logic in user guide
- Add FAQ entry for duplicate detection
- Include examples of common duplicate scenarios

---

### Phase 2: Advanced Features (Future)

**Estimated Effort:** 8-12 hours  
**Priority:** P2

⏳ **Task 2.1:** Add merge options UI
- Radio button selection for duplicate handling strategy
- Preview impact before import
- Test with real user feedback

⏳ **Task 2.2:** Scores-only merge mode
- Allow multiple rows with same identity in scores_only mode
- Implement safe merge logic (last value wins, or error on conflict?)
- Add comprehensive test coverage

⏳ **Task 2.3:** Manual duplicate review interface
- Side-by-side comparison of duplicate rows
- Per-row decision (keep first, keep second, merge, skip)
- Bulk actions for similar conflicts

---

## Testing Scenarios

### Test Case 1: Same Name + Number, Different Age Groups
```csv
first_name, last_name, age_group, jersey_number
Ryan, Johnson, 12U, 1038
Ryan, Johnson, 14U, 1038
```
**Expected:** Row 2 rejected with message explaining age group is not part of identity

---

### Test Case 2: Case Variations
```csv
first_name, last_name, jersey_number
john, smith, 42
John, Smith, 42
JOHN, SMITH, 42
```
**Expected:** Rows 2 and 3 rejected with message showing normalized names

---

### Test Case 3: Number Format Variations
```csv
first_name, last_name, jersey_number
Mike, Davis, 12
Mike, Davis, 12.0
Mike, Davis, 12.00
```
**Expected:** Rows 2 and 3 rejected with message explaining number normalization

---

### Test Case 4: Invisible Characters (Manual Testing Required)
```csv
John\u200bSmith  (with Zero Width Space)
John Smith      (clean)
```
**Expected:** One row rejected, message explains invisible character removal

---

### Test Case 5: Valid Duplicates in Different Events
```csv
# Event A
Ryan, Johnson, 12U, 1038

# Event B (different event_id)
Ryan, Johnson, 12U, 1038
```
**Expected:** ✅ Both succeed (event_id is part of player_id hash)

---

## Edge Cases & Considerations

### 1. External ID Matching
**Current Logic:**
```python
if incoming_ext_id and incoming_ext_id in external_id_map:
    previous_state = external_id_map[incoming_ext_id]
    player_id = previous_state['id']
else:
    player_id = generate_player_id(event_id, first_name, last_name, num)
```

**Implication:** External ID takes priority over name+number for existing player matching, but duplicate detection within file still uses name+number key.

**Potential Issue:** Two rows with different external IDs but same name+number would be rejected as duplicates, even though they might reference different external systems.

**Recommendation:** Consider including external_id in within-file duplicate key if present.

---

### 2. Missing Jersey Numbers
**Current Logic:**
```python
n = "nonum" if number is None else str(int(float(str(number).strip())))
```

**Implication:** Two players with same name and no jersey number are considered duplicates.

**Example:**
```csv
John, Smith, ,   # No jersey number
John, Smith, ,   # No jersey number
```
**Result:** 2nd row rejected as duplicate

**Is This Correct?** ✅ **YES** – Without jersey numbers, we can't differentiate between players with same name.

**Recommendation:** Keep current behavior but enhance error message to suggest assigning jersey numbers.

---

### 3. Age Group NOT in Identity
**Design Decision:** Age group intentionally excluded to support "playing up" scenarios (e.g., 12-year-old playing in 14U division).

**Consequence:** Users CANNOT import multiple players with same name+number in different age groups within single file.

**Workaround:** Import each age group separately, or assign different jersey numbers.

**Recommendation:** Document this behavior clearly in user guide with examples.

---

## Success Metrics

**Phase 1 Goals:**
- ✅ Zero user confusion about "why is this a duplicate?"
- ✅ Users can identify and fix duplicates within 30 seconds
- ✅ Support ticket reduction for duplicate-related issues by 80%

**Phase 2 Goals (Future):**
- ✅ Users can successfully import multi-source drill data
- ✅ 90% of users complete imports without errors on first try
- ✅ Net Promoter Score improvement for import experience

---

## Related Documentation

- **Sprint 60 Fix:** `docs/reports/DRILL_DATA_MAPPING_FIX_SPRINT_60.md`
- **Player Identity System:** `backend/utils/identity.py`
- **Import Architecture:** `docs/guides/PM_ONBOARDING_OVERVIEW.md`
- **API Contract:** `docs/API_CONTRACT.md`

---

## Questions for Product Decision

1. ✅ **Error Message Enhancement** – Should we proceed with detailed error messages? **APPROVED**
2. ✅ **Import Summary** – Should rejected rows be displayed prominently? **APPROVED**
3. 🤔 **Scores-Only Merge** – Do we need to support merging duplicate identities in scores_only mode? **DEFER**
4. 🤔 **Merge Options UI** – Should users choose how to handle duplicates (skip/overwrite/merge)? **PHASE 2**
5. 🤔 **External ID in Duplicate Key** – Should external_id be included in within-file duplicate detection? **DISCUSS**

---

## Conclusion

The duplicate detection logic is **technically correct** but suffers from **poor UX transparency**. Users are confused not because the system is wrong, but because they don't understand:

1. **What makes two rows "the same"** → Age group is ignored, names are case-insensitive, numbers are normalized
2. **Which row is the "first" occurrence** → No row number reference in error message
3. **How to fix the issue** → No actionable guidance

**Recommended Immediate Action (Phase 1):**
- ✅ Enhance error messages with full identity details + row references
- ✅ Update import summary to show rejected rows prominently
- ✅ Document identity key logic in user guide

**Deferred to Phase 2:**
- ⏳ Merge options UI (skip/overwrite/merge)
- ⏳ Scores-only mode duplicate merging
- ⏳ Manual duplicate review interface

This approach balances **immediate UX improvement** with **long-term flexibility** while keeping implementation complexity reasonable.

---

**Status:** ✅ Ready for Implementation  
**Next Step:** Review with product owner, then proceed with Phase 1 implementation  
**Estimated Delivery:** Phase 1 can ship within 1-2 days

