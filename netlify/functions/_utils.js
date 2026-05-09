// netlify/functions/_utils.js
// Shared utilities for all Netlify functions: rate limiting, input sanitization,
// IP extraction, and security headers.

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory per IP, max 5 calls per 15-minute window per function.
// Resets on cold start — good enough for burst protection without external store.

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const windows = new Map() // key -> { count, windowStart }

async function rateLimit(ip, fnName) {
  const key = `${fnName}:${ip}`
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    windows.set(key, { count: 1, windowStart: now })
    return { limited: false }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
    return { limited: true, retryAfter }
  }

  entry.count++
  return { limited: false }
}

function rateLimitResponse(retryAfter) {
  return {
    statusCode: 429,
    headers: { ...SECURE_HEADERS, 'Retry-After': String(retryAfter) },
    body: JSON.stringify({ error: 'Too many requests. Please try again later.' }),
  }
}

// ── IP extraction ─────────────────────────────────────────────────────────────

function getIP(event) {
  return (
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    event.headers['x-nf-client-connection-ip'] ||
    'unknown'
  )
}

// ── Input sanitization ────────────────────────────────────────────────────────

const sanitize = {
  /** Trim and truncate a string to maxLen characters. */
  string(value, maxLen = 200) {
    if (typeof value !== 'string') return ''
    return value.trim().slice(0, maxLen)
  },

  /** Safely parse a JSON body, returning {} on failure. */
  parseBody(raw) {
    try {
      if (!raw || typeof raw !== 'string') return {}
      return JSON.parse(raw)
    } catch {
      return {}
    }
  },
}

// ── Validation helpers ────────────────────────────────────────────────────────

const validate = {
  /** Check a value is one of the allowed options. */
  oneOf(value, allowed) {
    return allowed.includes(value)
  },

  /** Check an email looks roughly valid. */
  email(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  },
}

// ── Security headers ──────────────────────────────────────────────────────────

const SECURE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  rateLimit,
  rateLimitResponse,
  getIP,
  validate,
  sanitize,
  SECURE_HEADERS,
}
