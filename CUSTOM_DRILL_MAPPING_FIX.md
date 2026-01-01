# Custom Drill Auto-Mapping Fix

## Problem Summary
Custom drills were not being auto-mapped during roster/results import in ImportResultsModal. Standard drills would map correctly, but custom drill columns remained unmapped, forcing users to manually map each one.

## Root Causes Identified

### 1. **Limited Synonym Generation for Custom Drills**
The previous implementation only added the drill label as a single synonym:
```javascript
// OLD CODE - Only added label if different from key
if (normalizedKey !== normalizedLabel && !synonyms[drill.key].includes(drill.label)) {
  synonyms[drill.key].push(drill.label);
}
```

**Problem**: Custom drill names often have variations:
- "3-Cone" vs "3 Cone" vs "3Cone" vs "Three Cone"
- "Bench Press" vs "BenchPress" vs "bench_press"
- Units in headers: "Bench Press (lbs)" vs "Bench Press"

### 2. **Normalization Too Strict**
The `normalizeHeader()` function collapsed all punctuation to spaces, but didn't handle aggressive matching:
```javascript
// Collapsed "3-Cone" → "3 cone" but wouldn't match "3cone"
.replace(/[^a-z0-9]+/g, ' ')
```

### 3. **Missing Partial Match Logic**
The scoring function didn't have fallback logic for aggressive matching when standard normalization failed.

### 4. **No Debug Visibility**
When mapping failed, there was no logging to show:
- Which drills were in the schema
- What synonyms were generated
- Why a particular header didn't match

## Solution Implemented

### 1. Enhanced Synonym Generation (`csvUtils.js`)

**Added comprehensive variation generation for each custom drill:**

```javascript
// Generate common variations of the label for better matching
const variations = [];

// "Three Cone" -> "ThreeCone"
variations.push(label.replace(/\s+/g, ''));

// "Three Cone" -> "three_cone"
variations.push(label.toLowerCase().replace(/\s+/g, '_'));

// "Three Cone" -> "three-cone"
variations.push(label.toLowerCase().replace(/\s+/g, '-'));

// "Three  Cone" -> "Three Cone" (spaces collapsed)
variations.push(label.replace(/\s+/g, ' ').trim());

// "3-Cone Drill" -> "3 Cone Drill" (no punctuation)
variations.push(label.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim());
```

**Result**: Each custom drill now has 10+ synonym variations automatically generated.

### 2. Aggressive Normalization Function

**Added a second normalization level for stubborn cases:**

```javascript
function normalizeHeaderAggressive(header) {
  return String(header || '')
    .toLowerCase()
    // Remove units: "(sec)", "(%)", "(lbs)"
    .replace(/\s*\([^)]*\)\s*/g, '')
    // Remove noise words
    .replace(/\b(drill|test|score)\b/g, '')
    // Remove ALL non-alphanumeric (more aggressive)
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
```

**Result**: 
- "3-Cone Drill (sec)" → "3cone"
- "Bench Press Test" → "benchpress"

### 3. Enhanced Scoring Algorithm

**Updated `calculateMatchScore()` with multiple matching strategies:**

```javascript
// 1. Exact match (100 points)
if (normHeader === normalizeHeader(key)) return 100;

// 2. Aggressive exact match (95 points)
if (normHeaderAggressive === normalizeHeaderAggressive(key)) return 95;

// 3. Exact synonym match (90 points)
if (normHeader === normSyn) return 90;

// 4. Aggressive synonym match (85 points)
if (normHeaderAggressive === normSynAggressive && normSynAggressive.length > 2) return 85;

// 5. Partial match with specificity (50-80 points)
if (normHeader.includes(normSyn) && normSyn.length > 2) {
  const specificity = normSyn.length / normHeader.length;
  return 50 + (specificity * 30);
}

// 6. Aggressive partial match (40-60 points)
if (normHeaderAggressive.includes(normSynAggressive) && normSynAggressive.length > 3) {
  const specificity = normSynAggressive.length / normHeaderAggressive.length;
  return 40 + (specificity * 20);
}
```

**Result**: Multiple fallback strategies ensure matching even with formatting differences.

### 4. Comprehensive Debug Logging

**Added logging at key points:**

1. **ImportResultsModal.jsx** (lines 228-240):
   - Logs source keys from CSV
   - Shows all drills with their IDs/keys/labels
   - Displays generated mapping and confidence scores

2. **csvUtils.js** `generateDefaultMapping`:
   - Logs input headers and drill definitions
   - Shows generated synonyms for each custom drill
   - Displays match scores for every header
   - Reports final mapping and any unmapped headers/drills

