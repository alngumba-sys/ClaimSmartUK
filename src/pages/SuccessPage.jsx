import { useEffect, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return Math.round(n).toLocaleString('en-GB')
}

function fmtDec(n) {
  return Number(n).toFixed(2)
}

// ─── sub-components ───────────────────────────────────────────────────────────

function LikelihoodBadge({ likelihood }) {
  const map = {
    high:     { label: 'High likelihood',  bg: 'rgba(212,150,10,0.15)', color: '#d4960a' },
    medium:   { label: 'Worth checking',   bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
    possible: { label: 'Possible',         bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' },
  }
  const cfg = map[likelihood] || map.possible
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function UrgencyBadge({ urgency }) {
  const isUrgent = urgency?.toLowerCase().includes('week')
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
        color: isUrgent ? '#f87171' : 'rgba(255,255,255,0.4)',
      }}
    >
      {urgency || 'Worth checking'}
    </span>
  )
}

function BenefitCard({ benefit, index }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: 'rgba(212,150,10,0.15)', color: '#d4960a' }}
          >
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm truncate">{benefit.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <LikelihoodBadge likelihood={benefit.likelihood} />
              <UrgencyBadge urgency={benefit.urgency} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <div className="text-right">
            <p className="font-extrabold text-base" style={{ color: '#f0c040' }}>
              £{fmtDec(benefit.monthlyAmount)}/mo
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              £{fmt(benefit.annualAmount)}/yr
            </p>
          </div>
          <svg
            className="w-4 h-4 transition-transform duration-200 flex-shrink-0"
            style={{
              color: 'rgba(255,255,255,0.3)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div
          className="px-5 pb-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-sm leading-relaxed mt-4 mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {benefit.explanation}
          </p>

          {/* How to claim steps */}
          {benefit.howToClaim && benefit.howToClaim.length > 0 && (
            <div className="mb-4">
              <p
                className="text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(212,150,10,0.7)' }}
              >
                How to claim
              </p>
              <div className="space-y-2">
                {benefit.howToClaim.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(212,150,10,0.15)', color: '#d4960a' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official link */}
          {benefit.officialLink && (
            <a
              href={benefit.officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#d4960a' }}
            >
              Official GOV.UK page
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Email opt-in panel ───────────────────────────────────────────────────────

function EmailPanel({ customerEmail, sessionId }) {
  const [email, setEmail]     = useState(customerEmail || '')
  const [sent, setSent]       = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')

  async function handleSend() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setSending(true)
    setError('')
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const jwt = authSession?.access_token || ''
      const res = await fetch('/api/resend-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ sessionId, email }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        setError('Failed to send. Please try again or contact hello@claimsmart.uk')
      }
    } catch {
      setError('Failed to send. Please try again or contact hello@claimsmart.uk')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-3"
        style={{ background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.2)' }}
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm font-semibold" style={{ color: '#d4960a' }}>
          Report sent to {email}. Check your inbox and spam folder.
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-bold text-white">Your report has been emailed</p>
      </div>
      <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {customerEmail
          ? <>We sent a PDF copy to <strong style={{ color: 'white' }}>{customerEmail}</strong>. If you'd like it sent to a different address, enter it below.</>
          : 'Enter your email below to receive a PDF copy of your report.'
        }
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          maxLength={254}
          onChange={e => {
            const val = e.target.value.replace(/[ -]/g, '')
            setEmail(val)
            setError('')
          }}
          placeholder={customerEmail ? "Send to a different email..." : "your@email.com"}
          className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none min-w-0"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.12)'}`,
            color: 'white',
            caretColor: '#d4960a',
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending}
          className="px-4 py-2.5 rounded-lg text-sm font-bold flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#d4960a', color: '#0f0722' }}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
      {error && (
        <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{error}</p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuccessPage() {
  const [searchParams]  = useSearchParams()
  const [status, setStatus]       = useState('loading')
  const [sessionData, setSessionData] = useState(null)
  const [benefits, setBenefits]   = useState([])
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) { setStatus('error'); return }

    fetch(`/api/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.paid) {
          setSessionData(data)
          setStatus('complete')
          sessionStorage.setItem('claimsmart_stripe_session', sessionId)

          // Load benefits from sessionStorage (set by QuestionFlow teaser screen)
          const cached = sessionStorage.getItem('claimsmart_benefits')
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              setBenefits(parsed.benefits || [])
            } catch (e) { console.warn("Failed to parse cached benefits:", e.message) }
          }
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [sessionId])

  function shareWhatsApp() {
    // Include referral code if user is logged in so they earn £2
    const referralCode = profile?.referral_code
    const baseUrl = import.meta.env.VITE_APP_URL || 'https://claimsmartuk.com'
    const shareUrl = referralCode ? `${baseUrl}?ref=${referralCode}` : baseUrl
    const text = encodeURIComponent(
      `I used ClaimSmart UK and found £${Math.round((sessionData?.totalMonthly || 0) * 12).toLocaleString()} a year in benefits I didn't know I was owed. Check what you're entitled to in 8 minutes — it's free to check: ${shareUrl}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
          <div
            className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-5"
            style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
          />
          <h2 className="text-lg font-semibold text-white">Verifying your payment...</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            This takes a few seconds
          </p>
        </div>
      </Layout>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(239,68,68,0.15)' }}
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            We couldn't verify your payment. If you were charged, contact{' '}
            <a href="mailto:hello@claimsmart.uk" className="underline" style={{ color: '#d4960a' }}>
              hello@claimsmart.uk
            </a>{' '}
            and we'll sort it immediately.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#d4960a', color: '#0f0722' }}
          >
            Back to home
          </Link>
        </div>
      </Layout>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────
  const { totalMonthly, benefitsCount, customerEmail } = sessionData || {}
  const totalAnnual = sessionData?.totalAnnual || totalMonthly * 12

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Home
          </Link>
          <div style={{ width: 60 }} />
        </div>

        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(212,150,10,0.15)', border: '2px solid #d4960a' }}
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Your report is ready</h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your full benefits breakdown is below.
            {customerEmail && <span> We also emailed a summary to <strong className="text-white">{customerEmail}</strong>.</span>}
          </p>
          {user && (
            <button
              onClick={async () => { await signOut(); navigate('/') }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          )}
        </div>

        {/* ── Total summary card ── */}
        {totalMonthly > 0 && (
          <div
            className="rounded-2xl p-6 mb-6 text-center"
            style={{ background: 'rgba(212,150,10,0.1)', border: '1px solid rgba(212,150,10,0.25)' }}
          >
            <p
              className="text-xs font-bold tracking-widest uppercase mb-2"
              style={{ color: 'rgba(212,150,10,0.7)' }}
            >
              Estimated monthly entitlement
            </p>
            <p className="text-5xl font-extrabold mb-1" style={{ color: '#f0c040' }}>
              £{fmt(totalMonthly)}
            </p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              per month · up to £{fmt(totalAnnual)}/yr
              {benefitsCount ? ` · ${benefitsCount} benefits found` : ''}
            </p>
          </div>
        )}

        {/* ── Primary CTA ── */}
        <div className="space-y-3 mb-8">
          {loading ? (
            // Auth still resolving — show neutral placeholder, never flash wrong text
            <div
              className="w-full py-4 rounded-xl animate-pulse"
              style={{ background: 'rgba(212,150,10,0.15)', height: 56 }}
            />
          ) : user ? (
            // Logged in — go straight to dashboard
            <Link
              to="/dashboard"
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
              style={{ background: '#d4960a', color: '#0f0722' }}
            >
              View my full report in dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          ) : null}
        </div>

        {/* ── Inline report ── */}
        {benefits.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-white">
                Your benefits breakdown
              </h2>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(212,150,10,0.15)', color: '#d4960a' }}
              >
                {benefits.length} benefits found
              </span>
            </div>

            {/* Disclaimer */}
            <div
              className="rounded-xl px-4 py-3 mb-4 flex gap-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Results are estimates based on DWP rates April 2026/27 and your answers.
                Always confirm your entitlement with DWP (0800 328 5644) or Citizens Advice
                (0800 144 8848) before applying.
              </p>
            </div>

            {/* Benefit cards — first one open, rest collapsed */}
            <div className="space-y-3">
              {benefits.map((benefit, i) => (
                <BenefitCard key={benefit.name} benefit={benefit} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── Email PDF panel ── */}
        <div className="mb-8">
          <EmailPanel customerEmail={customerEmail} sessionId={sessionId} />
        </div>

        {/* ── Action plan ── */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h3 className="font-bold text-white mb-4">Your action plan this week</h3>
          <ol className="space-y-3">
            {[
              'Start with the benefit marked "Claim this week" — it has the highest value and fastest process',
              'Have your National Insurance number, bank details, and any relevant medical letters ready',
              'Visit the GOV.UK link for each benefit — click the official page link in each card above',
              'If anything is unclear, call Citizens Advice free on 0800 144 8848',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(212,150,10,0.2)', color: '#d4960a' }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* ── Share ── */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h3 className="font-bold text-white mb-1">Know someone missing out?</h3>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Share ClaimSmart with friends or family — and earn £2 for every person who gets their report.
          </p>
          <button
            onClick={shareWhatsApp}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: '#25d366', color: '#fff' }}
          >
            Share on WhatsApp
          </button>
          {user && (
            <Link
              to="/referrals"
              className="mt-2 block text-center text-xs transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              View your referral link & earnings →
            </Link>
          )}
        </div>

        {/* ── Benefits Watch upsell ── */}
        {user && !profile?.benefits_watch_active && (
          <div
            className="rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,150,10,0.2)' }}
          >
            <h3 className="font-bold text-white mb-2">Never miss a rate increase</h3>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              DWP changes rates every April. Benefits Watch monitors your entitlement
              automatically and alerts you the moment anything changes — for £3.99/month.
            </p>
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: '#d4960a' }}>£3.99/month</span>
              <Link
                to="/benefits-watch"
                className="text-sm font-bold px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
                style={{ background: '#d4960a', color: '#0f0722' }}
              >
                Learn more →
              </Link>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
