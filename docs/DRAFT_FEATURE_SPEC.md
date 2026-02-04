# Draft Feature Specification
## Woo-Combine Player Draft System

**Goal:** Add OnlineDraft-style team drafting to Woo-Combine, leveraging existing combine performance data as the foundation for coach decision-making.

---

## 1. Overview

### What We're Building
A real-time draft system where coaches take turns selecting players for their teams. Unlike OnlineDraft (which requires manual player rankings), Woo-Combine already has objective combine scores—giving coaches data-driven insights during picks.

### Key Differentiator
> "Draft with data, not guesswork."

Coaches see actual 40m dash times, vertical jumps, catching scores, etc. while making picks. This is our competitive advantage over generic draft tools.

---

## 2. User Roles

| Role | Capabilities |
|------|-------------|
| **League Admin** | Create draft, set order, manage teams, override picks, pause/resume |
| **Head Coach** | Make picks for their team, view all players, create personal rankings |
| **Assistant Coach** | View draft, suggest picks (no pick authority) |
| **Spectator** | View-only draft board (optional public link) |

---

## 3. Draft Configuration

### Setup Options (Admin)

```
Draft Settings:
├── Draft Name: "U10 Spring Draft"
├── Age Group: [U8 | U10 | U12 | U14 | All] ← Filters player pool
├── Number of Teams: [4-16]
├── Rounds: [Auto-calculate from players/teams, or manual]
├── Draft Type: [Snake | Linear]
├── Pick Timer: [Off | 30s | 60s | 90s | 120s | Custom]
├── Auto-pick on timeout: [Yes/No] (uses coach ranking or composite score)
├── Pre-slotted Players: [Assign specific players to teams before draft]
├── Visibility: [Coaches Only | Public Draft Board]
│
└── Trade Settings:
    ├── Allow Trades: [Yes / No] ← Default: NO
    ├── Trade Window: [During Draft | Post-Draft | Both]
    └── Require Admin Approval: [Yes / No]
```

### Draft Order
- **Random** — System generates order
- **Reverse Standings** — Worst team picks first (for returning leagues)
- **Manual** — Admin sets order explicitly

### Snake Draft Example (8 teams, showing first 2 rounds):
```
Round 1: Team1 → Team2 → Team3 → Team4 → Team5 → Team6 → Team7 → Team8
Round 2: Team8 → Team7 → Team6 → Team5 → Team4 → Team3 → Team2 → Team1
```

---

## 4. Data Model (Firestore)

### New Collections

#### `drafts`
```javascript
{
  id: "draft_abc123",
  event_id: "event_xyz",
  league_id: "league_123",
  name: "U10 Spring Draft",
  status: "setup" | "active" | "paused" | "completed",
  
  // Player Pool Filter
  age_group: "U10" | "U12" | "U14" | null,  // null = all players
  
  // Configuration
  draft_type: "snake" | "linear",
  num_teams: 8,
  num_rounds: 12,
  pick_timer_seconds: 60,  // 0 = no timer
  auto_pick_on_timeout: true,
  
  // Trade Settings
  trades_enabled: false,  // Default: NO
  trade_window: "during_draft" | "post_draft" | "both",
  trades_require_approval: true,
  
  // Draft Order (team IDs in pick order for round 1)
  team_order: ["team_1", "team_2", "team_3", ...],
  
  // State
  current_round: 1,
  current_pick: 1,
  current_team_id: "team_1",
  
  // Timestamps
  created_at: timestamp,
  started_at: timestamp | null,
  completed_at: timestamp | null,
  
  // Timer state (for live countdown)
  pick_deadline: timestamp | null,
  
  created_by: "user_uid"
}
```

#### `draft_teams`
```javascript
{
  id: "dteam_abc",
  draft_id: "draft_abc123",
  team_name: "Warriors",
  coach_user_id: "user_456",
  coach_name: "Coach Smith",
  pick_order: 3,  // Position in round 1
  
  // Pre-slotted players (e.g., coach's kid)
  pre_slotted_player_ids: ["player_789"],
  
  created_at: timestamp
}
```

