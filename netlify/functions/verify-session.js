/**
 * verify-session.js
 *
 * Called by SuccessPage after Stripe redirects the user back to the site.
 * Verifies the Stripe Checkout session is genuinely paid, then returns
 * the matching report from Supabase so the frontend can show real data.
 *
 * GET /api/verify-session?session_id=cs_xxx
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const sessionId = event.queryStringParameters?.session_id

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing or invalid session_id' }),
    }
  }

  try {
    // 1. Verify with Stripe that the session is actually paid
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return {
        statusCode: 402,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Payment not completed', status: session.payment_status }),
      }
    }

    const reportId = session.metadata?.report_id
    const customerEmail = session.customer_details?.email
    const totalMonthly = session.metadata?.total_monthly

    // 2. Fetch the report from Supabase
    let report = null
    if (reportId && !reportId.startsWith('temp-')) {
      const { data } = await supabase
        .from('reports')
        .select('id, benefits, total_monthly_pence, total_annual_pence, paid, paid_at')
        .eq('id', reportId)
        .single()
      report = data
    }

    // 3. If the webhook hasn't fired yet (race condition), the report may not
    //    be marked paid — that's fine, the webhook will handle it shortly.
    //    We still return the data so the user sees confirmation immediately.

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid: true,
        customerEmail,
        totalMonthly: totalMonthly ? parseInt(totalMonthly, 10) : (report?.total_monthly_pence || 0) / 100,
        benefitsCount: session.metadata?.benefits_count || report?.benefits?.length || null,
        reportId: reportId && !reportId.startsWith('temp-') ? reportId : null,
        benefits: report?.benefits || null,
      }),
    }
  } catch (err) {
    console.error('verify-session error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not verify session' }),
    }
  }
}
