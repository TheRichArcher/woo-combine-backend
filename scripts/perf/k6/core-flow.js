import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend } from 'k6/metrics'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'

// Config via env
const BASE_URL = __ENV.STAGING_BASE_URL || ''
const TOKEN = __ENV.STAGING_BEARER_TOKEN || ''
const DURATION = __ENV.K6_DURATION || '1m'
const VUS = Number(__ENV.K6_VUS || '10')

if (!BASE_URL || !TOKEN) {
  throw new Error('Missing STAGING_BASE_URL or STAGING_BEARER_TOKEN envs')
}

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    'http_req_duration{group:auth}': ['p(95)<500'],
    'http_req_duration{group:events}': ['p(95)<500'],
    'http_req_duration{group:players}': ['p(95)<500'],
    'http_req_duration{group:rankings}': ['p(95)<500'],
  },
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
}

const eventIdTrend = new Trend('event_create_time')

export default function () {
  // Auth/me
  group('auth', () => {
    const res = http.get(`${BASE_URL}/api/users/me`, { headers, tags: { group: 'auth' } })
    check(res, { 'auth 200': (r) => r.status === 200 })
  })

  // Create league
  let leagueId = null
  group('events', () => {
    const body = JSON.stringify({ name: `Perf League ${__VU}-${__ITER}` })
    const res = http.post(`${BASE_URL}/api/leagues`, body, { headers, tags: { group: 'events' } })
    check(res, { 'league created': (r) => r.status === 200 && r.json('league_id') })
    leagueId = res.json('league_id') || ''

    // Create event
    const eb = JSON.stringify({ name: `Perf Event ${__VU}-${__ITER}`, date: null, location: '' })
    const t0 = Date.now()
    const er = http.post(`${BASE_URL}/api/leagues/${leagueId}/events`, eb, { headers, tags: { group: 'events' } })
    eventIdTrend.add(Date.now() - t0)
    check(er, { 'event created': (r) => r.status === 200 && r.json('event_id') })
    const eventId = er.json('event_id')

    // List events
    const lr = http.get(`${BASE_URL}/api/leagues/${leagueId}/events`, { headers, tags: { group: 'events' } })
    check(lr, { 'events listed': (r) => r.status === 200 })

    // Upload players (2 rows)
    const players = {
      event_id: eventId,
      players: [
        { first_name: 'Test', last_name: 'One', jersey_number: 1, age_group: '12U' },
        { first_name: 'Test', last_name: 'Two', jersey_number: 2, age_group: '12U' },
      ],
    }
    const ur = http.post(`${BASE_URL}/api/players/upload`, JSON.stringify(players), { headers, tags: { group: 'players' } })
    check(ur, { 'upload ok': (r) => r.status === 200 })

    // List players
    const pr = http.get(`${BASE_URL}/api/players?event_id=${eventId}`, { headers, tags: { group: 'players' } })
    check(pr, { 'players listed': (r) => r.status === 200 })

    // Rankings
    const rr = http.get(
      `${BASE_URL}/api/rankings?event_id=${eventId}&age_group=12U&weight_40m_dash=0.3&weight_vertical_jump=0.2&weight_catching=0.15&weight_throwing=0.15&weight_agility=0.2`,
      { headers, tags: { group: 'rankings' } },
    )
    check(rr, { 'rankings ok': (r) => r.status === 200 })
  })

  sleep(1)
}

export function handleSummary(data) {
  const md = textSummary(data, { indent: ' ', enableColors: false })
  const html = htmlReport(data)
  return {
    'docs/perf/k6-report.md': md,
    'docs/perf/k6-report.html': html,
    'docs/perf/k6-summary.json': JSON.stringify(data, null, 2),
  }
}



