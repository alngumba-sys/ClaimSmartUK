/**
 * useDWPStats
 *
 * Fetches live DWP benefit statistics from /api/dwp-stats.
 * The endpoint is backed by the Stat-Xplore cache in Supabase and
 * falls back to published DWP figures if the cache is empty.
 *
 * Data is cached in sessionStorage for the duration of the browser session
 * so we only make one network request per visit.
 */

import { useState, useEffect } from 'react'

const CACHE_KEY = 'claimsmart_dwp_stats'

export function useDWPStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check session cache first
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        setStats(JSON.parse(cached))
        setLoading(false)
        return
      } catch {}
    }

    fetch('/api/dwp-stats')
      .then(r => r.json())
      .then(data => {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
        setStats(data)
        setLoading(false)
      })
      .catch(err => {
        console.warn('Could not load DWP stats:', err)
        setError(err)
        setLoading(false)
      })
  }, [])

  // Helper: get UC stats for a specific quiz region label.
  // Returns { claimants } — claimant count as a number.
  function getRegionStats(region) {
    if (!stats?.uc?.byRegion) return null
    const val = stats.uc.byRegion[region]
    if (!val) return null
    // Support both the legacy shape { claimants, avgAward } and the
    // current live shape (plain number) from the Stat-Xplore cache.
    return typeof val === 'object' ? val : { claimants: Math.round(val) }
  }

  function getPIPRegionTotal(region) {
    if (!stats?.pip?.byRegion) return null
    return stats.pip.byRegion[region] || null
  }

  return { stats, loading, error, getRegionStats, getPIPRegionTotal }
}
