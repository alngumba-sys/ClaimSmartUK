export const RATES_2026 = {
  universalCredit: {
    singleUnder25: 338.58,
    single25Plus: 424.90,
    coupleUnder25: 528.34,
    couple25Plus: 666.97,
    childElement: 290.00,
    limitedCapacityWork: 390.06,
    housingEstimateNational: 650,
    housingEstimateLondon: 910,
    housingEstimateNorth: 480,
    workAllowanceNoHousing: 673,
    workAllowanceWithHousing: 344,
    taperRate: 0.55,
  },
  childBenefit: {
    firstChild: 110.93,
    additionalChild: 73.45,
    highIncomeChargeThreshold: 60000,
  },
  carersAllowance: {
    monthly: 354.90,
    weeklyHoursMin: 35,
    earningsLimitWeekly: 151,
  },
  pip: {
    dailyLivingStandard: 314.82,
    dailyLivingEnhanced: 470.05,
    mobilityStandard: 124.37,
    mobilityEnhanced: 328.25,
  },
  councilTaxReduction: {
    estimatedSavingPct: 0.75,
    avgMonthlyBill: 160,
  },
  freeSchoolMeals: { annualPerChild: 430, monthlyPerChild: 35.83 },
  healthyStart: { monthly: 36.83 },
  pensionCredit: { single: 944.98, couple: 1442.78 },
  attendanceAllowance: { lower: 314.82, higher: 470.05 },
}

export function formatGBP(amount) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}
