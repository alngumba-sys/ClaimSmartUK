/**
 * refresh-dwp-stats.js
 *
 * Fetches live statistics from the DWP Stat-Xplore Open Data API and
 * stores the results in the dwp_stats_cache Supabase table.
 *
 * Runs automatically on the 10th of every month (DWP publishes new data
 * around the 5th–8th of each month).
 *
 * Can also be triggered manually:
 *   POST /api/refresh-dwp-stats   (requires x-admin-key header)
 *
 * Stat-Xplore API: https://stat-xplore.dwp.gov.uk/webapi/rest/v1/
 * Authentication:  APIKey header — pass the raw hex string from the Account
 *                  page exactly as-is (do NOT decode it).
 *
 * Verified field IDs (May 2026, queried from live schema):
 *
 *   UC:   str:database:UC_Monthly
 *         COUNT  str:count:UC_Monthly:V_F_UC_CASELOAD_FULL
 *         GEO    str:valueset:UC_Monthly:V_F_UC_CASELOAD_FULL:COA_CODE:V_C_MASTERGEOG21_REGION_TO_COUNTRY
 *
 *   PIP:  str:database:PIP_Monthly_new
 *         COUNT  str:count:PIP_Monthly_new:V_F_PIP_MONTHLY
 *         GEO    str:valueset:PIP_Monthly_new:V_F_PIP_MONTHLY:COA_CODE:V_C_MASTERGEOG21_REGION_TO_COUNTRY
 *         DL     str:valueset:PIP_Monthly_new:V_F_PIP_MONTHLY:DL_AWARD_TYPE:C_PIP_DL_AWARD_TYPE
 *         MOB    str:valueset:PIP_Monthly_new:V_F_PIP_MONTHLY:MOB_AWARD_TYPE:C_PIP_MOB_AWARD_TYPE
 *
 *   HB:   str:database:hb_new
 *         COUNT  str:count:hb_new:V_F_HB_NEW
 *         AVG    str:statfn:hb_new:V_F_HB_NEW:LAHBAMT:MEAN
 *
 *   PC:   str:database:PC_New
 *         COUNT  str:count:PC_New:V_F_PC_CASELOAD_New
 *
 *   CA:   str:database:CA_In_Payment_New
 *         COUNT  str:count:CA_In_Payment_New:V_F_CA_In_Payment_New
 *
 * Response format from the /table endpoint:
 *   - cubes   → object keyed by measure URI (NOT an array)
 *   - fields  → array; fields[0] is the auto-added Date dimension;
 *               fields[1] is the first explicit dimension (geography)
 *   - items   → each item has a `labels` array (not a plain `label` string)
 *   - values  → 2-D: values[date_index][region_index]; since we get the latest
 *               month only, use values[0]
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const STAT_XPLORE_BASE = 'https://stat-xplore.dwp.gov.uk/webapi/rest/v1'
const API_KEY = process.env.DWP_STAT_XPLORE_API_KEY

// ---------------------------------------------------------------------------
// Region mapping: Stat-Xplore England Government Office Region labels → our
// 8-region quiz values. Where multiple ONS regions map to one quiz region
// (e.g., East + East Midlands + West Midlands → "Midlands") we sum them.
// ---------------------------------------------------------------------------
const REGION_MAP = {
  'London':                       'London',
  'South East':                   'South East',
  'South West':                   'South West',
  'East Midlands':                'Midlands',
  'West Midlands':                'Midlands',
  'East of England':              'Midlands',   // closest grouping
  'Yorkshire and The Humber':     'North of England',
  'North West':                   'North of England',
  'North East':                   'North of England',
  'Wales':                        'Wales',
  'Scotland':                     'Scotland',
  'Northern Ireland':             'Northern Ireland',  // not in UC (devolved)
}

// ---------------------------------------------------------------------------
// Core helper — POST a table query to Stat-Xplore
//
// The API key must be the raw hex string as shown on the Account page —
// NOT the decoded JWT. Pass it exactly as stored in the env var.
// ---------------------------------------------------------------------------
async function queryTable(body) {
  const res = await fetch(`${STAT_XPLORE_BASE}/table`, {
    method: 'POST',
    headers: {
      'APIKey':         API_KEY,
      'Content-Type':   'application/json',
      'Accept':         'application/json',
      'Accept-Encoding': 'identity', // avoid gzip so we can parse reliably
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Stat-Xplore ${res.status}: ${text}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Response parsers
//
// The /table response has:
//   fields[0]  = auto-added Date dimension (always present)
//   fields[1]  = first explicit dimension (geography, when requested)
//   cubes      = object { measureURI: { values: [[v0, v1, ...]] } }
//
// Item labels are in item.labels[0] (array), NOT item.label.
// ---------------------------------------------------------------------------

/**
 * Extract the single scalar value from a national-total query
 * (no explicit dimensions → fields has only the Date entry).
 */
