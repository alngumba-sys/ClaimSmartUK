/**
 * refresh-rates.js — GOV.UK benefit rate scraper
 *
 * Fetches the six authoritative GOV.UK rate pages, extracts current figures,
 * diffs them against the values hardcoded in rates.js, stores the scraped
 * snapshot in Supabase, and emails a change report to the admin.
 *
 * Trigger: POST /api/refresh-rates  (admin-only, requires ADMIN_SECRET header)
 * Scheduled: runs automatically on 7 April each year via Netlify scheduled functions.
 *
 * Environment variables required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY, ADMIN_EMAIL
 *   ADMIN_SECRET  (simple shared secret to gate the manual trigger)
 */

const { createClient } = require('@supabase/supabase-js')
const { RATES } = require('./rates')

// ─── GOV.UK page scrapers ────────────────────────────────────────────────────

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ClaimSmart-rates-checker/1.0 (admin@claimsmart.co.uk)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

/** Extract all £NNN.NN amounts from a block of HTML, with surrounding context. */
function extractAmounts(html) {
  const amounts = []
  const re = /£([\d,]+(?:\.\d{1,2})?)/g
  let m
  while ((m = re.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''))
    const ctx = html.slice(Math.max(0, m.index - 120), m.index + 80)
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    amounts.push({ val, ctx })
  }
  return amounts
}

/** weekly → monthly (rounded to 2dp) */
function w2m(weekly) {
  return Math.round(weekly * 52 / 12 * 100) / 100
}

// ─── Individual page scrapers ────────────────────────────────────────────────

async function scrapeUniversalCredit() {
  const html = await fetchText('https://www.gov.uk/universal-credit/what-youll-get')
  const scraped = {}
  const amounts = extractAmounts(html)

  // Standard allowances appear in a table — pick by surrounding context keywords
  for (const { val, ctx } of amounts) {
    const c = ctx.toLowerCase()
    if (c.includes('single') && c.includes('under 25'))     scraped.singleUnder25 = val
    if (c.includes('single') && c.includes('25 or over'))   scraped.single25Plus  = val
    if ((c.includes('partner') || c.includes('couple')) && c.includes('both under 25')) scraped.coupleUnder25 = val
    if ((c.includes('partner') || c.includes('couple')) && c.includes('25 or over'))    scraped.couple25Plus  = val
    // Child element — "£NNN.NN a month for each child"
    if (c.includes('month') && c.includes('each child') && !c.includes('childcare') && !c.includes('first child was born')) {
      scraped.childElement = val
    }
    // LCWRA — severe health element
    if (c.includes('severe') || c.includes('unlikely to change') || c.includes('end of life')) {
      scraped.limitedCapacityWorkActivity = val
    }
    // LCW — less severe health element
    if ((c.includes('less severe') || c.includes('may improve')) && val < 300) {
      scraped.limitedCapacityWork = val
    }
  }

  return scraped
}

async function scrapeWorkAllowances() {
  const html = await fetchText('https://www.gov.uk/universal-credit/how-your-wages-affect-your-payments')
  const amounts = extractAmounts(html)
  const scraped = {}

  for (const { val, ctx } of amounts) {
    const c = ctx.toLowerCase()
    // "earn up to £NNN a month before your payment starts to reduce if … housing"
    if (c.includes('housing') && c.includes('earn') && val < 600) scraped.workAllowanceWithHousing = val
    // "earn up to £NNN a month" when neither housing clause applies (higher allowance)
    if ((c.includes('neither') || (!c.includes('housing') && c.includes('earn') && c.includes('month'))) && val > 600 && val < 900) {
      scraped.workAllowanceNoHousing = val
    }
  }

  return scraped
}

async function scrapeChildBenefit() {
  const html = await fetchText('https://www.gov.uk/child-benefit/what-youll-get')
  const amounts = extractAmounts(html)
  const scraped = {}

  for (const { val, ctx } of amounts) {
    const c = ctx.toLowerCase()
    if ((c.includes('eldest') || c.includes('only child')) && val > 20) {
      scraped.firstChildWeekly = val
      scraped.firstChild = w2m(val)
    }
    if (c.includes('additional') && val > 10 && val < 25) {
      scraped.additionalChildWeekly = val
      scraped.additionalChild = w2m(val)
    }
  }

  return scraped
}

