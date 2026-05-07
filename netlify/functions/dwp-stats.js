/**
 * dwp-stats.js
 *
 * GET /api/dwp-stats
 *
 * Returns the latest DWP benefit statistics cached in Supabase.
 * The cache is populated by refresh-dwp-stats (runs on a schedule, or
 * manually via POST /api/refresh-dwp-stats).
 *
 * Falls back to hard-coded 2024/25 published figures if the cache is empty
 * so the app always has something to show.
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fallback figures — sourced from live DWP Stat-Xplore, May 2026
// (used only when the Supabase cache is empty on first deploy)
const FALLBACK_STATS = {
  uc: {
    totalClaimants: 8405138,           // March 2026
    byRegion: {
      'London':           1322919,
      'South East':        923550,
      'South West':        591688,
      'Midlands':         2150371,
      'North of England': 2274210,
      'Wales':             431622,
      'Scotland':          699945,
    },
  },
  pip: {
    totalClaimants: 3926015,           // March 2026 (England & Wales; Scotland mostly ADP)
    dailyLivingClaimants: 3763671,
    mobilityClaimants:    3161735,
    byRegion: {
      'London':            472825,
      'South East':        454401,
      'South West':        333484,
      'Midlands':         1088557,
      'North of England': 1282173,
      'Wales':             287677,
      'Scotland':            1579,     // Scotland migrated to ADP (Social Security Scotland)
    },
  },
  housingBenefit: {
    totalClaimants:   1477041,
    avgWeeklyBenefit: 158,
  },
  pensionCredit: {
    totalClaimants:              1389900,
    estimatedEligibleNotClaiming: 850000, // ~40% non-take-up (ONS est.)
  },
  carersAllowance: {
    totalClaimants: 1001138,
  },
  meta: {
    source:        'fallback',
    refreshedAt:   null,
    referenceDate: '2026-03',          // DWP stats reference month
  },
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    // Try to load the cached stats from Supabase
    const { data, error } = await supabase
      .from('dwp_stats_cache')
      .select('stats, refreshed_at')
      .order('refreshed_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      // Cache miss — return fallback
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(FALLBACK_STATS),
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400', // CDN-cache for 24 h
      },
      body: JSON.stringify({ ...data.stats, meta: { ...data.stats.meta, refreshedAt: data.refreshed_at } }),
    }
  } catch (err) {
    console.error('dwp-stats error:', err)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(FALLBACK_STATS),
    }
  }
}