function parseNational(response, measureURI) {
  const values = response.cubes?.[measureURI]?.values
  // National (no explicit dimension): values = [scalar], so values[0] is the total
  return values?.[0] ?? 0
}

/**
 * Parse a by-region query into { quizRegion → total } using REGION_MAP.
 * fields[1] holds the geography dimension with items[i].labels[0] = region label.
 */
function parseByRegion(response, measureURI) {
  const items  = response.fields?.[1]?.items || []
  const values = response.cubes?.[measureURI]?.values?.[0] || []

  const aggregated = {}

  items.forEach((item, i) => {
    const raw    = item.labels?.[0] ?? item.label ?? ''
    const mapped = REGION_MAP[raw]
    if (!mapped) return                           // skip Unknown / unmapped

    if (!aggregated[mapped]) aggregated[mapped] = 0
    const v = values[i]
    if (typeof v === 'number' && !isNaN(v)) aggregated[mapped] += v
  })

  return aggregated
}

// ---------------------------------------------------------------------------
// 1. Universal Credit caseload
//    (no monthly award amount measure exists in this database)
// ---------------------------------------------------------------------------
async function fetchUCStats() {
  const DB    = 'str:database:UC_Monthly'
  const COUNT = 'str:count:UC_Monthly:V_F_UC_CASELOAD_FULL'
  const GEO   = 'str:valueset:UC_Monthly:V_F_UC_CASELOAD_FULL:COA_CODE:V_C_MASTERGEOG21_REGION_TO_COUNTRY'

  const [national, byRegionRes] = await Promise.all([
    queryTable({ database: DB, measures: [COUNT], dimensions: [[]] }),
    queryTable({ database: DB, measures: [COUNT], dimensions: [[GEO]] }),
  ])

  const totalClaimants = Math.round(parseNational(national, COUNT))
  const byRegion       = parseByRegion(byRegionRes, COUNT)

  return { totalClaimants, byRegion }
}

// ---------------------------------------------------------------------------
// 2. Personal Independence Payment
//    Component breakdown uses DL / MOB award type valuesets.
// ---------------------------------------------------------------------------
async function fetchPIPStats() {
  const DB    = 'str:database:PIP_Monthly_new'
  const COUNT = 'str:count:PIP_Monthly_new:V_F_PIP_MONTHLY'
  const GEO   = 'str:valueset:PIP_Monthly_new:V_F_PIP_MONTHLY:COA_CODE:V_C_MASTERGEOG21_REGION_TO_COUNTRY'
  const DL    = 'str:valueset:PIP_Monthly_new:V_F_PIP_MONTHLY:DL_AWARD_TYPE:C_PIP_DL_AWARD_TYPE'
  const MOB   = 'str:valueset:PIP_Monthly_new:V_F_PIP_MONTHLY:MOB_AWARD_TYPE:C_PIP_MOB_AWARD_TYPE'

  const [national, byRegionRes, dlRes, mobRes] = await Promise.all([
    queryTable({ database: DB, measures: [COUNT], dimensions: [[]] }),
    queryTable({ database: DB, measures: [COUNT], dimensions: [[GEO]] }),
    queryTable({ database: DB, measures: [COUNT], dimensions: [[DL]] }),
    queryTable({ database: DB, measures: [COUNT], dimensions: [[MOB]] }),
  ])

  const totalClaimants = Math.round(parseNational(national, COUNT))

  // DL breakdown: items in fields[1]
  const dlItems  = dlRes.fields?.[1]?.items  || []
  const dlValues = dlRes.cubes?.[COUNT]?.values?.[0] || []
  let dlEnhanced = 0, dlStandard = 0
  dlItems.forEach((item, i) => {
    const lbl = (item.labels?.[0] ?? '').toLowerCase()
    if (lbl.includes('enhanced')) dlEnhanced += dlValues[i] || 0
    if (lbl.includes('standard')) dlStandard += dlValues[i] || 0
  })

  const mobItems  = mobRes.fields?.[1]?.items  || []
  const mobValues = mobRes.cubes?.[COUNT]?.values?.[0] || []
  let mobEnhanced = 0, mobStandard = 0
  mobItems.forEach((item, i) => {
    const lbl = (item.labels?.[0] ?? '').toLowerCase()
    if (lbl.includes('enhanced')) mobEnhanced += mobValues[i] || 0
    if (lbl.includes('standard')) mobStandard += mobValues[i] || 0
  })

  return {
    totalClaimants,
    dailyLivingClaimants:  Math.round(dlEnhanced + dlStandard),
    mobilityClaimants:     Math.round(mobEnhanced + mobStandard),
    byRegion: parseByRegion(byRegionRes, COUNT),
  }
}

