// netlify/functions/test-all-scenarios.js
const Anthropic = require('@anthropic-ai/sdk')

const TEST_SCENARIOS = [
  {
    name: 'Unemployed, under 25, renting, no children',
    answers: {
      situation: 'Unemployed',
      age: 'Under 25',
      housing: 'I rent privately',
      children: 'No children',
      income: 'Under £500',
      savings: 'Under £1,000',
      health: 'No health conditions',
    }
  },
  {
    name: 'Working full-time, 25-34, owns home, 2 kids',
    answers: {
      situation: 'Working full-time',
      age: '25 to 34',
      housing: 'Own with a mortgage',
      children: '2 children',
      income: '£1,500 to £2,500',
      savings: '£6,000 to £16,000',
      health: 'No health conditions',
    }
  },
  {
    name: 'Retired, 65+, health needs care',
    answers: {
      situation: 'Retired',
      age: '65 or over',
      housing: 'Council or housing association',
      children: 'No children',
      income: 'Under £500',
      savings: 'Under £1,000',
      health: 'Yes — need care from others',
    }
  },
  {
    name: 'Carer, unable to work, 1 child',
    answers: {
      situation: 'Carer for someone',
      age: '35 to 49',
      housing: 'I live with family or friends',
      children: '1 child',
      income: 'Under £500',
      savings: 'No savings',
      health: 'Yes — unable to work',
    }
  },
]

exports.handler = async () => {
  const results = []
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  for (const scenario of TEST_SCENARIOS) {
    try {
      const userMessage = Object.entries(scenario.answers)
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n')

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: `Calculate benefits for:\n${userMessage}` }],
        system: `Return ONLY valid JSON with benefits array, totalMonthly, totalAnnual. No markdown.`,
      })

      const text = msg.content[0]?.text || ''
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(clean)

      results.push({
        scenario: scenario.name,
        status: 'OK',
        totalMonthly: parsed.totalMonthly,
      })
    } catch (e) {
      results.push({
        scenario: scenario.name,
        status: 'FAILED',
        error: e.message,
      })
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      passed: results.filter(r => r.status === 'OK').length,
      failed: results.filter(r => r.status === 'FAILED').length,
      results 
    }, null, 2),
  }
}
