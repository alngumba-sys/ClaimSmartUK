import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatGBP } from '../data/benefitsRates2026'
import { getInteractionWarnings } from '../data/benefitInteractions'

const STATUS_OPTIONS = [
  { value: 'not_started',   label: 'Not started',     bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)'  },
  { value: 'in_progress',   label: 'In progress',     bg: 'rgba(212,150,10,0.15)',  color: '#d4960a'                },
  { value: 'claimed',       label: 'Claimed ✓',       bg: 'rgba(74,222,128,0.15)',  color: '#4ade80'                },
  { value: 'not_applicable',label: 'Not applicable',  bg: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)'  },
]

// ── styles matching dark purple brand ─────────────────────────────────────────
const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding: '20px 24px',
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [searchParams]    = useSearchParams()
  const [report, setReport]             = useState(null)
  const [claimStatuses, setClaimStatuses] = useState({})
  const [loading, setLoading]           = useState(true)
  const [linkingSession, setLinkingSession] = useState(false)

  const navigate = useNavigate()

  // If admin signed in via Google OAuth, redirect to /admin
  useEffect(() => {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'alngumba@gmail.com'
    if (user && user.email === adminEmail) {
      navigate('/admin', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    if (user) loadDashboard()
  }, [user])

  async function loadDashboard() {
    setLoading(true)
    try {
      // ── Try to link an anonymous Stripe session to this account ───────────
      // When a user pays without being logged in, then signs in, we attempt
      // to claim their report by matching the Stripe session stored in
      // sessionStorage or passed as a URL param.
      const stripeSession =
        searchParams.get('stripe_session') ||
        sessionStorage.getItem('claimsmart_stripe_session')

      if (stripeSession) {
        setLinkingSession(true)
        try {
          // Get JWT to prove identity server-side — never send userId from client
          const { data: { session: authSession } } = await supabase.auth.getSession()
          const jwt = authSession?.access_token || ''
          await fetch('/api/link-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({ sessionId: stripeSession }),
          })
        } catch (e) {
          console.warn('Session link failed:', e.message)
        }
        sessionStorage.removeItem('claimsmart_stripe_session')
        setLinkingSession(false)
      }

      // ── Load paid report ──────────────────────────────────────────────────
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('paid', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (reports && reports.length > 0) {
        setReport(reports[0])
        const { data: statuses } = await supabase
          .from('claim_status')
          .select('*')
          .eq('report_id', reports[0].id)
        const statusMap = {}
        statuses?.forEach(s => { statusMap[s.benefit_name] = s })
        setClaimStatuses(statusMap)
      } else {
        // ── No DB report — try sessionStorage (user paid without account) ───
        const cached = sessionStorage.getItem('claimsmart_benefits')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed?.benefits?.length > 0) {
              // Synthetic report object from session data
              setReport({
                id: null,
                benefits: parsed.benefits,
                total_monthly_pence: Math.round((parsed.totalMonthly || 0) * 100),
                total_annual_pence:  Math.round((parsed.totalAnnual  || 0) * 100),
                created_at: new Date().toISOString(),
                fromCache: true,
              })
            }
          } catch (e) { console.warn('Failed to parse cached benefits:', e.message) }
        }
      }
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(benefitName, newStatus) {
    if (!report?.id) return // can't persist without a DB report id
    const existing = claimStatuses[benefitName]
    const update   = { user_id: user.id, report_id: report.id, benefit_name: benefitName, status: newStatus }
    if (existing) {
      await supabase.from('claim_status').update({ status: newStatus }).eq('id', existing.id)
    } else {
      await supabase.from('claim_status').insert(update)
    }
    setClaimStatuses(prev => ({ ...prev, [benefitName]: { ...(existing || update), status: newStatus } }))
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || linkingSession) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {linkingSession ? 'Loading your report...' : 'Loading your dashboard...'}
          </p>
        </div>
      </DashboardLayout>
    )
  }

  // ── No report — prompt questions ───────────────────────────────────────────
  if (!report) {
    return (
      <DashboardLayout>
        <div className="max-w-lg">
          {/* Welcome header */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-white mb-1">
              Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              You haven't run a benefits check yet.
            </p>
          </div>

          {/* Prompt card */}
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{ border: '1px solid rgba(212,150,10,0.3)', background: 'rgba(212,150,10,0.06)' }}
          >
            <div
              className="px-6 py-5 text-center"
              style={{ borderBottom: '1px solid rgba(212,150,10,0.15)' }}
            >
              <p
                className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(212,150,10,0.6)' }}
              >
                You could be missing
              </p>
              <p className="text-4xl font-extrabold mb-1" style={{ color: '#f0c040' }}>
                £3,428
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                average unclaimed per UK household · per year
              </p>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Answer 8 quick questions about your circumstances and we'll calculate
                exactly which benefits you qualify for — based on 2026/27 DWP rates.
              </p>

              <div className="space-y-2.5 mb-6">
                {[
                  'Takes 8 minutes',
                  'Free to check — see your results before paying',
                  'Based on your exact circumstances, not generic estimates',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(212,150,10,0.2)' }}
                    >
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24"
                        stroke="#d4960a" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{item}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/check"
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #d4960a, #f0c040)', color: '#0f0722' }}
              >
                Check my entitlement — free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Trust line */}
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Results are estimates · Always confirm with DWP or Citizens Advice
          </p>
        </div>
      </DashboardLayout>
    )
  }

  // ── Has report — show full dashboard ──────────────────────────────────────
  const benefits     = report.benefits || []
  const claimedCount = Object.values(claimStatuses).filter(s => s.status === 'claimed').length
  const totalMonthly = report.total_monthly_pence / 100
  const totalAnnual  = report.total_annual_pence  / 100
  const interactions = getInteractionWarnings(benefits.map(b => b.name))

  return (
    <DashboardLayout>
      <div className="max-w-3xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-white mb-1">
            Hi {profile?.full_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Report generated{' '}
            {new Date(report.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            {report.fromCache && ' · Not yet saved to your account'}
          </p>
        </div>

        {/* Cache notice — nudge to pay if they used the free preview */}
        {report.fromCache && (
          <div
            className="rounded-xl px-5 py-4 mb-6 flex items-start gap-3"
            style={{ background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.2)' }}
          >
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
              stroke="#d4960a" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: '#d4960a' }}>
                This is a preview of your results
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Unlock your full report for £9 to see step-by-step claim instructions,
                save your progress, and track your claims.
              </p>
              <Link
                to="/results"
                className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                style={{ background: '#d4960a', color: '#0f0722' }}
              >
                Unlock full report — £9
              </Link>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Monthly entitlement', value: `£${Math.round(totalMonthly).toLocaleString()}`, color: '#f0c040' },
            { label: 'Annual entitlement',  value: `£${Math.round(totalAnnual).toLocaleString()}`,  color: '#d4960a' },
            { label: 'Benefits found',      value: String(benefits.length),                          color: 'rgba(255,255,255,0.9)' },
            { label: 'Benefits claimed',    value: `${claimedCount} of ${benefits.length}`,          color: '#4ade80' },
          ].map(stat => (
            <div key={stat.label} style={card}>
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</p>
              <p className="text-xl font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Benefits Watch banner — only if not subscribed and has a paid report */}
        {!profile?.benefits_watch_active && !report.fromCache && (() => {
          const month = new Date().getMonth() + 1 // 1-12
          const isPreApril  = month >= 1 && month <= 3
          const isApril     = month === 4
          const message = isApril
            ? { headline: 'DWP rates just changed', sub: 'Benefits Watch would have alerted you automatically. Make sure you never miss an increase again.', urgency: true }
            : isPreApril
            ? { headline: 'DWP rates change in April', sub: 'Benefits Watch will alert you the moment new rates are published — so you know exactly what changed for you.', urgency: true }
            : { headline: 'Never miss a rate increase', sub: 'DWP updates benefit rates every April. Benefits Watch monitors your entitlement automatically and emails you when anything changes.', urgency: false }

          return (
            <div
              className="rounded-2xl p-5 mb-6 flex items-start justify-between gap-4"
              style={{
                background: message.urgency ? 'rgba(212,150,10,0.1)' : 'rgba(255,255,255,0.04)',
                border: message.urgency ? '1px solid rgba(212,150,10,0.3)' : '1px solid rgba(255,255,255,0.09)',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {message.urgency && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(212,150,10,0.2)', color: '#d4960a' }}
                    >
                      {isApril ? 'Rates updated' : 'Coming soon'}
                    </span>
                  )}
                  <p className="text-sm font-bold text-white">{message.headline}</p>
                </div>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {message.sub}
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    to="/benefits-watch"
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                    style={{ background: '#d4960a', color: '#0f0722' }}
                  >
                    Start Benefits Watch — £3.99/mo
                  </Link>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Cancel anytime
                  </span>
                </div>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(212,150,10,0.15)' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>
          )
        })()}

        {/* Benefits list */}
        <h2 className="text-base font-bold text-white mb-3">Your benefits</h2>
        <div className="space-y-3 mb-8">
          {benefits.map(benefit => {
            const statusEntry  = claimStatuses[benefit.name]
            const currentStatus = statusEntry?.status || 'not_started'
            const statusCfg    = STATUS_OPTIONS.find(s => s.value === currentStatus)

            return (
              <div key={benefit.name} style={card}>
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm truncate">{benefit.name}</h3>
                    <p className="font-bold text-sm mt-0.5" style={{ color: '#f0c040' }}>
                      £{Number(benefit.monthlyAmount).toFixed(2)}/month
                    </p>
                  </div>
                  {!report.fromCache && (
                    <select
                      value={currentStatus}
                      onChange={e => updateStatus(benefit.name, e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer flex-shrink-0"
                      style={{ background: statusCfg.bg, color: statusCfg.color }}
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {benefit.explanation}
                </p>

                {/* Claim steps — blurred if fromCache */}
                {report.fromCache ? (
                  <div
                    className="relative rounded-lg px-3 py-2 overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="filter blur-sm select-none">
                      {(benefit.howToClaim || []).map((step, i) => (
                        <p key={i} className="text-xs text-gray-400 flex gap-2 mb-1">
                          <span className="font-medium" style={{ color: '#d4960a' }}>{i + 1}.</span>
                          {step}
                        </p>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(15,7,34,0.6)' }}>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full"
                        style={{ background: 'rgba(212,150,10,0.15)', color: '#d4960a' }}>
                        Unlock to see claim steps
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(benefit.howToClaim || []).map((step, i) => (
                      <p key={i} className="text-xs flex gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <span className="font-medium flex-shrink-0" style={{ color: '#d4960a' }}>{i + 1}.</span>
                        {step}
                      </p>
                    ))}
                  </div>
                )}

                {benefit.officialLink && !report.fromCache && (
                  <a
                    href={benefit.officialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-xs font-semibold inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ color: '#d4960a' }}
                  >
                    Official GOV.UK page
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )
          })}
        </div>

        {/* Interaction warnings */}
        {interactions.length > 0 && !report.fromCache && (
          <div className="mb-8 space-y-3">
            <h2 className="text-base font-bold text-white mb-3">
              Important: benefit interactions
            </h2>
            {interactions.map(w => (
              <div
                key={w.id}
                className="rounded-xl p-4 flex items-start gap-3"
                style={
                  w.severity === 'warning'
                    ? { background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.25)' }
                    : { background: 'rgba(96,165,250,0.08)',  border: '1px solid rgba(96,165,250,0.2)'  }
                }
              >
                <span className="text-base flex-shrink-0 mt-0.5">
                  {w.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold mb-1"
                    style={{ color: w.severity === 'warning' ? '#d4960a' : '#60a5fa' }}
                  >
                    {w.headline}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {w.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Re-check CTA */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: 'rgba(212,150,10,0.06)', border: '1px solid rgba(212,150,10,0.2)' }}
        >
          <h3 className="font-bold text-white mb-1">Circumstances changed?</h3>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
            New job, new baby, change in health? Re-run your assessment to see your updated entitlement.
          </p>
          <Link
            to="/check"
            className="inline-block text-sm font-bold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
            style={{ background: '#d4960a', color: '#0f0722' }}
          >
            Re-check my entitlement
          </Link>
        </div>

        {/* Disclaimer */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Results are estimates based on current DWP rates (April 2026/27) and the information
            you provided. Actual entitlement depends on your full individual circumstances, which
            only DWP can assess. ClaimSmart UK is not a benefits adviser or financial adviser.
            Always confirm your entitlement directly with DWP (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>0800 328 5644</span>) or Citizens Advice (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>0800 144 8848</span>
            ) before making any financial decisions.
          </p>
        </div>

      </div>
    </DashboardLayout>
  )
}
