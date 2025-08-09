### Storage usage (cookies/localStorage)

Web app uses:
- localStorage: Firebase auth token/session metadata; user preferences (selected league/event); ephemeral UI state.
- No third-party tracking cookies by default; Sentry session replay optional (configurable via env).

Data is scoped to the authenticated user and cleared on logout. Tokens are short-lived and refreshed by Firebase SDK.