async function scrapeCarersAllowance() {
  const [html1, html2] = await Promise.all([
    fetchText('https://www.gov.uk/carers-allowance/what-youll-get'),
    fetchText('https://www.gov.uk/carers-allowance/eligibility'),
  ])
  const amounts1 = extractAmounts(html1)
  const amounts2 = extractAmounts(html2)
  const scraped = {}

  // Rate: weekly amount
  for (const { val, ctx } of amounts1) {
    if (val > 70 && val < 120) {
      scraped.weeklyRate = val
      scraped.monthly = w2m(val)
    }
  }
  // Earnings limit
  for (const { val, ctx } of amounts2) {
    const c = ctx.toLowerCase()
    if ((c.includes('earn') || c.includes('earning')) && c.includes('week') && val > 100 && val < 300) {
      scraped.earningsLimitWeekly = val
    }
  }

  return scraped
}

async function scrapePIP() {
  const html = await fetchText('https://www.gov.uk/pip/how-much-youll-get')
  const amounts = extractAmounts(html)
  const scraped = {}

  for (const { val, ctx } of amounts) {
    const c = ctx.toLowerCase()
    if (c.includes('daily living') && (c.includes('lower') || c.includes('standard'))) {
      scraped.dailyLivingStandardWeekly = val
      scraped.dailyLivingStandard = w2m(val)
    }
    if (c.includes('daily living') && (c.includes('higher') || c.includes('enhanced'))) {
      scraped.dailyLivingEnhancedWeekly = val
      scraped.dailyLivingEnhanced = w2m(val)
    }
    if (c.includes('mobility') && (c.includes('lower') || c.includes('standard'))) {
      scraped.mobilityStandardWeekly = val
      scraped.mobilityStandard = w2m(val)
    }
    if (c.includes('mobility') && (c.includes('higher') || c.includes('enhanced'))) {
      scraped.mobilityEnhancedWeekly = val
      scraped.mobilityEnhanced = w2m(val)
    }
  }

  // Table layout fallback: if context matching fails, use positional extraction
  // The PIP table has exactly 4 data cells in order: DL lower, DL higher, mob lower, mob higher
  if (!scraped.dailyLivingStandard) {
    const cells = [...html.matchAll(/£([\d,]+(?:\.\d{1,2})?)/g)]
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(v => v > 20 && v < 200)
    if (cells.length >= 4) {
      scraped.dailyLivingStandard  = w2m(cells[0])
      scraped.dailyLivingEnhanced  = w2m(cells[1])
      scraped.mobilityStandard     = w2m(cells[2])
      scraped.mobilityEnhanced     = w2m(cells[3])
    }
  }

  return scraped
}

async function scrapePensionCredit() {
  const html = await fetchText('https://www.gov.uk/pension-credit/what-youll-get')
  const amounts = extractAmounts(html)
  const scraped = {}

  for (const { val, ctx } of amounts) {
    const c = ctx.toLowerCase()
    // "tops up your weekly income to £NNN for single" / "£NNN for couples"
    if ((c.includes('single') || c.includes('you\'re on your own')) && val > 200 && val < 280) {
      scraped.singleWeekly = val
      scraped.single = w2m(val)
    }
    if ((c.includes('partner') || c.includes('couple') || c.includes('joint')) && val > 300 && val < 450) {
      scraped.coupleWeekly = val
      scraped.couple = w2m(val)
    }
  }

  return scraped
}

// ─── Diff helper ─────────────────────────────────────────────────────────────

