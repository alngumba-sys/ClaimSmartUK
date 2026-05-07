import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

function formatGBP(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

/**
 * RatesReminder — shows a banner in the window around DWP's annual uprating.
 *
 * Severity levels:
 *   upcoming  April 1–4   amber  "Rates change in N days"
 *   urgent    April 5     red    "Rates change tomorrow — update before 9am"
 *   overdue   April 6–14  red    "Rates changed N day(s) ago — have you updated?"
 *
 * The "upcoming" banner is dismissible for the current session.
 * "urgent" and "overdue" banners cannot be dismissed — rates are wrong or about to be.
 */
function RatesReminder() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('rates_reminder_dismissed') === 'true'
  )

  // Use UK local date (GMT/BST). We only care about month/day, not time zone edge cases.
  const now   = new Date()
  const month = now.getMonth() + 1  // 1-indexed
  const day   = now.getDate()

  // Only show between April 1 and April 14
  if (month !== 4 || day > 14) return null

  const daysUntil  = 6 - day          // negative once April 6 has passed
  const daysAfter  = day - 6          // days since April 6

  let severity, icon, headline, sub

  if (day <= 4) {
    // Upcoming
    if (dismissed) return null
    severity = 'amber'
    icon     = '📅'
    headline = `DWP rates change in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} (April 6th)`
    sub      = 'Prepare to update both rate files and redeploy before 9am on April 6th.'
  } else if (day === 5) {
    // Urgent — tomorrow
    severity = 'red'
    icon     = '⚠️'
    headline = 'DWP rates change tomorrow (April 6th)'
    sub      = 'Update both rate files and redeploy before 9am tomorrow.'
  } else {
    // Overdue — rates already changed
    severity = 'red'
    icon     = '🚨'
    headline = daysAfter === 0
      ? 'DWP rates changed today (April 6th)'
      : `DWP rates changed ${daysAfter} day${daysAfter !== 1 ? 's' : ''} ago (April 6th)`
    sub      = 'Every calculation is wrong until you update the rate files and redeploy.'
  }

  const canDismiss = day <= 4

  function dismiss() {
    sessionStorage.setItem('rates_reminder_dismissed', 'true')
    setDismissed(true)
  }

  const bgStyle    = severity === 'red'
    ? { background: '#fef2f2', border: '1px solid #fca5a5' }
    : { background: '#fffbeb', border: '1px solid #fcd34d' }
  const textColor  = severity === 'red' ? '#991b1b' : '#92400e'
  const subColor   = severity === 'red' ? '#b91c1c' : '#a16207'
  const linkColor  = severity === 'red' ? '#dc2626' : '#d97706'

  return (
    <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={bgStyle}>
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: textColor }}>{headline}</p>
        <p className="text-sm mt-0.5" style={{ color: subColor }}>{sub}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-medium" style={{ color: linkColor }}>
          <span>Files to update:</span>
          <code className="font-mono bg-black/5 px-1.5 py-0.5 rounded">src/data/benefitsRates2026.js</code>
          <code className="font-mono bg-black/5 px-1.5 py-0.5 rounded">netlify/functions/rates.js</code>
        </div>
        <div className="flex flex-wrap gap-3 mt-2.5 text-xs" style={{ color: linkColor }}>
          <a href="https://www.gov.uk/universal-credit/what-youll-get"   target="_blank" rel="noreferrer" className="underline hover:no-underline">UC rates</a>
          <a href="https://www.gov.uk/child-benefit/what-youll-get"      target="_blank" rel="noreferrer" className="underline hover:no-underline">Child Benefit</a>
          <a href="https://www.gov.uk/pip/how-much-youll-get"            target="_blank" rel="noreferrer" className="underline hover:no-underline">PIP</a>
          <a href="https://www.gov.uk/carers-allowance/what-youll-get"   target="_blank" rel="noreferrer" className="underline hover:no-underline">Carer's Allowance</a>
          <a href="https://www.gov.uk/pension-credit/what-youll-get"     target="_blank" rel="noreferrer" className="underline hover:no-underline">Pension Credit</a>
          <a href="https://www.gov.uk/universal-credit/how-your-wages-affect-your-payments" target="_blank" rel="noreferrer" className="underline hover:no-underline">Work allowances</a>
        </div>
      </div>
      {canDismiss && (
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-lg leading-none hover:opacity-60 transition-opacity"
          style={{ color: textColor }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [maintenance, setMaintenance] = useState(null)
  const [maintSaving, setMaintSaving] = useState(null) // taskKey being saved
  const navigate = useNavigate()

  useEffect(() => {
    const token = sessionStorage.getItem('adminToken')
    if (!token) { navigate('/admin/login'); return }
    loadStats(token)
    loadMaintenance(token)
  }, [])

  async function loadStats(token) {
    try {
      const res = await fetch('/.netlify/functions/admin-stats', {
        headers: { 'x-admin-token': token || sessionStorage.getItem('adminToken') },
      })
      if (res.status === 401) { navigate('/admin/login'); return }
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Stats load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMaintenance(token) {
    try {
      const res = await fetch('/.netlify/functions/admin-maintenance', {
        headers: { 'x-admin-token': token || sessionStorage.getItem('adminToken') },
      })
      if (res.ok) setMaintenance(await res.json())
    } catch (err) {
      console.error('Maintenance load error:', err)
    }
  }

  async function logTask(taskKey, notes = '') {
    setMaintSaving(taskKey)
    try {
      const token = sessionStorage.getItem('adminToken')
      await fetch('/.netlify/functions/admin-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ taskKey, notes }),
      })
      await loadMaintenance(token)
    } catch (err) {
      console.error('logTask error:', err)
    } finally {
      setMaintSaving(null)
    }
  }

  async function resendReport(reportId, email) {
    const token = sessionStorage.getItem('adminToken')
    await fetch('/.netlify/functions/resend-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ reportId, email }),
    })
    alert('Report resent to ' + email)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const signupLabels = stats ? Object.keys(stats.dailySignups).slice(-14) : []
  const signupData = stats ? Object.values(stats.dailySignups).slice(-14) : []

  const regionLabels = stats ? Object.keys(stats.regionCounts) : []
  const regionData = stats ? Object.values(stats.regionCounts) : []

  const tabs = ['overview', 'transactions', 'users', 'maintenance']

  // ── Maintenance helpers ───────────────────────────────────────────────────
  function daysSince(isoString) {
    if (!isoString) return null
    return Math.floor((Date.now() - new Date(isoString)) / 86_400_000)
  }

  function fmtDate(isoString) {
    if (!isoString) return 'Never'
    return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Overdue rules — used both for inline badges and top-of-page banners
  const maintAlerts = maintenance ? (() => {
    const alerts = []
    const lat = maintenance.latest || {}

    // Annual rates — overdue if not done in current calendar year by April 6
    const now = new Date()
    const thisApril6 = new Date(now.getFullYear(), 3, 6) // April 6 (month 3 = April)
    const ratesDate  = lat.annual_rates?.completed_at ? new Date(lat.annual_rates.completed_at) : null
    if (now >= thisApril6 && (!ratesDate || ratesDate < thisApril6)) {
      const daysAgo = ratesDate ? Math.floor((now - thisApril6) / 86_400_000) : null
      alerts.push({
        key: 'annual_rates', severity: 'red',
        headline: daysAgo !== null
          ? `Annual rates update overdue — April 6th was ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`
          : 'Annual rates update not yet completed this year',
        sub: 'Update benefitsRates2026.js and netlify/functions/rates.js, then redeploy.',
      })
    }

    // Monthly spot-check — overdue after 35 days
    const spotDays = daysSince(lat.monthly_spotcheck?.completed_at)
    if (spotDays === null || spotDays > 35) {
      alerts.push({
        key: 'monthly_spotcheck', severity: 'amber',
        headline: spotDays === null
          ? 'Monthly spot-check has never been completed'
          : `Monthly spot-check overdue — last done ${spotDays} days ago`,
        sub: 'Run 3–4 test scenarios against entitledto.co.uk and check for >15% gaps.',
      })
    }

    // Complaint review — overdue at 10
    const complaints = maintenance.complaintsSinceReview || 0
    if (complaints >= 10) {
      alerts.push({
        key: 'complaint_review', severity: 'amber',
        headline: `${complaints} complaints logged since last review`,
        sub: 'Review recent complaints, identify error type, and fix root cause.',
      })
    }

    return alerts
  })() : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin nav */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">CS</span>
          </div>
          <span className="font-medium text-gray-900 text-sm">ClaimSmart Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => loadStats()} className="text-sm text-teal-600 hover:underline">Refresh</button>
          <button
            onClick={() => { sessionStorage.removeItem('adminAuth'); sessionStorage.removeItem('adminToken'); navigate('/admin/login') }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Annual rates update reminder — visible April 1–14 */}
        <RatesReminder />

        {/* Maintenance overdue banners — visible any time a task is late */}
        {maintAlerts.map(alert => (
          <div
            key={alert.key}
            className="rounded-xl p-4 mb-3 flex items-start gap-3"
            style={
              alert.severity === 'red'
                ? { background: '#fef2f2', border: '1px solid #fca5a5' }
                : { background: '#fffbeb', border: '1px solid #fcd34d' }
            }
          >
            <span className="text-xl flex-shrink-0 mt-0.5">{alert.severity === 'red' ? '🚨' : '⚠️'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: alert.severity === 'red' ? '#991b1b' : '#92400e' }}>
                {alert.headline}
              </p>
              <p className="text-sm mt-0.5" style={{ color: alert.severity === 'red' ? '#b91c1c' : '#a16207' }}>
                {alert.sub}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('maintenance')}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={
                alert.severity === 'red'
                  ? { background: '#fee2e2', color: '#991b1b' }
                  : { background: '#fef3c7', color: '#92400e' }
              }
            >
              Go to checklist →
            </button>
          </div>
        ))}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-full sm:w-fit overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && stats && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Total users', value: stats.totalUsers.toLocaleString() },
                { label: 'Paid reports', value: stats.totalReports.toLocaleString() },
                { label: 'Revenue', value: formatGBP(stats.totalRevenuePence / 100) },
                { label: 'Avg benefits found', value: String(stats.avgBenefits) },
                { label: 'Avg monthly found', value: formatGBP(stats.avgMonthly) },
              ].map(s => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                  <p className="text-xl font-medium text-teal-600">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Daily signups (last 14 days)</h3>
                <Line
                  data={{
                    labels: signupLabels.map(d => d.slice(5)),
                    datasets: [{
                      label: 'Signups',
                      data: signupData,
                      borderColor: '#0F6E56',
                      backgroundColor: '#E1F5EE',
                      tension: 0.3,
                      fill: true,
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
                />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Reports by region</h3>
                <Bar
                  data={{
                    labels: regionLabels,
                    datasets: [{
                      label: 'Reports',
                      data: regionData,
                      backgroundColor: '#E1F5EE',
                      borderColor: '#0F6E56',
                      borderWidth: 1,
                    }],
                  }}
                  options={{ responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && stats && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-900">Recent transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Date', 'Region', 'Benefits', 'Monthly', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTransactions.map(t => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-gray-600">{t.region}</td>
                      <td className="px-4 py-3 text-gray-600">{t.benefitsFound}</td>
                      <td className="px-4 py-3 text-teal-600 font-medium">{formatGBP(t.totalMonthly)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            const email = prompt('Enter email to resend report to:')
                            if (email) resendReport(t.id, email)
                          }}
                          className="text-xs text-teal-600 hover:underline"
                        >
                          Resend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && stats && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-900">Users ({stats.totalUsers})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Email', 'Name', 'Joined', 'Referral earnings', 'Referred by'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">{u.full_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-teal-600">{formatGBP((u.referral_earnings_pence || 0) / 100)}</td>
                      <td className="px-4 py-3 text-gray-400">{u.referred_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Maintenance tab ─────────────────────────────────────────────── */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">

            {/* ── 1. Annual — April 5th ────────────────────────────────────── */}
            <MaintenanceCard
              icon="📅"
              title="Annual — Every April 5th"
              freq="Due once per year, before 9am on April 6th"
              lastDone={fmtDate(maintenance?.latest?.annual_rates?.completed_at)}
              daysSince={daysSince(maintenance?.latest?.annual_rates?.completed_at)}
              overdueAfter={null}  // handled by RatesReminder
              taskKey="annual_rates"
              saving={maintSaving === 'annual_rates'}
              onDone={() => logTask('annual_rates')}
              steps={[
                { text: 'Update DWP rates in', code: 'netlify/functions/rates.js' },
                { text: 'Update frontend mirror in', code: 'src/data/benefitsRates2026.js' },
                { text: 'Redeploy to Netlify (git push)' },
                { text: 'Run 5 spot-checks against', link: 'https://www.entitledto.co.uk', linkText: 'entitledto.co.uk' },
                { text: 'Send "rates updated" email to all users via Resend' },
              ]}
              links={[
                { href: 'https://www.gov.uk/universal-credit/what-youll-get', label: 'UC rates' },
                { href: 'https://www.gov.uk/child-benefit/what-youll-get', label: 'Child Benefit' },
                { href: 'https://www.gov.uk/pip/how-much-youll-get', label: 'PIP' },
                { href: 'https://www.gov.uk/carers-allowance/what-youll-get', label: "Carer's Allowance" },
                { href: 'https://www.gov.uk/pension-credit/what-youll-get', label: 'Pension Credit' },
              ]}
            />

            {/* ── 2. DWP policy changes ─────────────────────────────────── */}
            <MaintenanceCard
              icon="📋"
              title="DWP Policy Changes"
              freq="After each Budget / Autumn Statement / DWP announcement"
              lastDone={fmtDate(maintenance?.latest?.policy_review?.completed_at)}
              daysSince={daysSince(maintenance?.latest?.policy_review?.completed_at)}
              overdueAfter={null}
              taskKey="policy_review"
              saving={maintSaving === 'policy_review'}
              onDone={() => logTask('policy_review')}
              steps={[
                { text: 'Check GOV.UK news for eligibility rule changes (not just rates)', link: 'https://www.gov.uk/government/organisations/department-for-work-pensions/about', linkText: 'DWP news' },
                { text: 'Update Claude system prompt in', code: 'netlify/functions/rates.js buildSystemPrompt()' },
                { text: 'Update validation logic in', code: 'netlify/functions/calculate-benefits.js validateBenefit()' },
                { text: 'If new benefits added or removed, update VALID_ANSWERS and INTERACTION_RULES' },
                { text: 'Redeploy and re-run spot-checks' },
              ]}
            />

            {/* ── 3. Monthly spot-check ─────────────────────────────────── */}
            <MaintenanceCard
              icon="🔍"
              title="Monthly Accuracy Spot-Check"
              freq="Every 30 days — run 3–4 scenarios through the live app"
              lastDone={fmtDate(maintenance?.latest?.monthly_spotcheck?.completed_at)}
              daysSince={daysSince(maintenance?.latest?.monthly_spotcheck?.completed_at)}
              overdueAfter={35}
              taskKey="monthly_spotcheck"
              saving={maintSaving === 'monthly_spotcheck'}
              onDone={() => logTask('monthly_spotcheck')}
              steps={[
                { text: 'Pick 3–4 varied profiles (different age, housing, health)' },
                { text: 'Run each through your live app at', link: 'https://claimsmart.uk/check', linkText: 'claimsmart.uk/check' },
                { text: 'Enter the same answers at', link: 'https://www.entitledto.co.uk', linkText: 'entitledto.co.uk' },
                { text: 'If any benefit is off by >15%, investigate: Claude error, rates error, or user input?' },
                { text: 'Fix root cause and mark done' },
              ]}
            />

            {/* ── 4. Complaint reviews ──────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-start gap-3">
                <span className="text-xl mt-0.5">📩</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">User Complaint Reviews</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Review every 10th complaint — identify error type, fix root cause</p>
                </div>
                {/* Complaint counter */}
                <div className="text-right">
                  <p
                    className="text-2xl font-bold"
                    style={{ color: (maintenance?.complaintsSinceReview || 0) >= 10 ? '#dc2626' : '#0f766e' }}
                  >
                    {maintenance?.complaintsSinceReview ?? '—'}<span className="text-sm font-normal text-gray-400">/10</span>
                  </p>
                  <p className="text-xs text-gray-400">since last review</p>
                </div>
              </div>
              <div className="p-5">
                <ol className="space-y-2 mb-5">
                  {[
                    'Pull up the user\'s specific answers from the admin Supabase → reports table',
                    'Check Claude\'s raw output for that report',
                    'Identify: Claude error (wrong benefit/amount), rates error (stale figures), or user input error (misunderstood question)',
                    'Fix the root cause in the appropriate file',
                    'Mark the review done below',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-600">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="flex gap-3">
                  <button
                    onClick={() => logTask('complaint_logged')}
                    disabled={maintSaving === 'complaint_logged'}
                    className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {maintSaving === 'complaint_logged' ? 'Logging…' : '+ Log complaint'}
                  </button>
                  <button
                    onClick={() => logTask('complaint_review', `Reviewed ${maintenance?.complaintsSinceReview || 0} complaints`)}
                    disabled={maintSaving === 'complaint_review'}
                    className="flex-1 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {maintSaving === 'complaint_review' ? 'Saving…' : 'Mark review done'}
                  </button>
                </div>
                {maintenance?.latest?.complaint_review && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Last review: {fmtDate(maintenance.latest.complaint_review.completed_at)}
                  </p>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// ── MaintenanceCard sub-component ──────────────────────────────────────────
function MaintenanceCard({ icon, title, freq, lastDone, daysSince, overdueAfter, taskKey, saving, onDone, steps, links }) {
  const isOverdue = overdueAfter !== null && (daysSince === null || daysSince > overdueAfter)

  return (
    <div
      className="bg-white border rounded-xl overflow-hidden"
      style={{ borderColor: isOverdue ? '#fca5a5' : '#e5e7eb' }}
    >
      <div
        className="p-5 border-b flex items-start gap-3"
        style={{ borderColor: isOverdue ? '#fee2e2' : '#f3f4f6' }}
      >
        <span className="text-xl mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{freq}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-medium" style={{ color: isOverdue ? '#dc2626' : '#0f766e' }}>
            {lastDone === 'Never' ? 'Never done' : `Done ${lastDone}`}
          </p>
          {daysSince !== null && (
            <p className="text-xs text-gray-400">{daysSince} day{daysSince !== 1 ? 's' : ''} ago</p>
          )}
        </div>
      </div>

      <div className="p-5">
        <ol className="space-y-2 mb-5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-600">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span>
                {step.text}{' '}
                {step.code && <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{step.code}</code>}
                {step.link && <a href={step.link} target="_blank" rel="noreferrer" className="text-teal-600 underline hover:no-underline">{step.linkText}</a>}
              </span>
            </li>
          ))}
        </ol>

        {links && links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {links.map(l => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer"
                className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors">
                {l.label} →
              </a>
            ))}
          </div>
        )}

        <button
          onClick={onDone}
          disabled={saving}
          className="w-full py-2.5 text-sm font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : '✓ Mark all steps done'}
        </button>
      </div>
    </div>
  )
}
