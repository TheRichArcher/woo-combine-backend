# Phase 1 QA Checklist - Ready for Testing

**Commit:** `4c5a863` (includes wording enhancements)  
**Previous:** `77c2c8c` (initial implementation)  
**Status:** ✅ Ready for QA Testing

---

## ✅ Pre-QA Verifications Complete

### 1. Row Numbering ✅ VERIFIED CORRECT
- **Implementation:** `idx + 1` used consistently throughout
- **Behavior:** Row 1 = First data row (header excluded)
- **User Experience:** "Row 37 matches Row 24" corresponds exactly to what users see in import preview
- **Edge Cases:** Error messages, duplicate references, validation errors all use same numbering

### 2. Counts Reconciliation ✅ VERIFIED CORRECT
- **Math:** `created_players + updated_players + rejected_count = players_received`
- **Example:** `48 + 0 + 5 = 53 ✅`
- **Scores Count:** Only counts written scores (skipped rows excluded from score tallies)
- **Backend provides:** `players_received = len(players)` for verification

### 3. Enhanced Messaging ✅ IMPLEMENTED
- **Added universal guidance:** "If the same athlete plays in multiple age groups, use a different jersey number or add a suffix to the name."
- **Location:** Base error message (appears in ALL duplicate scenarios) + frontend warning banner
- **Impact:** High - addresses #1 user confusion point about same athlete in different age groups

---

## 🧪 QA Test Cases

### Test 1: Identical Name + Jersey, Different Age Groups ⭐ PRIMARY
**CSV:**
```csv
first_name,last_name,age_group,jersey_number
Ryan,Johnson,12U,1038
Ryan,Johnson,14U,1038
```

**Expected Behavior:**
- ✅ Review step shows yellow warning: "Duplicate Players Detected (1)"
- ✅ Error shows: "Duplicate: Ryan Johnson #1038 (14U) matches Row 1"
- ✅ Message includes: "Players are matched by name + jersey number (age group is ignored). If the same athlete plays in multiple age groups, use a different jersey number or add a suffix to the name."
- ✅ TIP includes: "Age groups differ (12U vs 14U) but same name+number still creates a duplicate"
- ✅ After import: Success shows "1 new, 0 updated, 1 skipped"
- ✅ **Reconciliation:** 1 + 0 + 1 = 2 total rows ✅

**Row Numbering Check:**
- CSV Row 1 (Ryan, 12U) → Backend processes as Row 1 ✅
- CSV Row 2 (Ryan, 14U) → Backend error says "matches Row 1" ✅

---

### Test 2: Same Name, Different Jersey Numbers
**CSV:**
```csv
first_name,last_name,age_group,jersey_number
Ryan,Johnson,12U,1038
Ryan,Johnson,12U,2045
```

**Expected Behavior:**
- ✅ Review step: NO duplicate warning
- ✅ After import: "2 new, 0 updated, 0 skipped"
- ✅ **Reconciliation:** 2 + 0 + 0 = 2 total rows ✅
- ✅ Both players created successfully

---

### Test 3: Same Name + Jersey, Same Age Group
**CSV:**
```csv
first_name,last_name,age_group,jersey_number
John,Smith,12U,42
John,Smith,12U,42
```

**Expected Behavior:**
- ✅ Review step shows yellow warning: "Duplicate Players Detected (1)"
- ✅ Error shows: "Duplicate: John Smith #42 (12U) matches Row 1"
- ✅ Message includes universal athlete guidance
- ✅ TIP: "Remove this duplicate row or assign a different jersey number"
- ✅ After import: "1 new, 0 updated, 1 skipped"
- ✅ **Reconciliation:** 1 + 0 + 1 = 2 total rows ✅

---

### Test 4: Missing Jersey Numbers
**CSV:**
```csv
first_name,last_name,age_group,jersey_number
Alex,Williams,12U,
Alex,Williams,14U,
```

**Expected Behavior:**
- ✅ Review step shows yellow warning
- ✅ Error: "Duplicate: Alex Williams (no jersey number) matches Row 1"
- ✅ Message includes universal athlete guidance
- ✅ TIP: "Assign unique jersey numbers to differentiate players with the same name"
- ✅ After import: "1 new, 0 updated, 1 skipped"
- ✅ **Reconciliation:** 1 + 0 + 1 = 2 total rows ✅

---

### Test 5: Mixed Errors (Validation + Duplicates)
**CSV:**
```csv
first_name,last_name,age_group,jersey_number
John,Smith,12U,42
John,Smith,12U,42
,Davis,12U,55
Jane,Doe,14U,99
```

**Expected Behavior:**
- ✅ Review step shows BOTH:
  - Yellow duplicate warning (1 duplicate: Row 2)
  - Red validation error (1 error: Row 3 missing first_name)
- ✅ After import: "2 new, 0 updated, 2 rejected"
- ✅ Success step separates:
  - Yellow section: "1 row skipped (duplicates)" - Row 2
  - Red section: "Encountered 1 error" - Row 3
- ✅ **Reconciliation:** 2 + 0 + 2 = 4 total rows ✅

---

