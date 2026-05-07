const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

exports.handler = async (event) => {
  const adminToken = event.headers['x-admin-token']
  if (adminToken !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: 'Unauthorised' }
  }

  const { reportId, email } = JSON.parse(event.body)

  const { data: report } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (!report) return { statusCode: 404, body: 'Report not found' }

  // Call generate-pdf function
  const pdfRes = await fetch(
    `${process.env.VITE_APP_URL}/.netlify/functions/generate-pdf`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        benefits: report.benefits,
        totalMonthly: report.total_monthly_pence / 100,
        totalAnnual: report.total_annual_pence / 100,
      }),
    }
  )
  const { pdf } = await pdfRes.json()

  await resend.emails.send({
    from: 'ClaimSmart UK <reports@claimsmart.uk>',
    to: email,
    subject: 'Your ClaimSmart benefits report (resent)',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2C2C2A;">
        <div style="background: #0F6E56; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 18px; margin: 0; font-weight: 500;">ClaimSmart UK</h1>
        </div>
        <div style="background: #f9f9f9; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px; padding: 28px 24px;">
          <p style="color: #444; line-height: 1.6;">Please find your ClaimSmart benefits report attached as a PDF.</p>
          <p style="color: #999; font-size: 12px; line-height: 1.6; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Results are estimates based on current DWP rates (April 2026/27) and the information you provided.
            Actual entitlement depends on your full individual circumstances, which only DWP can assess.
            ClaimSmart UK is not a benefits adviser or financial adviser. Always confirm your entitlement
            directly with DWP (0800 328 5644) or Citizens Advice (0800 144 8848) before making any financial decisions.
          </p>
        </div>
      </div>
    `,
    attachments: [{ filename: 'ClaimSmart-Benefits-Report.pdf', content: pdf, encoding: 'base64' }],
  })

  return { statusCode: 200, body: 'Report resent' }
}
