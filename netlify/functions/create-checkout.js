const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { answers, benefits, totalMonthly, totalAnnual, userId, referralCode } = JSON.parse(event.body)

    // Save report to Supabase first so we can retrieve after payment
    const reportData = {
      user_id: userId || null,
      answers,
      benefits,
      total_monthly_pence: Math.round(totalMonthly * 100),
      total_annual_pence: Math.round(totalAnnual * 100),
      paid: false,
    }

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert(reportData)
      .select()
      .single()

    if (reportError) console.warn('Report save failed:', reportError.message)

    const reportId = report?.id || 'temp-' + Date.now()

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'ClaimSmart UK — Full Benefits Report',
            description: `${benefits.length} benefits found · £${Math.round(totalMonthly)}/month potential entitlement`,
          },
          unit_amount: 900, // £9.00
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.VITE_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.VITE_APP_URL}/results`,
      metadata: {
        report_id: reportId,
        user_id: userId || '',
        referral_code: referralCode || '',
        benefits_count: String(benefits.length),
        total_monthly: String(Math.round(totalMonthly)),
      },
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    }
  } catch (error) {
    console.error('Checkout error:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to create checkout session' }),
    }
  }
}
