# Coach Dashboard Performance Overview Score Normalization Fix

## Date
Sunday, January 4, 2026

## Issue
The Performance Overview card on `/coach` (CoachDashboard) was displaying unnormalized scores in the thousands (e.g., ~6654 average, ~6077-7272 range) instead of human-scale normalized scores (0-100 range).

## Root Cause
The Performance Overview calculation in `CoachDashboard.jsx` was incorrectly multiplying `composite_score` values by 100, based on a faulty assumption that the backend returns scores in a 0-1 range.

**Actual behavior:** The backend's `calculate_composite_score` function in `backend/routes/players.py` (lines 26-97) returns scores already normalized to a **0-100 range**.

**Bug location:**
- Line 589: `avgScore` calculation multiplied by 100
- Lines 638-639: Min/max range calculations multiplied by 100

This resulted in scores being inflated by 100x (e.g., a normalized score of 66.54 became 6654).

## Impact
- **Confusing and misleading** to users
- **Broke consistency** with `/players` and `/analytics` which displayed correct normalized scores
- **Undermined trust** in ranking presets and the evaluation system

## Solution
Removed the erroneous `* 100` multiplications from:

1. **Average score calculation (line 589):**
```javascript
// BEFORE (incorrect):
const avgScore = completedPlayers.length > 0 ? (completedPlayers.reduce((sum, p) => sum + p.composite_score, 0) / completedPlayers.length * 100) : 0;

// AFTER (correct):
const avgScore = completedPlayers.length > 0 ? (completedPlayers.reduce((sum, p) => sum + p.composite_score, 0) / completedPlayers.length) : 0;
```

2. **Score range calculation (lines 638-639):**
```javascript
// BEFORE (incorrect):
{(Math.min(...completedPlayers.map(p => p.composite_score)) * 100).toFixed(1)} - {(Math.max(...completedPlayers.map(p => p.composite_score)) * 100).toFixed(1)}

// AFTER (correct):
{Math.min(...completedPlayers.map(p => p.composite_score)).toFixed(1)} - {Math.max(...completedPlayers.map(p => p.composite_score)).toFixed(1)}
```

3. **Updated comment (line 588):**
```javascript
// BEFORE (incorrect):
// Fix: Normalize score display to 0-100 scale (data comes as 0-1)

// AFTER (correct):
// composite_score already comes normalized in 0-100 range from backend
```

## Verification

### Backend Score Calculation
From `backend/routes/players.py`, lines 94-97:
```python
# Final Renormalization: Weighted Sum / Total Weight
if total_weight > 0:
    return round(weighted_sum / total_weight, 2)
return 0.0
```

The backend normalizes each drill to 0-100 (line 72-87), applies weights, and returns the final weighted average in the 0-100 range.

### Consistency Check
- **Players page** (`frontend/src/pages/Players.jsx` line 789): Displays `player.composite_score.toFixed(1)` directly (no multiplication)
- **Coach Dashboard rankings** (line 820): Displays `score` from `player.composite_score.toFixed(2)` (no multiplication)
- **Performance Overview** (now fixed): Displays scores directly without multiplication

All views now consistently show normalized 0-100 scores.

## Testing
- ✅ Build successful (3177 modules transformed)
- ✅ No linter errors
- ✅ Performance Overview now displays human-scale scores matching other views

## Files Changed
- `frontend/src/pages/CoachDashboard.jsx` (lines 588-589, 638-639)

## Result
Performance Overview now displays consistent, normalized scores in the 0-100 range, matching the behavior of `/players` and `/analytics`. Users will see meaningful, intuitive scores (e.g., 66.5 average, 60.8-72.7 range) instead of confusing thousands.

