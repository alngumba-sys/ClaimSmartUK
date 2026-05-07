/**
 * check-admin-reminders.js
 *
 * Scheduled function — runs on the 1st of every month at 09:00 UTC.
 * Checks the admin_maintenance_log and emails the admin about:
 *   - Annual rates update (if April and not yet done)
 *   - Monthly spot-check overdue (>35 days)
 *   - Policy review not done this quarter (>90 days)
 *   - Complaint review backlog (>= 10 complaints since last review)
 *
 * Can also be triggered manually via POST /api/check-admin-reminders
 * with x-admin-secret header.
 */

const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@claimsmart.uk'

function daysSince(isoString) {
  if (!isoString) return null
  return Math.floor((Date.now() - new Date(isoString)) / 86_400_000)
}

function fmtDate(isoString) {
  if (!isoString) return 'never'
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

exports.handler = async (event) => {
  // Allow manual POST trigger with admin secret
  if (event.httpMethod === 'POST') {
    if (event.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return { statusCode: 401, body: 'Unauthorised' }
    }
  }

  try {
    // ── Fetch maintenance log ─────────────────────────────────────────────
    const { data: rows } = await supabase
      .from('admin_maintenance_log')
      .select('task_key, completed_at')
      .order('completed_at', { ascending: false })

    // Latest completion per task_key
    const latest = {}
    for (const row of (rows || [])) {
      if (!latest[row.task_key]) latest[row.task_key] = row.completed_at
    }

    // Complaint count since last review
    const lastReview = latest['complaint_review']
    const complaintQuery = supabase
      .from('admin_maintenance_log')
      .select('*', { count: 'exact', head: true })
      .eq('task_key', 'complaint_logged')
    if (lastReview) complaintQuery.gt('completed_at', lastReview)
    const { count: complaintsSinceReview } = await complaintQuery

    // ── Determine what's due ──────────────────────────────────────────────
    const now   = new Date()
    const month = now.getMonth() + 1   // 1-indexed
    const alerts = []

    // Annual rates — only flag in April if not done since April 6
    if (month === 4) {
      const thisApril6 = new Date(now.getFullYear(), 3, 6)
      const ratesDate  = latest['annual_rates'] ? new Date(latest['annual_rates']) : null
      if (!ratesDate || ratesDate < thisApril6) {
        const daysLate = Math.max(0, Math.floor((now - thisApril6) / 86_400_000))
        alerts.push({
          severity: 'critical',
          subject: daysLate > 0
            ? `🚨 Annual rates update is ${daysLate} days overdue`
            : '⚠️ Annual rates update due tomorrow (April 6th)',
          html: `
            <h3 style="color:#991b1b">Annual rates update ${daysLate > 0 ? `overdue by ${daysLate} days` : 'due tomorrow'}</h3>
            <p>DWP rates changed on April 6th. Until you update the rate files, every calculation is wrong.</p>
            <p><strong>Steps:</strong></p>
            <ol>
              <li>Update <code>netlify/functions/rates.js</code> with new DWP figures</li>
              <li>Update <code>src/data/benefitsRates2026.js</code> (frontend mirror)</li>
              <li>Deploy (git push to main)</li>
              <li>Run 5 spot-checks against <a href="https://www.entitledto.co.uk">entitledto.co.uk</a></li>
              <li>Send "rates updated" email to all users</li>
            </ol>
            <p>Rate sources:
              <a href="https://www.gov.uk/universal-credit/what-youll-get">UC</a> ·
              <a href="https://www.gov.uk/child-benefit/what-youll-get">Child Benefit</a> ·
              <a href="https://www.gov.uk/pip/how-much-youll-get">PIP</a> ·
              <a href="https://www.gov.uk/pension-credit/what-youll-get">Pension Credit</a>
            </p>
            <p>Last completed: ${fmtDate(latest['annual_rates'])}</p>`,
        })
      }
    }

    // Monthly spot-check — overdue after 35 days
    const spotDays = daysSince(latest['monthly_spotcheck'])
    if (spotDays === null || spotDays > 35) {
      alerts.push({
        severity: 'warning',
        subject: '⚠️ Monthly accuracy spot-check is overdue',
        html: `
          <h3 style="color:#92400e">Monthly spot-check overdue</h3>
          <p>Last done: <strong>${fmtDate(latest['monthly_spotcheck'])}</strong> (${spotDays ?? 'never'} days ago)</p>
          <p><strong>Steps:</strong></p>
          <ol>
            <li>Pick 3–4 varied profiles (different age, housing, health)</li>
            <li>Run each through <a href="https://claimsmart.uk/check">claimsmart.uk/check</a></li>
            <li>Enter the same answers at <a href="https://www.entitledto.co.uk">entitledto.co.uk</a></li>
            <li>If any benefit is off by &gt;15%, investigate (Claude error / rates error / input error)</li>
            <li>Fix root cause and mark done in the Admin → Maintenance tab</li>
          </ol>`,
      })
    }

    // Policy review — flag if not done in the last 90 days
    const policyDays = daysSince(latest['policy_review'])
    if (policyDays === null || policyDays > 90) {
      alerts.push({
        severity: 'info',
        subject: 'ℹ️ Quarterly DWP policy review reminder',
        html: `
          <h3 style="color:#1e40af">Quarterly policy review</h3>
          <p>Last done: <strong>${fmtDate(latest['policy_review'])}</strong></p>
          <p>Check for any DWP announcements, budgets, or eligibility rule changes since then.</p>
          <p>
            <a href="https://www.gov.uk/government/organisations/department-for-work-pensions/about">DWP news</a> ·
            <a href="https://www.citizensadvice.org.uk/about-us/how-citizens-advice-works/media/press-releases/">Citizens Advice press releases</a>
          </p>`,
      })
    }

    // Complaint review — threshold
    if ((complaintsSinceReview || 0) >= 10) {
      alerts.push({
        severity: 'warning',
        subject: `⚠️ ${complaintsSinceReview} complaints logged — review needed`,
        html: `
          <h3 style="color:#92400e">Complaint review threshold reached</h3>
          <p><strong>${complaintsSinceReview} complaints</strong> have been logged since the last review (${fmtDate(latest['complaint_review'])}).</p>
          <p><strong>Steps:</strong></p>
          <ol>
            <li>Pull up each user's answers from Supabase → reports table</li>
            <li>Identify error type: Claude error, rates error, or user input error</li>
            <li>Fix root cause</li>
            <li>Mark review done in Admin → Maintenance tab</li>
          </ol>`,
      })
    }

    if (alerts.length === 0) {
      console.log('[check-admin-reminders] No alerts — all tasks up to date.')
      return { statusCode: 200, body: JSON.stringify({ sent: 0, message: 'All tasks up to date' }) }
    }

    // ── Send a single digest email ────────────────────────────────────────
    const criticalCount = alerts.filter(a => a.severity === 'critical').length
    const emailSubject  = criticalCount > 0
      ? `🚨 ClaimSmart Admin — ${criticalCount} critical task${criticalCount !== 1 ? 's' : ''} overdue`
      : `⚠️ ClaimSmart Admin — ${alerts.length} maintenance reminder${alerts.length !== 1 ? 's' : ''}`

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
        <div style="background:#0F6E56;padding:16px 24px;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:18px;">ClaimSmart Admin — Maintenance Reminders</h1>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          ${alerts.map(a => `
            <div style="margin-bottom:24px;padding:16px;border-radius:8px;background:${
              a.severity === 'critical' ? '#fef2f2' : a.severity === 'warning' ? '#fffbeb' : '#eff6ff'
            };border:1px solid ${
              a.severity === 'critical' ? '#fca5a5' : a.severity === 'warning' ? '#fcd34d' : '#bfdbfe'
            };">
              ${a.html}
            </div>
          `).join('')}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <p style="font-size:12px;color:#9ca3af;">
            View the full checklist at
            <a href="https://claimsmart.uk/admin" style="color:#0F6E56;">claimsmart.uk/admin</a> → Maintenance tab.
          </p>
        </div>
      </body>
      </html>`

    await resend.emails.send({
      from: 'ClaimSmart Admin <admin@claimsmart.uk>',
      to: ADMIN_EMAIL,
      subject: emailSubject,
      html: emailHtml,
    })

    console.log(`[check-admin-reminders] Sent digest with ${alerts.length} alert(s) to ${ADMIN_EMAIL}`)
    return { statusCode: 200, body: JSON.stringify({ sent: 1, alerts: alerts.length }) }

  } catch (err) {
    console.error('[check-admin-reminders] error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
