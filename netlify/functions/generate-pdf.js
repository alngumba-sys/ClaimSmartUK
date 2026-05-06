const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')

const TEAL = rgb(0.059, 0.431, 0.337)       // #0F6E56
const TEAL_LIGHT = rgb(0.882, 0.961, 0.933) // #E1F5EE
const TEAL_DARK = rgb(0.031, 0.314, 0.255)  // #085041
const RED_LIGHT = rgb(0.988, 0.922, 0.922)  // #FCEBEB
const AMBER_LIGHT = rgb(0.98, 0.933, 0.855) // #FAEEDA
const GRAY = rgb(0.4, 0.4, 0.4)
const BLACK = rgb(0.17, 0.17, 0.16)
const WHITE = rgb(1, 1, 1)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { benefits, totalMonthly, totalAnnual, userEmail } = JSON.parse(event.body)

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const PAGE_W = 595  // A4 width in points
    const PAGE_H = 842  // A4 height in points
    const MARGIN = 40
    const CONTENT_W = PAGE_W - (MARGIN * 2)

    function addPage() {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H])

      // Teal header band
      page.drawRectangle({ x: 0, y: PAGE_H - 60, width: PAGE_W, height: 60, color: TEAL })

      // Header text
      page.drawText('ClaimSmart UK', {
        x: MARGIN, y: PAGE_H - 38,
        size: 16, font: fontBold, color: WHITE,
      })

      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      const refNum = 'CS-' + Math.floor(100000 + Math.random() * 900000)
      page.drawText(`${dateStr}  ·  Ref: ${refNum}`, {
        x: PAGE_W - MARGIN - 200, y: PAGE_H - 38,
        size: 9, font, color: rgb(0.62, 0.88, 0.75),
      })

      // Footer
      page.drawText(
        'Estimates based on DWP rates April 2026/27. Confirm entitlement with DWP or Citizens Advice. ClaimSmart UK is not a financial adviser.',
        { x: MARGIN, y: 20, size: 7, font, color: GRAY, maxWidth: CONTENT_W }
      )

      return page
    }

    // ── PAGE 1 ────────────────────────────────────────────────────────────────
    const page1 = addPage()
    let y = PAGE_H - 80

    // Hero band
    page1.drawRectangle({ x: 0, y: y - 80, width: PAGE_W, height: 80, color: TEAL_LIGHT })
    page1.drawText('Based on your answers, you may be missing:', {
      x: MARGIN, y: y - 18, size: 10, font, color: TEAL_DARK,
    })
    page1.drawText(`£${Math.round(totalMonthly).toLocaleString()} / month`, {
      x: MARGIN, y: y - 48, size: 28, font: fontBold, color: TEAL,
    })
    page1.drawText(`Up to £${Math.round(totalAnnual).toLocaleString()} per year`, {
      x: MARGIN, y: y - 68, size: 11, font, color: TEAL_DARK,
    })
    y -= 100

    // Red alert box
    page1.drawRectangle({ x: MARGIN, y: y - 36, width: CONTENT_W, height: 36, color: RED_LIGHT })
    page1.drawText('Unclaimed alert: You may be missing benefits worth up to £' +
      Math.round(totalAnnual).toLocaleString() + '/year you are entitled to.',
      { x: MARGIN + 8, y: y - 22, size: 9, font: fontBold, color: rgb(0.64, 0.17, 0.17), maxWidth: CONTENT_W - 16 }
    )
    y -= 52

    // Benefits section heading
    page1.drawText('YOUR BENEFITS BREAKDOWN', {
      x: MARGIN, y, size: 9, font: fontBold, color: GRAY,
    })
    y -= 18

    // Benefit cards
    for (const benefit of benefits) {
      if (y < 100) break // stop if running out of space on page 1

      const cardHeight = 85
      page1.drawRectangle({
        x: MARGIN, y: y - cardHeight, width: CONTENT_W, height: cardHeight,
        color: rgb(0.98, 0.98, 0.98), borderColor: rgb(0.87, 0.87, 0.87), borderWidth: 0.5,
      })

      // Benefit name
      page1.drawText(benefit.name, {
        x: MARGIN + 10, y: y - 18, size: 12, font: fontBold, color: BLACK,
      })

      // Amount right-aligned
      const amtText = `£${benefit.monthlyAmount.toFixed(2)}/month`
      page1.drawText(amtText, {
        x: MARGIN + CONTENT_W - 100, y: y - 18, size: 12, font: fontBold, color: TEAL,
      })

      // Likelihood badge
      const badgeColor = benefit.likelihood === 'high' ? rgb(0.87, 0.95, 0.85) : AMBER_LIGHT
      const badgeTextColor = benefit.likelihood === 'high' ? rgb(0.15, 0.47, 0.15) : rgb(0.52, 0.31, 0.04)
      page1.drawRectangle({ x: MARGIN + 10, y: y - 34, width: 80, height: 14, color: badgeColor })
      page1.drawText(benefit.likelihood === 'high' ? 'High likelihood' : 'Worth checking', {
        x: MARGIN + 14, y: y - 30, size: 8, font, color: badgeTextColor,
      })

      // Explanation
      page1.drawText(benefit.explanation, {
        x: MARGIN + 10, y: y - 50, size: 9, font, color: GRAY, maxWidth: CONTENT_W - 20,
      })

      // Urgency
      page1.drawText(benefit.urgency, {
        x: MARGIN + 10, y: y - 72, size: 8, font: fontBold, color: TEAL,
      })

      y -= cardHeight + 8
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    const page2 = addPage()
    let y2 = PAGE_H - 80

    // Action plan section
    page2.drawText('YOUR ACTION PLAN — DO THIS WEEK', {
      x: MARGIN, y: y2, size: 9, font: fontBold, color: GRAY,
    })
    y2 -= 20

    const topBenefits = benefits.filter(b => b.urgency === 'Claim this week').slice(0, 3)
    topBenefits.forEach((benefit, i) => {
      // Number circle
      page2.drawCircle({ x: MARGIN + 10, y: y2 - 4, size: 10, color: TEAL })
      page2.drawText(String(i + 1), {
        x: MARGIN + 7, y: y2 - 8, size: 9, font: fontBold, color: WHITE,
      })

      page2.drawText(`Claim ${benefit.name}`, {
        x: MARGIN + 28, y: y2, size: 11, font: fontBold, color: BLACK,
      })
      page2.drawText(`Worth £${benefit.monthlyAmount.toFixed(2)}/month · ${benefit.howToClaim[0]}`, {
        x: MARGIN + 28, y: y2 - 14, size: 9, font, color: GRAY, maxWidth: CONTENT_W - 40,
      })
      y2 -= 36
    })

    y2 -= 16

    // How to claim steps for each benefit
    page2.drawText('HOW TO CLAIM — STEP BY STEP', {
      x: MARGIN, y: y2, size: 9, font: fontBold, color: GRAY,
    })
    y2 -= 20

    for (const benefit of benefits.slice(0, 4)) {
      if (y2 < 150) break
      page2.drawText(benefit.name, {
        x: MARGIN, y: y2, size: 10, font: fontBold, color: TEAL_DARK,
      })
      y2 -= 14
      benefit.howToClaim.forEach((step, i) => {
        page2.drawText(`${i + 1}. ${step}`, {
          x: MARGIN + 10, y: y2, size: 9, font, color: BLACK, maxWidth: CONTENT_W - 10,
        })
        y2 -= 13
      })
      y2 -= 8
    }

    // What to have ready
    if (y2 > 200) {
      page2.drawText('WHAT TO HAVE READY', {
        x: MARGIN, y: y2, size: 9, font: fontBold, color: GRAY,
      })
      y2 -= 16
      const docs = [
        'National Insurance number',
        'Bank account details (sort code and account number)',
        'Details of any current benefits you receive',
        'Birth certificates for any children',
        'Proof of rent or mortgage payments',
        'Last 3 months bank statements',
      ]
      docs.forEach(doc => {
        page2.drawText(`• ${doc}`, { x: MARGIN + 10, y: y2, size: 9, font, color: BLACK })
        y2 -= 13
      })
      y2 -= 10
    }

    // Contacts
    if (y2 > 120) {
      page2.drawText('USEFUL CONTACTS', {
        x: MARGIN, y: y2, size: 9, font: fontBold, color: GRAY,
      })
      y2 -= 16
      const contacts = [
        ['Universal Credit helpline', '0800 328 5644', 'Mon–Fri 8am–6pm'],
        ['Citizens Advice', '0800 144 8848', 'Free advice and support'],
        ['Turn2us helpline', '0808 802 2000', 'Benefits calculator and grants'],
      ]
      contacts.forEach(([name, number, hours]) => {
        page2.drawText(`${name}: ${number} · ${hours}`, {
          x: MARGIN, y: y2, size: 9, font, color: BLACK,
        })
        y2 -= 13
      })
    }

    // Serialise
    const pdfBytes = await pdfDoc.save()
    const base64 = Buffer.from(pdfBytes).toString('base64')

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: base64 }),
    }
  } catch (error) {
    console.error('PDF generation error:', error)
    return { statusCode: 500, body: JSON.stringify({ error: 'PDF generation failed' }) }
  }
}
