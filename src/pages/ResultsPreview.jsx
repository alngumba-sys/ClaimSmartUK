import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useDWPStats } from '../hooks/useDWPStats'
import { getInteractionWarnings } from '../data/benefitInteractions'

export default function ResultsPreview() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const { getRegionStats } = useDWPStats()

  useEffect(() => {
    const stored = sessionStorage.getItem('claimsmart_benefits')
    if (!stored) {
      navigate('/check', { replace: true })
      return
    }
    try {
      setData(JSON.parse(stored))
    } catch {
      navigate('/check', { replace: true })
    }
  }, [navigate])

  async function handleUnlock() {
    setCheckoutLoading(true)
    try {
      const answers = JSON.parse(sessionStorage.getItem('claimsmart_answers') || '{}')
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          benefits: data.benefits,
          totalMonthly: data.totalMonthly,
          totalAnnual: data.totalAnnual,
          userId: user?.id || null,
          referralCode: sessionStorage.getItem('referralCode') || '',
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || `Server error ${res.status}`)
      }
      if (json.url) {
        window.location.href = json.url
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutError(err.message || 'Something went wrong. Please try again.')
      setCheckoutLoading(false)
    }
  }

  if (!data) return null

  const { benefits = [], totalMonthly = 0, totalAnnual = 0 } = data

  // Regional context from Stat-Xplore
  const savedAnswers = (() => {
    try { return JSON.parse(sessionStorage.getItem('claimsmart_answers') || '{}') } catch { return {} }
  })()
  const userRegion = savedAnswers.region || null
  const regionStats = userRegion ? getRegionStats(userRegion) : null

  // Benefit interaction warnings
  const interactions = getInteractionWarnings(benefits.map(b => b.name))

  return (
    <Layout>
      {/* Hero */}
      <div
        className="py-12 px-4"
        style={{ background: 'linear-gradient(135deg, #0f0722 0%, #1a0f3c 60%, #2d1b69 100%)' }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm mb-3 font-medium tracking-wide uppercase" style={{ color: 'rgba(212,150,10,0.7)' }}>
            Based on your answers, you may be missing
          </p>
          <p
            className="text-5xl sm:text-6xl font-extrabold"
            style={{ color: '#d4960a' }}
          >
            £{Math.round(totalMonthly).toLocaleString()}
          </p>
          <p className="text-lg mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>per month</p>
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            That's up to £{Math.round(totalAnnual).toLocaleString()} per year you could be entitled to
          </p>
        </div>
      </div>

      {/* Benefits list */}
      <div
        className="min-h-screen"
        style={{ background: 'linear-gradient(180deg, #1a0f3c 0%, #0f0722 100%)' }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">

          {/* Regional context — shown when Stat-Xplore data is available */}
          {regionStats && (
            <div
              className="rounded-2xl p-4 mb-5 flex items-start gap-3"
              style={{
                background: 'rgba(212,150,10,0.07)',
                border: '1px solid rgba(212,150,10,0.2)',
              }}
            >
              <span className="text-lg mt-0.5">📍</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(212,150,10,0.7)' }}>
                  {userRegion} — live DWP data
                </p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <strong className="text-white">{(regionStats.claimants || 0).toLocaleString()}</strong> people in your region
                  currently receive Universal Credit.
                  Your estimate above is based on current 2026/27 DWP rates for your circumstances.
                </p>
              </div>
            </div>
          )}

          {benefits.map((benefit, i) =>
            i < 2 ? (
              /* Visible benefit card */
              <div
                key={benefit.name}
                className="rounded-2xl p-5 mb-3"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div>
                    <h3 className="font-bold text-white">{benefit.name}</h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-semibold"
                      style={
                        benefit.likelihood === 'high'
                          ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80' }
                          : { background: 'rgba(212,150,10,0.15)', color: '#d4960a' }
                      }
                    >
                      {benefit.likelihood === 'high' ? 'High likelihood' : 'Worth checking'}
                    </span>
                  </div>
                  <span className="font-extrabold text-lg whitespace-nowrap" style={{ color: '#d4960a' }}>
                    £{benefit.monthlyAmount.toFixed(2)}/mo
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{benefit.explanation}</p>
              </div>
            ) : (
              /* Blurred / locked benefit card */
              <div
                key={benefit.name}
                className="relative rounded-2xl p-5 mb-3 overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div className="blur-sm select-none">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white">{benefit.name}</h3>
                    <span className="font-extrabold text-lg" style={{ color: '#d4960a' }}>£XXX/mo</span>
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Unlock to see full details and how to claim
                  </p>
                </div>
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(15,7,34,0.5)' }}
                >
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Unlock to view
                    </span>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Benefit interaction warnings */}
          {interactions.length > 0 && (
            <div className="mt-5 space-y-3">
              {interactions.map(w => (
                <div
                  key={w.id}
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={
                    w.severity === 'warning'
                      ? { background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }
                      : { background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }
                  }
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {w.severity === 'warning' ? '⚠️' : 'ℹ️'}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-bold mb-1"
                      style={{ color: w.severity === 'warning' ? '#fbbf24' : '#60a5fa' }}
                    >
                      {w.headline}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {w.body}
                    </p>
                    <a
                      href={w.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 text-xs underline hover:no-underline inline-block"
                      style={{ color: w.severity === 'warning' ? 'rgba(251,191,36,0.7)' : 'rgba(96,165,250,0.7)' }}
                    >
                      {w.linkText} →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unlock section */}
          <div
            className="rounded-2xl p-6 mt-6 mb-8"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h2 className="text-xl font-extrabold text-white mb-4">Unlock your full report</h2>
            <ul className="space-y-2.5 mb-6">
              {[
                'Complete list of all benefits you qualify for',
                'Exact monthly amounts for your circumstances',
                'Step-by-step how to claim each benefit',
                'Priority action plan — what to do this week',
                'Personal claim calendar with all key dates',
                'Downloadable PDF report',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#d4960a' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            {/* Value nudge */}
            <div
              className="rounded-xl p-3.5 mb-5 text-sm"
              style={{
                background: 'rgba(212,150,10,0.1)',
                border: '1px solid rgba(212,150,10,0.25)',
                color: 'rgba(212,150,10,0.9)',
              }}
            >
              If you claim just one benefit we've found, you'll recover this cost in minutes.
            </div>

            <button
              onClick={handleUnlock}
              disabled={checkoutLoading}
              className="w-full font-bold py-4 rounded-xl transition-opacity hover:opacity-90 text-base min-h-[52px] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(90deg, #d4960a, #f0c040)', color: '#0f0722' }}
            >
              {checkoutLoading ? (
                <>
                  <div
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: '#0f0722', borderTopColor: 'transparent' }}
                  />
                  Redirecting to Stripe...
                </>
              ) : (
                'Get my full report — £9'
              )}
            </button>

            {checkoutError && (
              <p className="text-xs text-center mt-2" style={{ color: '#f87171' }}>
                {checkoutError}
              </p>
            )}

            <p className="text-xs text-center mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              One-time payment · No subscription · Secure via Stripe
            </p>
          </div>

          {/* Legal disclaimer */}
          <div
            className="rounded-2xl p-4 mt-2 mb-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Results are estimates based on current DWP rates (April 2026/27) and the information you provided.
              Actual entitlement depends on your full individual circumstances, which only DWP can assess.
              ClaimSmart UK is not a benefits adviser or financial adviser. Always confirm your entitlement
              directly with DWP (<span style={{ color: 'rgba(255,255,255,0.5)' }}>0800 328 5644</span>) or
              Citizens Advice (<span style={{ color: 'rgba(255,255,255,0.5)' }}>0800 144 8848</span>) before
              making any financial decisions.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
