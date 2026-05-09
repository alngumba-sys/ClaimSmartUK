import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

function formatGBP(pence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(pence / 100)
}

async function getJWT() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding: '20px 24px',
}

export default function BenefitsWatchPage() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [loading, setLoading]           = useState(false)
  const [alerts, setAlerts]             = useState([])
  const [showToast, setShowToast]       = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling]     = useState(false)

  const isActive = profile?.benefits_watch_active

  useEffect(() => {
    if (searchParams.get('activated') === 'true') {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 5000)
    }
  }, [searchParams])

  useEffect(() => {
    if (!user || !isActive) return
    supabase
      .from('watch_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setAlerts(data || []))
  }, [user, isActive])

  // ── Subscribe — sends userId + email (no sensitive action, JWT not required) ─
  // create-subscription only creates a Stripe checkout URL — no data is modified
  async function handleSubscribe() {
    setLoading(true)
    try {
      const jwt = await getJWT()
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ userEmail: user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  // ── Cancel — sends JWT so server verifies identity, no userId in body ────────
  async function handleCancel() {
    setCancelling(true)
    try {
      const jwt = await getJWT()
      await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({}),
      })
      setCancelConfirm(false)
      window.location.reload()
    } catch {
      setCancelling(false)
    }
  }

  const monthsActive = profile?.benefits_watch_started_at
    ? Math.max(1, Math.ceil((Date.now() - new Date(profile.benefits_watch_started_at)) / (30 * 86400000)))
    : 0

  const nextCheck = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 1)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  })()

  const periodEnd = profile?.benefits_watch_current_period_end
    ? new Date(profile.benefits_watch_current_period_end).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  // ── INACTIVE — upsell ──────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(212,150,10,0.3)' }}>

            {/* Header */}
            <div className="px-6 py-8 text-center" style={{ background: 'rgba(212,150,10,0.08)' }}>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(212,150,10,0.2)' }}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-white">Benefits Watch</h1>
              <p className="mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Never miss a rate change again</p>
              <p className="text-white text-3xl font-extrabold mt-4">
                £3.99<span className="text-base font-normal" style={{ color: 'rgba(255,255,255,0.5)' }}>/month</span>
              </p>
            </div>

            {/* Features */}
            <div className="px-6 py-6 space-y-3" style={{ borderTop: '1px solid rgba(212,150,10,0.15)' }}>
              {[
                'Monthly automatic re-check of your entitlement',
                'Instant rate change alerts when DWP updates figures',
                'Annual April update email with new rates',
                'Value protected tracker — see how much we\'ve saved you',
                'Cancel anytime — no contract',
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(212,150,10,0.2)' }}
                  >
                    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Callout */}
            <div
              className="mx-6 mb-6 rounded-xl px-4 py-3"
              style={{ background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.2)' }}
            >
              <p className="text-sm" style={{ color: '#d4960a' }}>
                One caught rate increase pays for months of Watch.
              </p>
            </div>

            {/* CTA */}
            <div className="px-6 pb-6">
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #d4960a, #f0c040)', color: '#0f0722' }}
              >
                {loading ? 'Redirecting to Stripe...' : 'Start Benefits Watch — £3.99/month'}
              </button>
              <p className="text-xs text-center mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Secure payment via Stripe · Cancel anytime from this page
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // ── ACTIVE — dashboard ─────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Success toast */}
      {showToast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2"
          style={{ background: '#d4960a', color: '#0f0722' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-bold">Benefits Watch is now active</span>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-extrabold text-white mb-6">Benefits Watch</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Value protected', value: formatGBP(profile?.total_value_protected_pence || 0), color: '#f0c040' },
            { label: 'Months active',   value: String(monthsActive),                                  color: '#d4960a' },
            { label: 'Next check',      value: nextCheck,                                              color: 'rgba(255,255,255,0.8)' },
          ].map(s => (
            <div key={s.label} style={card}>
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              <p className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* What we monitor */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: 'rgba(212,150,10,0.06)', border: '1px solid rgba(212,150,10,0.2)' }}
        >
          <h3 className="text-sm font-bold text-white mb-3">What we monitor for you</h3>
          <ul className="space-y-2">
            {[
              'DWP rate changes every April (and mid-year adjustments)',
              'Universal Credit, PIP, Child Benefit, Pension Credit rates',
              'Council Tax Reduction and housing benefit thresholds',
              'New benefits you may have become eligible for',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(212,150,10,0.2)' }}>
                  <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Alert history */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="font-bold text-white text-sm">Alert history</h3>
          </div>
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                No alerts yet. Your first check will run on the 1st of next month.
              </p>
            </div>
          ) : (
            <div>
              {alerts.map(a => {
                const diff = (a.difference_pence || 0) / 100
                const sign = diff >= 0 ? '+' : ''
                return (
                  <div
                    key={a.id}
                    className="px-5 py-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div>
                      <p className="text-sm text-white">{a.title}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {a.email_sent && ' · Email sent'}
                      </p>
                    </div>
                    {a.difference_pence !== null && a.difference_pence !== 0 && (
                      <span
                        className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{
                          background: diff >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                          color:      diff >= 0 ? '#4ade80'               : '#f87171',
                        }}
                      >
                        {sign}£{Math.abs(Math.round(diff))}/mo
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Subscription management */}
        <div style={card}>
          <h3 className="font-bold text-white mb-1">Subscription</h3>
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>£3.99/month · Benefits Watch</p>
          {periodEnd && (
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Current period ends {periodEnd}
            </p>
          )}

          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              className="text-sm transition-opacity hover:opacity-80"
              style={{ color: 'rgba(248,113,113,0.7)' }}
            >
              Cancel subscription
            </button>
          ) : (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}
            >
              <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Are you sure? You'll lose automatic monitoring at the end of your billing period.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="text-sm font-bold px-4 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171' }}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Keep subscription
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
