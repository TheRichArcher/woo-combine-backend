# Analysis: Player Scorecard Drill Filtering Issue

**Date:** January 4, 2026  
**Issue:** Are scorecards filtering drills based on ranking logic, causing recorded data to not appear?  
**Status:** ✅ **CONFIRMED - Scorecards show ALL drills from event schema**

---

## Your Hypothesis: PARTIALLY CORRECT

### What You Suspected ❓
> "Scorecards might be filtering drills based on ranking logic (zero weight, excluded from preset, not contributing to composite score)"

### Actual Behavior ✅

**Good news:** Scorecards are **NOT filtering based on weights or rankings**.

**Both display components show ALL drills:**

1. **PlayerDetailsPanel** (View Stats & Weights modal)
2. **PlayerScorecardGenerator** (PDF/Email reports)

---

## Code Evidence

### 1. PlayerDetailsPanel (Main Scorecard Display)

**File:** `frontend/src/components/Players/PlayerDetailsPanel.jsx`

**Props received:**
```javascript
const PlayerDetailsPanel = ({ 
  player, 
  allPlayers, 
  persistedWeights,    // ← Used for ranking calculations
  sliderWeights,
  drills = [],         // ← ALL drills from event
  presets = {}
})
```

**Where drills come from (ScorecardsPage.jsx, line 321):**
```javascript
<PlayerDetailsPanel 
  drills={currentDrills}  // ← From useDrills hook
  ...
/>
```

**What useDrills returns:**
```javascript
// frontend/src/hooks/useDrills.js
export function useDrills(selectedEvent) {
  // Fetches ALL drills from event schema via API
  const response = await api.get(`/events/${selectedEvent.id}/schema`);
  
  return {
    drills: response.data.drills,  // ← Complete drill list
    presets: response.data.presets
  };
}
```

**How drills are rendered (PlayerDetailsPanel.jsx, lines 120-177):**
```javascript
const weightedBreakdown = useMemo(() => {
  // Maps over ALL drills
  return drills.map(drill => {
    const rawScore = player.scores?.[drill.key] ?? player[drill.key];
    
    // NO FILTERING BASED ON WEIGHT
    // Shows drill even if weight is 0
    return {
      ...drill,
      rawScore,           // ← Shows actual value
      weight,             // ← Can be 0
      weightedScore,      // ← Can be 0 (but drill still shown)
      normalizedScore,
      rank
    };
  });
}, [drillRankings, player, weights, allPlayers, drills]);
```

**Display logic (PlayerDetailsPanel.jsx, lines 291-336):**
```javascript
{weightedBreakdown.map(drill => (
  <div className="drill-card">
    <h4>{drill.label}</h4>
    <span className="score">
      {drill.rawScore != null ? drill.rawScore + ' ' + drill.unit : 'No score'}
    </span>
    
    {/* Shows "No impact" badge if weight is 0, but STILL displays drill */}
    {isZeroImpact && (
      <span className="badge">No impact</span>
    )}
  </div>
))}
```

**Key point:** Drills with `weight: 0` are **still rendered**, just marked as "No impact" on composite score.

---

### 2. PlayerScorecardGenerator (PDF Reports)

**File:** `frontend/src/components/PlayerScorecardGenerator.jsx`

**Line 33:**
```javascript
const drills = getDrillsFromTemplate(selectedDrillTemplate);
```

**⚠️ THIS IS THE PROBLEM!** 

The PDF generator uses `getDrillsFromTemplate()` which returns the **static sport template**, not the **actual event schema with custom drills**.

**Evidence:**
```javascript
// Line 23
const PlayerScorecardGenerator = ({ 
  player, 
  allPlayers = [], 
  weights = {}, 
  selectedDrillTemplate = 'football'  // ← Template ID, not event drills
})

// Line 32-33
const template = getTemplateById(selectedDrillTemplate);
const drills = getDrillsFromTemplate(selectedDrillTemplate);  // ← STATIC TEMPLATE
```

**This means:**
- ✅ Live modal shows ALL drills (including custom drills)
- ❌ PDF reports only show template drills (missing custom drills)

---

## Root Cause of Missing Data

### Issue #1: CSV Mapping (Already Fixed) ✅
- **Cause:** `sprint_60` synonym missing
- **Impact:** CSV data not mapped during import
- **Status:** FIXED (committed today)

### Issue #2: PDF Generator Using Wrong Drill Source ⚠️
- **Cause:** `PlayerScorecardGenerator` uses static template instead of event schema
- **Impact:** Custom drills don't appear in PDF reports
- **Status:** **NOT FIXED** - This is a separate bug

---

## Expected vs Actual Behavior

### Correct Behavior (PlayerDetailsPanel) ✅

