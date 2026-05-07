const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature']
  let stripeEvent

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return { statusCode: 400, body: `Webhook Error: ${err.message}` }
  }

  // ── Benefits Watch subscription activation ────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed' &&
      stripeEvent.data.object.metadata?.product === 'benefits_watch') {
    const session = stripeEvent.data.object
    try {
      const sub = await stripe.subscriptions.retrieve(session.subscription)
      await supabase.from('profiles').update({
        benefits_watch_active: true,
        benefits_watch_started_at: new Date().toISOString(),
        benefits_watch_stripe_subscription_id: session.subscription,
        benefits_watch_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }).eq('id', session.metadata.user_id)
    } catch (err) {
      console.error('Benefits Watch activation error:', err)
    }
    return { statusCode: 200, body: 'OK' }
  }

  // ── Subscription cancelled ────────────────────────────────────────────────
  if (stripeEvent.type === 'customer.subscription.deleted') {
    const userId = stripeEvent.data.object.metadata?.user_id
    if (userId) {
      await supabase.from('profiles').update({
        benefits_watch_active: false,
        benefits_watch_stripe_subscription_id: null,
        benefits_watch_current_period_end: null,
      }).eq('id', userId)
    }
    return { statusCode: 200, body: 'OK' }
  }

  // ── Renewal — update period end ───────────────────────────────────────────
  if (stripeEvent.type === 'invoice.payment_succeeded' &&
      stripeEvent.data.object.subscription) {
    try {
      const sub = await stripe.subscriptions.retrieve(stripeEvent.data.object.subscription)
      const userId = sub.metadata?.user_id
      if (userId) {
        await supabase.from('profiles').update({
          benefits_watch_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('id', userId)
      }
    } catch (err) {
      console.error('Renewal period update error:', err)
    }
    return { statusCode: 200, body: 'OK' }
  }

  // ── Report purchase ───────────────────────────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    const { report_id, user_id, referral_code, total_monthly } = session.metadata
    const customerEmail = session.customer_details?.email

    try {
      // 1. Mark report as paid in Supabase
      const { data: report } = await supabase
        .from('reports')
        .update({
          paid: true,
          stripe_session_id: session.id,
          paid_at: new Date().toISOString(),
        })
        .eq('id', report_id)
        .select()
        .single()

      if (!report) {
        console.warn('Report not found for id:', report_id)
        return { statusCode: 200, body: 'OK' }
      }

      // 2. Generate PDF
      // Use the internal Netlify function URL so this works in both local dev
      // (localhost:8888) and production — never hardcode VITE_APP_URL here.
      const baseUrl = process.env.URL || process.env.VITE_APP_URL || 'http://localhost:8888'
      const pdfResponse = await fetch(
        `${baseUrl}/.netlify/functions/generate-pdf`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benefits: report.benefits,
            totalMonthly: report.total_monthly_pence / 100,
            totalAnnual: report.total_annual_pence / 100,
            userEmail: customerEmail,
          }),
        }
      )
      const { pdf } = await pdfResponse.json()

      // 3. Send email with PDF attached
      if (customerEmail && pdf) {
        await resend.emails.send({
          from: 'ClaimSmart UK <reports@claimsmart.uk>',
          to: customerEmail,
          subject: 'Your ClaimSmart benefits report is ready',
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2C2C2A;">
              <div style="background: #0F6E56; padding: 20px 24px; border-radius: 12px 12px 0 0; margin-bottom: 0;">
                <h1 style="color: white; font-size: 18px; margin: 0; font-weight: 500;">ClaimSmart UK</h1>
              </div>
              <div style="background: #f9f9f9; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; padding: 28px 24px;">
                <h2 style="font-size: 20px; font-weight: 500; margin-top: 0;">Your benefits report is ready</h2>
                <p style="color: #666; line-height: 1.6;">We found <strong>&pound;${total_monthly}/month</strong> in benefits you may be entitled to.</p>
                <p style="color: #666; line-height: 1.6;">Your full personalised report is attached to this email as a PDF. It includes your complete benefits breakdown, step-by-step claim instructions, and your action plan for this week.</p>
                <div style="background: #E1F5EE; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="color: #085041; font-weight: 500; margin: 0 0 4px;">Start here — your highest priority action:</p>
                  <p style="color: #0F6E56; margin: 0; font-size: 14px;">Check page 2 of your report for your personalised action plan.</p>
                </div>
                <p style="color: #999; font-size: 12px; line-height: 1.6; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                  Results are estimates based on current DWP rates (April 2026/27) and the information you provided.
                  Actual entitlement depends on your full individual circumstances, which only DWP can assess.
                  ClaimSmart UK is not a benefits adviser or financial adviser. Always confirm your entitlement
                  directly with DWP (0800 328 5644) or Citizens Advice (0800 144 8848) before making any financial decisions.
                </p>
              </div>
            </div>
          `,
          attachments: [{
            filename: 'ClaimSmart-Benefits-Report.pdf',
            content: pdf,
            encoding: 'base64',
          }],
        })
      }

      // 4. Create default calendar events for the user
      if (user_id) {
        const defaultEvents = [
          {
            user_id,
            type: 'rate_change',
            title: 'DWP benefit rates update',
            description: 'Check if your entitlement has changed with the new April rates',
            due_date: '2027-04-06',
            remind_days_before: 30,
          },
          {
            user_id,
            type: 'deadline',
            title: 'Re-check your entitlement',
            description: 'Your circumstances may have changed — run a new assessment',
            due_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            remind_days_before: 7,
          },
        ]
        await supabase.from('notifications').insert(defaultEvents)

        // Create claim status entries for each benefit
        const claimStatuses = report.benefits.map(b => ({
          user_id,
          report_id,
          benefit_name: b.name,
          status: 'not_started',
        }))
        await supabase.from('claim_status').insert(claimStatuses)
      }

      // 5. Handle referral payment
      if (referral_code && referral_code !== '') {
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', referral_code)
          .single()

        if (referrer) {
          await supabase.from('referrals').insert({
            referrer_id: referrer.id,
            referred_email: customerEmail,
            referred_user_id: user_id || null,
            paid: true,
          })

          // Fetch current earnings first, then add 200p.
          // supabase.rpc('increment') was used here previously but that
          // Postgres function was never defined — it silently failed every time.
          const { data: referrerProfile } = await supabase
            .from('profiles')
            .select('referral_earnings_pence')
            .eq('id', referrer.id)
            .single()

          await supabase
            .from('profiles')
            .update({
              referral_earnings_pence: (referrerProfile?.referral_earnings_pence || 0) + 200,
            })
            .eq('id', referrer.id)
        }
      }

    } catch (err) {
      console.error('Webhook processing error:', err)
      // Don't return 500 — Stripe will retry. Log and move on.
    }
  }

  return { statusCode: 200, body: 'OK' }
}
