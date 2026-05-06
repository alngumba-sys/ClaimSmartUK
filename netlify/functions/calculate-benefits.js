const Anthropic = require('@anthropic-ai/sdk')
const { RATES, buildSystemPrompt } = require('./rates')

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
  region: ['London', 'South East', 'South West', 'Midlands', 'North of England', 'Wales', 'Scotland', 'Northern Ireland'],
}

function validateAnswers(answers) {
  if (!answers || typeof answers !== 'object') return false
  for (const [key, validOptions] of Object.entries(VALID_ANSWERS)) {
    if (!validOptions.includes(answers[key])) return false
  }
  return true
}

// System prompt is generated from rates.js — single source of truth for all figures.
// Update rates.js each April; this prompt updates automatically.
const SYSTEM_PROMPT = buildSystemPrompt()

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