### Test 6: Large File with Multiple Scenarios
**CSV:**
```csv
first_name,last_name,age_group,jersey_number
John,Smith,12U,1
Jane,Doe,12U,2
John,Smith,14U,1          ← Duplicate (same name+number, diff age)
Mike,Davis,12U,3
Sarah,Lee,12U,             ← Duplicate (no number)
Sarah,Lee,14U,             ← Duplicate (no number)
,Johnson,12U,5             ← Validation error (missing first_name)
Tom,Wilson,12U,6
John,Smith,12U,1           ← Duplicate (exact match of Row 1)
```

**Expected Behavior:**
- ✅ Review step shows:
  - Yellow: "Duplicate Players Detected (3)" - Rows 3, 6, 9
  - Red: "1 validation error" - Row 7
- ✅ After import: "5 new, 0 updated, 4 rejected"
- ✅ **Reconciliation:** 5 + 0 + 4 = 9 total rows ✅
- ✅ Players created: John Smith #1 (12U), Jane Doe #2, Mike Davis #3, Sarah Lee (no #), Tom Wilson #6
- ✅ Rejected: Rows 3, 6, 7, 9

**Row Numbering Verification:**
- Row 3 error should say "matches Row 1" ✅
- Row 6 error should say "matches Row 5" ✅
- Row 9 error should say "matches Row 1" ✅

---

### Test 7: Scores Reconciliation
**CSV with drill scores:**
```csv
first_name,last_name,age_group,jersey_number,sprint_60,exit_velocity
Ryan,Johnson,12U,1038,7.2,85.5
Ryan,Johnson,14U,1038,6.9,88.0
Mike,Davis,12U,2045,7.5,82.0
```

**Expected Behavior:**
- ✅ Review step: "Duplicate Players Detected (1)" - Row 2
- ✅ After import: 
  - "2 new, 0 updated, 1 skipped"
  - "4 scores" ← Only scores from Rows 1 and 3 (2 players × 2 drills)
- ✅ **Reconciliation:** 
  - Players: 2 + 0 + 1 = 3 rows ✅
  - Scores: 2 players × 2 drills = 4 scores ✅ (Row 2 scores NOT counted)

---

## 📊 Reconciliation Formula Verification

For every test case, verify:

```
created_players + updated_players + rejected_count = total_rows_in_csv

Example Test 5:
2 (John, Jane) + 0 + 2 (Row 2 dup, Row 3 validation) = 4 rows ✅

Scores Check:
scores_written_total = (created_players + updated_players) × number_of_drill_columns
Only counts scores from successfully imported players (skipped rows excluded)
```

---

## 🎯 Acceptance Criteria Final Check

| Criteria | Status | Notes |
|----------|--------|-------|
| Backend returns structured duplicate info | ✅ | `rejected_rows[]` with row numbers, identity_key, duplicate_of_row |
| Frontend shows duplicates in Review step | ✅ | Yellow warning banner with all details |
| Frontend shows duplicates in Success step | ✅ | "Skipped" count + collapsible "View details" |
| Copy explains matching logic plainly | ✅ | "matched by name + jersey number (age group ignored)" |
| Actionable tips provided | ✅ | Universal athlete guidance + contextual tips |
| No changes to matching logic | ✅ | Identity key unchanged, same detection order |
| Counts reconcile correctly | ✅ | New + Updated + Skipped = Total |
| Row numbering consistent | ✅ | idx + 1 throughout, header excluded |

---

## 🚀 Deployment Commands

### Push to Production
```bash
cd /Users/richarcher/Desktop/WooCombine\ App
git push origin main
```

**Auto-Deployment:**
- Render (backend): ~5 minutes
- Netlify (frontend): ~5 minutes

### Verification After Deployment
```bash
# Check backend health
curl https://woo-combine-backend.onrender.com/health

# Check frontend build
curl -I https://woo-combine.com
```

---

## 🐛 Known Edge Cases (All Handled)

1. **External ID Priority** ✅
   - If CSV has external_id, matching uses that first
   - Within-file duplicate detection still uses name+number (simpler)

2. **Case Normalization** ✅
   - "John Smith" = "john smith" = "JOHN SMITH"
   - Error message shows original case from CSV

3. **Number Format** ✅
   - "42" = "42.0" = " 42 " (after normalization)
   - Error shows normalized format

4. **Missing Numbers** ✅
   - Two players with same name, no numbers → duplicate
   - Special tip provided about assigning numbers

5. **Age Group Ignored** ✅
   - Universal guidance now explains this upfront
   - Contextual tip when age groups differ

---

## 📝 Post-QA Actions

After QA passes:

- [ ] Update CHANGELOG.md with Phase 1 features
- [ ] Publish user guide to docs.woo-combine.com
- [ ] Monitor support tickets for 1 week
- [ ] Gather user feedback on new messaging
- [ ] Measure support ticket reduction (target: 80%)
- [ ] Decide on Phase 2 features based on feedback

---

## 📞 QA Contact

**If issues found:**
- Report in main thread with:
  - CSV file used (first 10 rows)
  - Screenshot of error
  - Expected vs actual behavior
  - Reconciliation math check

**Critical Issues (Deploy Blocker):**
- Row numbers don't match preview
- Counts don't reconcile
- Duplicates not shown in UI
- Validation errors mixed with duplicates (no color separation)

**Non-Critical (Can fix post-deploy):**
- Wording improvements
- UI polish
- Mobile responsiveness tweaks

---

**Status:** ✅ Ready for QA Testing  
**Estimated QA Time:** 30-45 minutes for all test cases  
**Confidence Level:** 🟢 High (verified math, row numbering, messaging)

