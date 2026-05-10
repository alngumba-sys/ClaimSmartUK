// netlify/functions/calculate-benefits.js
// Deterministic UK benefits calculator — no AI, uses rates from Supabase
const { createClient } = require('@supabase/supabase-js')
const { rateLimit, rateLimitResponse, getIP, validate, sanitize, SECURE_HEADERS } = require('./_utils')

const ALLOWED = {
  situation: ['Working full-time', 'Working part-time', 'Self-employed', 'Unemployed', 'Unable to work — health', 'Carer for someone', 'Retired', 'Student'],
  age:       ['Under 25', '25 to 34', '35 to 49', '50 to 64', '65 or over'],
  housing:   ['I rent privately', 'Council or housing association', 'Own with a mortgage', 'Own outright', 'I live with family or friends'],
  children:  ['No children', '1 child', '2 children', '3 or more children'],
  income:    ['Under £500', '£500 to £1,000', '£1,000 to £1,500', '£1,500 to £2,500', 'Over £2,500'],
  savings:   ['No savings', 'Under £1,000', '£1,000 to £6,000', '£6,000 to £16,000', 'Over £16,000'],
  health:    ['No health conditions', 'Yes — affects daily living', 'Yes — unable to work', 'Yes — need care from others'],
}

function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object') return 'Invalid answers format'
  for (const [key, allowed] of Object.entries(ALLOWED)) {
    if (answers[key] && !allowed.includes(answers[key])) {
      return `Invalid value for ${key}: ${sanitize.string(answers[key], 50)}`
    }
  }
  return null
}

// Parse income range to midpoint
function parseIncome(incomeStr) {
  const map = {
    'Under £500': 250,
    '£500 to £1,000': 750,
    '£1,000 to £1,500': 1250,
    '£1,500 to £2,500': 2000,
    'Over £2,500': 3000,
  }
  return map[incomeStr] || 0
}

// Parse savings range to midpoint
function parseSavings(savingsStr) {
  const map = {
    'No savings': 0,
    'Under £1,000': 500,
    '£1,000 to £6,000': 3500,
    '£6,000 to £16,000': 11000,
    'Over £16,000': 20000,
  }
  return map[savingsStr] || 0
}

// Parse children count
function parseChildren(childrenStr) {
  const map = {
    'No children': 0,
    '1 child': 1,
    '2 children': 2,
    '3 or more children': 3,
  }
  return map[childrenStr] || 0
}

// Get housing LHA key based on region and children
function getHousingKey(region, childCount) {
  const beds = childCount >= 2 ? '2bed' : childCount === 1 ? '2bed' : '2bed'
  if (region && region.toLowerCase().includes('london')) return `housing_london_${beds}`
  if (region && (region.toLowerCase().includes('east midlands') || region.toLowerCase().includes('lincoln'))) return `housing_east_midlands_${beds}`
  return `housing_other_${beds}`
}

// Determine which health-related element applies
function getHealthElement(situation, healthStr) {
  // "Unable to work — health" or health conditions
  if (situation === 'Unable to work — health' || healthStr === 'Yes — unable to work' || healthStr === 'Yes — need care from others') {
    return 'lcwra_new' // LCWRA for new claimants from Apr 2026
  }
  if (healthStr === 'Yes — affects daily living') {
    return null // May qualify for PIP but not UC health element without assessment
  }
  return null
}

