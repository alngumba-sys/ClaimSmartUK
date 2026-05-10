// netlify/functions/calculate-benefits.js
const Anthropic = require('@anthropic-ai/sdk')
const { rateLimit, rateLimitResponse, getIP, validate, sanitize, SECURE_HEADERS } = require('./_utils')

// ── Allowed values for each question ─────────────────────────────────────────
const ALLOWED = {
  situation: ['Working full-time', 'Working part-time', 'Self-employed', 'Unemployed', 'Unable to work — health', 'Carer for someone', 'Retired', 'Student'],
  age:       ['Under 25', '25 to 34', '35 to 49', '50 to 64', '65 or over'],
  housing:   ['I rent privately', 'Council or housing association', 'Own with a mortgage', 'Own outright', 'I live with family or friends'],
  children:  ['No children', '1 child', '2 children', '3 or more children'],
  income:    ['Under £500', '£500 to £1,000', '£1,000 to £1,500', '£1,500 to £2,500', 'Over £2,500'],
  savings:   ['No savings', 'Under £1,000', '£1,000 to £6,000', '£6,000 to £16,000', 'Over £16,000'],
  health:    ['No health conditions', 'Yes — affects daily living', 'Yes — unable to work', 'Yes — need care from others'],
  // postcode is optional and not validated (free text)
  // region is derived from postcode lookup or left empty
}

function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object') return 'Invalid answers format'
  for (const [key, allowed] of Object.entries(ALLOWED)) {
    if (answers[key] && !allowed.includes(answers[key])) {
      return `Invalid value for ${key}: ${sanitize.string(answers[key], 50)}`
    }
  }
  // postcode and region are optional/derived, don't validate them
  return null
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  // Instantiate client here — NOT at module level
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // ── Rate limit by IP (fail-open so it never blocks if table is missing) ───
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

    // Validate all answers against allowlist — prevents prompt injection
    const answerError = validateAnswers(answers)
    if (answerError) {
      console.error('Validation failed:', answerError)
    }
    if (answerError) {
      return { statusCode: 400, headers: SECURE_HEADERS, body: JSON.stringify({ error: answerError }) }
    }

    // Sanitize each answer
    const safeAnswers = {}
    for (const key of Object.keys(ALLOWED)) {
      if (answers[key]) safeAnswers[key] = sanitize.string(answers[key], 100)
    }

    const systemPrompt = `You are a UK benefits calculator. Return ONLY raw JSON (no markdown fences). Use these EXACT 2026/27 rates:

UC (monthly): Standard 25+: £424.90. Under 25: £338.58. Child: £292.81 each. LCWRA (new claimant Apr 2026+): £217.26. LCWRA (existing): £429.80. Carer element: £198.31. Housing: Lincoln/East Midlands 2-bed LHA ~£498/mo, London 2-bed ~£1000/mo, other ~£450-600. Savings over £16k=no UC. £6k-16k=tariff income.

PIP (NOT means-tested, separate from UC, paid on top): Daily living standard: £76.70/wk=£332/mo. Daily living enhanced: £114.60/wk=£496/mo. Mobility standard: £30.30/wk=£131/mo. Mobility enhanced: £80/wk=£346/mo. Max PIP: £194.60/wk=£843/mo. Map: "needs care"=enhanced daily living+standard mobility. "affects daily living"=standard daily living. "unable to work"=enhanced daily living+standard mobility.

Child Benefit (NOT means-tested, always include with children): First child £26.05/wk=£113/mo. Additional £17.25/wk=£75/mo. 2 children=£188/mo.

Other: Council Tax Reduction ~£100-170/mo on UC. Carer's Allowance £86.45/wk. Pension Credit 65+: tops up to £218.15/wk. Attendance Allowance 65+: £76.70-114.60/wk.

CRITICAL RULES:
1. Calculate UC as: standard + children + LCWRA/health + housing = total UC
2. PIP is ALWAYS separate and additional to UC
3. Child Benefit ALWAYS included if children exist
4. Unemployed person with 2 kids renting privately with health condition = £2000-3000/mo total
5. Never return £0. Never return under £100/mo total for anyone on low income
6. Keep explanation under 80 chars. Keep howToClaim steps under 60 chars each

Return: {"benefits":[{"name":"str","monthlyAmount":num,"annualAmount":num,"likelihood":"high|medium|low","explanation":"short calc","howToClaim":["step1","step2","step3"],"urgency":"Claim this week|Claim this month|Worth checking","officialLink":"https://gov.uk/..."}],"totalMonthly":num,"totalAnnual":num}`

    const userMessage = `Calculate benefits for:
Employment: ${safeAnswers.situation || 'Not specified'}
Age: ${safeAnswers.age || 'Not specified'}
Housing: ${safeAnswers.housing || 'Not specified'}
Children: ${safeAnswers.children || 'Not specified'}
Monthly income: ${safeAnswers.income || 'Not specified'}
Savings: ${safeAnswers.savings || 'Not specified'}
Health: ${safeAnswers.health || 'Not specified'}
Region: ${safeAnswers.region || 'Not specified'}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    })

    const text = message.content[0]?.text || ''
    // Strip any markdown code fences before parsing
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    return {
      statusCode: 200,
      headers: SECURE_HEADERS,
      body: JSON.stringify(result),
    }
  } catch (err) {
    console.error('calculate-benefits error:', JSON.stringify({
      message: err.message,
      status: err.status,
      type: err.error?.type,
      name: err.name,
      keyPresent: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 12),
    }))
    return {
      statusCode: 500,
      headers: SECURE_HEADERS,
      body: JSON.stringify({ error: 'Could not calculate benefits. Please try again.' }),
    }
  }
}
