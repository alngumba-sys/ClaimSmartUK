/**
 * admin-maintenance.js
 *
 * GET  /.netlify/functions/admin-maintenance
 *   → Returns latest completion per task_key + complaint count since last review
 *
 * POST /.netlify/functions/admin-maintenance
 *   Body: { taskKey: string, notes?: string }
 *   → Inserts a new completion record
 *
 * Both require x-admin-token header.
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VALID_TASK_KEYS = new Set([
  'annual_rates',
  'monthly_spotcheck',
  'policy_review',
  'complaint_logged',
  'complaint_review',
])

function checkAdminAuth(event) {
  return event.headers['x-admin-token'] === process.env.ADMIN_PASSWORD
}

exports.handler = async (event) => {
  if (!checkAdminAuth(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) }
  }

  const headers = { 'Content-Type': 'application/json' }

  // ── GET — return summary ──────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      // Latest completion per task_key (except complaint_logged which is a counter)
      const { data: rows } = await supabase
        .from('admin_maintenance_log')
        .select('task_key, completed_at, notes')
        .order('completed_at', { ascending: false })

      // Reduce to { taskKey: latestRow } for non-complaint tasks
      const latest = {}
      for (const row of (rows || [])) {
        if (!latest[row.task_key]) latest[row.task_key] = row
      }

      // Complaint count since last complaint_review
      const lastReview = latest['complaint_review']?.completed_at
      const complaintQuery = supabase
        .from('admin_maintenance_log')
        .select('*', { count: 'exact', head: true })
        .eq('task_key', 'complaint_logged')

      if (lastReview) {
        complaintQuery.gt('completed_at', lastReview)
      }

      const { count: complaintsSinceReview } = await complaintQuery

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          latest,
          complaintsSinceReview: complaintsSinceReview || 0,
          complaintReviewThreshold: 10,
        }),
      }
    } catch (err) {
      console.error('admin-maintenance GET error:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
    }
  }

  // ── POST — log a completion ───────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { taskKey, notes } = JSON.parse(event.body || '{}')

      if (!VALID_TASK_KEYS.has(taskKey)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid taskKey: ${taskKey}` }) }
      }

      const { error } = await supabase
        .from('admin_maintenance_log')
        .insert({ task_key: taskKey, notes: notes || null })

      if (error) throw error

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, taskKey }) }
    } catch (err) {
      console.error('admin-maintenance POST error:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
    }
  }

  return { statusCode: 405, body: 'Method not allowed' }
}
