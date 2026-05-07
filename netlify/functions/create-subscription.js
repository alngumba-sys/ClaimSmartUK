const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  const { userId, userEmail } = JSON.parse(event.body)

  const { data: profile } = await supabase
    .from('profiles')
    .select('benefits_watch_active')
    .eq('id', userId)
    .single()

  if (profile?.benefits_watch_active) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Already subscribed' }) }
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: userEmail,
    line_items: [{ price: process.env.STRIPE_BENEFITS_WATCH_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.VITE_APP_URL}/benefits-watch?activated=true`,
    cancel_url: `${process.env.VITE_APP_URL}/benefits-watch`,
    metadata: { user_id: userId, product: 'benefits_watch' },
    subscription_data: { metadata: { user_id: userId } },
  })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: session.url }),
  }
}
