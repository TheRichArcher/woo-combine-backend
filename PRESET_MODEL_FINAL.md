# Ranking Preset Model - LOCKED & FINAL

**Status:** ✅ Frontend ↔ Backend SYNCED  
**Last Updated:** January 2, 2026  
**Philosophy:** Presets are fast operational shortcuts, not exhaustive tuning tools

---

## 🎯 Design Philosophy

### Core Principles
1. **Speed over choice overload** - Max 4 presets even for complex sports
2. **Complexity-based scaling** - Preset count varies by sport needs
3. **Sport-specific weighting** - No forced uniformity between sports
4. **Quick operational modes** - Deep tuning belongs in `/analytics`, not preset buttons

### Preset Count Guidelines
- **Football / Basketball** → 4 presets (multi-skill, position-diverse)
- **Baseball / Soccer** → 2 presets (clear role differentiation)
- **Track / Volleyball** → 1 preset (highly specialized)

---

## 📊 Complete Preset Inventory

### 🏈 FOOTBALL (4 presets)
**Multi-position sport with diverse skill requirements**

| Preset | 40m Dash | Vertical | Catching | Throwing | Agility |
|--------|----------|----------|----------|----------|---------|
| **Balanced** | 20% | 20% | 20% | 20% | 20% |
| **Speed Focused** | **40%** | **30%** | 10% | 10% | 10% |
| **Skills Focused** | 10% | 10% | **35%** | **35%** | 10% |
| **Athletic** | 25% | 25% | 15% | 15% | 20% |

**Use cases:**
- Balanced: General evaluation baseline
- Speed Focused: RBs, DBs, WRs (speed positions)
- Skills Focused: QBs, WRs, TEs (ball handlers)
- Athletic: LBs, edge rushers (physical positions)

---

### 🏀 BASKETBALL (4 presets)
**Multi-position sport with specialized roles**

| Preset | Lane Agility | Vertical | FT% | 3PT% | Ball Handling | Defense |
|--------|--------------|----------|-----|------|---------------|---------|
| **Balanced** | 15% | 15% | 20% | 20% | 15% | 15% |
| **Shooter Focus** | 10% | 10% | **35%** | **35%** | 5% | 5% |
| **Athleticism** | **30%** | **30%** | 2.5% | 2.5% | 5% | **30%** |
| **Skill Focus** | 5% | 2.5% | 20% | 20% | **50%** | 2.5% |

**Use cases:**
- Balanced: General evaluation baseline
- Shooter Focus: Shooting guards, spot-up specialists
- Athleticism: Centers, power forwards (physical dominance)
- Skill Focus: Point guards, ball handlers

---

### ⚾ BASEBALL (2 presets)
**Clear offensive vs. well-rounded differentiation**

| Preset | 60-Yard Sprint | Exit Velocity | Throwing Velocity | Fielding | Pop Time |
|--------|----------------|---------------|-------------------|----------|----------|
| **Balanced** | 20% | 20% | 20% | 20% | 20% |
| **Hitter Focus** | 15% | **50%** | 15% | 15% | 5% |

**Use cases:**
- Balanced: General evaluation, multi-tool players
- Hitter Focus: DH, power hitters, offense-first prospects

---

### ⚽ SOCCER (2 presets)
**Technical vs. balanced evaluation**

| Preset | 20m Sprint | Ball Control | Passing | Shooting | Agility | Endurance |
|--------|------------|--------------|---------|----------|---------|-----------|
| **Balanced** | 15% | 20% | 20% | 15% | 15% | 15% |
| **Technical Focus** | 5% | **35%** | **35%** | 15% | 5% | 5% |

**Use cases:**
- Balanced: General evaluation baseline
- Technical Focus: Midfielders, playmakers (skill-first)

---

### 🏃 TRACK & FIELD (1 preset)
**Hyper-specialized by event type**

| Preset | 100m | 400m | Long Jump | High Jump | Shot Put | Mile |
|--------|------|------|-----------|-----------|----------|------|
| **Sprinter Focus** | **45%** | 25% | 15% | 10% | 2.5% | 2.5% |

**Use cases:**
- Sprinter Focus: Short-distance speed events (100m/200m specialists)

**Note:** Track is event-specific by nature. Additional presets (e.g., "Distance Focus", "Field Focus") could be added if needed, but current model assumes sprint-focused combines.

---

### 🏐 VOLLEYBALL (1 preset)
**Position-specific evaluation**

