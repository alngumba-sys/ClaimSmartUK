const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a UK benefits eligibility expert with complete knowledge of DWP 2026/27 rules.
Respond ONLY with a valid JSON array. No preamble, no markdown fences, no explanation. Raw JSON only.

Each benefit object must have exactly these fields:
{
  "name": "string — benefit name",
  "monthlyAmount": number (pounds, 2dp),
  "annualAmount": number (pounds, 2dp),
  "likelihood": "high" or "medium" or "possible",
  "explanation": "string — 1 sentence plain English why they qualify",
  "howToClaim": ["step 1", "step 2", "step 3"],
  "urgency": "Claim this week" or "Claim this month" or "Worth checking",
  "officialLink": "https://www.gov.uk/..."
}

Use these exact 2026/27 rates:
Universal Credit: £338.58/mo (single under 25), £424.90/mo (single 25+), £666.97/mo (couple 25+)
UC child element: £290.00/mo per child (2-child limit removed April 2026)
UC housing element: London £910/mo estimate, national average £650/mo, North £480/mo
UC limited capacity for work element: £390.06/mo additional
Child Benefit: £110.93/mo first child, £73.45/mo additional children
Carer's Allowance: £354.90/mo (must care 35+ hrs/week for someone receiving PIP/DLA/AA)
PIP daily living standard: £314.82/mo, enhanced: £470.05/mo
PIP mobility standard: £124.37/mo, enhanced: £328.25/mo
Council Tax Reduction: estimate 75% of £160/mo average = £120/mo saving
Free School Meals: £35.83/mo per child (if on UC or low income)
Healthy Start: £36.83/mo (if pregnant or child under 4, on UC/low income)
Pension Credit: £944.98/mo single, £1442.78/mo couple (for those over state pension age)
Attendance Allowance: £314.82/mo lower, £470.05/mo higher (age 65+, needs care)

Rules:
- Always include Child Benefit if they have children (unless income over £80k — not stated means include it)
- Always include Council Tax Reduction if income under £1,500/mo
- Never include pension-age benefits if under 65
- Return 4-8 benefits total
- Mark all results as estimates`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { answers } = JSON.parse(event.body)

    const userMessage = `Circumstances:
- Employment status: ${answers.situation}
- Age group: ${answers.age}
- Housing: ${answers.housing}
- Children: ${answers.children}
- Monthly income (after tax): ${answers.income}
- Savings: ${answers.savings}
- Health: ${answers.health}
- Region: ${answers.region}

Calculate all UK benefits this person likely qualifies for based on these circumstances.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const responseText = message.content[0].text.trim()
    const benefits = JSON.parse(responseText)

    const totalMonthly = benefits.reduce((sum, b) => sum + (b.monthlyAmount || 0), 0)
    const totalAnnual = benefits.reduce((sum, b) => sum + (b.annualAmount || 0), 0)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benefits, totalMonthly, totalAnnual }),
    }
  } catch (error) {
    console.error('Calculate benefits error:', error)

    // Fallback response if Claude API fails
    const fallback = [
      {
        name: 'Universal Credit',
        monthlyAmount: 424.90,
        annualAmount: 5098.80,
        likelihood: 'high',
        explanation: 'Based on your income level you may qualify for Universal Credit support.',
        howToClaim: ['Visit gov.uk/universal-credit', 'Click "Start now" to begin your application', 'Have your NI number and bank details ready'],
        urgency: 'Claim this week',
        officialLink: 'https://www.gov.uk/universal-credit',
      },
      {
        name: 'Council Tax Reduction',
        monthlyAmount: 120,
        annualAmount: 1440,
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
