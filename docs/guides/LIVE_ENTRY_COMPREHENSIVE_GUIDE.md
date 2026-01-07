# Live Entry Mode - Comprehensive Guide

## Table of Contents
1. [Overview](#overview)
2. [When to Use Live Entry](#when-to-use-live-entry)
3. [Quick Start](#quick-start)
4. [Step-by-Step Workflow](#step-by-step-workflow)
5. [Features & Capabilities](#features--capabilities)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Tips & Best Practices](#tips--best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

**Live Entry Mode** is the fastest way to record drill scores during an active combine event. It's designed for real-time data entry as athletes complete each drill station.

### Key Benefits
- ⚡ **Speed**: Record scores in 3-5 seconds per player
- 🎯 **Accuracy**: Smart player matching and duplicate detection
- 📊 **Real-time**: Instant leaderboard updates
- ↩️ **Safety**: Undo mistakes immediately
- 🔒 **Protection**: Lock drills when complete to prevent accidental changes

### Perfect For
- Live combines with 50+ athletes
- Multiple drill stations running simultaneously
- Events where coaches need instant rankings
- Fast-paced tryouts and showcases

---

## When to Use Live Entry

| Scenario | Use Live Entry? | Alternative |
|----------|----------------|-------------|
| Recording 40+ players at live event | ✅ Yes | - |
| One drill station, sequential players | ✅ Yes | - |
| Multiple stations, rotating players | ✅ Yes | Players page (for post-event entry) |
| Post-event data entry from paper | ❌ No | CSV Import or Players page |
| Small group (<10 players) | ⚠️ Optional | Players page may be easier |

---

## Quick Start

### Prerequisites
1. ✅ Event created with drill template selected
2. ✅ Players uploaded to roster
3. ✅ Each player has a unique jersey number (recommended)

### 3-Step Process
```
1. Select Drill → 2. Search Player → 3. Enter Score → Submit
```

### First Score Example
1. Click **"Select Drill"** → Choose **"Exit Velocity"**
2. Click **"Confirm Drill"**
3. Type **"1201"** (player number) → Player auto-selected
4. Type **"87"** (mph) → Enter
5. ✅ Score recorded! Next player ready.

**Time**: ~5 seconds per score

---

## Step-by-Step Workflow

### Phase 1: Drill Selection

#### Step 1A: Choose Your Drill
```
┌─────────────────────────────┐
│  Select Drill               │
│  ┌─────────────────────┐    │
│  │ 60-Yard Sprint      │ ◀── Click
│  │ Exit Velocity       │
│  │ Throwing Velocity   │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

**What You See:**
- Dropdown with all drills from your event's template
- Baseball example: 60-Yard Sprint, Exit Velocity, Throwing Velocity, etc.
- Drill shows measurement unit (seconds, mph, reps)

**Tips:**
- Choose drills in station order
- Stick with one drill until all players complete it
- Can't change drill while players are waiting? See [Drill Switching](#drill-switching)

#### Step 1B: Confirm Your Selection
```
┌─────────────────────────────┐
│  ✓ 60-Yard Sprint (sec)     │
│  [Confirm Drill] ◀────────── Click
└─────────────────────────────┘
```

**Why Confirmation?**
Prevents accidental drill switching when entering scores quickly. You must explicitly confirm before recording scores.

**After Confirmation:**
- ✅ Green checkmark appears
- 🔓 Player search unlocked
- 🎯 Focus jumps to player search

---

### Phase 2: Player Selection

#### Method A: Search by Jersey Number (Fastest)
```
┌─────────────────────────────────┐
│ Player Number or Name           │
│ ┌─────────────────────────────┐ │
│ │ 1201 ◀────────────────────── │ Type number
│ └─────────────────────────────┘ │
│ ✓ Selected: #1201 · Cole Anderson│ ◀── Auto-selected
└─────────────────────────────────┘
```

**How It Works:**
1. Type jersey number: `1201`
2. **Instant match**: Player auto-selected if exact match
3. **No match**: Shows similar numbers in dropdown
4. Press **Enter** or click player

**Speed**: ⚡ Fastest method (1-2 seconds)

#### Method B: Search by Name
```
┌─────────────────────────────────┐
│ Player Number or Name           │
│ ┌─────────────────────────────┐ │
│ │ anders ◀──────────────────── │ Type name
│ └─────────────────────────────┘ │
│   Cole Anderson       15U       │ ◀── Click
│   Sam Anderson        14U       │
│   Aaron Anderson      12U       │
└─────────────────────────────────┘
```

**How It Works:**
1. Type partial name: `anders`
2. Smart matching:
   - First name starts with: ✅ `Anders`on
   - Last name starts with: ✅ `Anderson`
   - Contains: ✅ Cole `Anders`on
3. Shows top 5 matches
4. Click player or use ↑↓ arrows + Enter

**Smart Features:**
- **Case-insensitive**: "COLE" = "cole" = "Cole"
- **Partial matching**: "col" finds "Cole"
- **Multiple words**: "sam and" finds "Sam Anderson"
- **Auto-select**: If only 1 match, auto-selects after 150ms

**Speed**: 🔹 Fast for unique names (2-4 seconds)

#### Keyboard Navigation
```
Type "and" → Dropdown appears
↓ arrow → Highlight Sam Anderson
↓ arrow → Highlight Aaron Anderson  
↑ arrow → Back to Sam Anderson
Enter   → Select highlighted player
```

#### After Selection
```
┌─────────────────────────────────────────┐
│ Player Number or Name                   │
│ ┌───────────────────────────────────┐ ✓ │ ◀── Green checkmark
│ │ #1201 · Cole Anderson             │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- ✅ Green checkmark confirms selection
- 🎯 Focus automatically jumps to Score field
- Player info shows in input: `#1201 · Cole Anderson`

---

### Phase 3: Score Entry

#### Step 3A: Enter the Score
```
┌─────────────────────────────┐
│ Score (mph)                 │
│ ┌─────────────────────────┐ │
│ │ 87 ◀──────────────────── │ Type score
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Input Types by Drill:**
- **Time-based** (sprint): `7.2`, `6.85` (decimals OK)
- **Velocity** (exit velo): `87`, `92.5` (mph)
- **Distance** (long jump): `24`, `18.5` (feet/inches)
- **Reps** (push-ups): `45`, `38` (whole numbers)

**Auto-Formatting:**
- Decimal point automatically inserted for time drills
- Unit displayed next to field: `(mph)`, `(sec)`, `(ft)`

#### Step 3B: Add Note (Optional)
```
┌─────────────────────────────┐
│ ☐ Add note (optional) ◀──── Click to expand
└─────────────────────────────┘

After clicking:
┌─────────────────────────────┐
│ ☑ Add note (optional)       │
│ ┌─────────────────────────┐ │
│ │ Wind-aided +2mph        │ │ ◀── Type note
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**When to Use Notes:**
- Weather conditions: "Strong headwind"
- Equipment issues: "Borrowed bat"
- Injury modifications: "Recovering from ankle sprain"
- Exceptional context: "Personal best"

**Notes Appear:**
- In recent entries list
- On player scorecards
- In exports/reports

#### Step 3C: Submit Score
```
┌─────────────────────────────┐
│ [Submit & Next] ◀─────────── Click or press Enter
└─────────────────────────────┘
```

**What Happens:**
1. ✅ Score saved to database
2. 📊 Leaderboard instantly updates
3. 🔄 Form resets for next player
4. 🎯 Focus returns to player search
5. ➕ Entry added to "Recent Entries" list

**Keyboard Shortcut**: Press **Enter** from score field to submit instantly

---

### Phase 4: Duplicate Detection

#### Duplicate Warning
```
┌───────────────────────────────────────┐
│ ⚠️ Duplicate Score Detected           │
│                                       │
│ Cole Anderson already has a score:   │
│ 60-Yard Sprint: 7.2 sec              │
│                                       │
│ New score: 7.0 sec                   │
│                                       │
│ [Replace] [Keep Both] [Cancel]       │
└───────────────────────────────────────┘
```

**When It Appears:**
- Same player + same drill already has a score
- Prevents accidental duplicates

**Your Options:**

1. **Replace** (Most Common)
   - Overwrites old score with new score
   - Use when: Retake, correction, better attempt

2. **Keep Both**
   - Saves both scores (some systems allow multiple attempts)
   - Rankings use best score automatically

3. **Cancel**
   - Discards new score
   - Use when: Entry error, wrong player

---

## Features & Capabilities

### 1. Recent Entries Panel

```
┌─────────────────────────────────────┐
│ Recent Entries (8)                  │
│ ┌─────────────────────────────────┐ │
│ │ Cole Anderson · 87 mph      [↩️] │ │ ◀── Click ↩️ to undo
│ │ Sam Anderson · 85 mph       [↩️] │ │
│ │ Aaron Lee · 92 mph          [↩️] │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Purpose**: Track the last 20 scores entered

**Features:**
- ↩️ **Undo**: Click arrow to delete entry
- 🕐 **Chronological**: Newest at top
- 📊 **Count**: Shows total entries for this drill
- 🎨 **Visual**: Player name, score, unit

**Use Cases:**
- Catch data entry errors immediately
- Verify scores were recorded correctly
- Undo accidental submissions

### 2. Missing Players Tracker

```
┌─────────────────────────────────────┐
│ Missing Players (12 remaining) 🔽   │
│ ┌─────────────────────────────────┐ │
│ │ Search: [_________]             │ │
│ │                                 │ │
│ │ #1205 · Mike Chen               │ │
│ │ #1207 · Sarah Johnson           │ │
│ │ #1210 · Alex Kim                │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Purpose**: Show which players haven't completed this drill yet

**Features:**
- 🔢 **Count**: "12 remaining" updates live
- 🔍 **Search**: Filter by name or number
- ✅ **Auto-remove**: Player disappears when score entered
- 📋 **Scrollable**: Shows up to 50 players

**Benefits:**
- Ensure no player is missed
- Quick reference for checking off players
- See who needs to rotate back

### 3. Drill Locking

```
┌─────────────────────────────────────┐
│ 60-Yard Sprint (sec)            🔓  │ ◀── Unlocked
│ [🔒 Lock This Drill]                │
└─────────────────────────────────────┘

After locking:
┌─────────────────────────────────────┐
│ 60-Yard Sprint (sec)            🔒  │ ◀── Locked
│ [🔓 Unlock This Drill]              │
└─────────────────────────────────────┘
```

**Purpose**: Prevent accidental changes to completed drills

**When to Lock:**
- ✅ All players have completed the drill
- ✅ Moving to next drill station
- ✅ Taking a break

**What Locking Does:**
- 🚫 Can't enter new scores for this drill
- 🔒 Must unlock to add/edit scores
- ✅ Other drills still fully accessible

**Safety Feature**: Client-side only (doesn't affect other devices)

### 4. Drill Review Mode

```
┌─────────────────────────────────────┐
│ 📋 Drill Complete — Review?         │
│                                     │
│ All 48 players have scores!         │
│                                     │
│ [Open Review] [Dismiss]             │
└─────────────────────────────────────┘
```

**When It Appears:**
- All players have scores for current drill
- Automatically suggests moving to next drill

**Review Mode Shows:**
- ✅ Complete list of all scores
- 🏆 Rankings and percentiles
- ❌ Outliers or potential errors
- ✏️ Edit any score inline

**Actions:**
- **Open Review**: See all scores, make corrections
- **Dismiss**: Continue (can manually review anytime)

### 5. Live Standings Integration

```
┌─────────────────────────────────────┐
│ [📊 View Live Standings →]          │
└─────────────────────────────────────┘
```

**Purpose**: Show real-time leaderboards

**What Athletes/Parents See:**
- 🏆 Current rankings
- 📈 Drill-by-drill results
- 🔄 Updates every 2-3 seconds
- 🎯 Overall rankings

**Coaches See:**
- All of the above PLUS
- Weight adjustments
- Age group breakdowns
- Export options

### 6. Score Entry Notes

```
┌─────────────────────────────────────┐
│ Cole Anderson · 87 mph              │
│ 📝 "Wind-aided, +2mph estimated"    │ ◀── Note appears
└─────────────────────────────────────┘
```

**Where Notes Appear:**
1. Recent entries list
2. Player detail modal
3. Exported reports
4. Score review mode

**Best Uses:**
- Context for unusual scores
- Equipment variations
- Weather conditions
- Injury modifications

### 7. Help Panel

```
┌─────────────────────────────────────┐
│ [❓ Show Help]                       │
└─────────────────────────────────────┘

Expands to:
┌─────────────────────────────────────┐
│ 📖 Live Entry Help                  │
│                                     │
│ Quick Tips:                         │
│ • Type player number for fastest... │
│ • Press Enter to submit...          │
│ • Use ↩️ arrow to undo...           │
└─────────────────────────────────────┘
```

**Always Available**: Click anytime during entry

---

## Keyboard Shortcuts

| Action | Shortcut | Context |
|--------|----------|---------|
| Submit score | **Enter** | When in score field |
| Navigate dropdown | **↑** **↓** arrows | When player search is active |
| Select player | **Enter** | When player highlighted |
| Clear player search | **Backspace** / **Delete** | When player selected |
| Focus player search | **Tab** | After drill confirmation |
| Focus score field | **Tab** | After player selection |

### Speed Workflow (Keyboard Only)
```
1. Click [Confirm Drill]
2. Type: 1201 → Enter (selects player)
3. Type: 87 → Enter (submits score)
4. Type: 1203 → Enter
5. Type: 92 → Enter
6. Repeat...
```

**Result**: ~5 seconds per score entry

---

## Tips & Best Practices

### Setup Phase

#### 1. Assign Jersey Numbers
```
✅ GOOD: Every player has unique number
❌ BAD: Multiple players share #12
```

**Why**: Number search is 3x faster than name search

**How to Assign:**
- Admin Tools → Player Management → Edit player
- Or bulk import with numbers in CSV

#### 2. Pre-Load Roster
```
✅ Upload players BEFORE event starts
❌ Don't add players during live entry
```

**Why**: Stops workflow to add new players

#### 3. Test Run
```
✅ Enter 3-5 test scores before event
❌ Learn during the actual event
```

**Why**: Builds muscle memory and confidence

---

### During Event

#### 1. Stick to One Drill at a Time
```
✅ Record all 60-yard sprints → Lock → Next drill
❌ Jumping between drills constantly
```

**Why**: Reduces confusion and drill-switching errors

#### 2. Use Recent Entries Panel
```
✅ Glance at Recent Entries after every 5 scores
❌ Wait until end to check for errors
```

**Why**: Catch mistakes while player is still present

#### 3. Verbal Confirmation
```
✅ "Cole Anderson, 7.2 seconds, correct?"
❌ Silent entry
```

**Why**: Athletes catch mistakes immediately

#### 4. Two-Person Team
```
✅ Spotter: Calls out "#1201, 7.2"
   Recorder: Types and confirms
❌ One person trying to watch and type
```

**Why**: Faster, more accurate, less stressful

#### 5. Lock Completed Drills
```
✅ Lock drill when everyone has score
❌ Leave all drills unlocked
```

**Why**: Prevents accidental entries in wrong drill

---

### Speed Optimization

#### For Sequential Entry (All Players, One Drill)
```
SETUP:
1. Confirm drill
2. Tell players to line up in order

ENTRY:
Type → Enter → Type → Enter → Type → Enter
1201 → Enter → 7.2 → Enter → 1203 → Enter → 7.0 → Enter
```

**Speed**: ⚡⚡⚡ 4-5 seconds per player

#### For Rotating Stations (Multiple Drills)
```
SETUP:
1. Assign 1 recorder per drill station
2. Each recorder enters for their station only

ADVANTAGE:
- Parallel entry
- 3 drills = 3x faster total completion
```

---

### Quality Control

#### Check These After Each Session

1. **Missing Players**: Expand list, check count
2. **Recent Entries**: Scroll through last 10-20
3. **Outliers**: Scores that seem too high/low
4. **Duplicates**: Same player listed twice

#### End of Drill Checklist
```
☐ All players have scores
☐ No obvious outliers (e.g., 0.0, 999)
☐ Recent entries look correct
☐ Lock drill
☐ Move to next drill
```

---

## Troubleshooting

### Problem: Player Name Doesn't Appear in Search

**Possible Causes:**
1. Player not uploaded to roster
2. Typo in name/number
3. Player in different age group (check filter)

**Solution:**
```
1. Go to Players page
2. Search for player there
3. If missing: Add player
4. Return to Live Entry
5. Refresh page (Cmd+R / Ctrl+R)
```

---

### Problem: Can't Select Drill

**Cause**: Drill hasn't been confirmed

**Solution:**
```
1. Choose drill from dropdown
2. Click [Confirm Drill] button
3. Green checkmark appears
4. Player search unlocks
```

---

### Problem: "Duplicate Score" Warning

**Cause**: Player already has score for this drill

**Options:**
1. **Replace**: Overwrites old score (most common)
2. **Keep Both**: Saves both (for multi-attempt drills)
3. **Cancel**: Discards new score (wrong player)

**Prevention**: Check Recent Entries before submitting

---

### Problem: Wrong Score Entered

**Immediate Fix (< 30 seconds ago):**
```
1. Find entry in Recent Entries panel
2. Click ↩️ undo arrow
3. Re-enter correct score
```

**Later Fix:**
```
1. Go to Players page
2. Find player
3. Click "View Stats & Weights"
4. Edit score manually
```

---

### Problem: Player Selection Doesn't Work

**Symptom**: Click player, nothing happens

**Solution:**
```
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Win)
2. If still broken: Clear browser cache
3. Try different browser (Chrome recommended)
```

---

### Problem: Scores Not Appearing in Live Standings

**Cause**: Network delay or cache

**Solution:**
```
1. Wait 5 seconds for sync
2. Refresh Live Standings page
3. Check internet connection
4. Verify score saved (check Recent Entries)
```

---

### Problem: Can't Undo Score

**Cause**: Only last 20 entries are undoable

**Solution:**
```
If not in Recent Entries list:
1. Go to Players page
2. Find player
3. Click "View Stats"
4. Delete or edit score manually
```

---

## Performance Metrics

### Speed Benchmarks

| Entry Method | Time per Score | 50 Players |
|--------------|----------------|------------|
| **Live Entry (number)** | 4-5 sec | 3-4 min ⚡ |
| **Live Entry (name)** | 6-8 sec | 5-7 min |
| **Players Page (manual)** | 15-20 sec | 12-17 min |
| **CSV Import (post-event)** | N/A | 5-10 min setup |

### Real-World Example

**Event**: 48 players, 5 drills = 240 total scores

| Method | Total Time |
|--------|------------|
| Live Entry (optimized) | **20-25 minutes** ⚡ |
| Players Page (manual) | 60-80 minutes |
| Paper → CSV → Import | 45-60 minutes |

**Verdict**: Live Entry is **3x faster** than alternatives for live events

---

## Advanced Workflows

### Multi-Station Setup

**Scenario**: 4 drill stations, 48 players rotating

**Setup:**
```
Station 1: Exit Velocity    → Recorder A
Station 2: 60-Yard Sprint   → Recorder B  
Station 3: Throwing Velo    → Recorder C
Station 4: Fielding Accuracy → Recorder D
```

**Each Recorder:**
1. Opens Live Entry on tablet/laptop
2. Confirms their assigned drill
3. Enters scores for their station only

**Result**: All 4 drills complete in time of 1 drill

---

### Single-Station Sequential

**Scenario**: 1 station, all players rotate through each drill

**Workflow:**
```
Drill 1: 60-Yard Sprint
├── Enter all 48 players → Lock drill
Drill 2: Exit Velocity  
├── Enter all 48 players → Lock drill
Drill 3: Throwing Velocity
└── Enter all 48 players → Done
```

**Time**: ~25 minutes total for 3 drills

---

## Integration with Other Features

### Live Entry → Live Standings
- Scores appear in 2-3 seconds
- Athletes/parents see real-time updates
- No manual refresh needed

### Live Entry → Player Scorecards
- All scores auto-populate scorecards
- Notes appear on printable reports
- Weighted rankings calculate instantly

### Live Entry → Exports
- CSV exports include all scores
- Timestamps show when entered
- Notes column includes annotations

### Live Entry → Analytics
- Drill distributions update live
- Percentile rankings recalculate
- Team averages adjust instantly

---

## Security & Permissions

### Who Can Access Live Entry?

| Role | Access | Can Edit? |
|------|--------|-----------|
| **Organizer** | ✅ Full | ✅ Yes |
| **Coach** | ✅ Full | ✅ Yes |
| **Evaluator** | ✅ Full | ✅ Yes |
| **Viewer** | ❌ No | ❌ No |
| **Player** | ❌ No | ❌ No |

### Data Safety
- ✅ All scores saved to database instantly
- ✅ No scores lost if browser crashes
- ✅ Undo only affects your device (doesn't delete from database immediately)
- ✅ Duplicate detection prevents overwrites

---

## Mobile vs Desktop

### Mobile (Phone/Tablet)
**Pros:**
- ✅ Portable around drill stations
- ✅ Touch-friendly interface
- ✅ Works on WiFi or cellular

**Cons:**
- ❌ Slower typing
- ❌ Smaller screen for Recent Entries
- ❌ Auto-correct can cause issues

**Best For**: Single-person entry at one station

### Desktop/Laptop
**Pros:**
- ✅ Fast keyboard entry
- ✅ Larger screen for monitoring
- ✅ External keyboard available

**Cons:**
- ❌ Less portable
- ❌ Needs table/desk

**Best For**: Central scoring station or multi-station coordinator

---

## FAQ

### Q: What happens if I lose internet connection?

**A**: Scores will fail to save. You'll see an error message. Wait for connection to restore, then re-enter.

### Q: Can two people enter scores for the same drill simultaneously?

**A**: Yes! Both entries will save. Duplicate detection will alert if same player is entered twice.

### Q: What if a player's number isn't in the system?

**A**: Search by name instead. After event, assign numbers in Player Management for future events.

### Q: Can I edit a score after it's submitted?

**A**: Yes, two ways:
1. **Immediate**: Click ↩️ in Recent Entries (last 20 entries)
2. **Later**: Go to Players page → Find player → Edit score

### Q: How do I know all players completed a drill?

**A**: Check "Missing Players" count. When it reaches 0, all players have scores.

### Q: What if I need to enter scores for a player not on roster?

**A**: Exit Live Entry → Go to Players page → Add player → Return to Live Entry → Refresh page

### Q: Can I switch between drills?

**A**: Yes, but not recommended during active entry. Better to complete one drill fully, lock it, then switch.

---

## Summary

### Live Entry is Best When:
✅ Recording scores during live event  
✅ 20+ players  
✅ Players have jersey numbers  
✅ Need real-time leaderboards  
✅ Speed is critical  

### Use Alternative When:
❌ Post-event data entry from paper  
❌ Fewer than 10 players  
❌ Need to enter historical data  
❌ Importing from CSV  

---

## Quick Reference Card

```
┌────────────────────────────────────────┐
│       LIVE ENTRY QUICK REFERENCE       │
├────────────────────────────────────────┤
│ WORKFLOW:                              │
│ 1. Select drill → Confirm              │
│ 2. Type player # → Enter               │
│ 3. Type score → Enter                  │
│ 4. Repeat for all players              │
│                                        │
│ KEYBOARD SHORTCUTS:                    │
│ Enter     → Submit score               │
│ ↑↓        → Navigate dropdown          │
│ Backspace → Clear selection            │
│                                        │
│ SPEED TIPS:                            │
│ • Use jersey numbers (fastest)         │
│ • Lock drills when complete            │
│ • Check Recent Entries every 5 scores  │
│ • Two-person team = 2x speed           │
│                                        │
│ TROUBLESHOOTING:                       │
│ • Wrong score? Click ↩️ to undo         │
│ • Missing player? Check roster         │
│ • Duplicate warning? Choose Replace    │
│ • Not working? Hard refresh (Cmd+Shift+R)│
└────────────────────────────────────────┘
```

---

## Support

Need help? Check these resources:

1. **In-App Help**: Click [❓ Show Help] in Live Entry
2. **Video Tutorials**: [Coming Soon]
3. **Email Support**: support@woo-combine.com
4. **This Guide**: Bookmark for quick reference

---

*Last Updated: January 7, 2026*  
*Version: 1.0*  
*WooCombine Live Entry Mode*

