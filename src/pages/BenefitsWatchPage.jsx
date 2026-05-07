import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

function formatGBP(pence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(pence / 100)
}

export default function BenefitsWatchPage() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [showToast, setShowToast] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

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

  async function handleSubscribe() {
    setLoading(true)
    try {
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userEmail: user.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoading(false)
    } catch {
      setLoading(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      setCancelConfirm(false)
      window.location.reload()
    } catch {
      setCancelling(false)
    }
  }

  // Active state calculations
  const monthsActive = profile?.benefits_watch_started_at
    ? Math.max(1, Math.ceil((Date.now() - new Date(profile.benefits_watch_started_at)) / (30 * 86400000)))
    : 0
  const nextCheck = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 1)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  })()
  const periodEnd = profile?.benefits_watch_current_period_end
    ? new Date(profile.benefits_watch_current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  // ── INACTIVE — upsell ──────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-teal-600 px-6 py-8 text-center">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Benefits Watch</h1>
              <p className="text-teal-100 mt-1">Never miss a rate change again</p>
              <p className="text-white text-3xl font-bold mt-4">£3.99<span className="text-base font-normal text-teal-100">/month</span></p>
            </div>

            {/* Features */}
            <div className="px-6 py-6 space-y-3">
              {[
                'Monthly automatic re-check of your entitlement',
                'Instant rate change alerts when DWP updates figures',
                'Annual April update email with new rates',
                'Value protected tracker — see how much we\'ve saved you',
                'Cancel anytime — no contract',
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">{f}</span>
                </div>
              ))}
            </div>

            {/* Callout */}
            <div className="mx-6 mb-6 rounded-xl px-4 py-3 bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                One caught rate increase pays for months of Watch.
              </p>
            </div>

            {/* CTA */}
            <div className="px-6 pb-6">
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Redirecting to Stripe...' : 'Start Benefits Watch — £3.99/month'}
              </button>
              <p className="text-xs text-gray-400 text-center mt-3">
                Secure payment via Stripe. Cancel anytime from this page.
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
        <div className="fixed top-4 right-4 z-50 bg-teal-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-[slideIn_0.3s_ease-out]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">Benefits Watch is now active</span>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Benefits Watch</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Value protected</p>
            <p className="text-xl font-bold text-teal-600">
              {formatGBP(profile?.total_value_protected_pence || 0)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Months active</p>
            <p className="text-xl font-bold text-teal-600">{monthsActive}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Next check</p>
            <p className="text-sm font-bold text-teal-600">{nextCheck}</p>
          </div>
        </div>

        {/* What we monitor */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-teal-800 mb-3">What we monitor for you</h3>
          <ul className="space-y-2">
            {[
              'DWP rate changes every April (and mid-year adjustments)',
              'Universal Credit, PIP, Child Benefit, Pension Credit rates',
              'Council Tax Reduction and housing benefit thresholds',
              'New benefits you may have become eligible for',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-teal-700">
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Alert history */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Alert history</h3>
          </div>
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">No alerts yet. Your first check will run on the 1st of next month.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {alerts.map(a => {
                const diff = (a.difference_pence || 0) / 100
                const sign = diff >= 0 ? '+' : ''
                return (
                  <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900">{a.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {a.email_sent && ' · Email sent'}
                      </p>
                    </div>
                    {a.difference_pence !== null && a.difference_pence !== 0 && (
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{
                          background: diff >= 0 ? '#dcfce7' : '#fef2f2',
                          color: diff >= 0 ? '#166534' : '#991b1b',
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
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Subscription</h3>
          <p className="text-sm text-gray-500 mb-1">£3.99/month · Benefits Watch</p>
          {periodEnd && (
            <p className="text-xs text-gray-400 mb-4">Current period ends {periodEnd}</p>
          )}

          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              Cancel subscription
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 mb-3">
                Are you sure? You'll lose access to automatic monitoring at the end of your current billing period.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="text-sm font-medium text-white bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="text-sm text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100"
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
