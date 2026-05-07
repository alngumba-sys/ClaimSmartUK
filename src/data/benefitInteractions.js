/**
 * benefitInteractions.js — benefit interaction warnings.
 *
 * Each rule fires when ALL of its `triggers` benefits appear in the result set.
 * `getInteractionWarnings(benefitNames)` returns an array of warning objects
 * ready to render in the UI and PDF.
 *
 * Rules are policy-based, not rate-based, so they don't need an April update.
 * Sources: DWP UC guidance, Citizens Advice, GOV.UK benefit interaction notes.
 */

export const INTERACTION_RULES = [
  // ── 1. Carer's Allowance + Universal Credit ─────────────────────────────
  // CA is classed as unearned income and deducted £-for-£ from UC.
  // Net financial gain from CA is often £0 when on UC, but CA still builds NI credits.
  {
    id: 'ca-uc',
    triggers: ["Carer's Allowance", 'Universal Credit'],
    severity: 'warning',   // amber
    headline: "Carer's Allowance reduces your Universal Credit",
    body:
      "Carer's Allowance is classed as unearned income and is deducted pound for pound " +
      "from your Universal Credit award. If you claim both, the CA amount (£374.62/mo) " +
      "will reduce your UC by the same figure — so your total income may not increase. " +
      "However, claiming CA still builds National Insurance credits which count toward " +
      "your State Pension. Speak to Citizens Advice before claiming to understand the " +
      "net impact for your circumstances.",
    link: 'https://www.citizensadvice.org.uk/benefits/universal-credit/before-you-apply-for-universal-credit/how-universal-credit-affects-other-benefits/',
    linkText: "Citizens Advice — how UC affects other benefits",
  },

  // ── 2. Pension Credit + Universal Credit ────────────────────────────────
  // These are entirely separate systems — PC for pension age, UC for working age.
  // If both appear it means age straddles the pension age boundary (unusual) or
  // it's a mixed-age couple. Either way, the person cannot claim both simultaneously.
  {
    id: 'pc-uc',
    triggers: ['Pension Credit', 'Universal Credit'],
    severity: 'warning',
    headline: 'Pension Credit and Universal Credit cannot be claimed at the same time',
    body:
      'Pension Credit and Universal Credit are separate systems for different age groups. ' +
      'You can only claim one — if you are over State Pension age (currently 66) you should ' +
      'claim Pension Credit; if you are under pension age, Universal Credit applies. ' +
      'The amounts shown above are individual estimates — your actual entitlement depends ' +
      'on which system applies to you.',
    link: 'https://www.gov.uk/pension-credit/eligibility',
    linkText: 'GOV.UK — Pension Credit eligibility',
  },

  // ── 3. PIP daily living + Carer's Allowance ─────────────────────────────
  // PIP is paid to the disabled person. CA is paid to the *carer*.
  // If both appear for the same person, one of two things is happening:
  // (a) the person has a disability AND cares for someone else — both are possible;
  // (b) Claude has confused the two roles.
  // Gentle note only — not an error, just worth flagging.
  {
    id: 'pip-ca',
    triggers: ['Personal Independence Payment', "Carer's Allowance"],
    severity: 'info',   // blue informational
    headline: 'PIP and Carer\'s Allowance serve different roles',
    body:
      "Personal Independence Payment is paid to you because of your own health condition. " +
      "Carer's Allowance is paid because you care for someone else who has a disability. " +
      "Both can be received at the same time if both apply — but note that receiving " +
      "Carer's Allowance may affect the 'severe disability premium' within other means-tested " +
      "benefits. Confirm your exact position with Citizens Advice.",
    link: 'https://www.citizensadvice.org.uk/benefits/sick-or-disabled-people-and-carers/',
    linkText: "Citizens Advice — disability and carers' benefits",
  },

  // ── 4. Attendance Allowance + Carer's Allowance ─────────────────────────
  // Same logic as PIP+CA — AA is for the disabled person, CA is for their carer.
  {
    id: 'aa-ca',
    triggers: ['Attendance Allowance', "Carer's Allowance"],
    severity: 'info',
    headline: 'Attendance Allowance and Carer\'s Allowance serve different roles',
    body:
      "Attendance Allowance is paid to you because of your own care needs (age 65+). " +
      "Carer's Allowance is paid because you provide care to someone else. " +
      "Both can apply to the same person if both conditions are met — but do confirm " +
      "with Citizens Advice, as receiving CA can reduce the Pension Credit 'severe disability' addition.",
    link: 'https://www.citizensadvice.org.uk/benefits/sick-or-disabled-people-and-carers/',
    linkText: "Citizens Advice — disability and carers' benefits",
  },
]

/**
 * Match rules against a set of benefit names returned by Claude.
 * Matching is case-insensitive and partial (so "PIP — daily living standard"
 * still matches a trigger of "Personal Independence Payment").
 *
 * @param {string[]} benefitNames — benefit.name values from the Claude response
 * @returns {Array<{id, severity, headline, body, link, linkText}>}
 */
export function getInteractionWarnings(benefitNames) {
  if (!benefitNames || benefitNames.length === 0) return []

  const normalised = benefitNames.map(n => n.toLowerCase())

  function matches(trigger) {
    const t = trigger.toLowerCase()
    return normalised.some(n => n.includes(t) || t.includes(n.split(' ')[0]))
  }

  return INTERACTION_RULES.filter(rule =>
    rule.triggers.every(trigger => matches(trigger))
  )
}