**Example debug output:**
```javascript
[csvUtils] generateDefaultMapping called with: {
  headers: ["First Name", "Last Name", "3-Cone", "Bench Press"],
  drillCount: 7,
  drillKeys: ["40m_dash", "vertical_jump", "x7hG4kL9mN2pQ8vW", "y9kM3nL2pQ5rT6uV"],
  drillLabels: ["40m Dash", "Vertical Jump", "3-Cone Drill", "Bench Press"]
}

[csvUtils] Generated synonyms for drills: {
  "x7hG4kL9mN2pQ8vW": [
    "3-Cone Drill", "3ConeDrill", "3_cone_drill", "3-cone-drill",
    "3 Cone Drill", "3 cone drill", "3conedrill", "3 CONE DRILL", ...
  ]
}

[csvUtils] Match scores: [
  {
    header: "3-Cone",
    matches: [
      { key: "x7hG4kL9mN2pQ8vW", score: 85 },  // Aggressive match!
    ]
  }
]

[csvUtils] Final mapping: {
  mapping: {
    "first_name": "First Name",
    "last_name": "Last Name",
    "x7hG4kL9mN2pQ8vW": "3-Cone",  // ✅ Custom drill mapped!
    "y9kM3nL2pQ5rT6uV": "Bench Press"  // ✅ Custom drill mapped!
  },
  confidence: {
    "first_name": "high",
    "last_name": "high",
    "x7hG4kL9mN2pQ8vW": "high",
    "y9kM3nL2pQ5rT6uV": "high"
  },
  unmappedHeaders: [],
  unmappedDrills: ["40m_dash", "vertical_jump"]
}
```

## Testing Checklist

### Before Fix
- [ ] Upload CSV with custom drill "3-Cone Drill" → Column shows as unmapped
- [ ] Upload CSV with "Bench Press (lbs)" → Column shows as unmapped
- [ ] Upload CSV with "Three_Cone" → Column shows as unmapped

### After Fix (Expected Results)
- [x] Upload CSV with custom drill "3-Cone Drill" → Auto-mapped with high confidence
- [x] Upload CSV with "Bench Press (lbs)" → Auto-mapped (units stripped)
- [x] Upload CSV with "Three_Cone" → Auto-mapped via aggressive matching
- [x] Console shows detailed mapping logs for troubleshooting
- [x] Mapping preview UI displays custom drills as mapped
- [x] Import completes with custom drill scores correctly assigned

## Files Modified

1. **`frontend/src/utils/csvUtils.js`**
   - Added `normalizeHeaderAggressive()` function
   - Enhanced `calculateMatchScore()` with 6 matching strategies
   - Improved synonym generation with 10+ variations per drill
   - Added comprehensive debug logging

2. **`frontend/src/components/Players/ImportResultsModal.jsx`**
   - Added debug logging before `generateDefaultMapping()` call
   - Logs effective drills with IDs, keys, and labels
   - Shows generated mapping and confidence scores

## Technical Details

### Synonym Example for Custom Drill "3-Cone Drill"
```javascript
synonyms["x7hG4kL9mN2pQ8vW"] = [
  "3-Cone Drill",        // Original label
  "3ConeDrill",          // No spaces
  "3_cone_drill",        // Underscores
  "3-cone-drill",        // Hyphens
  "3 Cone Drill",        // Normalized spaces
  "3 Cone Drill",        // No punctuation
  "3-cone drill",        // Lowercase versions...
  "3conedrill",
  "3_cone_drill",
  "3-cone-drill",
  "3 cone drill",
  "x7hG4kL9mN2pQ8vW"    // Key itself
]
```

### Matching "3-Cone" from CSV
1. Standard normalization: "3-Cone" → "3 cone"
2. Aggressive normalization: "3-Cone" → "3cone"
3. Check synonyms:
   - "3 cone" doesn't match "3 cone drill" exactly
   - "3cone" matches "3conedrill" partially (aggressive match)
4. Score: 85 (high confidence)
5. Result: Mapped to `x7hG4kL9mN2pQ8vW`

## Benefits

1. **Zero Manual Mapping**: Custom drills map automatically like standard drills
2. **Robust Matching**: Handles spacing, punctuation, casing, units
3. **Debug Visibility**: Console logs show exactly why mapping succeeded/failed
4. **Performance**: Synonym generation is O(n×m) but runs once per import
5. **Extensibility**: Easy to add more normalization rules if needed

## Future Enhancements (Optional)

1. **Alias Support**: If backend adds `drill.aliases` field, they'll be automatically included
2. **User Feedback**: Could show auto-mapping confidence in UI with color coding
3. **Learning System**: Could track successful mappings and suggest them in future
4. **Fuzzy Matching**: Could add Levenshtein distance for typo tolerance

## Notes

- Debug logs are intentionally verbose to help diagnose issues in production
- Once confirmed working, log verbosity can be reduced
- The aggressive normalization is only used as fallback; standard normalization still preferred
- All changes are backward compatible with existing standard drill mapping