function buildDiff(scraped, current) {
  const changes = []
  const checks = [
    // UC standard allowances
    { path: 'UC single <25',     cur: current.universalCredit.singleUnder25,             scr: scraped.uc?.singleUnder25 },
    { path: 'UC single 25+',     cur: current.universalCredit.single25Plus,              scr: scraped.uc?.single25Plus },
    { path: 'UC couple <25',     cur: current.universalCredit.coupleUnder25,             scr: scraped.uc?.coupleUnder25 },
    { path: 'UC couple 25+',     cur: current.universalCredit.couple25Plus,              scr: scraped.uc?.couple25Plus },
    { path: 'UC child element',  cur: current.universalCredit.childElement,              scr: scraped.uc?.childElement },
    { path: 'UC LCWRA',          cur: current.universalCredit.limitedCapacityWorkActivity, scr: scraped.uc?.limitedCapacityWorkActivity },
    { path: 'UC LCW',            cur: current.universalCredit.limitedCapacityWork,       scr: scraped.uc?.limitedCapacityWork },
    { path: 'Work allowance (housing)',    cur: current.universalCredit.workAllowanceWithHousing, scr: scraped.workAllowances?.workAllowanceWithHousing },
    { path: 'Work allowance (no housing)', cur: current.universalCredit.workAllowanceNoHousing,  scr: scraped.workAllowances?.workAllowanceNoHousing },
    // Child Benefit
    { path: 'Child Benefit (first child)',      cur: current.childBenefit.firstChild,      scr: scraped.childBenefit?.firstChild },
    { path: 'Child Benefit (additional child)', cur: current.childBenefit.additionalChild, scr: scraped.childBenefit?.additionalChild },
    // Carer's Allowance
    { path: "Carer's Allowance (monthly)",      cur: current.carersAllowance.monthly,          scr: scraped.carersAllowance?.monthly },
    { path: "Carer's Allowance earnings limit", cur: current.carersAllowance.earningsLimitWeekly, scr: scraped.carersAllowance?.earningsLimitWeekly },
    // PIP
    { path: 'PIP DL standard', cur: current.pip.dailyLivingStandard, scr: scraped.pip?.dailyLivingStandard },
    { path: 'PIP DL enhanced', cur: current.pip.dailyLivingEnhanced, scr: scraped.pip?.dailyLivingEnhanced },
    { path: 'PIP mobility standard', cur: current.pip.mobilityStandard, scr: scraped.pip?.mobilityStandard },
    { path: 'PIP mobility enhanced', cur: current.pip.mobilityEnhanced, scr: scraped.pip?.mobilityEnhanced },
    // Pension Credit
    { path: 'Pension Credit (single)', cur: current.pensionCredit.single, scr: scraped.pensionCredit?.single },
    { path: 'Pension Credit (couple)', cur: current.pensionCredit.couple, scr: scraped.pensionCredit?.couple },
  ]

  for (const { path, cur, scr } of checks) {
    if (scr === undefined || scr === null) {
      changes.push({ path, status: 'NOT_FOUND', current: cur, scraped: null })
    } else {
      const diff = Math.abs(scr - cur)
      const pct  = cur ? (diff / cur * 100).toFixed(1) : '?'
      if (diff > 0.02) {
        changes.push({ path, status: 'CHANGED', current: cur, scraped: scr, diff: scr - cur, pctChange: pct })
      } else {
        changes.push({ path, status: 'OK', current: cur, scraped: scr })
      }
    }
  }

  return changes
}

// ─── Email report ─────────────────────────────────────────────────────────────

