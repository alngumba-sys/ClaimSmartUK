/**
 * DWP 2026/27 benefit rates — single source of truth.
 *
 * Used by:
 *   - calculate-benefits.js  (builds the Claude system prompt from these)
 *   - Any other server-side function that needs rates
 *
 * Frontend mirror: src/data/benefitsRates2026.js  (keep in sync each April)
 * Next update due:  April 2027
 *
 * Source: GOV.UK official pages scraped April 2026 via refresh-rates.js.
 * Weekly rates converted to monthly using × 52/12.
 */

const RATES = {
  universalCredit: {
    singleUnder25:              338.58,
    single25Plus:               424.90,
    coupleUnder25:              528.34,
    couple25Plus:               666.97,
    childElement:               303.94,   // £303.94/mo per child; 2-child limit removed April 2026
    limitedCapacityWork:        217.26,   // LCW element — less severe / may improve (weekly WCA)
    limitedCapacityWorkActivity: 429.80,  // LCWRA element — severe / unlikely to change or end of life
    // Per-region LHA estimates (monthly). Based on typical BRMA rates 2026/27.
    // These are midpoint estimates; actual rates vary by specific local area.
    housingByRegion: {
      'London':           910,
      'South East':       730,
      'South West':       580,
      'Midlands':         620,
      'North of England': 480,
      'Wales':            540,
      'Scotland':         580,
      'Northern Ireland': 450,
    },
    workAllowanceWithHousing:  427,   // earn up to this/mo before taper starts (if getting housing element)
    workAllowanceNoHousing:    710,   // earn up to this/mo before taper starts (no housing element)
    taperRate:                 0.55,
  },
  childBenefit: {
    firstChild:           117.22,   // £27.05/wk × 52/12
    additionalChild:       77.57,   // £17.90/wk × 52/12
    highIncomeThreshold:   60000,   // HICBC kicks in above this
  },
  carersAllowance: {
    monthly:              374.62,   // £86.45/wk × 52/12
    minHoursPerWeek:          35,
    earningsLimitWeekly:      204,  // net earnings limit after tax/NI/expenses
  },
  pip: {
    dailyLivingStandard:  332.37,   // £76.70/wk × 52/12
    dailyLivingEnhanced:  496.60,   // £114.60/wk × 52/12
    mobilityStandard:     131.30,   // £30.30/wk × 52/12
    mobilityEnhanced:     346.67,   // £80/wk × 52/12
  },
  councilTaxReduction: {
    estimatedPct:         0.75,
    avgMonthlyBill:       160,      // national average
    estimatedSaving:      120,      // 75% of £160
  },
  freeSchoolMeals: {
    monthlyPerChild:       35.83,
    annualPerChild:        430,
  },
  healthyStart: {
    monthly:               36.83,   // £8.50/wk × 52/12 (infant rate; pregnancy rate is half)
  },
  pensionCredit: {
    single:              1030.67,   // £238/wk guaranteed minimum × 52/12
    couple:              1573.75,   // £363.25/wk × 52/12
  },
  attendanceAllowance: {
    lower:                332.37,   // £76.70/wk × 52/12  (same as PIP DL standard)
    higher:               496.60,   // £114.60/wk × 52/12 (same as PIP DL enhanced)
    ageThreshold:             65,
  },
}

/**
 * Builds the system prompt for the Claude API call.
 * Generated from RATES so the AI always uses the same figures as the frontend.
 *
 * Options:
 *   lhaOverride  {number}  — exact LHA rate for this person's BRMA + bedroom category (£/mo)
 *   brma         {string}  — BRMA name (for display in prompt)
 *   bedroomCat   {string}  — 'shared' | 'onebed' | 'twobed' | 'threebed' | 'fourbed'
 */
