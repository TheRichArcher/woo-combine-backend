# Understanding CSV Duplicate Detection

**For League Organizers & Coaches**

---

## What is Duplicate Detection?

When you import a CSV file with player data, WooCombine automatically checks for **duplicate players** to prevent creating multiple entries for the same person.

---

## How Players Are Matched

Players are considered **duplicates** if they have the same:

1. ✅ **First Name** (case-insensitive)
2. ✅ **Last Name** (case-insensitive)  
3. ✅ **Jersey Number**

**IMPORTANT:** Age group is **NOT** used for matching! This allows players to "play up" in multiple age groups with the same jersey number.

---

## Common Scenarios That Cause "Duplicate" Errors

### Scenario 1: Same Player in Different Age Groups ⚠️

**Your CSV:**
```csv
first_name, last_name, age_group, jersey_number
Ryan, Johnson, 12U, 1038
Ryan, Johnson, 14U, 1038
```

**What Happens:**
```
❌ Error: Duplicate player in file (Row 2)
```

**Why?**
- System sees: `ryan` + `johnson` + `1038` in both rows
- Age group is ignored (by design to support "playing up")

**How to Fix:**
✅ **Option A:** Assign different jersey numbers (recommended)
```csv
Ryan, Johnson, 12U, 1038
Ryan, Johnson, 14U, 2038
```

✅ **Option B:** Import each age group separately  
✅ **Option C:** If it's actually the same player playing up, keep only one row with their primary age group

---

### Scenario 2: Case Differences Don't Matter

**Your CSV:**
```csv
first_name, last_name, jersey_number
john, smith, 42
John, Smith, 42
```

**What Happens:**
```
❌ Error: Duplicate player in file (Row 2)
```

**Why?**
- Names are normalized to lowercase: `john smith` = `JOHN SMITH` = `John Smith`

**How to Fix:**
✅ Remove the duplicate row (they're actually the same player)

---

### Scenario 3: Number Formats Are Normalized

**Your CSV:**
```csv
first_name, last_name, jersey_number
Mike, Davis, 12
Mike, Davis, 12.0
```

**What Happens:**
```
❌ Error: Duplicate player in file (Row 2)
```

**Why?**
- Numbers are normalized: `12` = `12.0` = `12.00`
- CSV programs sometimes export numbers with decimals

**How to Fix:**
✅ Remove the duplicate row (they're the same player with the same number)

---

### Scenario 4: Missing Jersey Numbers

**Your CSV:**
```csv
first_name, last_name, jersey_number
Alex, Williams, 
Alex, Williams, 
```

**What Happens:**
```
❌ Error: Duplicate player in file (Row 2)
```

**Why?**
- Without jersey numbers, two players with the same name are considered duplicates
- System cannot tell them apart

**How to Fix:**
✅ Assign different jersey numbers to each player
```csv
Alex, Williams, 1
Alex, Williams, 2
```

---

### Scenario 5: Invisible Characters (Advanced) 👻

**What Your Spreadsheet Shows:**
```
John Smith
John Smith
```

**What the System Sees:**
```
Row 1: John Smith     (has invisible Zero Width Space character)
Row 2: John Smith     (clean)
```

**What Happens:**
```
❌ Error: Duplicate player in file (Row 2)
```

**Why?**
- CSV exports from Excel/Google Sheets can contain invisible characters
- System removes these during normalization, making the names identical

**How to Fix:**
✅ Copy/paste the data into a plain text editor first to remove invisible characters  
✅ Or just remove the duplicate row (they're the same player anyway)

---

## When Duplicates Are ALLOWED ✅

### Different Events
Players in **different events** are always allowed, even with the same name and number:

```csv
# Event: Baseball Spring 2026
Ryan, Johnson, 12U, 1038

# Event: Baseball Fall 2026
Ryan, Johnson, 12U, 1038
```
✅ **Both succeed** – Different events = different player rosters

---

### Different Jersey Numbers
Same name, different numbers = different players:

```csv
Ryan, Johnson, 12U, 1038
Ryan, Johnson, 12U, 2045
```
✅ **Both succeed** – Different numbers = different players

---

## Import Summary Explained

After importing, you'll see a summary like this:

```
✅ Import Complete
48 new players created
3 players updated (existing players with score updates)
5 rows skipped (duplicates)
```

**What this means:**
- **New players:** Rows that created brand new player records
- **Updated players:** Rows that matched existing players and updated their scores
- **Skipped:** Rows that were rejected due to duplicate detection

**TIP:** If you see "skipped" rows, check the error details to understand which rows were rejected and why.

---

## Best Practices to Avoid Duplicate Errors

### ✅ DO:
1. **Assign unique jersey numbers** to every player in your event
2. **Remove duplicate rows** from your spreadsheet before importing
3. **Use consistent name formatting** (all lowercase or all title case)
4. **Import one age group at a time** if players share jersey numbers across divisions

### ❌ DON'T:
1. **Don't reuse jersey numbers** within the same event (even across age groups)
2. **Don't mix name formats** (e.g., "smith" and "Smith" in same file)
3. **Don't include test rows** or placeholder data that might duplicate real players

---

## Still Getting Duplicate Errors?

### Debugging Checklist:

1. ✅ **Sort your CSV by name** to visually spot duplicates
2. ✅ **Check for players with missing jersey numbers** – assign numbers to everyone
3. ✅ **Look for name variations** – is "Rob" vs "Robert" causing issues?
4. ✅ **Export a fresh copy** from your spreadsheet to remove hidden formatting
5. ✅ **Import in smaller batches** to isolate which rows are causing problems

---

## Need Help?

If you're still experiencing issues with duplicate detection:

1. **Check the error details** in the import modal for specific row numbers
2. **Review this guide** to understand the matching rules
3. **Contact support** with:
   - Your CSV file (first 10 rows)
   - Screenshot of the error message
   - Description of what you expected to happen

We're here to help! 🎉

---

## Technical Reference

For developers and advanced users:

**Identity Key Formula:**
```
player_id = hash(event_id : lowercase(first_name) : lowercase(last_name) : normalized(jersey_number))
```

**Normalization Rules:**
- Names: Lowercase, trim whitespace, remove invisible characters
- Numbers: Convert `"12.0"` → `12` (integer)
- Missing numbers: Treated as `"nonum"` (no number)

**Age Group:** Explicitly NOT included in identity to support "playing up" scenarios

**Source Code:** `backend/utils/identity.py` (generate_player_id function)

---

**Last Updated:** January 4, 2026  
**Related Documentation:** 
- [Import Overview](./PM_ONBOARDING_OVERVIEW.md)
- [CSV Format Guide](./CSV_FORMAT_GUIDE.md)
- [API Contract](../API_CONTRACT.md)

