### DAST (ZAP) Quick Scan Summary

Date: 2025-08-09
Target: `<staging-base-url>` public endpoints

Command executed:
```
zap-baseline.py -t <staging-base-url>/api/ -r docs/security/zap-report.html -x docs/security/zap-report.xml -m 5
```

Findings:
- High: 0
- Medium: 0
- Low/Info: Mixed CSP recommendations; review CSP_CONNECT_SRC additions as needed.

Artifacts:
- HTML report: `docs/security/zap-report.html`
- XML report: `docs/security/zap-report.xml`

Notes:
- Authenticated paths not covered by baseline; use `zap-full-scan` with context for deep testing if needed.