#### `draft_picks`
```javascript
{
  id: "pick_001",
  draft_id: "draft_abc123",
  round: 1,
  pick_number: 3,  // Overall pick number
  team_id: "dteam_abc",
  player_id: "player_xyz",
  
  // Metadata
  picked_by: "user_456",  // Who made the pick
  pick_type: "manual" | "auto" | "pre-slot",
  time_taken_seconds: 45,
  
  created_at: timestamp
}
```

#### `coach_rankings` (Personal pre-draft rankings)
```javascript
{
  id: "ranking_abc",
  draft_id: "draft_abc123",
  coach_user_id: "user_456",
  
  // Ordered list of player IDs (index = rank)
  ranked_player_ids: ["player_1", "player_5", "player_3", ...],
  
  updated_at: timestamp
}
```

---

## 5. Core Screens

### 5.1 Draft Setup (Admin)
**Route:** `/draft/setup/:eventId`

```
┌─────────────────────────────────────────────────────────┐
│  Create Draft: Spring 2026 Basketball                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Teams (8)                      Draft Settings          │
│  ┌─────────────────────┐       ┌───────────────────┐   │
│  │ 1. Warriors [Coach] │       │ Type: Snake    ▼  │   │
│  │ 2. Lakers   [Coach] │       │ Timer: 60 sec  ▼  │   │
│  │ 3. Celtics  [Coach] │       │ Auto-pick: Yes ▼  │   │
│  │ 4. Bulls    [Coach] │       │ Rounds: 12     ▼  │   │
│  │ + Add Team          │       └───────────────────┘   │
│  └─────────────────────┘                               │
│                                                         │
│  Pre-Slotted Players (Optional)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Player          →  Team                         │   │
│  │ Jake Smith (#12) →  Warriors (Coach's kid)      │   │
│  │ + Add Pre-Slot                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Player Pool: 96 players from "Spring Combine"         │
│                                                         │
│             [ Save Draft ]  [ Start Draft → ]          │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Coach Ranking (Pre-Draft)
**Route:** `/draft/:draftId/rankings`

```
┌─────────────────────────────────────────────────────────┐
│  My Player Rankings                    Draft in 2 days  │
├─────────────────────────────────────────────────────────┤
│  Drag players to rank. This is YOUR private list.      │
│                                                         │
│  ┌─ My Rankings ──────────┐  ┌─ Available Players ────┐│
│  │ 1. Mike Johnson        │  │ [Search...]            ││
│  │    40m: 5.2s | Vert: 28│  │                        ││
│  │ 2. Sarah Williams      │  │ ☐ Alex Chen            ││
│  │    40m: 5.5s | Vert: 26│  │   40m: 5.8s | Vert: 24 ││
│  │ 3. (empty)             │  │ ☐ Jordan Lee           ││
│  │    Drag player here    │  │   40m: 5.4s | Vert: 27 ││
│  │                        │  │ ☐ Taylor Kim           ││
│  └────────────────────────┘  │   40m: 5.6s | Vert: 25 ││
│                              └────────────────────────┘│
│  Sort available by: [Composite ▼] [40m] [Vert] [Age]   │
│                                                         │
│                              [ Save Rankings ]          │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Live Draft Room (Coach View)
**Route:** `/draft/:draftId/live`

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔴 LIVE DRAFT          Round 3 of 12         Pick Timer: 0:45     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ ON THE CLOCK ────────────────────────────────────────────────┐ │
│  │        🏀 WARRIORS (Coach Smith)                              │ │
│  │           Pick #17 Overall                                    │ │
│  │                        ████████████░░░░ 45s                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ AVAILABLE PLAYERS ──────────────────────────────────────────┐  │
│  │ [Search...] Sort: [My Ranking ▼] [Composite] [40m] [Position]│  │
│  │                                                               │  │
│  │  ★ #1 Mike Johnson      5.2s   28"   8.5   [DRAFT]          │  │
│  │  ★ #2 Sarah Williams    5.5s   26"   8.2   [DRAFT]          │  │
│  │    #3 Alex Chen         5.8s   24"   7.9   [DRAFT]          │  │
│  │    -- Jordan Lee        5.4s   27"   8.1   [DRAFT]          │  │
│  │       (★ = on your ranking list)                             │  │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ DRAFT BOARD ────────────────────────────────────────────────┐  │
│  │      │ Rd1      │ Rd2      │ Rd3      │ Rd4      │           │  │
│  │ WAR  │ T.Brown  │ K.Davis  │ ⏳       │          │           │  │
│  │ LAK  │ J.White  │ M.Green  │ ←next    │          │           │  │
│  │ CEL  │ R.Black  │ S.Gray   │          │          │           │  │
│  │ BUL  │ L.Blue   │ P.Red    │          │          │           │  │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ MY TEAM (Warriors) ─────┐  ┌─ RECENT PICKS ─────────────────┐  │
│  │ 1. Tyler Brown    (Rd1)  │  │ #16 Lakers: Marcus Green       │  │
│  │ 2. Kevin Davis    (Rd2)  │  │ #15 Celtics: Sam Gray          │  │
│  │ 3. (picking...)          │  │ #14 Bulls: Pete Red            │  │
│  └──────────────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Draft Board (Big Screen / TV View)
**Route:** `/draft/:draftId/board`

