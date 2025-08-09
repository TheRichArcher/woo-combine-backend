# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Frontend: static site build to `frontend/dist`; HTTPS redirect + HSTS
- Backend: Docker non-root, health check `/health`
- Render: health checks and autoscaling guidance; stateless (no sticky sessions)
- Release flow: Dev auto-deploy on `main`, Staging protected, Prod via tags with changelog

## [1.0.0] - 2025-08-09
- Initial documented release process and deployment hardening

[Unreleased]: https://github.com/your-org/woo-combine/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/woo-combine/releases/tag/v1.0.0
