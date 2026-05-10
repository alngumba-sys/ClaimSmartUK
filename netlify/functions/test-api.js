const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  // Simulate EXACTLY what calculate-benefits does
  const { rateLimit, rateLimitResponse, getIP, validate, sanitize, SECURE_HEADERS } = require('./_utils')
  
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: ratesData, error: ratesError } = await supabase
    .from('benefit_rates')
    .select('category, name, amount_monthly')
    .eq('tax_year', '2026/27')

  if (ratesError || !ratesData?.length) {
    return { statusCode: 200, body: JSON.stringify({ error: 'No rates', detail: ratesError?.message }) }
  }

  const rates = {}
  for (const r of ratesData) {
    if (!rates[r.category]) rates[r.category] = {}
    rates[r.category][r.name] = Number(r.amount_monthly)
  }

  // Now run the EXACT same logic as calculate-benefits with your answers
  const answers = {
    situation: 'Unemployed',
    age: '35 to 49',
    housing: 'I rent privately',
    children: '2 children',
    income: 'Under £500',
    savings: 'No savings',
    health: 'Yes — need care from others',
    region: 'East Midlands',
  }

  const income = 250
  const savings = 0
  const childCount = 2
  const isOver65 = false
  const isUnder25 = false
  const rents = true
  const region = 'East Midlands'

  const benefits = []
  const debug = []

  // 1. UC
  if (!isOver65 && savings < 16000) {
    let ucTotal = 0

    const standard = rates.uc?.standard_25_plus || 424.90
    ucTotal += standard
    debug.push(`UC standard: ${standard} (type: ${typeof standard})`)

    const childRate = rates.uc?.child_element || 292.81
    const childElements = Math.min(childCount, 2) * childRate
    ucTotal += childElements
    debug.push(`UC children: ${childCount} × ${childRate} = ${childElements}`)

    // Health check - THIS IS THE KEY
    const situation = answers.situation
    const health = answers.health
    debug.push(`situation: '${situation}'`)
    debug.push(`health: '${health}'`)
    debug.push(`situation === 'Unable to work — health': ${situation === 'Unable to work \u2014 health'}`)
    debug.push(`health === 'Yes — need care from others': ${health === 'Yes \u2014 need care from others'}`)
    
    let healthKey = null
    if (situation === 'Unable to work \u2014 health' || health === 'Yes \u2014 unable to work' || health === 'Yes \u2014 need care from others') {
      healthKey = 'lcwra_new'
    }
    debug.push(`healthKey: ${healthKey}`)
    
    if (healthKey && rates.uc?.[healthKey]) {
      ucTotal += rates.uc[healthKey]
      debug.push(`LCWRA: ${rates.uc[healthKey]}`)
    } else {
      debug.push(`LCWRA: SKIPPED (key=${healthKey}, rate=${rates.uc?.[healthKey]})`)
    }

    // Housing
    const housing = rates.uc?.housing_east_midlands_2bed || 498
    ucTotal += housing
    debug.push(`Housing: ${housing}`)

    // Income taper
    const hasWorkAllowance = childCount > 0 || healthKey === 'lcwra_new'
    const workAllowance = hasWorkAllowance ? 411 : 0
    const taperableIncome = Math.max(0, income - workAllowance)
    const taper = taperableIncome * 0.55
    ucTotal -= taper
    debug.push(`Taper: income=${income}, WA=${workAllowance}, taper=${taper}`)
    debug.push(`UC TOTAL: ${ucTotal}`)

    if (ucTotal > 0) {
      benefits.push({ name: 'Universal Credit', monthlyAmount: ucTotal })
    }
  } else {
    debug.push('UC SKIPPED: isOver65=' + isOver65 + ' savings=' + savings)
  }

  // 2. PIP
  if (!isOver65 && answers.health !== 'No health conditions') {
    let pipTotal = 0
    if (answers.health === 'Yes \u2014 need care from others') {
      pipTotal += (rates.pip?.daily_living_enhanced || 496.60)
      pipTotal += (rates.pip?.mobility_standard || 131.30)
      debug.push(`PIP: DL enhanced + Mob standard = ${pipTotal}`)
    }
    if (pipTotal > 0) benefits.push({ name: 'PIP', monthlyAmount: pipTotal })
  }

  // 3. Child Benefit
  if (childCount > 0) {
    const firstChild = rates.child_benefit?.first_child || 113
    const additional = rates.child_benefit?.additional_child || 74.83
    const cbTotal = firstChild + Math.max(0, childCount - 1) * additional
    benefits.push({ name: 'Child Benefit', monthlyAmount: cbTotal })
    debug.push(`CB: ${firstChild} + ${childCount-1} × ${additional} = ${cbTotal}`)
  }

  // 4. Council Tax
  benefits.push({ name: 'Council Tax Reduction', monthlyAmount: 130 })

  const totalMonthly = benefits.reduce((sum, b) => sum + b.monthlyAmount, 0)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debug, benefits, totalMonthly }, null, 2),
  }
}
