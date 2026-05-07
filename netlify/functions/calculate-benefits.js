const Anthropic = require('@anthropic-ai/sdk')
const { RATES, buildSystemPrompt } = require('./rates')
const { getBedroomCat, BRMA_RATES, LA_TO_BRMA } = require('./lha-lookup')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ---------------------------------------------------------------------------
// Rate limiting — in-memory per IP, max 5 calls per 15-minute window.
// Protects against API cost abuse. Resets on cold start; good enough for
// burst protection without needing an external store.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const ipRequests = new Map() // ip -> { count, windowStart }

function isRateLimited(ip) {
  const now = Date.now()
  const entry = ipRequests.get(ip)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRequests.set(ip, { count: 1, windowStart: now })
    return false
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true
  }

  entry.count++
  return false
}

// ---------------------------------------------------------------------------
// Answer validation — only allow values from the known option lists.
// Prevents prompt injection via crafted answer strings.
// ---------------------------------------------------------------------------
const VALID_ANSWERS = {
  situation: ['Working full-time', 'Working part-time', 'Self-employed', 'Unemployed', 'Unable to work — health', 'Carer for someone', 'Retired', 'Student'],
  age: ['Under 25', '25 to 34', '35 to 49', '50 to 64', '65 or over'],
  housing: ['I rent privately', 'Council or housing association', 'Own with a mortgage', 'Own outright', 'I live with family or friends'],
  children: ['No children', '1 child', '2 children', '3 or more children'],
  income: ['Under £500', '£500 to £1,000', '£1,000 to £1,500', '£1,500 to £2,500', 'Over £2,500'],
  savings: ['No savings', 'Under £1,000', '£1,000 to £6,000', '£6,000 to £16,000', 'Over £16,000'],
  health: ['No health conditions', 'Yes — affects daily living', 'Yes — unable to work', 'Yes — need care from others'],
}

// Region can be any string from Postcodes.io or 'Unknown' when skipped
const KNOWN_REGIONS = new Set([
  'London', 'South East', 'South West', 'East Midlands', 'West Midlands', 'Midlands',
  'North East', 'North West', 'North of England', 'Yorkshire and The Humber',
  'East of England', 'Wales', 'Scotland', 'Northern Ireland', 'Unknown',
])

function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object') return false
  for (const [key, validOptions] of Object.entries(VALID_ANSWERS)) {
    if (!validOptions.includes(answers[key])) return false
  }
  // Region: accept any string from Postcodes.io or 'Unknown' when skipped
  const region = answers.region
  if (!region || typeof region !== 'string' || region.length > 100) return false
  // council and constituency are optional free-text strings from Postcodes.io
  if (answers.council && (typeof answers.council !== 'string' || answers.council.length > 100)) return false
  if (answers.constituency && (typeof answers.constituency !== 'string' || answers.constituency.length > 100)) return false
  // postcodeProvided must be a boolean if present
  if (answers.postcodeProvided !== undefined && typeof answers.postcodeProvided !== 'boolean') return false
  return true
}

// ─── Benefit validation ───────────────────────────────────────────────────────
// Applied to Claude's JSON output before returning to the user.
// Catches the most common model errors: wrong amounts, ineligible benefits,
// duplicates, and mismatched annual/monthly figures.
// Hard violations (ineligible) → return null → filtered out.
// Soft violations (wrong amount) → corrected in place.

const RENTING_OPTIONS = new Set(['I rent privately', 'Council or housing association'])
const CHILD_COUNT     = { 'No children': 0, '1 child': 1, '2 children': 2, '3 or more children': 3 }
const PENSION_AGE     = '65 or over'
const CARER_SITUATION = 'Carer for someone'
const HEALTH_OPTIONS  = new Set(['Yes — affects daily living', 'Yes — unable to work', 'Yes — need care from others'])

// Map Postcodes.io region names to the keys used in housingByRegion
const REGION_MAP = {
  'London':                    'London',
  'South East':                'South East',
  'South West':                'South West',
  'East Midlands':             'Midlands',
  'West Midlands':             'Midlands',
  'Midlands':                  'Midlands',
  'North East':                'North of England',
  'North West':                'North of England',
  'North of England':          'North of England',
  'Yorkshire and The Humber':  'North of England',
  'East of England':           'South East',
  'Wales':                     'Wales',
  'Scotland':                  'Scotland',
  'Northern Ireland':          'Northern Ireland',
}

