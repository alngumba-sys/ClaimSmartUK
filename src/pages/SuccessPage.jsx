import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function SuccessPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading | complete | error
  const [sessionData, setSessionData] = useState(null)
  const { user, profile } = useAuth()
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      return
    }

    // Verify the Stripe session is genuinely paid before showing confirmation.
    // Previously this was a fake 3-second timer — now it calls the real endpoint.
    fetch(`/api/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.paid) {
          setSessionData(data)
          setStatus('complete')
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [sessionId])

  function shareWhatsApp() {
    const text = encodeURIComponent(
      "I used ClaimSmart UK to check my benefit entitlements and found money I didn't know I was owed. Check yours free: https://claimsmart.uk"
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (status === 'loading') {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-5"
            style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }} />
          <h2 className="text-lg font-semibold text-white">Verifying your payment...</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Confirming with Stripe — this takes a few seconds
          </p>
        </div>
      </Layout>
    )
  }

  if (status === 'error') {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(239,68,68,0.15)' }}>
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            We couldn't verify your payment. If you were charged, your report will still
            be emailed to you within a few minutes. Contact{' '}
            <a href="mailto:hello@claimsmart.uk" className="underline" style={{ color: '#d4960a' }}>
              hello@claimsmart.uk
            </a>{' '}
            if you need help.
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

  const { totalMonthly, benefitsCount, customerEmail } = sessionData || {}

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-12">

        {/* Success mark */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(212,150,10,0.15)', border: '2px solid #d4960a' }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Your report is ready</h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {customerEmail
              ? `We've sent it to ${customerEmail}. Check your inbox (and spam folder).`
              : "We've emailed your report. Check your inbox (and spam folder)."}
          </p>
        </div>

        {/* Summary card */}
        {totalMonthly > 0 && (
          <div
            className="rounded-2xl p-6 mb-6 text-center"
            style={{ background: 'rgba(212,150,10,0.1)', border: '1px solid rgba(212,150,10,0.25)' }}
          >
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'rgba(212,150,10,0.7)' }}>
              Estimated monthly entitlement
            </p>
            <p className="text-5xl font-extrabold" style={{ color: '#d4960a' }}>
              £{Math.round(totalMonthly).toLocaleString()}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              per month · up to £{Math.round(totalMonthly * 12).toLocaleString()}/yr
              {benefitsCount && ` · ${benefitsCount} benefits found`}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 mb-8">
          {user && (
            <Link
              to="/dashboard"
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
              style={{ background: '#d4960a', color: '#0f0722' }}
            >
              View my dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          )}
          {!user && (
            <Link
              to="/auth"
              className="w-full flex items-center justify-center py-4 rounded-xl font-bold text-sm"
              style={{ background: '#d4960a', color: '#0f0722' }}
            >
              Create account to track your claims
            </Link>
          )}
        </div>

        {/* What to do next */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h3 className="font-bold text-white mb-4">What to do next</h3>
          <ol className="space-y-3">
            {[
              'Open your PDF report and go to page 2 — your action plan',
              'Start with whichever benefit is marked "Claim this week"',
              'Have your National Insurance number ready before you start',
              'Visit gov.uk or call the relevant helpline — links are in your report',
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

        {/* Share / referral */}
        <div
          className="rounded-2xl p-6"
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
              className="mt-2 block text-center text-xs"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              View your referral link & earnings →
            </Link>
          )}
        </div>

        {/* Benefits Watch upsell — only if not subscribed */}
        {user && !profile?.benefits_watch_active && (
          <div
            className="rounded-2xl p-6 mt-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(15,110,86,0.3)' }}
          >
            <h3 className="font-bold text-white mb-2">Never miss a rate increase</h3>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              DWP changes rates every April. Benefits Watch monitors your entitlement
              automatically and alerts you when anything changes.
            </p>
            <div className="flex items-center justify-between">
              <span className="font-semibold" style={{ color: '#4ade80' }}>£3.99/month</span>
              <Link
                to="/benefits-watch"
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                style={{ background: '#0F6E56', color: 'white' }}
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
