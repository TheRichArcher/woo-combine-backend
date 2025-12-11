import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './firebase'
import App from './App.jsx'
import * as Sentry from '@sentry/react'

const release = (import.meta?.env?.VITE_RELEASE) || `frontend@${(import.meta?.env?.VITE_GIT_COMMIT) || 'unknown'}`
const environment = (import.meta?.env?.VITE_SENTRY_ENVIRONMENT) || (import.meta?.env?.PROD ? 'production' : 'development')

// Debug Sentry Init
const sentryDSN = import.meta?.env?.VITE_SENTRY_DSN;
if (sentryDSN) {
  try {
    console.log("[Sentry] Initializing...", { environment, release });
    Sentry.init({
      dsn: sentryDSN,
      environment,
      release,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: false, blockAllMedia: true }),
      ],
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.2'),
      replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE || '0.0'),
      replaysOnErrorSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE || '1.0'),
    })
    // Expose for debugging in console
    window.Sentry = Sentry;
  } catch (e) {
    console.error("[Sentry] Failed to initialize:", e);
  }
} else {
  console.warn("[Sentry] DSN not found. Skipping initialization.");
}

createRoot(document.getElementById('root')).render(
  <App />,
)