function mapRegion(region) {
  return REGION_MAP[region] || null
}

/** Compute the absolute maximum UC payable given these quiz answers (no taper, all elements). */
function maxPossibleUC(answers) {
  const r = RATES.universalCredit
  const std     = answers.age === 'Under 25' ? r.singleUnder25 : r.couple25Plus
  const mappedRegion = mapRegion(answers.region)
  const housing = RENTING_OPTIONS.has(answers.housing)
    ? (r.housingByRegion[mappedRegion] ?? Math.max(...Object.values(r.housingByRegion)))
    : 0
  const children = (CHILD_COUNT[answers.children] ?? 0) * r.childElement
  const health = r.limitedCapacityWorkActivity
  return std + housing + children + health
}

/**
 * Validate and, where possible, correct a single benefit object.
 * Returns the (possibly mutated) benefit, or null to remove it.
 * All issues are appended to the `log` array.
 */
function validateBenefit(benefit, answers, log) {
  const name = (benefit.name || '').trim()
  const r    = RATES

  // ── Amount must be a positive finite number ──────────────────────────────
  if (typeof benefit.monthlyAmount !== 'number' || !isFinite(benefit.monthlyAmount) || benefit.monthlyAmount <= 0) {
    log.push(`REMOVE ${name}: monthlyAmount invalid (${benefit.monthlyAmount})`)
    return null
  }

  // ── annualAmount must equal monthlyAmount × 12 (auto-fix if wrong) ───────
  const expectedAnnual = parseFloat((benefit.monthlyAmount * 12).toFixed(2))
  if (Math.abs((benefit.annualAmount ?? 0) - expectedAnnual) > 1) {
    log.push(`FIX ${name}: annualAmount ${benefit.annualAmount} → ${expectedAnnual}`)
    benefit.annualAmount = expectedAnnual
  }

  // Helper: cap monthlyAmount and sync annualAmount, log the correction
  function cap(newAmount, reason) {
    log.push(`CAP ${name}: £${benefit.monthlyAmount.toFixed(2)} → £${newAmount.toFixed(2)} (${reason})`)
    benefit.monthlyAmount = parseFloat(newAmount.toFixed(2))
    benefit.annualAmount  = parseFloat((benefit.monthlyAmount * 12).toFixed(2))
  }

  // ── Universal Credit ─────────────────────────────────────────────────────
  if (/^universal credit$/i.test(name)) {
    // Savings > £16,000 disqualifies entirely (DWP capital rules)
    if (answers.savings === 'Over £16,000') {
      log.push(`REMOVE UC: savings over £16,000 disqualifies`)
      return null
    }
    // Amount ceiling: standard + housing (actual region) + all children + LCWRA
    const ceiling = maxPossibleUC(answers)
    if (benefit.monthlyAmount > ceiling + 0.02) {
      cap(ceiling, `exceeds max possible £${ceiling.toFixed(2)} for these answers`)
    }
  }

  // ── Child Benefit ────────────────────────────────────────────────────────
  if (/^child benefit$/i.test(name)) {
    const count = CHILD_COUNT[answers.children] ?? 0
    if (count === 0) {
      log.push(`REMOVE Child Benefit: no children declared`)
      return null
    }
    const maxCB = r.childBenefit.firstChild + Math.max(0, count - 1) * r.childBenefit.additionalChild
    if (benefit.monthlyAmount > maxCB * 1.05) {
      cap(maxCB, `max for ${count} child(ren) is £${maxCB.toFixed(2)}`)
    }
  }

  // ── Pension Credit — pension age only ────────────────────────────────────
  if (/^pension credit$/i.test(name)) {
    if (answers.age !== PENSION_AGE) {
      log.push(`REMOVE Pension Credit: age group '${answers.age}' is not pension age`)
      return null
    }
    const maxPC = r.pensionCredit.couple * 1.05  // couple is higher
    if (benefit.monthlyAmount > maxPC) {
      cap(maxPC, `exceeds couple rate £${r.pensionCredit.couple}`)
    }
  }

  // ── Attendance Allowance — pension age only ───────────────────────────────
  if (/^attendance allowance$/i.test(name)) {
    if (answers.age !== PENSION_AGE) {
      log.push(`REMOVE Attendance Allowance: age group '${answers.age}' is not pension age`)
      return null
    }
    if (benefit.monthlyAmount > r.attendanceAllowance.higher * 1.05) {
      cap(r.attendanceAllowance.higher, `exceeds higher rate £${r.attendanceAllowance.higher}`)
    }
  }

  // ── Carer's Allowance — carers only ──────────────────────────────────────
  if (/carer.?s allowance/i.test(name)) {
    if (answers.situation !== CARER_SITUATION) {
      log.push(`REMOVE Carer's Allowance: situation '${answers.situation}' — only paid to carers, not care recipients`)
      return null
    }
    if (benefit.monthlyAmount > r.carersAllowance.monthly * 1.05) {
      cap(r.carersAllowance.monthly, `exceeds published rate £${r.carersAllowance.monthly}`)
    }
  }

  // ── PIP — requires a declared health condition ────────────────────────────
  if (/personal independence payment|^pip/i.test(name)) {
    if (!HEALTH_OPTIONS.has(answers.health)) {
      log.push(`REMOVE PIP: health '${answers.health}' — no condition declared`)
      return null
    }
    if (/daily living/i.test(name) && benefit.monthlyAmount > r.pip.dailyLivingEnhanced * 1.02) {
      cap(r.pip.dailyLivingEnhanced, `exceeds enhanced DL rate £${r.pip.dailyLivingEnhanced}`)
    }
    if (/mobility/i.test(name) && benefit.monthlyAmount > r.pip.mobilityEnhanced * 1.02) {
      cap(r.pip.mobilityEnhanced, `exceeds enhanced mobility rate £${r.pip.mobilityEnhanced}`)
    }
  }

  // ── Free School Meals — requires children ────────────────────────────────
  if (/free school meals/i.test(name)) {
    const count = CHILD_COUNT[answers.children] ?? 0
    if (count === 0) {
      log.push(`REMOVE Free School Meals: no children declared`)
      return null
    }
    const maxFSM = count * r.freeSchoolMeals.monthlyPerChild
    if (benefit.monthlyAmount > maxFSM * 1.05) {
      cap(maxFSM, `max for ${count} child(ren) is £${maxFSM.toFixed(2)}`)
    }
  }

  // ── Healthy Start — cap at published rate ────────────────────────────────
  if (/healthy start/i.test(name)) {
    if (benefit.monthlyAmount > r.healthyStart.monthly * 1.1) {
      cap(r.healthyStart.monthly, `exceeds published rate £${r.healthyStart.monthly}`)
    }
  }

  return benefit
}

