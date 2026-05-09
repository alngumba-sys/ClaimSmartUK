const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')

// ── Benefit interaction rules ─────────────────────────────────────────────────
const INTERACTION_RULES = [
  {
    id: 'ca-uc',
    triggers: ["Carer's Allowance", 'Universal Credit'],
    severity: 'warning',
    headline: "Carer's Allowance reduces your Universal Credit",
    body: "Carer's Allowance is treated as unearned income and deducted pound for pound from your UC award. If you claim both, your total income may not increase. However, CA builds National Insurance credits. Speak to Citizens Advice before claiming both.",
  },
  {
    id: 'pc-uc',
    triggers: ['Pension Credit', 'Universal Credit'],
    severity: 'warning',
    headline: 'Pension Credit and Universal Credit cannot both be claimed',
    body: "These are separate systems — Pension Credit (pension age) and Universal Credit (working age) cannot be received at the same time. Claim whichever applies to your age.",
  },
  {
    id: 'pip-ca',
    triggers: ['Personal Independence Payment', "Carer's Allowance"],
    severity: 'info',
    headline: "PIP and Carer's Allowance serve different roles",
    body: "PIP is paid for your own health condition; CA is paid because you care for someone else. Both can be received at the same time if both conditions apply.",
  },
  {
    id: 'aa-ca',
    triggers: ['Attendance Allowance', "Carer's Allowance"],
    severity: 'info',
    headline: "Attendance Allowance and Carer's Allowance serve different roles",
    body: "Attendance Allowance is paid for your own care needs; CA is paid for caring for someone else. Both can apply, but receiving CA may reduce the severe disability addition in Pension Credit. Confirm with Citizens Advice.",
  },
]

function getInteractionWarnings(benefitNames) {
  if (!benefitNames || benefitNames.length === 0) return []
  const norm = benefitNames.map(n => n.toLowerCase())
  function matches(trigger) {
    const t = trigger.toLowerCase()
    return norm.some(n => n.includes(t) || t.includes(n.split(' ')[0]))
  }
  return INTERACTION_RULES.filter(r => r.triggers.every(t => matches(t)))
}

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  teal:       rgb(0.059, 0.431, 0.337),
  tealLight:  rgb(0.882, 0.961, 0.933),
  tealDark:   rgb(0.031, 0.314, 0.255),
  amber:      rgb(0.831, 0.588, 0.039),
  amberLight: rgb(0.980, 0.933, 0.855),
  redLight:   rgb(0.988, 0.922, 0.922),
  redDark:    rgb(0.640, 0.170, 0.170),
  greenLight: rgb(0.870, 0.950, 0.850),
  greenDark:  rgb(0.150, 0.470, 0.150),
  gray:       rgb(0.420, 0.420, 0.420),
  grayLight:  rgb(0.960, 0.960, 0.960),
  grayBorder: rgb(0.850, 0.850, 0.850),
  black:      rgb(0.170, 0.170, 0.160),
  white:      rgb(1, 1, 1),
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_W   = 595
const PAGE_H   = 842
const MARGIN   = 44
const CONTENT_W = PAGE_W - MARGIN * 2
const HEADER_H  = 56
const FOOTER_H  = 32  // reserved at bottom
const TOP_Y     = PAGE_H - HEADER_H - 16   // first content y on each page
const BOTTOM_Y  = FOOTER_H + 8             // last usable y

