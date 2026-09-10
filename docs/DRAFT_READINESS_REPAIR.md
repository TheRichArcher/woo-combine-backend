# Commissioner-led draft acceptance criteria

Confirmed with Rich on September 9, 2026. These requirements supersede incompatible assumptions in the older feature specification. Readiness is judged with synthetic drafts of varying sizes; actual event enrollment is not a prerequisite.

## Required behavior

- An organizer creates a draft and invites coaches. During Zoom, the organizer can enter each team's pick without pause/resume. Coaches can see remaining players and complete rosters update. Coach self-picking is optional, not a release prerequisite.
- Each team may have zero to three Safe Picks total, including children associated with its coach's account. They occupy that team's rounds 1 through N. One Safe Pick means first live selection in round 2; three means round 4. Reserved athletes leave the available pool and appear in team rosters before live selections begin.
- Draft order is randomized before starting and then snakes, reversing each round. Teams with different Safe Pick counts retain their original snake slots; reserved slots are skipped.
- Siblings are assigned together unless explicitly requested otherwise. Additional siblings consume the selecting team's next future turns, including across snake reversals. Never consume another team's turn. The existing reviewed sibling group is the assignment unit; separation must be represented explicitly by a separation request/review decision or removal of that grouping.
- Buddy requests do not create guaranteed assignments. Conflicting emailed Safe Pick nominations must be resolved before using the final approved Safe Pick assignments; the app must not silently award an athlete twice.
- An absent coach or unassigned team can be handled by organizer-triggered autodraft. Timers are optional; a browser timer is not a guarantee of server-side scheduling.
- Every athlete appears exactly once across remaining pool and assigned rosters. Uneven pool sizes, fewer players than teams, empty pools and exhaustion must terminate or reject clearly without lost players or deadlock.
- An organizer can correct a mistaken live pick, including the final selection. Undo reverses the entire sibling action, future reserved slots and generated roster effects together. Safe assignments are setup decisions; post-event trades remain disabled by default.
- Duplicate clicks, stale observer state, refresh, disconnect and concurrent requests cannot double-assign an athlete or advance a stale turn twice.
- CSV export reopens with separate rows and correct quoted fields, preserving team and player data.

## Verification gates

1. Real Firestore SDK persistence and transaction lifecycle, including retries/conflicts. In-memory unit tests alone are insufficient.
2. Synthetic rules matrix: 0/1/2/3 Safe Picks, different counts across teams, sibling groups across reversal, explicit separation, unequal pools, last selection undo, and independent drafts with no cross-talk.
3. Access checks: organizer can operate every turn, assigned coach can view the draft, outsider cannot access it.
4. Browser rehearsal: setup, start, select, observe available pool and complete rosters, undo, resume and export. Disclose any test-only identity harness; it does not verify production login or invite delivery.
5. Production build and focused regression tests. Report remaining failures and environment blockers; do not equate compilation with readiness.

Deployment is a separate release step. Local repairs and successful synthetic rehearsals do not establish the currently deployed site has changed.

## September 9 repair verification

Full backend suite:192 passed,2 unrelated baseline failures (legacy league scope expectation and public-results name punctuation), each reproduced against original HEAD. Four emulator integration tests use actual Firestore. Frontend focused tests:8 passed; Vite and Tailwind production builds passed. Chrome synthetic21-player/4-team rehearsal verified safe0/1/2/3, siblings, separation, pause/resume, observer refresh, grouped/final undo and re-completion. Exported21 rows exactly matched persisted team/player/round/pick records. Real Firebase identity, deployed rehearsal and Safari remain release gates. Registration ability/history mapping remains a feature gap.

## Release follow-up — September 9, 2026

SportsConnect participant CSV mapping now preserves parent-reported ability, previous team and seasons played, explicitly labeled separately from measured scores. Preview requires a division choice. Import is atomic and rejects duplicate source IDs/names without partial writes. Current enrollment exports lack the supplemental answers; obtain a participant export for the relevant season.

Clean npm ci and full production/postbuild pass with updated nonbreaking lockfile resolutions. Runtime npm audit reports zero known advisories at verification time; two moderate dev-only jest-junit/uuid advisories remain. Focused frontend15 tests pass. Full frontend20 failures reproduce on the pre-follow-up source (five existing auth/route test suites). Final backend197 pass,2 previously reproduced baseline failures; five real Firestore emulator tests pass including concurrent import.

Chrome verified synthetic CSV upload, preview, import, commissioner picks, coach refresh, completion and CSV export. Phone-width390px Chrome emulation verified full named rosters; this is not a physical iPhone/Safari test. Production Firebase authentication remains unverified: no authenticated Woo-Combine browser session, and hosting login requires the account owner's passkey.

`render-draft-rehearsal.yaml` prepares separate free test services on this branch, using the existing non-production `tosh-woo-combine` Firebase project. `scripts/rehearsal_entry.py` refuses production project credentials and local emulator auth in the remote service. Never substitute production credentials. Manual hosting authentication, confirmation of existing test credentials/accounts, and remote commissioner/coach rehearsal remain required. This blueprint has not been applied.
