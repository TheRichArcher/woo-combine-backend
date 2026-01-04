# WooCombine - Next High-Leverage Focus Areas

**Date:** January 3, 2026  
**Context:** Importer UX is complete and locked (commit 80fb72c)

---

## 🚫 Do Not Work On

**Importer UX** - Over-solved, production-ready, locked per PM directive.

Only touch if:
- Real production users fail with documented evidence
- Critical bug (crashes, data loss)
- Accessibility compliance issue

---

## 🎯 High-Leverage Areas (Priority Order)

### 1. Coach Dashboard → "Next Action" Follow-Through

**Problem:** Coaches complete guided setup but don't know what to do next.

**Evidence from memories:**
- "RESOLVED major UX confusion in Getting Started guide where coaches could see what to do but not how to do it"
- "Transformed passive bullet points into actionable step-by-step guide"
- Previous fixes improved messaging but may not address underlying workflow gaps

**High-leverage opportunities:**

#### A. Post-Import "What's Next" Flow
**When:** After user completes first CSV import  
**Current state:** Success modal → closes → back to Players page  
**Opportunity:**
- Add contextual "Next Steps" panel after import success
- "✅ 25 players imported. Ready to start tracking scores?"
- Quick actions:
  - "Start Live Entry Mode" (primary CTA)
  - "Download Score Sheets" (for offline events)
  - "Share QR Code with Coaches" (for distributed scoring)

**Impact:** Converts passive success into immediate action  
**Effort:** Low (1-2 hours) - Modal enhancement  
**Value:** High - Bridges gap between setup and usage

#### B. Dashboard "Empty State" Intelligence
**When:** Coach has players but no drill scores yet  
**Current state:** Shows player list, no scores  
**Opportunity:**
- Prominent card: "📊 Ready to Record Results?"
- Three workflow paths with icons:
  1. ⚡ Live Entry (real-time during event)
  2. 📋 Offline Import (spreadsheet after event)
  3. 📱 Coach QR Codes (distributed scoring)
- Each path shows estimated time and best use case

**Impact:** Removes decision paralysis  
**Effort:** Medium (3-4 hours) - New component  
**Value:** High - Accelerates first ranking

#### C. Progress Indicators for First Event
**Concept:** Milestone tracker that shows completion status  
**Visual:**
```
Event Setup Progress:
✅ Event created (Dec 15)
✅ Players imported (Dec 16) - 25 players
⏳ Record drill scores - 0 of 125 total
☐ Generate rankings
☐ Export results
```

**Triggers next action:** "Record your first drill score to unlock rankings"

**Impact:** Creates momentum and clarity  
**Effort:** Medium (4-5 hours) - State tracking + UI  
**Value:** Medium-High - Psychological driver

---

### 2. First-Event Success Metrics

**Problem:** We don't know where users get stuck or succeed.

**Key questions:**
1. What % of users who create an event record at least 1 drill score?
2. What's the median time from event creation → first ranking generated?
3. Where do users drop off? (Import? Live Entry? Export?)

**High-leverage opportunities:**

#### A. Event Lifecycle Tracking (Backend)
**Implementation:**
```python
# Add to Event model
first_player_added_at: datetime
first_score_recorded_at: datetime
first_ranking_generated_at: datetime
first_export_at: datetime

# Track in relevant endpoints
/players/upload → set first_player_added_at
/drills/{drill_id}/scores → set first_score_recorded_at
/players (with rankings) → set first_ranking_generated_at
/events/{id}/export-pdf → set first_export_at
```

**Impact:** Enables funnel analysis  
**Effort:** Low (2-3 hours) - Schema + logging  
**Value:** High - Data-driven prioritization

#### B. Simple Analytics Dashboard (Admin View)
**For PM/Admin only:**
- Conversion funnel visualization
- Median time-to-value by step
- Drop-off points with counts

**Insight examples:**
- "60% of events never record a score → prioritize Live Entry UX"
- "Users who import players within 1 hour are 5x more likely to complete event"
- "Median time from import → first ranking: 45 minutes (goal: < 15 min)"

