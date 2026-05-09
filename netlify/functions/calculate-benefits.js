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

    const systemPrompt = `You are a UK benefits calculator. Based on user answers, calculate entitlement using 2026/27 DWP rates.

KEY BENEFITS & 2026/27 MONTHLY RATES:
- Universal Credit (UC): Standard allowance £393.45 (under 25) or £509.72 (25+) + housing element (varies by rent) + child element £315/£287 per child + limited capability £416.19 or £156.11
- Child Benefit: £102.40 first child, £67.80 each additional child
- Pension Credit: Guarantee credit tops up income to £218.15 (single) or £332.95 (couple)
- Attendance Allowance (65+): £72.65 lower or £108.55 higher rate
- Personal Independence Payment (PIP): Daily living £72.65–£108.55, mobility £28.70–£75.75
- Carer's Allowance: £81.90 if caring 35+ hours/week
- Council Tax Reduction: up to 100% of council tax (varies by council)
- Housing Benefit: covers rent (social or private) if not on UC

RULES:
- UC replaces most working-age benefits; you get UC OR Housing Benefit/Tax Credits, not both
- Under £16k savings: eligible for most means-tested benefits. Over £16k: disqualified from UC/PC
- Working full-time 16+ hours: may still get UC if low income. UC has work allowance
- Health conditions: PIP/Attendance Allowance for care needs; UC limited capability for work reduction
- Children: UC child element + Child Benefit (Child Benefit not means-tested)
- Pensioners (65+): Pension Credit, Attendance Allowance, Winter Fuel Payment (£200–£300/year)
- Carers: Carer's Allowance if 35+ hrs/week caring; UC carer element £198.31

TYPICAL SCENARIOS:
- Unemployed, under 25, renting, no children, no savings: UC standard £393.45 + housing ~£600–800 = ~£1,000–1,200/month
- Unemployed, 25+, renting, 2 children, low income: UC standard £509.72 + 2 children £602 + housing ~£800 = ~£1,900/month + Child Benefit £170/month = £2,070 total
- Working part-time, low income, 1 child: UC (reduced by earnings) ~£300–600 + Child Benefit £102.40 = £400–700/month
- Retired 65+, low income: Pension Credit tops up to £218.15, Attendance Allowance £72.65–108.55 if care needs = £290–326/month
- Health condition affecting work: UC + limited capability £416.19 or PIP daily living £72.65–108.55 = potentially £500–600/month
- Carer, not working: Carer's Allowance £81.90 + UC carer element £198.31 = £280/month

Return ONLY valid JSON, no markdown:
{
  "benefits": [
    {
      "name": "Universal Credit",
      "monthlyAmount": 1200.50,
      "annualAmount": 14406,
      "likelihood": "high",
      "explanation": "UC standard allowance + housing element for your rent. You qualify as unemployed with income under threshold.",
      "howToClaim": ["Apply online at gov.uk/apply-universal-credit", "Have your bank details, rent agreement, and National Insurance number ready", "You'll need to verify your identity with GOV.UK Verify or at a Jobcentre"],
      "urgency": "Claim this week",
      "officialLink": "https://www.gov.uk/universal-credit"
    }
  ],
  "totalMonthly": 1200.50,
  "totalAnnual": 14406
}

Only include benefits the person likely qualifies for based on their answers. Be realistic with amounts. No markdown, no preamble, just JSON.`

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
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
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
