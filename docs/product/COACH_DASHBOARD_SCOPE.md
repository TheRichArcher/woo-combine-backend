# Coach Dashboard Scope & Design Principles

**Route:** `/coach`  
**Purpose:** Command center for running combine events  
**Last Updated:** January 2, 2025

---

## Core Mental Model

The Coach Dashboard (`/coach`) serves as a **shared operations dashboard** for both organizers and coaches:

- **Organizers** = Superset of coaches (full access + admin controls)
- **Coaches** = View + limited interaction (no event management)

### Design Philosophy

> **The 10-Second Rule**  
> "Can an organizer make this decision in under 10 seconds while standing at the registration table during an event?"
> 
> **YES** → Belongs on `/coach`  
> **NO** → Move to specialist page

**Key Attributes:**
- **Calm** - Not overwhelming with options
- **Fast** - Quick load, minimal scrolling
- **Operational** - Focused on "what's next?" not deep analysis
- **Navigational** - Fast paths to specialist tools

---

## Confirmed Scope (What Stays)

### 1. League & Event Management
- ✅ League name display
- ✅ Event selector dropdown (switch between events)
- ✅ Create New Event button (organizers)
- ✅ Edit Event Details button (organizers)
- ✅ Current event display with date/location

### 2. Age Group Selection
- ✅ Age group dropdown with player counts
- ✅ "All Players" option for cross-age evaluation

### 3. High-Level Event Statistics
Display **summary metrics only** for selected age group:
- ✅ Total player count
- ✅ Completion rate (% with scores)
- ✅ Average composite score
- ✅ Score range (min/max)
- ✅ Status indicator (not started / in progress / complete)

### 4. Ranking Presets (Organizers)
**Keep:** 4 quick preset buttons
- ⚖️ Balanced
- ⚡ Speed Focused
- 🎯 Skills Focused
- 🏃 Athletic

**Why presets belong here:** Fast operational decision ("We want speed-focused rankings for this tryout")

### 5. Quick Navigation Grid
4-icon grid for specialist pages:
- 👥 Players (`/players`) - Roster management
- 📅 Schedule (`/schedule`) - Calendar
- 🛡️ Teams (`/team-formation`) - Team creation
- 📋 Scorecards (`/scorecards`) - Player reports
- 📊 Analytics (link) - Advanced analysis

### 6. Rankings Preview
**At-a-glance signal**, not deep exploration:
- ✅ Top 8-10 players (medal indicators for top 3)
- ✅ Rank, name, number, score
- ✅ Click → Opens player details modal
- ✅ Export CSV button

---

## Planned Additions (High-Value)

### Priority 1: Contextual "Next Action" CTA ⭐ **IMPLEMENTED**

**Problem:** Users ask "what do I do next?" after selecting event

**Solution:** Smart primary button that adapts to event state

**Logic:**
```javascript
if (players.length === 0) 
  → "Add Players" → /admin#player-upload

else if (totalScoresCount === 0) 
  → "Import Results" → /players?action=import
  → "Start Live Entry" (secondary) → /live-entry

else if (completionRate < 100) 
  → "Continue Evaluations" → /live-entry

else (completionRate === 100)
  → "Review Full Rankings" → /players?tab=rankings
  → "Export Results" (secondary) → /players?tab=export
```

**Placement:** Below Events Card, above quick nav grid  
**Visual Hierarchy:** Large, prominent, primary color  
**Status:** Implemented ✅

---

### Priority 2: Operational Alerts Strip 🔶 **DEFERRED**

**Purpose:** Surface **actionable** issues that block event execution

**Examples:**
```
⚠️ 8 players missing age groups → Fix Player Data
⚠️ 12 players have no drill scores → Start Evaluations
⚠️ CSV import: 3 unmapped columns → Review Import Settings
```

**Characteristics:**
- Yellow/orange styling (warning, not error)
- Dismissible but persistent (localStorage tracking)
- Direct link to fix location
- Only shows **operational blockers**, not analytics insights

