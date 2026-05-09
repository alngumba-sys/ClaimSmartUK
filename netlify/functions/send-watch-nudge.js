// netlify/functions/send-watch-nudge.js
// Cron: runs daily at 10am — emails users who bought a report ~30 days ago
// and have not yet subscribed to Benefits Watch.
// Schedule set in netlify.toml: "0 10 * * *"

const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM || 'ClaimSmart UK <onboarding@resend.dev>'
const APP_URL = process.env.VITE_APP_URL || 'https://claimsmartuk.netlify.app'

exports.handler = async () => {
  try {
    // Find users who:
    // 1. Paid for a report 28–32 days ago (30-day window with ±2 day tolerance)
    // 2. Do NOT have Benefits Watch active
    // 3. Have an email address
    const now       = new Date()
    const from28    = new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString()
    const from32    = new Date(now - 32 * 24 * 60 * 60 * 1000).toISOString()

    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        id,
        total_monthly_pence,
        paid_at,
        profiles (
          id,
          email,
          full_name,
          benefits_watch_active
        )
      `)
      .eq('paid', true)
      .gte('paid_at', from32)
      .lte('paid_at', from28)

    if (error) {
      console.error('Supabase query error:', error)
      return { statusCode: 500, body: error.message }
    }

    if (!reports || reports.length === 0) {
      console.log('No eligible users for 30-day nudge today')
      return { statusCode: 200, body: 'No eligible users' }
    }

    let sent = 0
    let skipped = 0

    for (const report of reports) {
      const profile = report.profiles

      // Skip if already subscribed or no email
      if (!profile?.email || profile?.benefits_watch_active) {
        skipped++
        continue
      }

      const firstName     = profile.full_name?.split(' ')[0] || 'there'
      const monthlyAmount = Math.round((report.total_monthly_pence || 0) / 100)
      const annualAmount  = monthlyAmount * 12

      // Time-aware message
      const month        = now.getMonth() + 1
      const isPreApril   = month >= 1 && month <= 3
      const isApril      = month === 4
      const timingLine   = isApril
        ? 'DWP has just updated benefit rates for 2026/27. Your entitlement may have changed.'
        : isPreApril
        ? 'DWP rates change every April — which is coming up soon. Your entitlement could increase.'
        : 'DWP updates benefit rates every April. Most claimants miss the increase simply because nobody tells them.'

      try {
        await resend.emails.send({
          from: FROM,
          to: profile.email,
          subject: `Hi ${firstName} — it's been a month since your ClaimSmart report`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;
              padding:0;background:#ffffff;">

              <div style="background:#0f0722;padding:20px 28px;border-radius:12px 12px 0 0;">
                <h1 style="color:#d4960a;font-size:16px;font-weight:700;margin:0;">
                  ClaimSmart UK
                </h1>
              </div>

              <div style="padding:28px;border:1px solid #e5e7eb;border-top:0;
                border-radius:0 0 12px 12px;background:#fafafa;">

                <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;">
                  Hi ${firstName},
                </p>

                <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 16px;">
                  It's been about a month since your ClaimSmart report found you
                  <strong style="color:#d4960a;">£${monthlyAmount.toLocaleString('en-GB')}/month</strong>
                  (up to £${annualAmount.toLocaleString('en-GB')}/year) in benefits you may be entitled to.
                </p>

                <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px;">
                  ${timingLine}
                </p>

                <!-- Benefits Watch card -->
                <div style="background:#0f0722;border-radius:12px;padding:20px 24px;
                  margin:0 0 24px;">
                  <p style="color:rgba(212,150,10,0.8);font-size:11px;font-weight:700;
                    text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px;">
                    Benefits Watch
                  </p>
                  <p style="color:#f0c040;font-size:26px;font-weight:800;margin:0 0 4px;">
                    £3.99/month
                  </p>
                  <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0 0 16px;">
                    Cancel anytime · No contract
                  </p>
                  <div style="margin-bottom:12px;">
                    ${[
                      'Automatic re-check of your entitlement every month',
                      'Instant email alert when DWP changes rates',
                      'Annual April update — we tell you exactly what changed for you',
                      'Running total of value protected on your behalf',
                    ].map(item => `
                      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
                        <span style="color:#d4960a;font-weight:700;flex-shrink:0;">✓</span>
                        <span style="color:rgba(255,255,255,0.7);font-size:13px;">${item}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Value callout -->
                <div style="background:#fef9ec;border:1px solid #f0c040;border-radius:10px;
                  padding:14px 18px;margin:0 0 24px;">
                  <p style="color:#854f0b;font-size:13px;line-height:1.6;margin:0;">
                    <strong>The maths:</strong> if Benefits Watch catches just one rate increase
                    you would have missed, it pays for itself in under a week.
                    The average subscriber recovers <strong>£340/year</strong> in increases
                    they'd have missed without us.
                  </p>
                </div>

                <a
                  href="${APP_URL}/benefits-watch"
                  style="display:block;text-align:center;background:#d4960a;color:#0f0722;
                    text-decoration:none;font-weight:700;font-size:14px;padding:14px 24px;
                    border-radius:10px;margin:0 0 20px;"
                >
                  Start Benefits Watch — £3.99/month →
                </a>

                <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:4px;">
                  <p style="color:#9ca3af;font-size:11px;line-height:1.6;margin:0;">
                    You're receiving this because you used ClaimSmart UK.
                    Results are estimates based on DWP rates April 2026/27.
                    ClaimSmart UK is not a benefits adviser or financial adviser.
                    <a href="${APP_URL}/dashboard" style="color:#d4960a;">View your dashboard</a>
                  </p>
                </div>
              </div>
            </div>
          `,
        })

        console.log(`30-day nudge sent to ${profile.email}`)
        sent++

        // Small delay to avoid Resend rate limits
        await new Promise(r => setTimeout(r, 300))

      } catch (emailErr) {
        console.error(`Failed to send to ${profile.email}:`, emailErr.message)
      }
    }

    const summary = `30-day nudge: sent=${sent} skipped=${skipped} total=${reports.length}`
    console.log(summary)
    return { statusCode: 200, body: summary }

  } catch (err) {
    console.error('send-watch-nudge error:', err)
    return { statusCode: 500, body: err.message }
  }
}
