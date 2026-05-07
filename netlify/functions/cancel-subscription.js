const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  const { userId } = JSON.parse(event.body)

  const { data: profile } = await supabase
    .from('profiles')
    .select('benefits_watch_stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (!profile?.benefits_watch_stripe_subscription_id) {
    return { statusCode: 404, body: 'No subscription found' }
  }

  await stripe.subscriptions.update(profile.benefits_watch_stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Cancelled at period end' }),
  }
}