**Impact:** Reveals highest-leverage improvements  
**Effort:** Medium (6-8 hours) - Backend aggregation + simple UI  
**Value:** High - Strategic clarity

#### C. User Feedback Capture at Key Moments
**Trigger points:**
1. After first successful import: "How was the import process?" (1-5 scale)
2. After first drill score entry: "How intuitive was score entry?" (1-5)
3. After first ranking view: "Did this meet your expectations?" (Yes/No/Comments)

**Non-intrusive:** Dismissible, stored but doesn't block workflow

**Impact:** Qualitative context for metrics  
**Effort:** Low (3-4 hours) - Simple modal component  
**Value:** Medium - Contextualizes quantitative data

---

### 3. Export/Share Flows (Value Realization)

**Problem:** Users complete the event but don't share/export results.

**Evidence from memories:**
- "Successfully streamlined Players page" mentions export tab
- Export functionality exists but usage unclear

**High-leverage opportunities:**

#### A. Post-Event "Share Results" Wizard
**Trigger:** When event status changes to "Complete" or 7 days after last score  
**Flow:**
```
🎉 Event Complete: Spring Combine 2026

Your results are ready to share!

□ Download PDF Report (for records)
□ Email to all participants (25 players)
□ Generate shareable link (public rankings)
□ Export CSV (for analysis)

[Share Results] [Do This Later]
```

**Impact:** Converts completion into visibility  
**Effort:** Medium (5-6 hours) - Wizard UI + email integration  
**Value:** High - Demonstrates ROI to organizers

#### B. "Quick Share" from Players Page
**Current:** Export options buried in tab  
**Opportunity:**
- Floating action button (bottom-right): "📤 Share"
- Quick menu:
  - Copy shareable link
  - Download PDF (1-click)
  - Email results
  - Print score sheets

**Impact:** Reduces friction to sharing  
**Effort:** Low (2-3 hours) - FAB component  
**Value:** Medium - Convenience improvement

#### C. Post-Export Feedback Loop
**After export/share:**
```
✅ PDF downloaded successfully

Quick tip: Share on social media to showcase your athletes!

[Share on Twitter] [Share Link] [Done]
```

**Impact:** Amplifies reach, increases visibility  
**Effort:** Low (1-2 hours) - Success state enhancement  
**Value:** Medium - Marketing opportunity

---

## 📊 Recommended Priority Stack

**This Week (High-leverage, low-effort):**
1. Post-import "What's Next" flow (2 hours)
2. Event lifecycle tracking backend (3 hours)
3. "Quick Share" FAB (2 hours)

**Total: ~7 hours for 3 high-impact improvements**

**Next Week (Strategic depth):**
4. Dashboard empty state intelligence (4 hours)
5. Simple analytics dashboard (8 hours)
6. Post-event share wizard (6 hours)

**Total: ~18 hours for foundational improvements**

---

## 🚫 Anti-Patterns to Avoid

1. **Don't iterate on importer** - It's done, locked, over-solved
2. **Don't build features without metrics** - Track first, then optimize
3. **Don't polish UI before workflow** - Ensure users complete journeys first
4. **Don't add complexity** - Every new feature should reduce friction

---

## ✅ Success Criteria for These Areas

**Coach Dashboard:**
- 80%+ of coaches who import players start Live Entry within same session
- < 5 minutes from import → first drill score recorded

**First-Event Metrics:**
- Track 100% of event lifecycle milestones
- Identify top drop-off point with >50% confidence
- Reduce median time-to-first-ranking by 30%

**Export/Share:**
- 60%+ of completed events generate at least 1 export
- 30%+ of organizers share results publicly
- Average 2+ shares per event

---

## 📝 Notes

These recommendations are based on:
- User behavior patterns from memory
- Conversion funnel logic (setup → usage → value)
- Low-hanging fruit (high impact, low effort)
- Strategic depth (metrics to guide future work)

**Importer is complete.** Focus on what happens **after** import.

