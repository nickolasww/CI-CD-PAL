import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://ec2-54-83-68-186.compute-1.amazonaws.com'
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://ycgrfvvfcajqiafonqys.supabase.co'
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || ''
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || ''
const ENABLE_SUPABASE = __ENV.ENABLE_SUPABASE === '1'

const errorRate = new Rate('errors')

export const options = {
  vus: Number(__ENV.K6_VUS) || 10,
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    errors: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
}

function supabaseHeaders(token) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function loginAdmin() {
  if (!SUPABASE_ANON_KEY) {
    console.warn('Skipping Supabase login: SUPABASE_ANON_KEY is not provided.')
    return null
  }

  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`
  const payload = JSON.stringify({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  })

  const res = http.post(url, payload, { headers: supabaseHeaders() })

  const success = check(res, {
    'admin login status 200': (r) => r.status === 200,
    'admin access token present': (r) => !!r.json('access_token'),
  })

  if (!success) {
    console.warn(`Supabase login failed with status ${res.status}: ${res.body}`)
    return null
  }

  return res.json('access_token')
}

function getProfile(accessToken) {
  const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,email,role&email=eq.${encodeURIComponent(TEST_USER_EMAIL)}`
  const res = http.get(url, { headers: supabaseHeaders(accessToken) })
  check(res, {
    'load profile status 200': (r) => r.status === 200,
    'profile data returned': (r) => r.json().length > 0,
  })
}

function getGuests(accessToken) {
  const url = `${SUPABASE_URL}/rest/v1/guests?select=*&order=created_at.desc&limit=10`
  const res = http.get(url, { headers: supabaseHeaders(accessToken) })
  check(res, {
    'list guests status 200': (r) => r.status === 200,
  })
}

function createGuest() {
  if (!SUPABASE_ANON_KEY) {
    console.warn('Skipping guest creation: SUPABASE_ANON_KEY is not provided.')
    return
  }

  const body = JSON.stringify({
    name: `Load Test Guest ${Math.floor(Math.random() * 100000)}`,
    company: 'k6 Load Test Co',
    purpose: 'Menguji performa aplikasi buku tamu',
    arrival_time: new Date().toISOString(),
  })

  const url = `${SUPABASE_URL}/rest/v1/guests`
  const res = http.post(url, body, {
    headers: {
      ...supabaseHeaders(),
      Prefer: 'return=representation',
    },
  })

  check(res, {
    'create guest status 201': (r) => r.status === 201,
    'guest record created': (r) => Array.isArray(r.json()) && r.json().length === 1,
  })
}

function searchGuests(keyword) {
  if (!SUPABASE_ANON_KEY) {
    console.warn('Skipping guest search: SUPABASE_ANON_KEY is not provided.')
    return
  }

  const query = `select=*&or=name.ilike.*${encodeURIComponent(keyword)}*,company.ilike.*${encodeURIComponent(keyword)}*,purpose.ilike.*${encodeURIComponent(keyword)}*`
  const url = `${SUPABASE_URL}/rest/v1/guests?${query}&limit=5`
  const res = http.get(url, { headers: supabaseHeaders() })
  check(res, {
    'search guests status 200': (r) => r.status === 200,
  })
}

export default function () {
  group('public front-end pages', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/`, null, { headers: { Accept: 'text/html' } }],
      ['GET', `${BASE_URL}/login`, null, { headers: { Accept: 'text/html' } }],
    ])

    check(responses[0], {
      'home page status 200': (r) => r.status === 200,
    })
    check(responses[1], {
      'login page status 200': (r) => r.status === 200,
    })
  })

  if (ENABLE_SUPABASE) {
    group('admin auth and dashboard data', () => {
      if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
        console.warn('Skipping admin login because TEST_USER_EMAIL or TEST_USER_PASSWORD is not set.')
      } else {
        const token = loginAdmin()
        if (token) {
          getProfile(token)
          getGuests(token)
        }
      }
    })

    group('public guest workflow', () => {
      createGuest()
      searchGuests('Load Test')
    })
  }

  sleep(1)
}
