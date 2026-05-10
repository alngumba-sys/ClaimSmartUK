const { createClient } = require('@supabase/supabase-js')

exports.handler = async () => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Check if benefit_rates table exists and has data
  const { data, error, count } = await supabase
    .from('benefit_rates')
    .select('category, name, amount_monthly', { count: 'exact' })

  if (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        table_exists: false, 
        error: error.message,
        hint: 'Run create_benefit_rates.sql in Supabase SQL Editor'
      }),
    }
  }

  // Show types to verify Number vs String
  const sample = data[0]
  const rates = {}
  for (const r of data) {
    if (!rates[r.category]) rates[r.category] = {}
    rates[r.category][r.name] = Number(r.amount_monthly)
  }

  // Simulate your exact scenario
  const uc = (rates.uc?.standard_25_plus || 0) + 
             (rates.uc?.child_element || 0) * 2 + 
             (rates.uc?.lcwra_new || 0) + 
             (rates.uc?.housing_east_midlands_2bed || 0)
  const pip = (rates.pip?.daily_living_enhanced || 0) + (rates.pip?.mobility_standard || 0)
  const cb = (rates.child_benefit?.first_child || 0) + (rates.child_benefit?.additional_child || 0)
  const ct = rates.council_tax?.reduction_full || 0

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_exists: true,
      total_rows: count,
      sample_type: typeof sample?.amount_monthly,
      sample_raw: sample?.amount_monthly,
      sample_as_number: Number(sample?.amount_monthly),
      categories: Object.keys(rates),
      your_scenario: {
        UC: uc,
        PIP: pip,
        ChildBenefit: cb,
        CouncilTax: ct,
        TOTAL: uc + pip + cb + ct
      }
    }, null, 2),
  }
}
