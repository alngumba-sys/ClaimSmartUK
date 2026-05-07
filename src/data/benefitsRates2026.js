/**
 * DWP 2026/27 benefit rates — frontend mirror of netlify/functions/rates.js.
 * Keep in sync each April. Next update due: April 2027.
 *
 * Source: GOV.UK official pages scraped April 2026 via refresh-rates.js.
 * Weekly rates converted to monthly using × 52/12.
 */
export const RATES_2026 = {
  universalCredit: {
    singleUnder25:               338.58,
    single25Plus:                424.90,
    coupleUnder25:               528.34,
    couple25Plus:                666.97,
    childElement:                303.94,   // per child/mo; 2-child limit removed April 2026
    limitedCapacityWork:         217.26,   // LCW — less severe / may improve
    limitedCapacityWorkActivity: 429.80,   // LCWRA — severe / unlikely to change
    // Per-region LHA midpoint estimates — keep in sync with rates.js
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
    workAllowanceWithHousing:    427,   // £/mo before taper if getting housing element
    workAllowanceNoHousing:      710,   // £/mo before taper if NOT getting housing element
    taperRate:                   0.55,
  },
  childBenefit: {
    firstChild:            117.22,   // £27.05/wk × 52/12
    additionalChild:        77.57,   // £17.90/wk × 52/12
    highIncomeChargeThreshold: 60000,
  },
  carersAllowance: {
    monthly:               374.62,   // £86.45/wk × 52/12
    weeklyHoursMin:            35,
    earningsLimitWeekly:      204,   // net after tax/NI/expenses
  },
  pip: {
    dailyLivingStandard:   332.37,   // £76.70/wk × 52/12
    dailyLivingEnhanced:   496.60,   // £114.60/wk × 52/12
    mobilityStandard:      131.30,   // £30.30/wk × 52/12
    mobilityEnhanced:      346.67,   // £80/wk × 52/12
  },
  councilTaxReduction: {
    estimatedSavingPct:    0.75,
    avgMonthlyBill:        160,
  },
  freeSchoolMeals: { annualPerChild: 430, monthlyPerChild: 35.83 },
  healthyStart:    { monthly: 36.83 },
  pensionCredit: {
    single:              1030.67,   // £238/wk × 52/12
    couple:              1573.75,   // £363.25/wk × 52/12
  },
  attendanceAllowance: {
    lower:               332.37,    // £76.70/wk × 52/12
    higher:              496.60,    // £114.60/wk × 52/12
  },
}

export function formatGBP(amount) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}