async function sendReport({ changes, scrapedAt, apiKey, adminEmail }) {
  const changed  = changes.filter(c => c.status === 'CHANGED')
  const notFound = changes.filter(c => c.status === 'NOT_FOUND')
  const ok       = changes.filter(c => c.status === 'OK')

  const statusEmoji = changed.length > 0 ? '🔴' : notFound.length > 0 ? '🟡' : '🟢'
  const subject = `${statusEmoji} ClaimSmart rates check — ${changed.length} change(s) found — ${new Date(scrapedAt).toLocaleDateString('en-GB')}`

  let html = `
    <h2>GOV.UK Benefit Rates Check</h2>
    <p>Scraped: ${new Date(scrapedAt).toLocaleString('en-GB')}</p>
    <p><strong>${changed.length} rate(s) changed</strong> &nbsp;|&nbsp; ${notFound.length} not found &nbsp;|&nbsp; ${ok.length} unchanged</p>
  `

  if (changed.length > 0) {
    html += '<h3>🔴 Changed rates — update rates.js immediately</h3><table border="1" cellpadding="6" style="border-collapse:collapse">'
    html += '<tr><th>Field</th><th>Current (rates.js)</th><th>GOV.UK scraped</th><th>Diff</th></tr>'
    for (const c of changed) {
      html += `<tr>
        <td>${c.path}</td>
        <td>£${c.current.toFixed(2)}</td>
        <td><strong>£${c.scraped.toFixed(2)}</strong></td>
        <td>${c.diff > 0 ? '+' : ''}£${c.diff.toFixed(2)} (${c.pctChange}%)</td>
      </tr>`
    }
    html += '</table>'
  }

  if (notFound.length > 0) {
    html += '<h3>🟡 Could not scrape — verify manually</h3><ul>'
    for (const c of notFound) html += `<li>${c.path} (current value: £${c.current.toFixed(2)})</li>`
    html += '</ul>'
    html += '<p><em>GOV.UK may have changed page structure. Check scraper selectors.</em></p>'
  }

  html += '<h3>✅ Unchanged</h3><ul>'
  for (const c of ok) html += `<li>${c.path}: £${c.current.toFixed(2)}</li>`
  html += '</ul>'

  html += `
    <hr>
    <p>
      <a href="https://www.gov.uk/universal-credit/what-youll-get">UC rates</a> ·
      <a href="https://www.gov.uk/child-benefit/what-youll-get">Child Benefit</a> ·
      <a href="https://www.gov.uk/pip/how-much-youll-get">PIP</a> ·
      <a href="https://www.gov.uk/carers-allowance/what-youll-get">Carer's Allowance</a> ·
      <a href="https://www.gov.uk/pension-credit/what-youll-get">Pension Credit</a>
    </p>
    <p style="color:#888;font-size:12px">Sent by ClaimSmart refresh-rates function</p>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'ClaimSmart <noreply@claimsmart.co.uk>',
      to:   adminEmail,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Resend error:', body)
  }
}

// ─── Netlify handler ──────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // Allow both scheduled invocations (no auth needed) and manual POST triggers
  const isScheduled = event.httpMethod === undefined || event.httpMethod === null
  const isManual    = event.httpMethod === 'POST'

  if (isManual) {
    const secret = event.headers?.['x-admin-secret'] || event.headers?.['authorization']
    if (secret !== process.env.ADMIN_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
  }

  if (!isScheduled && !isManual) {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  console.log('refresh-rates: starting GOV.UK scrape…')
  const scrapedAt = new Date().toISOString()

  // Run all scrapers in parallel
  const [uc, workAllowances, childBenefit, carersAllowance, pip, pensionCredit] = await Promise.allSettled([
    scrapeUniversalCredit(),
    scrapeWorkAllowances(),
    scrapeChildBenefit(),
    scrapeCarersAllowance(),
    scrapePIP(),
    scrapePensionCredit(),
  ])

  const scraped = {
    uc:              uc.status === 'fulfilled'             ? uc.value             : null,
    workAllowances:  workAllowances.status === 'fulfilled' ? workAllowances.value : null,
    childBenefit:    childBenefit.status === 'fulfilled'   ? childBenefit.value   : null,
    carersAllowance: carersAllowance.status === 'fulfilled'? carersAllowance.value: null,
    pip:             pip.status === 'fulfilled'            ? pip.value            : null,
    pensionCredit:   pensionCredit.status === 'fulfilled'  ? pensionCredit.value  : null,
    scrapedAt,
  }

  // Log any scraper errors
  for (const [name, result] of Object.entries({ uc, workAllowances, childBenefit, carersAllowance, pip, pensionCredit })) {
    if (result.status === 'rejected') console.error(`Scraper error (${name}):`, result.reason)
  }

  // Store snapshot in Supabase
  const { error: dbError } = await supabase
    .from('benefit_rates_cache')
    .upsert({ id: 1, scraped_at: scrapedAt, data: scraped }, { onConflict: 'id' })

  if (dbError) console.error('Supabase upsert error:', dbError)

  // Diff against current hardcoded rates
  const changes = buildDiff(scraped, RATES)
  const changedCount = changes.filter(c => c.status === 'CHANGED').length

  console.log(`refresh-rates: ${changedCount} rate(s) changed`)

  // Always send the report so there's a record each April
  if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
    await sendReport({
      changes,
      scrapedAt,
      apiKey:     process.env.RESEND_API_KEY,
      adminEmail: process.env.ADMIN_EMAIL,
    })
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      scrapedAt,
      changedCount,
      changes: changes.filter(c => c.status !== 'OK'),
      scraped,
    }),
  }
}
