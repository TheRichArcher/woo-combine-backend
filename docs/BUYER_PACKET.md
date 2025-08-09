### Buyer Packet Contents

Include the following files and exports when sharing with a prospective acquirer:

- API docs: export `/docs` (OpenAPI JSON) and include `docs/API_REFERENCE.md` and `docs/API_CONTRACT.md`
- Architecture: diagram (attach), plus `docs/README.md`, `docs/SECURITY.md`, `docs/DATA_CONTRACTS.md`
- Runbooks: `docs/runbooks/` (Incident Response, Credential Outage, Firestore Quota Exceeded, Rate Limit Tuning)
- Ops: `docs/ENV_VARS_AND_RENDER_SETUP.md`, `render.yaml`, `Dockerfile`
- Metrics: screenshots/exports from Sentry, uptime provider, and frontend analytics (DAU/MAU)
- Compliance: `docs/PRIVACY_AND_TERMS_ONE_PAGER.md` and any vendor DPAs/licenses
- Acceptance: `docs/testing/ACCEPTANCE_REPORT_TEMPLATE.md` filled for staging walkthrough

Sign-off checklist: `docs/checklists/FINAL_CLEANUP_CHECKLIST.md`


### CI/QA Proof Links

- CI (unit + backend tests): [latest runs](https://github.com/TheRichArcher/woo-combine-backend/actions/workflows/ci.yml)
- Perf (k6): [workflow run](https://github.com/TheRichArcher/woo-combine-backend/actions/workflows/perf.yml) • Artifacts: [HTML report](docs/perf/k6-report.html), [JSON summary](docs/perf/k6-summary.json)
- Lighthouse: [workflow run](https://github.com/TheRichArcher/woo-combine-backend/actions/workflows/lighthouse.yml) • Artifacts: [summary](docs/qa/lighthouse-summary.md), [HTML report](docs/qa/lighthouse-report.html)
- Smoke: [workflow run](https://github.com/TheRichArcher/woo-combine-backend/actions/workflows/smoke.yml) • Artifact: [latest run log](docs/qa/smoke-run-latest.md)

### Attached Artifacts (Release)

- OpenAPI JSON: `docs/openapi.json`
- Lighthouse: `docs/qa/lighthouse-report.html`
- k6: `docs/perf/k6-report.html`, `docs/perf/k6-summary.json`
- Smoke: `docs/qa/smoke-run-latest.md`
- Uptime screenshot: `docs/reports/uptime-90d.png`
- Architecture: `docs/arch/architecture.svg`

Buyer Build Tag:
- `v1.0-buyer-ready` — https://github.com/TheRichArcher/woo-combine-backend/releases/tag/v1.0-buyer-ready

### Known Limitations & Next 90 Days

- Limited offline support; add caching and graceful retry for rank views
- No multi-tenant org boundary yet; leagues are project-scoped
- Evaluator auth is email-based; add magic-link short-lived codes
- Aggregated ranking weights are per-session; persist per-league presets
- Export formats are CSV-first; add PDF and JSON API for external tools
- Mobile UX is good for data entry; optimize coach dashboards for small screens