| Preset | Vertical | Approach Jump | Serving | Passing | Attack Power | Blocking |
|--------|----------|---------------|---------|---------|--------------|----------|
| **Hitter Focus** | 25% | **30%** | 10% | 10% | 20% | 5% |

**Use cases:**
- Hitter Focus: Outside hitters, attackers

**Note:** Volleyball combines typically focus on offensive positions. Additional presets (e.g., "Setter Focus", "Libero Focus") could be added for specialized events.

---

## 🔒 Source of Truth

### Backend (Canonical)
**File:** `/backend/services/schema_registry.py` (lines 5-274)
- Defines all sport schemas with drills, weights, and presets
- Used by API endpoints (`/schemas`) and ranking calculations
- **This is the single source of truth**

### Frontend (Mirror)
**File:** `/frontend/src/constants/drillTemplates.js` (lines 8-305)
- Mirrors backend for offline/fallback scenarios
- Uses `fetchSchemas()` to sync from backend on load
- Falls back to local definitions if API unavailable

### Sync Status
✅ **All sports synced as of January 2, 2026**

---

## 🚫 Change Policy

### Preset Model is LOCKED
- **No new presets** without product review
- Changes require:
  1. User research showing real combine workflow gap
  2. Validation that gap can't be solved with custom weights in `/analytics`
  3. Approval from product leadership

### Allowed Changes
- ✅ Weight tuning based on scout feedback (within existing presets)
- ✅ Bug fixes (e.g., weights don't sum to 1.0)
- ✅ Description improvements for clarity

### Prohibited Changes
- ❌ Adding new presets without review
- ❌ Renaming presets (breaks user expectations)
- ❌ Removing presets (breaks saved configurations)

---

## ✅ Verification Checklist

### All Sports
- [x] Football: 4 presets (backend ↔ frontend synced)
- [x] Basketball: 4 presets (backend ↔ frontend synced) ⚠️ **FIXED 1/2/2026**
- [x] Baseball: 2 presets (backend ↔ frontend synced) ⚠️ **FIXED 1/2/2026**
- [x] Soccer: 2 presets (backend ↔ frontend synced)
- [x] Track: 1 preset (backend ↔ frontend synced)
- [x] Volleyball: 1 preset (backend ↔ frontend synced)

### Weight Validation
- [x] All preset weights sum to 1.0
- [x] All weights are between 0.0 and 1.0
- [x] Specialized presets use 30-50% on primary skills
- [x] "Balanced" presets distribute weights evenly or near-evenly

### UX Validation
- [x] Max 4 presets per sport (no choice overload)
- [x] Preset names are sport-appropriate
- [x] Descriptions clearly explain use case
- [x] Presets follow complexity-based scaling model

---

## 📝 Future Considerations

### Potential Additions (Product Review Required)
1. **Track "Distance Focus"** - For 800m/1600m specialists
2. **Track "Field Focus"** - For jumps/throws specialists
3. **Volleyball "Setter Focus"** - For setter-specific combines
4. **Volleyball "Libero Focus"** - For defensive specialist combines
5. **Baseball "Pitcher Focus"** - For pitching-only showcases

### Rationale for Current Exclusions
- These represent <10% of combine scenarios based on current usage
- Can be handled with custom weights in analytics view
- Adding them would violate "speed over choice overload" principle
- Should only add if user research shows clear workflow pain

---

## 🎓 Design Rationale

### Why Different Preset Counts?
**Football (4 presets)** has the most diverse position types:
- Speed positions (RB, WR, DB) vs. skill positions (QB, TE) vs. physical positions (LB, DE)
- Warrants distinct evaluation modes

**Track (1 preset)** is hyper-specialized:
- Athletes typically compete in narrow event categories
- Sprint combines don't need "balanced" evaluation - they're sprint-focused by definition

### Why No "Medium" Presets?
Presets like "Moderately Speed Focused" or "Slightly Athletic" create choice paralysis without adding value. Each preset should represent a **distinct evaluation philosophy**, not a point on a sliding scale.

### Why "Balanced" Everywhere?
Even specialized sports benefit from a baseline comparison preset. "Balanced" provides:
1. Fair starting point for multi-tool prospects
2. Reference point for custom weight adjustments
3. Neutral evaluation mode for scouts unfamiliar with sport-specific priorities

---

**Document Status:** FINAL  
**Next Review:** Only if user research identifies workflow gaps  
**Owner:** Product Leadership

