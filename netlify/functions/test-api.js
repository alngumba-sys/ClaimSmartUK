// netlify/functions/test-api.js
// DELETE AFTER DEBUGGING
const Anthropic = require('@anthropic-ai/sdk')

exports.handler = async (event) => {
  const results = { steps: [] }

  // Step 1: Check if _utils loads
  try {
    const utils = require('./_utils')
    results.steps.push({ step: '_utils import', status: 'OK', exports: Object.keys(utils) })
  } catch (e) {
    results.steps.push({ step: '_utils import', status: 'FAILED', error: e.message })
  }

  // Step 2: Try rate limiting
  try {
    const { rateLimit, getIP } = require('./_utils')
    const ip = getIP(event)
    const rl = await rateLimit(ip, 'test')
    results.steps.push({ step: 'rateLimit', status: 'OK', result: rl })
  } catch (e) {
    results.steps.push({ step: 'rateLimit', status: 'FAILED', error: e.message })
  }

  // Step 3: Full calculate-benefits simulation
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const systemPrompt = `You are a UK benefits calculation engine. Return ONLY valid JSON with this structure:
{
  "benefits": [{"name":"Universal Credit","monthlyAmount":500,"annualAmount":6000,"likelihood":"high","explanation":"Test","howToClaim":["Step 1"],"urgency":"Claim this week","officialLink":"https://gov.uk/universal-credit"}],
  "totalMonthly": 500,
  "totalAnnual": 6000
}`

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 'Calculate benefits for: Employment: Unemployed, Age: 25 to 34, Housing: I rent privately, Children: No children, Monthly income: No income, Savings: Under £1,000, Health: No health conditions, Region: London' }],
      system: systemPrompt,
    })

    const text = msg.content[0]?.text || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)
    results.steps.push({
      step: 'full API call + parse',
      status: 'OK',
      benefitCount: parsed.benefits?.length,
      totalMonthly: parsed.totalMonthly,
    })
  } catch (e) {
    results.steps.push({
      step: 'full API call + parse',
      status: 'FAILED',
      error: e.message,
      name: e.name,
    })
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results, null, 2),
  }
}
