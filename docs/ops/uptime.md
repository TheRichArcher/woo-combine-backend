### Uptime & SLO

- Monitored endpoints: `/health` and `/api/health` every 1 minute.
- SLOs: Staging 99.5%, Production 99.9% monthly.
- Alert policy: Page on-call when 5-min error budget burn suggests breach within 1h.

Include 90-day screenshots/links from the uptime provider (Pingdom/UptimeRobot/Grafana Cloud):
- Staging uptime: [link-to-staging-dashboard]
- Production uptime: [link-to-prod-dashboard]

Artifacts:
- 90-day screenshot: `docs/reports/uptime-90d.png`

SLOs & Alerts:
- Staging: 99.5% monthly; alert on projected breach within 1 hour
- Production: 99.9% monthly; alert on any 5xx spike > 5 minutes or projected breach within 30 minutes

Alert configuration notes:
- Health 200 required; 5xx and DNS/connectivity errors count as downtime.
- Retries: 2; timeout: 5s.