**What NOT to alert on:**
- ❌ Low average scores (that's analytics)
- ❌ Imbalanced age group sizes (not actionable)
- ❌ Suggested weight changes (not operational)

**Implementation Timing:** Future polish sprint

---

### Priority 3: Event-Day Quick Tools (Organizers) 🔧 **DEFERRED**

**Purpose:** Common event-day tasks without leaving `/coach`

**Proposed Features:**
- 📱 Show/Download QR Code (coach invites)
- 🔗 Copy Invite Link (shareable URL)
- 📋 Print Check-in List (player roster PDF)

**Placement Options:**
1. Collapsible "Event Tools" card below Events Card
2. "Tools" dropdown in Events Card header
3. Modal triggered by "Event Tools" button

**Implementation Timing:** Future polish sprint

---

## Future Migrations (Moving Features Off)

### Move to `/analytics` or `/players`

#### 1. Full Ranking Weight Sliders → `/analytics`

**Currently on `/coach`:** Individual drill sliders (0-100%) for custom weight tuning

**Why move:**
- Deep tuning requires analysis, not quick decisions
- Slows page load (5 sliders + real-time calculations)
- Violates 10-second rule (tuning weights takes 2-5 minutes)

**Keep on `/coach`:** 4 preset buttons (fast operational choice)  
**Move to `/analytics`:** 
- Individual drill sliders
- Weight sensitivity analysis
- Historical weight comparisons
- Custom preset saving

**Migration Timeline:** When `/analytics` page has ranking analysis features

---

#### 2. Deep Rankings Explorer → `/players?tab=rankings` or `/rankings`

**Currently on `/coach`:** Full scrollable rankings list with deep PlayerDetailsModal

**Why move:**
- Rankings analysis is a dedicated task, not a quick check
- Heavy modals (PlayerDetailsModal) slow interaction
- Users spending 5+ minutes here = they need a specialist page

**Keep on `/coach`:** Top 8-10 players preview + "View Full Rankings →" link  
**Move to specialist page:**
- Full sortable/filterable rankings list
- PlayerDetailsModal with drill breakdowns
- Historical performance trends
- Comparison tools

**Migration Timeline:** After `/players` or dedicated `/rankings` page is enhanced

---

#### 3. Detailed Drill-Level Breakdowns → `/analytics`

**Currently on `/coach`:** Age group stats show average score only (good!)

**Future-proof guideline:** 
- ✅ Keep: Summary stats (avg score, completion %)
- ❌ Don't add: Per-drill averages, percentile charts, drill correlations

Those belong in `/analytics` for deep performance analysis.

---

## Page Architecture Hierarchy

```
WooCombine App
│
├─ /coach (Command Center) ⭐ THIS PAGE
│  ├─ Run the event
│  ├─ See status
│  ├─ Make fast decisions
│  └─ Navigate to specialists
│
├─ /players (Roster Operations)
│  ├─ Player management (add/edit/delete)
│  ├─ Bulk operations (CSV import/export)
│  ├─ Deep player details
│  └─ Full rankings explorer
│
├─ /analytics (Analysis & Optimization)
│  ├─ Ranking weight tuning (sliders)
│  ├─ Performance insights
│  ├─ Historical trends
│  └─ Drill correlations
│
├─ /schedule (Calendar Management)
│  └─ Event scheduling & planning
│
├─ /scorecards (Player Reports)
│  └─ Individual player scorecards
│
└─ /team-formation (Team Building)
   └─ Balanced team creation
```

---

## Decision Framework

When deciding if a feature belongs on `/coach`, ask:

### ✅ Belongs on `/coach` if:
- [ ] Needed within 10 seconds during event execution
- [ ] Operational decision, not analytical deep-dive
- [ ] Requires no more than 1-2 clicks/inputs
- [ ] Provides at-a-glance status signal
- [ ] Enables fast navigation to specialist tools

### ❌ Does NOT belong on `/coach` if:
- [ ] Requires 5+ minutes of focused attention
- [ ] Deep analysis or exploration task
- [ ] Heavy interaction (lots of scrolling/filtering/tuning)
- [ ] Detailed configuration or customization
- [ ] Historical comparison or trend analysis

**Gray Area Example:**  
*"Should we add drill-by-drill completion rates?"*

**Analysis:**
- Is it operational? ✅ Yes (helps identify which drills to focus on)
- 10-second decision? ⚠️ Marginal (might be too detailed)
- Alternative? ✅ Yes (Alerts strip can flag "12 players missing Agility scores")

**Decision:** Use Alerts Strip instead of detailed breakdown

---

## Success Metrics

Track these to validate `/coach` effectiveness:

1. **Time to First Action** - How fast do users navigate after landing?
2. **Bounce Rate to Specialist Pages** - Are users finding what they need?
3. **Return Frequency** - Do users come back to `/coach` during events?
4. **Feature Usage** - Which quick actions/presets get used most?

**Goal:** Keep average session time on `/coach` under 2 minutes (it's a command center, not a destination)

---

## Implementation Notes

### Current Status (January 2025)

**Implemented:**
- ✅ League/Event management
- ✅ Age group selection + stats
- ✅ Ranking presets (organizers)
- ✅ Quick nav grid
- ✅ Rankings preview with export
- ✅ Contextual Next Action CTA

**Deferred (Future Sprints):**
- 🔶 Operational Alerts Strip
- 🔶 Event-Day Quick Tools
- 🔶 Move weight sliders to Analytics
- 🔶 Move deep rankings to specialist page

### Code Location
**File:** `frontend/src/pages/CoachDashboard.jsx`

### Related Pages
- `/players` - Player management
- `/analytics` - Performance analysis
- `/admin` - Organizer tools

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2, 2025 | Initial scope definition, 10-second rule established |
| 1.1 | Jan 2, 2025 | Added Contextual Next Action CTA |

---

## Questions / Escalation

If unsure whether a feature belongs on `/coach`:

1. Apply the 10-second rule
2. Check the Decision Framework above
3. Review similar features in this document
4. Default to moving it to a specialist page (keep `/coach` focused)

**Philosophy:** When in doubt, keep `/coach` **smaller** and **faster**.

