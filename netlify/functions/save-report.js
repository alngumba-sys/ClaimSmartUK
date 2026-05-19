/**
 * save-report.js
 *
 * POST /api/save-report
 *
 * Used when VITE_PAYMENTS_DISABLED=true — saves a report directly as paid:true,
 * creating the same Supabase rows that the Stripe webhook would create.
 * Requires a logged-in user (x-user-id header).
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  // Only works when payments are explicitly disabled
  if (process.env.VITE_PAYMENTS_DISABLED !== 'true') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Payments are not disabled on this environment' }),
    }
  }

  try {
    const { answers, benefits, totalMonthly, totalAnnual, userId } = JSON.parse(event.body || '{}')

    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Must be logged in to save a report' }),
      }
    }

    // Save report as paid:true — same shape as stripe-webhook
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        user_id: userId,
        answers,
        benefits,
        total_monthly_pence: Math.round(totalMonthly * 100),
        total_annual_pence: Math.round(totalAnnual * 100),
        paid: true,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (reportError) throw reportError

    // Create claim status entries for each benefit (same as stripe-webhook)
    const claimStatuses = (benefits || []).map(b => ({
      user_id: userId,
      report_id: report.id,
      benefit_name: b.name,
      status: 'not_started',
    }))

    if (claimStatuses.length > 0) {
      await supabase.from('claim_status').insert(claimStatuses)
    }

    // Create default calendar reminders (same as stripe-webhook)
    const defaultEvents = [
      {
        user_id: userId,
        type: 'rate_change',
        title: 'DWP benefit rates update',
        description: 'Check if your entitlement has changed with the new April rates',
        due_date: '2027-04-06',
        remind_days_before: 30,
      },
      {
        user_id: userId,
        type: 'deadline',
        title: 'Re-check your entitlement',
        description: 'Your circumstances may have changed — run a new assessment',
        due_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        remind_days_before: 7,
      },
    ]
    await supabase.from('notifications').insert(defaultEvents)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, reportId: report.id }),
    }
  } catch (err) {
    console.error('[save-report] error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
