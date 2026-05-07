const Anthropic = require('@anthropic-ai/sdk')
const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

const SYSTEM_PROMPT = `UK benefits expert 2026/27. Return ONLY a valid JSON array, no markdown.
Each item: { name, monthlyAmount, annualAmount, likelihood, explanation, howToClaim, urgency, officialLink }
Use current DWP rates. Return 4-8 benefits.`

async function recalculate(answers) {
  const loc = answers.postcodeProvided
    ? `${answers.council}, ${answers.region}`
    : answers.region || 'UK'

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Employment:${answers.situation} Age:${answers.age} Housing:${answers.housing} Children:${answers.children} Income:${answers.income} Savings:${answers.savings} Health:${answers.health} Location:${loc}. Calculate benefits.`,
    }],
  })

  return JSON.parse(msg.content[0].text.trim())
}

async function sendAlert(email, name, prevMonthly, newMonthly, benefits, alertType) {
  const diff = newMonthly - prevMonthly
  const sign = diff >= 0 ? '+' : ''

  await resend.emails.send({
    from: 'ClaimSmart UK <watch@claimsmart.uk>',
    to: email,
    subject: alertType === 'rate_change'
      ? `Your benefits changed — ${sign}£${Math.abs(Math.round(diff))}/month`
      : 'Benefits Watch — your monthly update',
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <div style="background:#0F6E56;padding:20px;border-radius:12px 12px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">Benefits Watch</h2>
      </div>
      <div style="background:#f9f9f9;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:20px;">
        <p style="color:#444;">Hi ${name || 'there'},</p>
        <p style="color:#444;">${alertType === 'rate_change' ? 'DWP updated rates. We re-checked your entitlement.' : 'Your monthly benefits check is complete.'}</p>
        <div style="background:#E1F5EE;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;color:#085041;font-size:13px;">Your monthly entitlement</p>
          <p style="margin:6px 0 0;color:#0F6E56;font-size:26px;font-weight:500;">£${Math.round(newMonthly).toLocaleString()}/month</p>
          ${diff !== 0 ? `<p style="margin:4px 0 0;color:#0F6E56;font-size:13px;">${sign}£${Math.abs(Math.round(diff))}/month vs your last report</p>` : ''}
        </div>
        ${benefits.slice(0, 4).map(b => `<p style="margin:4px 0;color:#444;font-size:13px;">• ${b.name}: £${b.monthlyAmount.toFixed(2)}/mo</p>`).join('')}
        <a href="${process.env.VITE_APP_URL}/dashboard" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;margin-top:16px;">View dashboard →</a>
        <p style="color:#999;font-size:11px;margin-top:20px;">Estimates based on DWP rates April 2026/27. Confirm with DWP or Citizens Advice.</p>
      </div>
    </div>`,
  })
}

exports.handler = async (event) => {
  const isPost = event.httpMethod === 'POST'
  if (isPost && event.headers?.['x-admin-token'] !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: 'Unauthorised' }
  }

  const { alertType = 'monthly_checkin' } = isPost ? JSON.parse(event.body || '{}') : {}

  const { data: subscribers } = await supabase
    .from('profiles')
    .select('id, email, full_name, total_value_protected_pence, reports(id,answers,benefits,total_monthly_pence,paid,created_at)')
    .eq('benefits_watch_active', true)

  if (!subscribers?.length) {
    return { statusCode: 200, body: 'No subscribers' }
  }

  let alerted = 0
  for (const sub of subscribers) {
    try {
      const latest = sub.reports
        ?.filter(r => r.paid)
        ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      if (!latest) continue

      const prevMonthly = latest.total_monthly_pence / 100
      const newBenefits = await recalculate(latest.answers)
      const newMonthly = newBenefits.reduce((s, b) => s + b.monthlyAmount, 0)
      const diffPence = Math.round((newMonthly - prevMonthly) * 100)
      const shouldEmail = alertType === 'rate_change' ? Math.abs(diffPence) > 1000 : true

      const { data: alert } = await supabase.from('watch_alerts').insert({
        user_id: sub.id,
        alert_type: alertType,
        title: alertType === 'rate_change' ? 'DWP rates updated' : 'Monthly check complete',
        previous_monthly_pence: latest.total_monthly_pence,
        new_monthly_pence: Math.round(newMonthly * 100),
        difference_pence: diffPence,
      }).select().single()

      if (shouldEmail && sub.email) {
        await sendAlert(sub.email, sub.full_name?.split(' ')[0], prevMonthly, newMonthly, newBenefits, alertType)
        await supabase.from('watch_alerts').update({ email_sent: true }).eq('id', alert.id)
        alerted++
      }

      const addProtected = Math.max(diffPence, 0)
      if (addProtected > 0) {
        await supabase.from('profiles').update({
          total_value_protected_pence: (sub.total_value_protected_pence || 0) + addProtected,
        }).eq('id', sub.id)
      }

      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.error('Subscriber error:', sub.id, e.message)
    }
  }

  return { statusCode: 200, body: `Alerted ${alerted} of ${subscribers.length}` }
}
