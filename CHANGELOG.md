# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
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
