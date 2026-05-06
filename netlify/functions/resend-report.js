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
    html: '<p>Please find your ClaimSmart benefits report attached.</p>',
    attachments: [{ filename: 'ClaimSmart-Benefits-Report.pdf', content: pdf, encoding: 'base64' }],
  })

  return { statusCode: 200, body: 'Report resent' }
}
