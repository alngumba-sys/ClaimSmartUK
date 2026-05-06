const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

exports.handler = async () => {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Find notifications due today based on remind_days_before
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*, profiles(email, full_name)')
      .eq('email_sent', false)
      .eq('dismissed', false)

    let sent = 0

    for (const n of (notifications || [])) {
      const dueDate = new Date(n.due_date)
      const triggerDate = new Date(dueDate)
      triggerDate.setDate(triggerDate.getDate() - (n.remind_days_before || 7))

      const triggerStr = triggerDate.toISOString().split('T')[0]

      if (triggerStr === todayStr) {
        const email = n.profiles?.email
        if (!email) continue

        const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))

        try {
          await resend.emails.send({
            from: 'ClaimSmart UK <reminders@claimsmart.uk>',
            to: email,
            subject: `Reminder: ${n.title} — ${daysUntil} days away`,
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2C2C2A;">
                <div style="background: #0F6E56; padding: 16px 20px; border-radius: 10px 10px 0 0;">
                  <h2 style="color: white; margin: 0; font-size: 16px; font-weight: 500;">ClaimSmart UK Reminder</h2>
                </div>
                <div style="background: #f9f9f9; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px;">
                  <h3 style="margin-top: 0;">${n.title}</h3>
                  <p style="color: #666;">${n.description || ''}</p>
                  <div style="background: #FAEEDA; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <strong style="color: #854F0B;">Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}:</strong>
                    <span style="color: #854F0B; margin-left: 4px;">${new Date(n.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <a href="${process.env.VITE_APP_URL}/dashboard" style="display: inline-block; background: #0F6E56; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; margin-top: 8px;">
                    View my dashboard
                  </a>
                  <p style="color: #999; font-size: 11px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 12px;">
                    You're receiving this because you set up a reminder on ClaimSmart UK.
                    <a href="${process.env.VITE_APP_URL}/notifications" style="color: #0F6E56;">Manage reminders</a>
                  </p>
                </div>
              </div>
            `,
          })

          await supabase
            .from('notifications')
            .update({ email_sent: true })
            .eq('id', n.id)

          sent++
        } catch (emailErr) {
          console.error('Email send failed for notification', n.id, emailErr)
        }
      }
    }

    console.log(`Notification cron: checked ${notifications?.length || 0} notifications, sent ${sent} emails`)
    return { statusCode: 200, body: `Sent ${sent} notification emails` }
  } catch (err) {
    console.error('Cron error:', err)
    return { statusCode: 500, body: 'Cron failed' }
  }
}
