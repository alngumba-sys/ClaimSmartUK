// netlify/functions/link-session.js
// Links an anonymous Stripe session to an authenticated user account.
// User identity is verified via Supabase JWT — never trusted from request body.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { sessionId } = JSON.parse(event.body)

    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId' }) }
    }

    // ── Verify caller identity via Supabase JWT ──────────────────────────────
    // Never trust userId from the request body — extract from verified JWT instead
    const authHeader = event.headers['authorization'] || ''
    const jwt        = authHeader.replace('Bearer ', '')

    if (!jwt) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) }
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      console.error('JWT verification failed:', authError?.message)
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) }
    }

    const userId = user.id  // trusted — from verified JWT, not request body

    // ── Verify Stripe session is paid ────────────────────────────────────────
    let session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch (e) {
      console.error('Stripe retrieval error:', e.message)
      return { statusCode: 403, body: JSON.stringify({ error: 'Invalid session' }) }
    }

    if (session.payment_status !== 'paid') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Payment not confirmed' }) }
    }

    // ── Find report by stripe_session_id or report_id in metadata ────────────
    const reportId = session.metadata?.report_id

    const { data: report } = await (reportId
      ? supabase.from('reports').select('id, user_id, benefits').eq('id', reportId).single()
      : supabase.from('reports').select('id, user_id, benefits').eq('stripe_session_id', sessionId).single()
    )

    if (!report) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Report not found' }) }
    }

    // Don't overwrite if already owned by a different user
    if (report.user_id && report.user_id !== userId) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true }) }
    }

    // ── Link report to verified user ─────────────────────────────────────────
    await supabase
      .from('reports')
      .update({ user_id: userId, stripe_session_id: sessionId })
      .eq('id', report.id)

    // ── Create claim_status rows ──────────────────────────────────────────────
    const { data: existingStatuses } = await supabase
      .from('claim_status')
      .select('benefit_name')
      .eq('report_id', report.id)

    const existingNames = new Set((existingStatuses || []).map(s => s.benefit_name))

    if (report.benefits) {
      const newStatuses = report.benefits
        .filter(b => !existingNames.has(b.name))
        .map(b => ({
          user_id:      userId,
          report_id:    report.id,
          benefit_name: b.name,
          status:       'not_started',
        }))

      if (newStatuses.length > 0) {
        await supabase.from('claim_status').insert(newStatuses)
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, reportId: report.id }) }

  } catch (err) {
    // Log detail server-side only
    console.error('link-session error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to link session' }) }
  }
}
