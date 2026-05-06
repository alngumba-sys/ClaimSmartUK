const { createClient } = require('@supabase/supabase-js')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function checkAdminAuth(event) {
  const auth = event.headers['x-admin-token']
  return auth === process.env.ADMIN_PASSWORD
}

exports.handler = async (event) => {
  if (!checkAdminAuth(event)) {
    return { statusCode: 401, body: 'Unauthorised' }
  }

  try {
    // Users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Paid reports
    const { data: reports, count: totalReports } = await supabase
      .from('reports')
      .select('*', { count: 'exact' })
      .eq('paid', true)
      .order('created_at', { ascending: false })

    // Revenue
    const totalRevenuePence = (totalReports || 0) * 900

    // Average benefits found
    let avgBenefits = 0
    if (reports && reports.length > 0) {
      const totalBenefits = reports.reduce((sum, r) => sum + (r.benefits?.length || 0), 0)
      avgBenefits = (totalBenefits / reports.length).toFixed(1)
    }

    // Average monthly amount found
    let avgMonthly = 0
    if (reports && reports.length > 0) {
      const total = reports.reduce((sum, r) => sum + (r.total_monthly_pence || 0), 0)
      avgMonthly = Math.round(total / reports.length / 100)
    }

    // Reports by region
    const regionCounts = {}
    reports?.forEach(r => {
      const region = r.answers?.region || 'Unknown'
      regionCounts[region] = (regionCounts[region] || 0) + 1
    })

    // Daily signups — last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const dailySignups = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dailySignups[d.toISOString().split('T')[0]] = 0
    }
    recentUsers?.forEach(u => {
      const day = u.created_at.split('T')[0]
      if (dailySignups[day] !== undefined) dailySignups[day]++
    })

    // Recent transactions
    const recentTransactions = reports?.slice(0, 15).map(r => ({
      id: r.id,
      date: r.paid_at || r.created_at,
      region: r.answers?.region || 'Unknown',
      benefitsFound: r.benefits?.length || 0,
      totalMonthly: r.total_monthly_pence / 100,
      stripeSessionId: r.stripe_session_id,
    })) || []

    // Users list
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at, referral_code, referral_earnings_pence, referred_by')
      .order('created_at', { ascending: false })
      .limit(50)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalUsers: totalUsers || 0,
        totalReports: totalReports || 0,
        totalRevenuePence,
        avgBenefits,
        avgMonthly,
        regionCounts,
        dailySignups,
        recentTransactions,
        users: users || [],
      }),
    }
  } catch (err) {
    console.error('Admin stats error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