// ── Text wrapping helper ───────────────────────────────────────────────────────
// Returns estimated height in points for text at given fontSize in given width.
// pdf-lib wraps automatically but doesn't tell us the height — we estimate it.
function estimateTextHeight(text, fontSize, maxWidth, font) {
  // Rough character width for Helvetica at 1pt ≈ 0.55 * fontSize
  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.52))
  const words = text.split(' ')
  let lines = 1
  let lineLen = 0
  for (const word of words) {
    if (lineLen + word.length + 1 > charsPerLine && lineLen > 0) {
      lines++
      lineLen = word.length
    } else {
      lineLen += word.length + 1
    }
  }
  return lines * (fontSize + 3)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { benefits = [], totalMonthly = 0, totalAnnual = 0 } = JSON.parse(event.body)
    const interactions = getInteractionWarnings(benefits.map(b => b.name))

    const pdfDoc  = await PDFDocument.create()
    const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // ── Layout engine ──────────────────────────────────────────────────────────
    // Tracks current page and y position. Automatically adds new pages.
    let page = null
    let y    = 0

    function newPage() {
      page = pdfDoc.addPage([PAGE_W, PAGE_H])

      // Header band
      page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C.teal })
      page.drawText('ClaimSmart UK', { x: MARGIN, y: PAGE_H - 36, size: 15, font: fontBold, color: C.white })

      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      const refNum  = 'CS-' + Math.floor(100000 + Math.random() * 900000)
      page.drawText(`${dateStr}  ·  Ref: ${refNum}`, {
        x: PAGE_W - MARGIN - 185, y: PAGE_H - 36, size: 8, font, color: rgb(0.62, 0.88, 0.75),
      })

      // Footer line
      page.drawLine({
        start: { x: MARGIN, y: FOOTER_H },
        end:   { x: PAGE_W - MARGIN, y: FOOTER_H },
        thickness: 0.5, color: C.grayBorder,
      })
      page.drawText(
        'Results are estimates only, based on DWP rates April 2026/27. ' +
        'Always confirm entitlement with DWP (0800 328 5644) or Citizens Advice (0800 144 8848). ' +
        'ClaimSmart UK is not a benefits adviser or financial adviser.',
        { x: MARGIN, y: FOOTER_H - 14, size: 6.5, font, color: C.gray, maxWidth: CONTENT_W }
      )

      y = TOP_Y
    }

    // Ensure there is space for `needed` points; add page if not
    function ensureSpace(needed) {
      if (!page || y - needed < BOTTOM_Y) newPage()
    }

    function gap(pt) { y -= pt }

    function sectionHeading(text) {
      ensureSpace(24)
      page.drawText(text, { x: MARGIN, y, size: 8, font: fontBold, color: C.gray })
      gap(16)
    }

    function drawWrappedText(text, { x = MARGIN, size = 9, color = C.black, bold = false, indent = 0, extraLineGap = 0 } = {}) {
      const f     = bold ? fontBold : font
      const mw    = CONTENT_W - (x - MARGIN) - indent
      const h     = estimateTextHeight(text, size, mw, f)
      ensureSpace(h + 4)
      page.drawText(text, { x: x + indent, y, size, font: f, color, maxWidth: mw, lineHeight: size + 3 })
      gap(h + extraLineGap)
    }

    // ── PAGE 1 ─────────────────────────────────────────────────────────────────
    newPage()

    // ── Hero band ──────────────────────────────────────────────────────────────
    const HERO_H = 78
    page.drawRectangle({ x: 0, y: y - HERO_H, width: PAGE_W, height: HERO_H, color: C.tealLight })
    page.drawText('Based on your answers, you may be missing:', {
      x: MARGIN, y: y - 16, size: 10, font, color: C.tealDark,
    })
    page.drawText(`£${Math.round(totalMonthly).toLocaleString()} / month`, {
      x: MARGIN, y: y - 44, size: 26, font: fontBold, color: C.teal,
    })
    page.drawText(`Up to £${Math.round(totalAnnual).toLocaleString()} per year`, {
      x: MARGIN, y: y - 64, size: 10, font, color: C.tealDark,
    })
    gap(HERO_H + 12)

    // ── Unclaimed alert box ────────────────────────────────────────────────────
    const alertText = `Unclaimed alert: Based on your answers you may be missing up to £${Math.round(totalAnnual).toLocaleString()} per year in benefits you are entitled to.`
    const alertH = estimateTextHeight(alertText, 9, CONTENT_W - 20, fontBold) + 16
    ensureSpace(alertH)
    page.drawRectangle({ x: MARGIN, y: y - alertH, width: CONTENT_W, height: alertH, color: C.redLight, borderColor: rgb(0.9, 0.7, 0.7), borderWidth: 0.5 })
    page.drawText(alertText, { x: MARGIN + 10, y: y - 13, size: 9, font: fontBold, color: C.redDark, maxWidth: CONTENT_W - 20, lineHeight: 12 })
    gap(alertH + 14)

    // ── Benefits breakdown ─────────────────────────────────────────────────────
    sectionHeading('YOUR BENEFITS BREAKDOWN')

    for (const benefit of benefits) {
      const name        = benefit.name || ''
      const amount      = `£${Number(benefit.monthlyAmount || 0).toFixed(2)}/month`
      const likelihood  = benefit.likelihood || 'medium'
      const explanation = benefit.explanation || ''
      const urgency     = benefit.urgency || ''

      // Estimate total card height
      const explanationH = estimateTextHeight(explanation, 8.5, CONTENT_W - 24, font)
      const cardH        = 14 + 14 + 16 + explanationH + 14 + 16  // name + badge + gap + explanation + urgency + padding

      ensureSpace(cardH + 8)

      const cardTop = y
      page.drawRectangle({
        x: MARGIN, y: y - cardH, width: CONTENT_W, height: cardH,
        color: C.grayLight, borderColor: C.grayBorder, borderWidth: 0.5,
      })

      // Benefit name
      page.drawText(name, { x: MARGIN + 10, y: y - 14, size: 11, font: fontBold, color: C.black })

      // Amount — right aligned
      const amtWidth = amount.length * 6.2  // rough estimate
      page.drawText(amount, { x: MARGIN + CONTENT_W - amtWidth - 10, y: y - 14, size: 11, font: fontBold, color: C.teal })

      // Likelihood badge
      const badgeBg   = likelihood === 'high' ? C.greenLight : C.amberLight
      const badgeTxt  = likelihood === 'high' ? C.greenDark  : C.amber
      const badgeLabel = likelihood === 'high' ? 'High likelihood' : 'Worth checking'
      const badgeW    = 76
      page.drawRectangle({ x: MARGIN + 10, y: y - 32, width: badgeW, height: 13, color: badgeBg })
      page.drawText(badgeLabel, { x: MARGIN + 14, y: y - 29, size: 7.5, font, color: badgeTxt })

      // Explanation
      const exY = y - 50
      page.drawText(explanation, {
        x: MARGIN + 10, y: exY, size: 8.5, font, color: C.gray,
        maxWidth: CONTENT_W - 24, lineHeight: 11.5,
      })

      // Urgency
      const urgencyY = y - cardH + 12
      page.drawText(urgency, { x: MARGIN + 10, y: urgencyY, size: 8, font: fontBold, color: C.teal })

      gap(cardH + 10)
    }

    // ── PAGE 2 ─────────────────────────────────────────────────────────────────
    newPage()

    // ── Action plan ────────────────────────────────────────────────────────────
    sectionHeading('YOUR ACTION PLAN — DO THIS WEEK')

    const urgentBenefits = benefits.filter(b => b.urgency === 'Claim this week').slice(0, 3)
    const actionBenefits = urgentBenefits.length > 0 ? urgentBenefits : benefits.slice(0, 3)

    actionBenefits.forEach((benefit, i) => {
      const lineText = `Claim ${benefit.name} — worth £${Number(benefit.monthlyAmount).toFixed(2)}/month`
      const subText  = benefit.howToClaim?.[0] || ''
      ensureSpace(40)

      // Circle
      page.drawCircle({ x: MARGIN + 9, y: y - 6, size: 9, color: C.teal })
      page.drawText(String(i + 1), { x: MARGIN + 6, y: y - 9.5, size: 8.5, font: fontBold, color: C.white })

      page.drawText(lineText, { x: MARGIN + 26, y, size: 10, font: fontBold, color: C.black, maxWidth: CONTENT_W - 30 })
      gap(14)
      if (subText) {
        page.drawText(subText, { x: MARGIN + 26, y, size: 8.5, font, color: C.gray, maxWidth: CONTENT_W - 30 })
        gap(20)
      } else {
        gap(8)
      }
    })

    gap(12)

    // ── How to claim step by step ──────────────────────────────────────────────
    sectionHeading('HOW TO CLAIM — STEP BY STEP')

    for (const benefit of benefits) {
      const steps = benefit.howToClaim || []
      if (steps.length === 0) continue

      const totalStepH = steps.reduce((sum, s) => sum + estimateTextHeight(s, 8.5, CONTENT_W - 30, font) + 4, 0)
      ensureSpace(16 + totalStepH + 10)

      page.drawText(benefit.name, { x: MARGIN, y, size: 10, font: fontBold, color: C.tealDark })
      gap(14)

      steps.forEach((step, i) => {
        const stepH = estimateTextHeight(step, 8.5, CONTENT_W - 30, font) + 4
        ensureSpace(stepH)
        page.drawText(`${i + 1}.`, { x: MARGIN + 6, y, size: 8.5, font: fontBold, color: C.teal })
        page.drawText(step, { x: MARGIN + 18, y, size: 8.5, font, color: C.black, maxWidth: CONTENT_W - 22, lineHeight: 12 })
        gap(stepH)
      })
      gap(10)
    }

    gap(8)

    // ── Benefit interaction warnings ───────────────────────────────────────────
    if (interactions.length > 0) {
      sectionHeading('IMPORTANT — BENEFIT INTERACTIONS')

      for (const w of interactions) {
        const bodyH   = estimateTextHeight(w.body, 8, CONTENT_W - 24, font)
        const boxH    = 14 + 4 + bodyH + 14
        ensureSpace(boxH + 8)

        const boxBg  = w.severity === 'warning' ? rgb(1.0, 0.97, 0.88) : rgb(0.94, 0.97, 1.0)
        const boxBdr = w.severity === 'warning' ? rgb(0.98, 0.75, 0.15) : rgb(0.75, 0.86, 1.0)
        const hCol   = w.severity === 'warning' ? rgb(0.58, 0.25, 0.0) : rgb(0.12, 0.25, 0.68)

        page.drawRectangle({ x: MARGIN, y: y - boxH, width: CONTENT_W, height: boxH, color: boxBg, borderColor: boxBdr, borderWidth: 0.75 })
        page.drawText(w.severity === 'warning' ? '! ' : 'i ', { x: MARGIN + 8, y: y - 13, size: 9, font: fontBold, color: hCol })
        page.drawText(w.headline, { x: MARGIN + 20, y: y - 13, size: 9, font: fontBold, color: hCol, maxWidth: CONTENT_W - 28 })
        page.drawText(w.body, { x: MARGIN + 8, y: y - 28, size: 8, font, color: C.black, maxWidth: CONTENT_W - 16, lineHeight: 11 })
        gap(boxH + 8)
      }

      gap(8)
    }

    // ── What to have ready ────────────────────────────────────────────────────
    sectionHeading('WHAT TO HAVE READY')

    const docs = [
      'National Insurance number',
      'Bank account details (sort code and account number)',
      'Details of any current benefits you already receive',
      'Birth certificates for any children',
      'Proof of rent or mortgage payments',
      'Last 3 months bank statements',
      'Any medical letters or evidence if claiming health-related benefits',
    ]

    for (const doc of docs) {
      ensureSpace(14)
      page.drawText(`•  ${doc}`, { x: MARGIN + 8, y, size: 9, font, color: C.black })
      gap(14)
    }

    gap(12)

    // ── Useful contacts ────────────────────────────────────────────────────────
    sectionHeading('USEFUL CONTACTS')

    const contacts = [
      ['Universal Credit helpline', '0800 328 5644', 'Mon–Fri 8am–6pm'],
      ['Citizens Advice',           '0800 144 8848', 'Free advice and support'],
      ['Turn2us helpline',          '0808 802 2000', 'Benefits calculator and grants'],
      ['GOV.UK',                    'gov.uk/browse/benefits', 'Official benefit information'],
    ]

    for (const [name, number, hours] of contacts) {
      ensureSpace(14)
      page.drawText(`${name}:`, { x: MARGIN + 6, y, size: 9, font: fontBold, color: C.black })
      page.drawText(`${number}  ·  ${hours}`, { x: MARGIN + 130, y, size: 9, font, color: C.gray })
      gap(14)
    }

    // ── Serialise ─────────────────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save()
    const base64   = Buffer.from(pdfBytes).toString('base64')

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: base64 }),
    }
  } catch (error) {
    console.error('PDF generation error:', error)
    console.error('PDF generation detail:', String(error))
    return { statusCode: 500, body: JSON.stringify({ error: 'PDF generation failed' }) }
  }
}