/**
 * Run validateBenefit across the full array, also stripping duplicates.
 * Returns the cleaned array and logs any corrections made.
 */
function validateBenefits(benefits, answers) {
  const log  = []
  const seen = new Set()

  const validated = benefits
    .map(b => {
      // Strip duplicates (keep first occurrence)
      const key = (b.name || '').toLowerCase().replace(/\s+/g, ' ').trim()
      if (seen.has(key)) {
        log.push(`REMOVE duplicate: ${b.name}`)
        return null
      }
      seen.add(key)
      return validateBenefit(b, answers, log)
    })
    .filter(Boolean)

  if (log.length > 0) {
    console.warn(`[validate-benefits] ${log.length} correction(s) applied:`, JSON.stringify(log))
  }

  return validated
}

// System prompt is generated from rates.js — single source of truth for all figures.
// Update rates.js each April; this prompt updates automatically.
const SYSTEM_PROMPT = buildSystemPrompt()

// ---------------------------------------------------------------------------
// Postcode → actual LHA rate lookup (called when user supplies a postcode).
// Returns { lhaMonthly, brma, bedroomCat } or null on any failure.
// Uses the same BRMA_RATES / LA_TO_BRMA tables from lha-lookup.js
// so no extra HTTP call is needed — just an internal function call.
// ---------------------------------------------------------------------------
async function resolveActualLHA(answers) {
  // Use council name from Postcodes.io (resolved client-side) for LHA lookup
  const councilName = answers.council
  if (!councilName || councilName === 'Unknown') return null

  try {
    const brmaName    = LA_TO_BRMA[councilName]
    const brmaRates   = brmaName ? BRMA_RATES[brmaName] : null
    if (!brmaRates) return null

    const bedroomCat = getBedroomCat(answers)
    const lhaMonthly = parseFloat((brmaRates[bedroomCat] ?? brmaRates.onebed).toFixed(2))
    return { lhaMonthly, brma: brmaName, bedroomCat, councilName }
  } catch (err) {
    console.warn('[lha-lookup] error:', err.message)
    return null
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  // Rate limiting
  const ip =
    event.headers['x-forwarded-for']?.split(',')[0].trim() ||
    event.headers['client-ip'] ||
    'unknown'

  if (isRateLimited(ip)) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Too many requests. Please wait a few minutes before trying again.' }),
    }
  }

  let answers
  try {
    const body = JSON.parse(event.body)
    answers = body.answers
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) }
  }

  // Validate that all answers are from the known option lists
  if (!validateAnswers(answers)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid answers. Please complete the questionnaire on the site.' }),
    }
  }

  try {
    // If a postcode was provided, resolve the actual LHA rate for their BRMA.
    // This overrides the regional estimate in the system prompt.
    const lhaData = await resolveActualLHA(answers)

    const systemPrompt = lhaData
      ? buildSystemPrompt({ lhaOverride: lhaData.lhaMonthly, brma: lhaData.brma, bedroomCat: lhaData.bedroomCat })
      : SYSTEM_PROMPT

    const locationContext = answers.postcodeProvided
      ? `Location: ${answers.council}, ${answers.region} (postcode verified)`
      : `Location: ${answers.region || 'UK'} (regional estimate only — results for housing and council tax benefits may be less accurate)`

    const locationGuidance = answers.postcodeProvided
      ? `Use ${answers.council} council rates for Council Tax Reduction.\nUse ${answers.region} Local Housing Allowance rates.`
      : `Use regional average estimates for Council Tax Reduction and Local Housing Allowance. Note in each benefit's explanation that rates vary by council and the user should verify locally.`

    const userMessage = `Circumstances:
- Employment status: ${answers.situation}
- Age group: ${answers.age}
- Housing: ${answers.housing}
- Children: ${answers.children}
- Monthly income (after tax): ${answers.income}
- Savings: ${answers.savings}
- Health: ${answers.health}
- ${locationContext}${lhaData ? `\n- LHA: ${lhaData.brma} BRMA — actual rate ${lhaData.bedroomCat} = £${lhaData.lhaMonthly}/mo` : ''}

${locationGuidance}

Calculate all UK benefits this person likely qualifies for.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const responseText = message.content[0].text.trim()
    // Strip markdown fences if the model wrapped the JSON despite instructions
    const cleanText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const rawBenefits = JSON.parse(cleanText)

    // Cross-check Claude's output against hardcoded rates before returning
    const benefits = validateBenefits(rawBenefits, answers)

    const totalMonthly = benefits.reduce((sum, b) => sum + (b.monthlyAmount || 0), 0)
    const totalAnnual = benefits.reduce((sum, b) => sum + (b.annualAmount || 0), 0)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benefits, totalMonthly, totalAnnual }),
    }
  } catch (error) {
    console.error('Calculate benefits error:', error)

    // Fallback response if Claude API fails — amounts from rates.js
    const ucMonthly = RATES.universalCredit.single25Plus
    const ctrMonthly = RATES.councilTaxReduction.estimatedSaving
    const fallback = [
      {
        name: 'Universal Credit',
        monthlyAmount: ucMonthly,
        annualAmount: parseFloat((ucMonthly * 12).toFixed(2)),
        likelihood: 'high',
        explanation: 'Based on your income level you may qualify for Universal Credit support.',
        howToClaim: ['Visit gov.uk/universal-credit', 'Click "Start now" to begin your application', 'Have your NI number and bank details ready'],
        urgency: 'Claim this week',
        officialLink: 'https://www.gov.uk/universal-credit',
      },
      {
        name: 'Council Tax Reduction',
        monthlyAmount: ctrMonthly,
        annualAmount: parseFloat((ctrMonthly * 12).toFixed(2)),
        likelihood: 'high',
        explanation: 'Most people on low incomes qualify for a reduction on their council tax bill.',
        howToClaim: ['Contact your local council', 'Ask about Council Tax Reduction or Support', 'Apply online through your council website'],
        urgency: 'Claim this week',
        officialLink: 'https://www.gov.uk/council-tax-reduction',
      },
    ]

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        benefits: fallback,
        totalMonthly: fallback.reduce((s, b) => s + b.monthlyAmount, 0),
        totalAnnual: fallback.reduce((s, b) => s + b.annualAmount, 0),
        fallback: true,
      }),
    }
  }
}
