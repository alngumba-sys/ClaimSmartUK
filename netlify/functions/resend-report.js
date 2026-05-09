// netlify/functions/resend-report.js
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { Resend } = require('resend')
const { createClient } = require('@supabase/supabase-js')

const resend   = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const FROM    = process.env.RESEND_FROM || 'ClaimSmart UK <onboarding@resend.dev>'
const APP_URL = process.env.VITE_APP_URL || 'https://claimsmartuk.netlify.app'

// Rate limiting is enforced via Supabase resend_log table
// (in-memory Map is stateless across Netlify cold starts — not reliable)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { sessionId, email } = JSON.parse(event.body)

    if (!sessionId || !email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email address' }) }
    }

    // Rate limit via Supabase — max 3 sends per sessionId in last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: sendCount } = await supabase
      .from('resend_log')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .gte('created_at', since)
    if ((sendCount || 0) >= 3) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Too many requests' }) }
    }
    // Log this send attempt
    await supabase.from('resend_log').insert({ session_id: sessionId, email })

    // Verify Stripe session is paid
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

    // Auth: require JWT for all non-admin calls
    // Admin can bypass with x-admin-token header
    const isAdmin = event.headers['x-admin-token'] === process.env.ADMIN_PASSWORD
    const customerEmail = session.customer_details?.email

    if (!isAdmin) {
      const jwt = (event.headers['authorization'] || '').replace('Bearer ', '')
      if (!jwt) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) }
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
      if (authError || !user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) }
      }
      // Verify user owns this Stripe session
      const sessionUserId = session.metadata?.user_id
      const isOwnerByEmail = customerEmail && user.email?.toLowerCase() === customerEmail.toLowerCase()
      const isOwnerById    = sessionUserId && user.id === sessionUserId
      if (!isOwnerByEmail && !isOwnerById) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorised' }) }
      }
    }

    const totalMonthly  = session.metadata?.total_monthly || '0'
    const benefitsCount = session.metadata?.benefits_count || '0'
    const reportId      = session.metadata?.report_id

    // Get report and generate PDF
    let pdfBase64 = null
    try {
      const { data: report } = await (reportId
        ? supabase.from('reports').select('benefits,total_monthly_pence,total_annual_pence').eq('id', reportId).single()
        : supabase.from('reports').select('benefits,total_monthly_pence,total_annual_pence').eq('stripe_session_id', sessionId).single()
      )

      if (report) {
        const pdfRes = await fetch(`${APP_URL}/.netlify/functions/generate-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benefits: report.benefits,
            totalMonthly: report.total_monthly_pence / 100,
            totalAnnual:  report.total_annual_pence  / 100,
            userEmail: email,
          }),
        })
        const pdfData = await pdfRes.json()
        pdfBase64 = pdfData.pdf || null
      }
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr.message)
    }

    const emailPayload = {
      from: FROM,
      to: email,
      subject: 'Your ClaimSmart UK benefits report',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#0f0722;padding:20px 28px;border-radius:12px 12px 0 0;">
            <h1 style="color:#d4960a;font-size:18px;font-weight:700;margin:0;">ClaimSmart UK</h1>
          </div>
          <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;background:#fafafa;">
            <h2 style="font-size:20px;font-weight:700;margin-top:0;">Your benefits report</h2>
            <div style="background:#fef9ec;border:1px solid #f0c040;border-radius:10px;padding:16px 20px;margin:20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#854f0b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Estimated monthly entitlement</p>
              <p style="margin:6px 0 0;font-size:36px;font-weight:800;color:#d4960a;">£${Math.round(parseFloat(totalMonthly)).toLocaleString('en-GB')}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#92400e;">${benefitsCount} benefits found</p>
            </div>
            ${pdfBase64
              ? '<p style="color:#444;font-size:14px;line-height:1.6;">Your full personalised report is attached as a PDF with step-by-step claim instructions and your action plan.</p>'
              : `<p style="color:#444;font-size:14px;line-height:1.6;">View your full report at <a href="${APP_URL}/dashboard" style="color:#d4960a;">your dashboard</a>.</p>`
            }
            <div style="background:#f0fdf4;border-radius:8px;padding:14px 18px;margin:20px 0;">
              <p style="font-weight:700;color:#166534;margin:0 0 6px;font-size:14px;">Start here this week:</p>
              <ol style="margin:0;padding-left:18px;color:#15803d;font-size:13px;line-height:1.8;">
                <li>Start with the benefit marked "Claim this week"</li>
                <li>Have your National Insurance number ready</li>
                <li>Use the official GOV.UK links in your report</li>
                <li>Call Citizens Advice free on 0800 144 8848 if you need help</li>
              </ol>
            </div>
            <p style="color:#9ca3af;font-size:11px;line-height:1.6;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">
              Results are estimates based on DWP rates April 2026/27. Always confirm with DWP (0800 328 5644) or Citizens Advice (0800 144 8848). ClaimSmart UK is not a benefits adviser.
            </p>
          </div>
        </div>
      `,
    }

    if (pdfBase64) {
      emailPayload.attachments = [{ filename: 'ClaimSmart-Benefits-Report.pdf', content: pdfBase64, encoding: 'base64' }]
    }

    await resend.emails.send(emailPayload)
    return { statusCode: 200, body: JSON.stringify({ success: true }) }

  } catch (err) {
    console.error('resend-report error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send report' }) }
  }
}