// ---------------------------------------------------------------------------
// 3. Housing Benefit
// ---------------------------------------------------------------------------
async function fetchHBStats() {
  const DB    = 'str:database:hb_new'
  const COUNT = 'str:count:hb_new:V_F_HB_NEW'
  const AVG   = 'str:statfn:hb_new:V_F_HB_NEW:LAHBAMT:MEAN'

  const result = await queryTable({
    database:   DB,
    measures:   [COUNT, AVG],
    dimensions: [[]],
  })

  return {
    totalClaimants:   Math.round(parseNational(result, COUNT)),
    avgWeeklyBenefit: Math.round(parseNational(result, AVG)),
  }
}

// ---------------------------------------------------------------------------
// 4. Pension Credit
// ---------------------------------------------------------------------------
async function fetchPCStats() {
  const DB    = 'str:database:PC_New'
  const COUNT = 'str:count:PC_New:V_F_PC_CASELOAD_New'

  const result = await queryTable({ database: DB, measures: [COUNT], dimensions: [[]] })

  return {
    totalClaimants:              Math.round(parseNational(result, COUNT)),
    estimatedEligibleNotClaiming: 850000, // ONS est. ~40% non-take-up; not in Stat-Xplore
  }
}

// ---------------------------------------------------------------------------
// 5. Carer's Allowance
// ---------------------------------------------------------------------------
async function fetchCAStats() {
  const DB    = 'str:database:CA_In_Payment_New'
  const COUNT = 'str:count:CA_In_Payment_New:V_F_CA_In_Payment_New'

  const result = await queryTable({ database: DB, measures: [COUNT], dimensions: [[]] })

  return {
    totalClaimants: Math.round(parseNational(result, COUNT)),
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  // Allow both scheduled invocations and manual POST with admin key
  if (event.httpMethod === 'POST') {
    const adminKey = event.headers['x-admin-key']
    if (adminKey !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: 'Unauthorised' }
    }
  } else if (event.httpMethod && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'DWP_STAT_XPLORE_API_KEY not configured' }),
    }
  }

  console.log('Starting DWP Stat-Xplore refresh...')

  const errors  = []
  const results = {}

  // Fetch each dataset independently so one failure doesn't block the others
  await Promise.allSettled([
    fetchUCStats()
      .then(d  => { results.uc = d })
      .catch(e => { errors.push(`UC: ${e.message}`);   console.error('UC fetch failed:', e) }),
    fetchPIPStats()
      .then(d  => { results.pip = d })
      .catch(e => { errors.push(`PIP: ${e.message}`);  console.error('PIP fetch failed:', e) }),
    fetchHBStats()
      .then(d  => { results.housingBenefit = d })
      .catch(e => { errors.push(`HB: ${e.message}`);   console.error('HB fetch failed:', e) }),
    fetchPCStats()
      .then(d  => { results.pensionCredit = d })
      .catch(e => { errors.push(`PC: ${e.message}`);   console.error('PC fetch failed:', e) }),
    fetchCAStats()
      .then(d  => { results.carersAllowance = d })
      .catch(e => { errors.push(`CA: ${e.message}`);   console.error('CA fetch failed:', e) }),
  ])

  if (Object.keys(results).length === 0) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'All Stat-Xplore fetches failed', details: errors }),
    }
  }

  const referenceDate = new Date().toISOString().slice(0, 7) // e.g. "2026-05"

  const stats = {
    ...results,
    meta: {
      source:        'stat-xplore',
      referenceDate,
      errors:        errors.length > 0 ? errors : undefined,
    },
  }

  // Upsert into Supabase cache
  const { error: dbError } = await supabase
    .from('dwp_stats_cache')
    .insert({ stats, refreshed_at: new Date().toISOString() })

  if (dbError) {
    console.error('Cache write failed:', dbError)
    // Still return the data even if we couldn't cache it
  }

  console.log(`Stat-Xplore refresh complete. Datasets: ${Object.keys(results).join(', ')}. Errors: ${errors.length}`)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, datasets: Object.keys(results), errors, stats }),
  }
}
