// netlify/functions/admin-rates.js
// Admin endpoint to view/update benefit rates
const { createClient } = require('@supabase/supabase-js')
const { SECURE_HEADERS } = require('./_utils')

function isAdmin(event) {
  const token = event.headers['x-admin-token'] || ''
  return token === process.env.ADMIN_PASSWORD
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: SECURE_HEADERS, body: '' }
  }

  if (!isAdmin(event)) {
    return { statusCode: 401, headers: SECURE_HEADERS, body: JSON.stringify({ error: 'Unauthorised' }) }
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // GET — fetch all rates
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('benefit_rates')
      .select('*')
      .order('category')
      .order('name')

    if (error) {
      return { statusCode: 500, headers: SECURE_HEADERS, body: JSON.stringify({ error: error.message }) }
    }

    return {
      statusCode: 200,
      headers: SECURE_HEADERS,
      body: JSON.stringify({ rates: data }),
    }
  }

  // PUT — update a single rate
  if (event.httpMethod === 'PUT') {
    const body = JSON.parse(event.body || '{}')
    const { id, amount_monthly, amount_weekly, amount_annual, notes } = body

    if (!id) {
      return { statusCode: 400, headers: SECURE_HEADERS, body: JSON.stringify({ error: 'Missing rate ID' }) }
    }

    const updates = { updated_at: new Date().toISOString() }
    if (amount_monthly !== undefined) updates.amount_monthly = amount_monthly
    if (amount_weekly !== undefined) updates.amount_weekly = amount_weekly
    if (amount_annual !== undefined) updates.amount_annual = amount_annual
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('benefit_rates')
      .update(updates)
      .eq('id', id)
      .select()

    if (error) {
      return { statusCode: 500, headers: SECURE_HEADERS, body: JSON.stringify({ error: error.message }) }
    }

    return {
      statusCode: 200,
      headers: SECURE_HEADERS,
      body: JSON.stringify({ rate: data[0] }),
    }
  }

  return { statusCode: 405, headers: SECURE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
}
