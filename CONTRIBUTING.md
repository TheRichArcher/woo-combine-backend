# Contributing to WooCombine

Thank you for contributing to WooCombine! This document outlines our development standards and workflow.

---

## 🎯 Core Principle: UX Consistency

**Rule:** Same function = same component = same experience

We maintain a set of canonical components for common operations. **You must use these components** instead of creating new implementations.

### Canonical Components (Required)

If you're implementing any of these features, you **MUST** use the canonical component:

| Feature | Canonical Component | Location |
|---------|---------------------|----------|
| **Player Bulk Import** | `ImportResultsModal` | `frontend/src/components/Players/ImportResultsModal.jsx` |
| **Manual Player Add** | `AddPlayerModal` | `frontend/src/components/Players/AddPlayerModal.jsx` |
| **Event Create/Edit** | `EventFormModal` | `frontend/src/components/EventFormModal.jsx` |
| **Delete Confirmation** | `DeleteConfirmModal` | `frontend/src/components/DeleteConfirmModal.jsx` |
| **Player Display** | `PlayerCard` | `frontend/src/components/PlayerCard.jsx` |

### When You Can't Use a Canonical Component

If you believe you need a different implementation:

1. **Stop and ask:** Why can't the canonical component handle this case?
2. **Propose enhancement:** Can we add a prop/variant to the canonical component?
3. **Document in PR:** Explain why a new component is absolutely necessary
4. **Get approval:** Tag maintainers for review before proceeding

**Example valid reasons:**
- Canonical component doesn't support required data structure
- Performance issues at scale
- Fundamentally different use case (not just styling)

**Invalid reasons:**
- "I didn't know it existed" → Check this doc first
- "It's faster to build my own" → No, maintenance cost is higher
- "I want different styling" → Use className prop or variants

---

## 📋 Pull Request Requirements

### Before Submitting

**Code Quality:**
- [ ] Build passes (`npm run build`)
- [ ] No linter errors
- [ ] No console errors in browser
- [ ] Tested in Chrome and Safari

**Canonical Component Check:**
- [ ] If adding create/edit/delete/import/player-add/player-display functionality:
  - [ ] Used canonical component, OR
  - [ ] Explained in PR description why canonical doesn't work
  - [ ] Proposed enhancement to canonical component

**Documentation:**
- [ ] Updated relevant docs in `/docs` if architecture changed
- [ ] Added JSDoc comments to new functions
- [ ] Updated CHANGELOG.md for user-facing changes

**Testing:**
- [ ] Manually tested happy path
- [ ] Tested error states
- [ ] Tested edge cases (empty data, network errors)

---

## 🚫 Anti-Patterns (Reject in PR Review)

**❌ DO NOT:**
- Create inline forms when canonical modals exist
- Use `window.confirm()` for delete actions (use `DeleteConfirmModal`)
- Build custom player card HTML (use `PlayerCard` component)
- Copy/paste form validation (use shared utils)
- Duplicate API calls (use `withCache` or context)
- Hard-code drill definitions (use `drillTemplates.js`)

**✅ DO:**
- Reuse canonical components
- Configure via props
- Add variants if needed (after discussion)
- Update canonical component if insufficient
- Follow existing patterns

---

## 🏗️ Development Workflow

### Setup

```bash
# Clone repo
git clone <repo-url>

# Install dependencies
cd frontend && npm install
cd ../backend && pip install -r requirements.txt

# Run development servers
cd frontend && npm run dev  # Port 5173
cd backend && uvicorn main:app --reload  # Port 8000
```

### Making Changes

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Follow canonical component requirements
   - Keep commits focused and atomic
   - Write clear commit messages

3. **Test thoroughly**
   ```bash
   cd frontend && npm run build  # Verify build
   ```

4. **Commit with clear message**
   ```bash
   git commit -m "feat: add xyz feature using ImportResultsModal
   
   - Uses canonical ImportResultsModal component
   - Added custom validation for edge case
   - Tested with 500+ player import"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

---

## 📝 Commit Message Format

```
<type>: <short summary>

<detailed description>

<why this change was made>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code improvement (no behavior change)
- `docs:` Documentation only
- `test:` Test changes
- `chore:` Build/tooling changes

**Example:**
```
feat: add player filtering by age group

Added age group dropdown to Players page.
Uses existing PlayerCard component with filter prop.
Maintains consistency with CoachDashboard filtering.

Resolves user request for quick age group navigation.
```

---

## 🧪 Testing Guidelines

### Manual Testing Checklist

For any player-related changes:
- [ ] Test with 0 players (empty state)
- [ ] Test with 1 player
- [ ] Test with 100+ players (performance)
- [ ] Test with missing data (no scores, no age group)

For any form changes:
- [ ] Test required field validation
- [ ] Test error states (network failure)
- [ ] Test success states (toast, navigation)
- [ ] Test cancellation (modal closes, no changes saved)

### Regression Prevention

After any changes to canonical components:
- [ ] Test all pages that use the component
- [ ] Verify no visual regressions (compare screenshots)
- [ ] Check console for new errors
- [ ] Verify loading/empty states still work

---

## 🎨 UI/UX Standards

### Player Cards
- Always use `PlayerCard` component
- Variants: `card` (default), `compact` (rankings), `list` (tables)
- Actions: View Stats, Edit, Delete (standardized)
- Don't create custom player HTML

### Modals
- Use existing modal components when possible
- Consistent close behavior (X button, Esc key, click outside)
- Loading states (spinner + disabled buttons)
- Error states (red text, try again option)

### Forms
- Required fields marked with *
- Validation messages below fields
- Submit button disabled during loading
- Success toasts on completion

### Colors
- Primary actions: `bg-brand-primary` (teal)
- Destructive actions: `bg-red-600`
- Success states: `bg-green-600`
- Disabled states: `opacity-50`

---

## 📚 Key Documentation

- [UX Consistency Principle](./docs/ux/UX_CONSISTENCY_PRINCIPLE.md)
- [Duplication Audit](./docs/ux/DUPLICATION_AUDIT_2026-01.md)
- [Phase 1 Validation](./docs/ux/PHASE_1_VALIDATION_CHECKLIST.md)
- [Phase 2 Audit](./docs/ux/PHASE_2_AUDIT.md)

---

## 🆘 Need Help?

**Before asking:**
1. Check if canonical component exists for your use case
2. Read the component's JSDoc comments
3. Look for similar implementations in codebase

**How to ask:**
- Describe what you're trying to build
- Show what canonical component you checked
- Explain why it doesn't work for your case
- Propose a solution (enhancement or new component)

---

## ✅ PR Approval Checklist (Reviewers)

**Code Quality:**
- [ ] Build passes
- [ ] No linter errors
- [ ] Code follows existing patterns

**Canonical Components:**
- [ ] Uses canonical components for common operations
- [ ] If not, valid reason provided
- [ ] No duplicate implementations added

**Testing:**
- [ ] Manually tested by author
- [ ] Edge cases considered
- [ ] No console errors

**Documentation:**
- [ ] JSDoc added for new functions
- [ ] README updated if needed
- [ ] Changelog updated for user-facing changes

---

## 🎉 Thank You!

Your contributions make WooCombine better. By following these guidelines, you help maintain a consistent, maintainable codebase that's easy for everyone to work with.

**Questions?** Open a discussion or reach out to maintainers.