// Determine PIP eligibility
function getPIPComponents(healthStr) {
  if (healthStr === 'Yes — need care from others') {
    return { dailyLiving: 'daily_living_enhanced', mobility: 'mobility_standard' }
  }
  if (healthStr === 'Yes — unable to work') {
    return { dailyLiving: 'daily_living_enhanced', mobility: 'mobility_standard' }
  }
  if (healthStr === 'Yes — affects daily living') {
    return { dailyLiving: 'daily_living_standard', mobility: null }
  }
  return { dailyLiving: null, mobility: null }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: SECURE_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: SECURE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  // Rate limit (fail-open)
  try {
    const ip = getIP(event)
    const rl = await rateLimit(ip, 'calculate-benefits')
    if (rl.limited) return rateLimitResponse(rl.retryAfter)
  } catch (rlErr) {
    console.warn('Rate limit check failed (continuing):', rlErr.message)
  }

  try {
    const body    = sanitize.parseBody(event.body)
    const answers = body.answers || {}
    
    console.log('Received answers:', JSON.stringify(answers, null, 2))

    const answerError = validateAnswers(answers)
    if (answerError) {
      console.error('Validation failed:', answerError)
      return { statusCode: 400, headers: SECURE_HEADERS, body: JSON.stringify({ error: answerError }) }
    }

    // ── Load rates from Supabase ────────────────────────────────────────────
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    const { data: ratesData, error: ratesError } = await supabase
      .from('benefit_rates')
      .select('category, name, amount_monthly')
      .eq('tax_year', '2026/27')

    if (ratesError || !ratesData?.length) {
      console.error('Failed to load rates:', ratesError?.message || 'No rates found')
      return { statusCode: 500, headers: SECURE_HEADERS, body: JSON.stringify({ error: 'Could not load benefit rates.' }) }
    }

    // Build lookup: rates['uc']['standard_25_plus'] = 424.90
    const rates = {}
    for (const r of ratesData) {
      if (!rates[r.category]) rates[r.category] = {}
      rates[r.category][r.name] = Number(r.amount_monthly)
    }
    
    console.log('Loaded rates:', JSON.stringify({
      categories: Object.keys(rates),
      uc_keys: Object.keys(rates.uc || {}),
      pip_keys: Object.keys(rates.pip || {}),
      cb_keys: Object.keys(rates.child_benefit || {}),
      sample: rates.uc?.standard_25_plus,
    }))

    // ── Parse answers ──────────────────────────────────────────────────────
    const income     = parseIncome(answers.income)
    const savings    = parseSavings(answers.savings)
    const childCount = parseChildren(answers.children)
    const isOver65   = answers.age === '65 or over'
    const isUnder25  = answers.age === 'Under 25'
    const rents      = ['I rent privately', 'Council or housing association'].includes(answers.housing)
    const region     = answers.region || ''

    const benefits = []

    // ── 1. UNIVERSAL CREDIT ────────────────────────────────────────────────
    if (!isOver65 && savings < 16000) {
      let ucTotal = 0
      const ucParts = []

      // Standard allowance
      const standardKey = isUnder25 ? 'standard_under_25' : 'standard_25_plus'
      const standard = rates.uc?.[standardKey] || 424.90
      ucTotal += standard
      ucParts.push(`Standard £${standard.toFixed(0)}`)

      // Child elements (two-child limit)
      if (childCount > 0) {
        const childRate = rates.uc?.child_element || 292.81
        const childElements = Math.min(childCount, 2) * childRate
        ucTotal += childElements
        ucParts.push(`${Math.min(childCount, 2)} child × £${childRate.toFixed(0)} = £${childElements.toFixed(0)}`)
      }

      // Health/disability element
      const healthKey = getHealthElement(answers.situation, answers.health)
      if (healthKey && rates.uc?.[healthKey]) {
        ucTotal += rates.uc[healthKey]
        ucParts.push(`LCWRA £${rates.uc[healthKey].toFixed(0)}`)
      }

      // Carer element
      if (answers.situation === 'Carer for someone') {
        const carerEl = rates.uc?.carer_element || 198.31
        ucTotal += carerEl
        ucParts.push(`Carer £${carerEl.toFixed(0)}`)
      }

      // Housing element
      if (rents) {
        const housingKey = getHousingKey(region, childCount)
        const housing = rates.uc?.[housingKey] || 498
        ucTotal += housing
        ucParts.push(`Housing £${housing.toFixed(0)}`)
      }

      // Savings tariff income (£4.35 per £250 above £6,000)
      if (savings > 6000) {
        const bands = Math.ceil((savings - 6000) / 250)
        const tariff = bands * 4.35
        ucTotal -= tariff
        ucParts.push(`Savings deduction -£${tariff.toFixed(0)}`)
      }

      // Income taper (55% above work allowance)
      if (income > 0) {
        const hasWorkAllowance = childCount > 0 || healthKey === 'lcwra_new'
        const workAllowance = hasWorkAllowance ? (rents ? 411 : 684) : 0
        const taperableIncome = Math.max(0, income - workAllowance)
        const taper = taperableIncome * 0.55
        ucTotal -= taper
        if (taper > 0) ucParts.push(`Income taper -£${taper.toFixed(0)}`)
      }

      ucTotal = Math.max(0, Math.round(ucTotal * 100) / 100)

      if (ucTotal > 0) {
        benefits.push({
          name: 'Universal Credit',
          monthlyAmount: ucTotal,
          annualAmount: Math.round(ucTotal * 12 * 100) / 100,
          likelihood: 'high',
          explanation: ucParts.join(' + '),
          howToClaim: [
            'Apply at gov.uk/apply-universal-credit',
            'Have ID, bank details, rent agreement ready',
            'Attend Jobcentre appointment within 7 days'
          ],
          urgency: 'Claim this week',
          officialLink: 'https://www.gov.uk/universal-credit',
        })
      }
    }

    // ── 2. PIP (not means-tested) ──────────────────────────────────────────
    if (!isOver65 && answers.health !== 'No health conditions') {
      const pip = getPIPComponents(answers.health)
      let pipTotal = 0
      const pipParts = []

      if (pip.dailyLiving && rates.pip?.[pip.dailyLiving]) {
        pipTotal += rates.pip[pip.dailyLiving]
        pipParts.push(`Daily living £${rates.pip[pip.dailyLiving].toFixed(0)}/mo`)
      }
      if (pip.mobility && rates.pip?.[pip.mobility]) {
        pipTotal += rates.pip[pip.mobility]
        pipParts.push(`Mobility £${rates.pip[pip.mobility].toFixed(0)}/mo`)
      }

      if (pipTotal > 0) {
        benefits.push({
          name: 'Personal Independence Payment',
          monthlyAmount: pipTotal,
          annualAmount: Math.round(pipTotal * 12 * 100) / 100,
          likelihood: answers.health === 'Yes — need care from others' ? 'high' : 'medium',
          explanation: pipParts.join(' + ') + '. Not means-tested.',
          howToClaim: [
            'Call DWP on 0800 917 2222',
            'Complete PIP2 form within 1 month',
            'Attend health assessment'
          ],
          urgency: 'Claim this week',
          officialLink: 'https://www.gov.uk/pip',
        })
      }
    }

    // ── 3. CHILD BENEFIT (not means-tested) ────────────────────────────────
    if (childCount > 0) {
      const firstChild = rates.child_benefit?.first_child || 113
      const additionalChild = rates.child_benefit?.additional_child || 74.83
      const cbTotal = firstChild + Math.max(0, childCount - 1) * additionalChild

      benefits.push({
        name: 'Child Benefit',
        monthlyAmount: Math.round(cbTotal * 100) / 100,
        annualAmount: Math.round(cbTotal * 12 * 100) / 100,
        likelihood: 'high',
        explanation: `£${firstChild.toFixed(0)} first child` + (childCount > 1 ? ` + ${childCount - 1} × £${additionalChild.toFixed(0)}` : '') + '. Not means-tested.',
        howToClaim: [
          'Apply online at gov.uk/child-benefit',
          'Need child birth certificate and your NI number',
          'Can backdate up to 3 months'
        ],
        urgency: 'Claim this week',
        officialLink: 'https://www.gov.uk/child-benefit',
      })
    }

    // ── 4. COUNCIL TAX REDUCTION ───────────────────────────────────────────
    if (income < 1500 || savings < 16000) {
      const ctReduction = rates.council_tax?.reduction_full || 130
      // Partial reduction if some income
      const ctAmount = income > 1000 ? Math.round(ctReduction * 0.5) : ctReduction

      benefits.push({
        name: 'Council Tax Reduction',
        monthlyAmount: ctAmount,
        annualAmount: ctAmount * 12,
        likelihood: income < 500 ? 'high' : 'medium',
        explanation: `Up to £${ctReduction}/mo off council tax. Varies by council.`,
        howToClaim: [
          'Apply through your local council website',
          'Provide proof of income and UC award',
          'Applied separately from Universal Credit'
        ],
        urgency: 'Claim this month',
        officialLink: 'https://www.gov.uk/council-tax-reduction',
      })
    }

    // ── 5. ATTENDANCE ALLOWANCE (65+ only) ─────────────────────────────────
    if (isOver65 && answers.health !== 'No health conditions') {
      const aaKey = answers.health === 'Yes — need care from others' ? 'higher_rate' : 'lower_rate'
      const aaAmount = rates.attendance?.[aaKey] || 332.37

      benefits.push({
        name: 'Attendance Allowance',
        monthlyAmount: aaAmount,
        annualAmount: Math.round(aaAmount * 12 * 100) / 100,
        likelihood: 'high',
        explanation: `${aaKey === 'higher_rate' ? 'Higher' : 'Lower'} rate. Not means-tested.`,
        howToClaim: [
          'Call 0800 731 0122 for a claim form',
          'Describe how condition affects daily life',
          'No medical assessment usually needed'
        ],
        urgency: 'Claim this week',
        officialLink: 'https://www.gov.uk/attendance-allowance',
      })
    }

    // ── 6. PENSION CREDIT (65+ only) ───────────────────────────────────────
    if (isOver65 && income < 2000 && savings < 16000) {
      const pcAmount = rates.pension?.guarantee_credit_single || 945.32
      const topUp = Math.max(0, pcAmount - (income * 4.33))

      if (topUp > 50) {
        benefits.push({
          name: 'Pension Credit',
          monthlyAmount: Math.round(topUp * 100) / 100,
          annualAmount: Math.round(topUp * 12 * 100) / 100,
          likelihood: 'high',
          explanation: `Tops up weekly income to £${(pcAmount / 4.33).toFixed(0)}/wk`,
          howToClaim: [
            'Call Pension Credit claim line 0800 991 234',
            'Can backdate up to 3 months',
            'Need details of all income and savings'
          ],
          urgency: 'Claim this week',
          officialLink: 'https://www.gov.uk/pension-credit',
        })
      }
    }

    // ── 7. CARER'S ALLOWANCE ───────────────────────────────────────────────
    if (answers.situation === 'Carer for someone') {
      const caAmount = rates.carers?.carers_allowance || 374.62

      benefits.push({
        name: "Carer's Allowance",
        monthlyAmount: caAmount,
        annualAmount: Math.round(caAmount * 12 * 100) / 100,
        likelihood: 'high',
        explanation: 'For caring 35+ hrs/wk. May overlap with UC carer element.',
        howToClaim: [
          'Apply at gov.uk/carers-allowance',
          'Person you care for must get PIP/DLA/AA',
          'You must earn under £151/wk after deductions'
        ],
        urgency: 'Claim this week',
        officialLink: 'https://www.gov.uk/carers-allowance',
      })
    }

    // ── Calculate totals ───────────────────────────────────────────────────
    const totalMonthly = Math.round(benefits.reduce((sum, b) => sum + b.monthlyAmount, 0) * 100) / 100
    const totalAnnual  = Math.round(benefits.reduce((sum, b) => sum + b.annualAmount, 0) * 100) / 100

    console.log('Calculated benefits:', benefits.map(b => `${b.name}: £${b.monthlyAmount}`).join(', '))
    console.log('Total monthly:', totalMonthly)

    return {
      statusCode: 200,
      headers: SECURE_HEADERS,
      body: JSON.stringify({ benefits, totalMonthly, totalAnnual }),
    }

  } catch (err) {
    console.error('calculate-benefits error:', JSON.stringify({
      message: err.message,
      name: err.name,
      stack: err.stack?.split('\n').slice(0, 3),
    }))
    return {
      statusCode: 500,
      headers: SECURE_HEADERS,
      body: JSON.stringify({ error: 'Could not calculate benefits. Please try again.' }),
    }
  }
}
