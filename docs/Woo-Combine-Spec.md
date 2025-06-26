Woo-Combine: Full Feature Specification for Rebuild

This document provides a comprehensive technical and functional breakdown of the Woo-Combine platform to allow any developer or team to rebuild it from scratch.

🎮 Product Overview

Woo-Combine is a modern, mobile-first web application for managing youth sports combines. It allows:

Admins to create and manage players.

Coaches to adjust scoring weights and view custom player rankings.

Drill results to be entered, stored, and analyzed.

Custom CSV export of rankings.

Secure admin-only tools (e.g., Reset, CSV Upload).

The frontend is built with React (Vite) and styled using Tailwind CSS. Backend is powered by FastAPI, PostgreSQL, and Firebase for authentication.

🔎 1. Core Features

Players

Create, view, and manage players with:

Name

Age group (e.g., 7-8, 9-10, 11-12)

Player number

Optional photo

Drill Results

Record results for:

40-Yard Dash

Vertical Jump

Catching

Throwing

Agility

All results are tied to the player and timestamped.

Composite Scoring

A weighted score is calculated per player based on drill results.

Coaches can adjust weights on the dashboard.

Default weights are: 40-Yard Dash 30%, Vertical 20%, Catching 15%, Throwing 15%, Agility 20%.

Rankings are recalculated live based on weight adjustments.

Rankings

Displayed per age group.

Rankings update dynamically as drill weights change.

Export rankings via CSV.

Coach Dashboard

Live dashboard for coaches to:

Adjust weights via sliders

Filter by age group

View updated rankings

Admin Tools

Reset All Players (DELETE /players/reset)

Requires confirmation phrase (e.g., REMOVE)

Bulk Upload via CSV

Securely mapped fields (name, number, age group, etc.)

📁 2. Folder Structure (Recommended)

/frontend
  /src
    /components
      Button.jsx
      TextInput.jsx
      Layout.jsx
      Header.jsx
      Footer.jsx
    /pages
      Login.jsx
      SignUp.jsx
      Dashboard.jsx
      Players.jsx
    /context
      AuthContext.jsx
    App.jsx
    main.jsx
  index.html
  tailwind.config.js
  postcss.config.js
  index.css

/backend
  main.py
  models.py
  routes/
    players.py
    drills.py
    auth.py
  db.py
  pdf_generator.py
  requirements.txt

/.env
README.md

🔒 3. Authentication (Firebase)

Firebase Web SDK (v9+ modular)

firebase.js includes:

initializeApp

getAuth

AuthProvider sets user, loading, error in context.

RequireAuth wraps protected routes (e.g., /dashboard, /players).

Login/Sign Up use Firebase email/password.

Optional email verification in future.

🔧 4. Backend (FastAPI)

Main Endpoints

GET /players/: Returns all players with composite scores

GET /players/{id}/results/: Returns drill results for one player

POST /drill-results/: Create a new result

DELETE /players/reset: Deletes all players/results (admin only)

Models

Player: id, name, number, age_group, photo_url, created_at

DrillResult: id, player_id, type, value, created_at

Composite Score Calculation

Performed in backend or frontend (both supported)

Weighted sum of drill results

Players missing results are flagged visually

Admin Auth (Backend Only)

Backend protects /reset and /upload routes via get_current_admin_user().

Admin credentials handled via Firebase token + role or environment secret.

📅 5. Combine Lifecycle

Admin resets database pre-combine.

Players added manually or via CSV.

Drill results entered via mobile/tablet interface.

Coaches view live scores and rankings.

Rankings exported to CSV.

📊 6. CSV Upload Format

name

number

age_group

40m_dash

vertical_jump

catching

throwing

agility

John Smith

12

9-10

6.2

18

3

4

7

Notes:

Header names must match exactly.

Validation occurs before database write.

🔊 7. Style & Branding

Mobile-first layout

Responsive Tailwind-only styling (no global CSS)

Consistent Header/Footer

Logo rendered using img with h-16 w-auto mx-auto my-4

Buttons: bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded

📊 8. Admin Settings & Safety

CSV Upload and Reset All buttons hidden behind:

Confirm Dialog

Phrase input (REMOVE)

Auth check

Located at bottom of CoachDashboard

Admin-only UI flags

🛍️ 9. Features in Consideration (Future)

Player Profile pages (photos, full history)

Email/SMS ranking delivery

Stripe integration for digital scorecards

Multi-Combine Support

QR-code-based check-in

📈 10. Metrics to Track

Most improved players

Top scores per drill

Attendance vs. performance

Age group analytics

📆 11. Timeline to Rebuild

Phase 1: Auth, Player creation, drill logging, score logic (3-5 days)

Phase 2: Dashboard, weights, rankings, CSV (3 days)

Phase 3: Admin tools, polish, mobile QA, deploy (2-3 days)

Total Estimate: 8–12 days for full rebuild with 1–2 engineers

✅ Final Note

This doc allows any dev team to:

Start from a clean, Tailwind-only codebase

Avoid legacy bugs

Understand every feature's logic, UI expectation, and endpoint