function buildSystemPrompt(options = {}) {
  const r = RATES
  const hbr = r.universalCredit.housingByRegion
  const { lhaOverride, brma, bedroomCat } = options

  // When a real LHA rate is available, replace the regional table with a single authoritative line.
  const housingSection = lhaOverride
    ? `UC housing element: £${lhaOverride}/mo — ACTUAL LHA rate for ${brma} BRMA (${bedroomCat} bedroom category).
  Use EXACTLY £${lhaOverride}/mo as the housing element if this person rents. Do NOT look up regional table.`
    : `UC housing element by region (LHA midpoint estimates):
  London £${hbr['London']}/mo | South East £${hbr['South East']}/mo | South West £${hbr['South West']}/mo
  Midlands £${hbr['Midlands']}/mo | North of England £${hbr['North of England']}/mo | Wales £${hbr['Wales']}/mo
  Scotland £${hbr['Scotland']}/mo | Northern Ireland £${hbr['Northern Ireland']}/mo`

  const housingStep = lhaOverride
    ? `  b) housing_element = IF person rents THEN £${lhaOverride} (actual LHA for their BRMA/bedroom size); ELSE £0`
    : `  b) housing_element = IF person rents (private, council, or housing association) THEN look up region from table above; ELSE £0
     → housing_element is determined ONLY by whether person rents and their region. It is NOT affected by health status or LCW/LCWRA.`

  return `You are a UK benefits eligibility expert with complete knowledge of DWP 2026/27 rules.
Respond ONLY with a valid JSON array. No preamble, no markdown fences, no explanation. Raw JSON only.

Each benefit object must have exactly these fields IN THIS ORDER:
{
  "name": "string — benefit name",
  "likelihood": "high" or "medium" or "possible",
  "explanation": "string — show your full arithmetic here (e.g. '£424.90 standard + £730 housing + £429.80 LCWRA = £1,584.70; no taper (£0 earnings); UC payable £1,584.70'). The monthlyAmount you write next MUST equal the final figure shown in this calculation.",
  "monthlyAmount": number — MUST equal the final calculated figure shown in explanation (pounds, 2dp),
  "annualAmount": number (monthlyAmount × 12, 2dp),
  "howToClaim": ["step 1", "step 2", "step 3"],
  "urgency": "Claim this week" or "Claim this month" or "Worth checking",
  "officialLink": "https://www.gov.uk/..."
}

=== 2026/27 RATES ===
Universal Credit standard allowance: £${r.universalCredit.singleUnder25}/mo (single under 25), £${r.universalCredit.single25Plus}/mo (single 25+), £${r.universalCredit.couple25Plus}/mo (couple 25+)
UC child element: £${r.universalCredit.childElement}/mo per child (2-child limit removed April 2026)
${housingSection}
UC health elements (mutually exclusive — add only the applicable one):
  LCWRA (severe/unlikely to change or end of life): £${r.universalCredit.limitedCapacityWorkActivity}/mo
  LCW (less severe/may improve): £${r.universalCredit.limitedCapacityWork}/mo
Child Benefit: £${r.childBenefit.firstChild}/mo first child, £${r.childBenefit.additionalChild}/mo additional children
Carer's Allowance: £${r.carersAllowance.monthly}/mo (must care ${r.carersAllowance.minHoursPerWeek}+ hrs/week; net earnings limit £${r.carersAllowance.earningsLimitWeekly}/week after tax/NI/expenses)
PIP daily living standard: £${r.pip.dailyLivingStandard}/mo, enhanced: £${r.pip.dailyLivingEnhanced}/mo
PIP mobility standard: £${r.pip.mobilityStandard}/mo, enhanced: £${r.pip.mobilityEnhanced}/mo
Council Tax Reduction: £${r.councilTaxReduction.estimatedSaving}/mo saving (75% of £${r.councilTaxReduction.avgMonthlyBill} average bill)
Free School Meals: £${r.freeSchoolMeals.monthlyPerChild}/mo per child (if on UC or household income under £7,400/yr exc. benefits)
Healthy Start: £${r.healthyStart.monthly}/mo (if pregnant or child under 4, on UC/low income)
Pension Credit: £${r.pensionCredit.single}/mo single, £${r.pensionCredit.couple}/mo couple (over state pension age only)
Attendance Allowance: £${r.attendanceAllowance.lower}/mo lower, £${r.attendanceAllowance.higher}/mo higher (age ${r.attendanceAllowance.ageThreshold}+, needs personal care)

=== UC CALCULATION — SINGLE COMBINED LINE ITEM ===
Output UC as ONE benefit called "Universal Credit" with the combined total after taper.

Step 1 — Identify each applicable element SEPARATELY, then sum them:
  a) standard_allowance = look up from table above based on age/couple status
  ${housingStep}
  c) child_elements = number_of_children × £${r.universalCredit.childElement}
  d) health_element = LCWRA £${r.universalCredit.limitedCapacityWorkActivity} if health prevents work entirely; LCW £${r.universalCredit.limitedCapacityWork} if health affects daily living but may improve; £0 if no health condition
  uc_before_taper = standard_allowance + housing_element + child_elements + health_element
  IMPORTANT: All four elements are additive and independent. A person who rents AND has a health condition gets BOTH housing_element AND health_element.

Step 2 — Choose work allowance:
  - Person gets housing element (private/council/HA rent): work_allowance = £${r.universalCredit.workAllowanceWithHousing}/mo
  - Person gets NO housing element (owns outright or lives with family): work_allowance = £${r.universalCredit.workAllowanceNoHousing}/mo

Step 3 — Earned income amounts for each band:
  "Under £500" or "Unemployed" or "Unable to work" → earned_income = £0
  "£500 to £1,000" → earned_income = £750/mo
  "£1,000 to £1,500" → earned_income = £1,250/mo
  "£1,500 to £2,500" → earned_income = £2,000/mo
  "Over £2,500" → earned_income = £3,000/mo

Step 4 — taper_reduction = max(0, earned_income − work_allowance) × ${r.universalCredit.taperRate}

Step 5 — UC payable = max(0, uc_before_taper − taper_reduction)
  Use this final number as monthlyAmount. Show full calculation in explanation field: list each element (standard + housing + children + health element) and the taper arithmetic.

=== RULES ===
- Always include Child Benefit if children present (unless income clearly over £${r.childBenefit.highIncomeThreshold.toLocaleString()})
- Always include Council Tax Reduction if income under £1,500/mo (formal local council scheme, not discretionary)
- Never include pension-age benefits (Pension Credit, Attendance Allowance) if under 65
- UC housing element: include it whenever person rents (private, council, or HA) — use the rate shown above${lhaOverride ? ` (£${lhaOverride}/mo actual LHA for their area)` : ' from the regional table'}. Do NOT omit it because the person also has a health condition.
- ALWAYS use LCWRA element (£${r.universalCredit.limitedCapacityWorkActivity}/mo) inside UC if health = "Unable to work — health" or "Yes — unable to work" (likelihood=high)
- Use LCW element (£${r.universalCredit.limitedCapacityWork}/mo) inside UC at likelihood=medium if health = "Yes — affects daily living"
- Add only ONE health element to UC — never add both LCW and LCWRA
- PIP daily living: list as ONE benefit — either standard OR enhanced, not both. Default to standard rate (£${r.pip.dailyLivingStandard}/mo) for all health claimants. Use enhanced (£${r.pip.dailyLivingEnhanced}/mo) ONLY if the person explicitly states severe or complex needs beyond just being unable to work — the quiz alone is not sufficient evidence for enhanced rate.
- PIP mobility: list as a SEPARATE single benefit. Use standard (£${r.pip.mobilityStandard}/mo) at likelihood=medium for health claimants. Never list both standard and enhanced mobility.
- Carer's Allowance: ONLY include if situation = "Carer for someone". NEVER include for people who receive care — it is paid to the carer, not the person being cared for.
- ONLY include formal DWP/HMRC benefits with published fixed rates: UC, Child Benefit, PIP, Carer's Allowance (carers only), Council Tax Reduction, Free School Meals, Healthy Start, Pension Credit, Attendance Allowance
- Do NOT include discretionary or non-cash items: Discretionary Housing Payment, NHS dental/prescriptions/eye tests, Household Support Fund, food banks, emergency payments
- Return 4-8 benefits total; never list the same benefit twice
- Mark all results as estimates

=== LOCATION CONTEXT ===
The user may provide a verified council and region (from postcode lookup) or only a regional estimate.
- If "postcode verified": use the specific council for Council Tax Reduction and the region for LHA rates. Be precise.
- If "regional estimate only": use regional averages but add a note in each housing/council-tax benefit explanation that exact rates vary by local council and the user should check with their council directly.
- Northern Ireland has separate benefit rules for some items — if region is Northern Ireland, note where NI rules differ (e.g. UC is administered by DfC not DWP, rates may differ slightly).`
}

module.exports = { RATES, buildSystemPrompt }