Optimized for projection. Large text, high contrast, auto-scrolls.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🏀 SPRING 2026 DRAFT                             │
│                       Round 3 • Pick #17                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│         ⏱️  WARRIORS ON THE CLOCK  ⏱️                               │
│                     0:45                                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   WARRIORS    │   LAKERS     │   CELTICS    │   BULLS              │
│   ──────────  │   ──────────  │   ──────────  │   ──────────        │
│   T. Brown    │   J. White    │   R. Black    │   L. Blue           │
│   K. Davis    │   M. Green    │   S. Gray     │   P. Red            │
│   ⏳ picking  │               │               │                     │
│               │               │               │                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  LAST PICK: #16 Lakers selected Marcus Green (Composite: 8.3)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Real-Time Sync

### Option A: Firestore Real-Time Listeners (Recommended for MVP)
- Use Firestore's `onSnapshot()` for live updates
- Each client listens to `drafts/{draftId}` and `draft_picks` collection
- Simple, no additional infrastructure
- ~1-2 second latency (acceptable for draft pace)

### Option B: WebSocket Server (Future Enhancement)
- Sub-second updates
- More complex deployment
- Better for high-stakes, fast-paced drafts

### MVP Approach
```javascript
// Frontend: Listen for draft state changes
const unsubscribe = onSnapshot(
  doc(db, 'drafts', draftId),
  (doc) => {
    setDraftState(doc.data());
  }
);

// Listen for new picks
const unsubscribePicks = onSnapshot(
  collection(db, 'drafts', draftId, 'picks'),
  (snapshot) => {
    const picks = snapshot.docs.map(d => d.data());
    setAllPicks(picks);
  }
);
```

---

## 7. API Endpoints

### Draft Management
```
POST   /drafts                    Create new draft
GET    /drafts/:id                Get draft details
PATCH  /drafts/:id                Update draft settings
POST   /drafts/:id/start          Start the draft
POST   /drafts/:id/pause          Pause the draft
POST   /drafts/:id/resume         Resume the draft
DELETE /drafts/:id                Delete draft (setup only)
```

### Teams
```
POST   /drafts/:id/teams          Add team to draft
GET    /drafts/:id/teams          List all teams
PATCH  /drafts/:id/teams/:teamId  Update team (name, coach)
DELETE /drafts/:id/teams/:teamId  Remove team
```

### Picks
```
POST   /drafts/:id/picks          Make a pick
GET    /drafts/:id/picks          Get all picks
POST   /drafts/:id/picks/undo     Undo last pick (admin only)
```

### Rankings
```
GET    /drafts/:id/rankings       Get my rankings
PUT    /drafts/:id/rankings       Save my rankings
```

