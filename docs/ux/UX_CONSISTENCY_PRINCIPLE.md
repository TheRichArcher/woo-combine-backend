# WooCombine UX Consistency Principle

**Adopted:** January 2026  
**Status:** Enforced

---

## Core Principle

> **"Same function = same component = same experience"**

If two (or more) features or functions perform the same job, they **must** be identical in:
- Style
- Performance
- Functionality
- Behavior
- Visual design
- Copy/messaging
- Interaction patterns
- Error handling
- Success flows
- Every other dimension

**No exceptions.**

---

## Why This Matters

### User Trust
When the same action looks/behaves differently in different contexts, users:
- Question if they're using the right tool
- Wonder if one version is "better" or "newer"
- Lose trust in the consistency of the system
- Experience cognitive load trying to learn multiple patterns

### Maintenance Cost
Duplicate implementations mean:
- 2x the code to maintain
- 2x the surface area for bugs
- 2x the work for feature updates
- Divergence over time (one gets updated, the other doesn't)

### Design Debt
Inconsistency compounds:
- New developers see multiple patterns and don't know which to follow
- Future features get built inconsistently
- Technical debt grows exponentially

---

## Implementation Rules

### 1. One Canonical Component
For each distinct function, there is **one canonical component**:
- All entry points use this component
- No parallel implementations
- No "custom versions" for specific contexts

### 2. Context-Appropriate Configuration
If behavior needs to differ by context:
- Use **props** to configure the canonical component
- Do NOT create a separate component
- Document why the configuration exists

**Example:**
```jsx
// ✅ GOOD: Single component, configured
<ImportResultsModal 
  initialMode="create_or_update"
  showModeSwitch={false}  // Hide in setup context
/>

// ❌ BAD: Separate component for same job
<EventSetupImporter />
```

### 3. Shared Visual Language
Components that serve the same purpose must share:
- Color schemes
- Typography
- Spacing/padding
- Button styles
- Icon usage
- Animation/transitions
- Loading states
- Error states

### 4. Consistent Post-Action Behavior
After completing an action, the system must behave consistently:
- Same success feedback
- Same navigation/redirect logic
- Same data refresh patterns
- Same error recovery

---

## Current Canonical Components

### Player Import
**Canonical Component:** `ImportResultsModal.jsx`

**Used By:**
- Players page → "Import Results" button
- Admin Tools → Event Setup → "Import Players from File"
- Onboarding flow → Player upload step

**Configuration:**
- `initialMode`: "create_or_update" | "scores_only"
- `showModeSwitch`: true (Players page) | false (Event Setup)
- `intent`: "roster_and_scores" | "roster_only"

**Post-Success:**
- Show success toast
- Invalidate cache
- Redirect to `/players?tab=manage`
- Refresh player count

**History:**
- January 2026: Unified on ImportResultsModal, removed 460 lines of duplicate logic from EventSetup
- Commit: `a0c0b52`

---

## Enforcement Checklist

Before creating a new UI component, ask:

1. **Does this function already exist elsewhere?**
   - If yes → use the existing component
   - If no → proceed

2. **Could this function exist elsewhere in the future?**
   - If yes → design for reusability from day 1
   - If no → still design for clarity and consistency

3. **Does this look/behave exactly like the canonical version?**
   - If no → fix it before shipping
   - If yes → document why any differences exist

4. **Is there a clearer way to do this using existing patterns?**
   - Always prefer consistency over novelty
   - New patterns require explicit justification

---

## Code Review Standards

**Reject PRs that:**
- Create duplicate implementations of existing functions
- Introduce inconsistent visual patterns for the same job
- Don't use canonical components when available
- Fail to document intentional differences

**Require before merge:**
- Confirmation that canonical components were considered
- Justification for any new patterns introduced
- Documentation of component configuration options

---

## Audit Process

**Quarterly:**
1. Search codebase for duplicate patterns
2. Identify functions that appear in multiple places
3. Create unification tickets
4. Prioritize by user impact

**Immediate Red Flags:**
- Multiple components with "Import" in the name
- Multiple "Add [Entity]" patterns with different UX
- Multiple forms for the same data model
- Copy-pasted code with slight variations

---

## Migration Strategy

When duplicates are found:

1. **Identify Canonical:** Choose the best implementation (UX, features, code quality)
2. **Extract Configuration:** Identify what needs to be configurable
3. **Migrate Entry Points:** Replace all duplicates with canonical component
4. **Delete Old Code:** Fully remove duplicate implementations (don't leave commented out)
5. **Document:** Add to "Current Canonical Components" section above
6. **Prevent Regression:** Add code comments preventing re-introduction

---

## Examples of Duplicate Patterns to Watch For

### High Risk Areas
- **Forms:** Player add/edit, Event create/edit, League setup
- **Imports:** CSV/Excel uploads, data migrations
- **Modals:** Confirmation dialogs, info popups
- **Lists:** Player lists, event lists, drill lists
- **Navigation:** Menus, breadcrumbs, back buttons

### Common Anti-Patterns
```jsx
// ❌ BAD: Desktop vs Mobile versions of same component
<DesktopPlayerList />
<MobilePlayerList />

// ✅ GOOD: Responsive canonical component
<PlayerList className="responsive-grid" />
```

```jsx
// ❌ BAD: Context-specific duplicates
<EventSetupPlayerImport />
<PlayersPageImport />
<OnboardingImport />

// ✅ GOOD: Single component, configured
<ImportResultsModal context="setup|players|onboarding" />
```

---

## Success Metrics

**Goals:**
- Zero duplicate implementations of the same function
- <5 seconds for users to recognize familiar patterns in new contexts
- Zero "which version should I use?" questions in user feedback
- 100% code reuse for identical functions

**Tracking:**
- Monthly audit of component duplication
- User confusion reports related to inconsistent UX
- Code review rejection rate for duplicate patterns
- Bundle size reduction from deduplication

---

## Related Principles

- **DRY (Don't Repeat Yourself):** Applied to UX, not just code
- **Principle of Least Surprise:** Users should never wonder "why is this different?"
- **Progressive Enhancement:** Start consistent, add context-specific features via props
- **Component Composition:** Build complex UX from simple, reusable pieces

---

## Version History

**v1.0 - January 2026**
- Initial adoption
- ImportResultsModal established as canonical player importer
- EventSetup deduplicated (460 lines removed)

---

## Questions?

If you're unsure whether to create a new component or use an existing one:
1. Check this document for canonical components
2. Search codebase for similar patterns
3. Ask in code review: "Does this already exist?"
4. Default to consistency over customization

**When in doubt: reuse, don't rebuild.**