**Drills displayed:**
```javascript
// Event schema drills (from useDrills hook)
[
  { key: "sprint_60", label: "60-Yard Sprint" },      // Template drill
  { key: "exit_velocity", label: "Exit Velocity" },   // Template drill
  { key: "abc123xyz", label: "Custom Bench Press" }   // CUSTOM DRILL ✓
]
```

**Display logic:**
- Shows ALL drills from event schema
- Displays actual recorded values
- Shows "No score" if value is null
- Shows "No impact" badge if weight is 0
- **Does NOT filter based on weight**

### Incorrect Behavior (PlayerScorecardGenerator) ❌

**Drills displayed:**
```javascript
// Static template drills (from getDrillsFromTemplate)
[
  { key: "sprint_60", label: "60-Yard Sprint" },      // Template drill ✓
  { key: "exit_velocity", label: "Exit Velocity" },   // Template drill ✓
  // MISSING: Custom drills not in template
]
```

**Problem:**
- Only shows template drills
- Ignores custom drills added to event
- PDF reports are incomplete

---

## Verification: Your Expected Behavior is CORRECT

### Rankings = Selective ✅
```javascript
// Rankings can filter by weight
const effectiveDrills = drills.filter(d => weights[d.key] > 0);
const rankedPlayers = calculateRankings(players, effectiveDrills, weights);
```

**Result:** Rankings only use drills with non-zero weights.

### Player Card = Exhaustive ✅ (Mostly)

**PlayerDetailsPanel:**
```javascript
// Shows ALL drills, regardless of weight
drills.map(drill => {
  return {
    rawScore: player.scores?.[drill.key],  // Shows actual value
    weight: weights[drill.key] || 0,        // Can be 0
    // Displays drill even if weight is 0
  };
});
```

**Result:** Shows every recorded stat.

**PlayerScorecardGenerator (PDF):** ❌ Only shows template drills, missing custom drills.

---

## The Real Problem: Two Separate Issues

### Issue A: Missing Data in Live View ✅ FIXED
**Cause:** CSV mapping (`sprint_60` synonym missing)  
**Status:** Fixed and deployed today

### Issue B: Missing Custom Drills in PDF Reports ⚠️ NEW BUG
**Cause:** PDF generator uses static template instead of event schema  
**Status:** Needs fixing

---

## How to Fix Issue B

### Current Code (PlayerScorecardGenerator.jsx, lines 32-33)
```javascript
const template = getTemplateById(selectedDrillTemplate);
const drills = getDrillsFromTemplate(selectedDrillTemplate);  // ← WRONG
```

### Fixed Code
```javascript
const PlayerScorecardGenerator = ({ 
  player, 
  allPlayers = [], 
  weights = {}, 
  drills = [],              // ← Accept drills as prop
  selectedDrillTemplate = 'football'
})

// Use prop if provided, fallback to template
const effectiveDrills = drills.length > 0 
  ? drills 
  : getDrillsFromTemplate(selectedDrillTemplate);
```

### Update Call Site (ScorecardsPage.jsx, line 342)
```javascript
<PlayerScorecardGenerator
  player={selectedPlayer}
  allPlayers={players}
  weights={persistedWeights}
  drills={currentDrills}         // ← Pass event drills
  selectedDrillTemplate={drillTemplate}
/>
```

---

## Summary: Answering Your Questions

### Q1: Is the scorecard filtering drills based on ranking logic?

**A:** ❌ **NO** - PlayerDetailsPanel shows ALL drills regardless of weight.

### Q2: Are drills with zero weight excluded?

**A:** ❌ **NO** - They're shown with a "No impact" badge, but data is displayed.

### Q3: Are drills recorded in player.scores but excluded from rankings not rendered?

**A:** 
- **PlayerDetailsPanel:** ❌ NO - All recorded drills are shown
- **PlayerScorecardGenerator (PDF):** ⚠️ **YES** - Custom drills are missing

### Q4: Should we decouple scorecard vs ranking drill sources?

**A:** ✅ **Already decoupled** for live view, but PDF generator needs fixing.

---

## Action Items

### Immediate (sprint_60 fix) ✅ DONE
- [x] Added `sprint_60` synonyms
- [x] Deployed to production
- [x] Awaiting empirical verification

### Secondary (PDF generator fix) 🔧 TODO
- [ ] Update PlayerScorecardGenerator to accept drills prop
- [ ] Pass event drills from ScorecardsPage
- [ ] Test PDF generation with custom drills
- [ ] Verify all drills appear in PDF reports

---

**Conclusion:** Your hypothesis was correct that scorecards should show all recorded data regardless of ranking relevance. The good news is that the live scorecard (PlayerDetailsPanel) already does this correctly. The PDF generator has a separate bug where it uses static templates instead of event schemas.

**For the sprint_60 issue:** This was purely a CSV mapping problem (missing synonyms), not a scorecard filtering issue.

