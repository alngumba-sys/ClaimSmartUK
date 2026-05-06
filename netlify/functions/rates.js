/**
 * DWP 2026/27 benefit rates — single source of truth.
 *
 * Used by:
 *   - calculate-benefits.js  (builds the Claude system prompt from these)
 *   - Any other server-side function that needs rates
 *
 * Frontend mirror: src/data/benefitsRates2026.js  (keep in sync each April)
 * Next update due:  April 2027
 */

const RATES = {
  universalCredit: {
    singleUnder25:        338.58,
    single25Plus:         424.90,
    coupleUnder25:        528.34,
    couple25Plus:         666.97,
    childElement:         290.00,   // 2-child limit removed April 2026
    limitedCapacityWork:  390.06,
    housingLondon:        910,
    housingNational:      650,
    housingNorth:         480,
    workAllowanceNoHousing: 673,
    workAllowanceWithHousing: 344,
    taperRate:            0.55,
  },
  childBenefit: {
    firstChild:           110.93,
    additionalChild:      73.45,
    highIncomeThreshold:  60000,    // HICBC kicks in above this
  },
  carersAllowance: {
    monthly:              354.90,
    minHoursPerWeek:      35,
    earningsLimitWeekly:  151,
  },
  pip: {
    dailyLivingStandard:  314.82,
    dailyLivingEnhanced:  470.05,
    mobilityStandard:     124.37,
    mobilityEnhanced:     328.25,
  },
  councilTaxReduction: {
    estimatedPct:         0.75,
    avgMonthlyBill:       160,      // national average
    estimatedSaving:      120,      // 75% of £160
  },
  freeSchoolMeals: {
    monthlyPerChild:      35.83,
    annualPerChild:       430,
  },
  healthyStart: {
    monthly:              36.83,
  },
  pensionCredit: {
    single:               944.98,
    couple:               1442.78,
  },
  attendanceAllowance: {
    lower:                314.82,
    higher:               470.05,
    ageThreshold:         65,
  },
}

/**
 * Builds the system prompt for the Claude API call.
 * Generated from RATES so the AI always uses the same figures as the frontend.
 */
function buildSystemPrompt() {
  const r = RATES
  return `You are a UK benefits eligibility expert with complete knowledge of DWP 2026/27 rules.
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
Universal Credit: £${r.universalCredit.singleUnder25}/mo (single under 25), £${r.universalCredit.single25Plus}/mo (single 25+), £${r.universalCredit.couple25Plus}/mo (couple 25+)
UC child element: £${r.universalCredit.childElement}/mo per child (2-child limit removed April 2026)
UC housing element: London £${r.universalCredit.housingLondon}/mo estimate, national average £${r.universalCredit.housingNational}/mo, North £${r.universalCredit.housingNorth}/mo
UC limited capacity for work element: £${r.universalCredit.limitedCapacityWork}/mo additional
Child Benefit: £${r.childBenefit.firstChild}/mo first child, £${r.childBenefit.additionalChild}/mo additional children
Carer's Allowance: £${r.carersAllowance.monthly}/mo (must care ${r.carersAllowance.minHoursPerWeek}+ hrs/week for someone receiving PIP/DLA/AA; earnings limit £${r.carersAllowance.earningsLimitWeekly}/week)
PIP daily living standard: £${r.pip.dailyLivingStandard}/mo, enhanced: £${r.pip.dailyLivingEnhanced}/mo
PIP mobility standard: £${r.pip.mobilityStandard}/mo, enhanced: £${r.pip.mobilityEnhanced}/mo
Council Tax Reduction: estimate ${r.councilTaxReduction.estimatedPct * 100}% of £${r.councilTaxReduction.avgMonthlyBill}/mo average = £${r.councilTaxReduction.estimatedSaving}/mo saving
Free School Meals: £${r.freeSchoolMeals.monthlyPerChild}/mo per child (if on UC or low income)
Healthy Start: £${r.healthyStart.monthly}/mo (if pregnant or child under 4, on UC/low income)
Pension Credit: £${r.pensionCredit.single}/mo single, £${r.pensionCredit.couple}/mo couple (for those over state pension age)
Attendance Allowance: £${r.attendanceAllowance.lower}/mo lower, £${r.attendanceAllowance.higher}/mo higher (age ${r.attendanceAllowance.ageThreshold}+, needs care)

Rules:
- Always include Child Benefit if they have children (unless income clearly over £${r.childBenefit.highIncomeThreshold.toLocaleString()} — not stated means include it)
- Always include Council Tax Reduction if income under £1,500/mo
- Never include pension-age benefits if under 65
- Return 4-8 benefits total
- Mark all results as estimates`
}

module.exports = { RATES, buildSystemPrompt }
