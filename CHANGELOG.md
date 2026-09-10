# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Draft: commit picks, Safe Picks, grouped undo and rosters using real Firestore transactions; reject concurrent or stale turns.
- Draft: enforce three Safe Picks in each team's opening rounds, reserve sibling assignments on that team's future snake turns, and finish uneven player pools without dropping players.
- Draft: repair standalone coach invites, hide other teams' invite tokens, preserve explicit sibling separation, and keep pause/resume/reset consistent with completion.
- Draft UI: show complete named rosters, correct CSV export, reconnect failures, accurate Safe Pick rules and completion controls; leave unmeasured athletes unrated.
- Validation: add real Firestore emulator coverage for transaction lifecycle, concurrent picks, sibling/safe turns and competing invite claims, plus focused frontend regressions.
- Frontend: static site build to `frontend/dist`; HTTPS redirect + HSTS
- Backend: Docker non-root, health check `/health`
- Render: health checks and autoscaling guidance; stateless (no sticky sessions)
- Release flow: Dev auto-deploy on `main`, Staging protected, Prod via tags with changelog

## [v1.0-buyer-ready] - 2025-08-09
- Buyer-ready release
- CI green across backend and frontend
- Perf proof: k6 core flow with thresholds; HTML/JSON attached
- Lighthouse proof: performance/accessibility/SEO summary attached
- Smoke proof: end-to-end staging flow log attached
- Ops proof: uptime 90-day screenshot and SLO/alerts documented
- Security proof: environment screenshots (masked), ZAP baseline summary
- Backup/restore proof: Firestore export/import commands and last-tested date

[Unreleased]: https://github.com/your-org/woo-combine/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/woo-combine/releases/tag/v1.0.0

### Draft release checks (2026-09-09)
- Add participant-export preview and raw parent-report fields, atomic duplicate-safe registration import, and synthetic regression coverage.
- Refresh frontend locked dependency resolutions within existing version ranges; add an isolated rehearsal blueprint with non-production credential checks.