### Players (Draft Context)
```
GET    /drafts/:id/players        Get available players with scores
GET    /drafts/:id/players/taken  Get drafted players
```

---

## 8. Pick Flow Logic

```python
def make_pick(draft_id: str, player_id: str, user_id: str):
    draft = get_draft(draft_id)
    
    # Validate
    if draft.status != "active":
        raise Error("Draft not active")
    
    current_team = get_current_team(draft)
    if current_team.coach_user_id != user_id and not is_admin(user_id):
        raise Error("Not your turn")
    
    if player_already_drafted(draft_id, player_id):
        raise Error("Player already drafted")
    
    # Record pick
    pick = create_pick(
        draft_id=draft_id,
        round=draft.current_round,
        pick_number=calculate_overall_pick(draft),
        team_id=current_team.id,
        player_id=player_id,
        picked_by=user_id,
        pick_type="manual"
    )
    
    # Advance draft state
    advance_draft(draft)
    
    return pick

def advance_draft(draft):
    next_pick = calculate_next_pick(draft)
    
    if next_pick is None:
        # Draft complete
        draft.status = "completed"
        draft.completed_at = now()
    else:
        draft.current_round = next_pick.round
        draft.current_pick = next_pick.pick_number
        draft.current_team_id = next_pick.team_id
        
        if draft.pick_timer_seconds > 0:
            draft.pick_deadline = now() + timedelta(seconds=draft.pick_timer_seconds)
    
    save_draft(draft)
```

---

## 9. Implementation Phases

### Phase 1: Core Draft (MVP) — ✅ COMPLETE (2026-02-02)
- [x] Data model & Firestore collections
- [x] Draft setup UI (admin)
- [x] Basic draft room (make picks, see board)
- [x] Real-time sync via Firestore listeners
- [x] Snake/linear draft logic

### Phase 2: Enhanced UX — ✅ COMPLETE (2026-02-02)
- [x] Coach pre-draft rankings
- [x] Pick timer with auto-pick
- [x] Draft Board (TV view)
- [x] Pick undo (admin)
- [x] Mobile-optimized coach view
- [x] Player photos throughout

### Phase 3: Advanced Features — Future
- [ ] Pre-slotted players (API exists, needs UI)
- [ ] Trade functionality
- [ ] Draft history & replay
- [ ] Export rosters
- [ ] Public spectator link

---

## 10. Migration Notes

### Existing Data Integration
- **Players:** Use existing `players` collection, filtered by `event_id`
- **Scores:** Leverage existing `scores` map and drill results
- **Users/Coaches:** Use existing Firebase Auth + league membership

### No Breaking Changes
- Draft is additive — existing team formation tool remains
- Coaches can still use algorithmic formation OR manual draft
- Draft results can feed into existing team/roster views

---

## 11. Design Decisions

### ✅ Draft Results → Auto-Create Teams
When a draft completes, the system automatically creates team roster records. No manual conversion step. Coaches immediately see their roster in the Teams view.

### ✅ Multiple Drafts Per Event
Each age group gets its own draft. Draft setup includes "Age Group" filter that scopes the player pool. One event can have:
- U8 Draft (players aged 7-8)
- U10 Draft (players aged 9-10)
- U12 Draft (players aged 11-12)
- etc.

### ✅ Trades: Optional, Disabled by Default
```
Trade Settings (per draft):
├── Allow Trades: [Yes / No]  ← Default: NO
├── Trade Window: [During Draft Only / Post-Draft / Both]
└── Require Admin Approval: [Yes / No]
```
Many youth leagues prohibit trades for fairness. This is respected by default.

### 🔮 Future: Keeper Leagues
For returning leagues, let teams protect players from previous season. (Phase 3+)

---

## 12. Success Metrics

- Drafts completed without errors
- Average time per pick (target: <60s with timer)
- Coach prep (% using ranking feature)
- Repeat usage (leagues using draft year-over-year)

---

*Spec created: 2026-02-02*
*Author: Tosh*
