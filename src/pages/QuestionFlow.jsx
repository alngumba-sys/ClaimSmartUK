import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// UK postcode format — case-insensitive
const POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i

const QUESTIONS = [
  {
    key: 'situation',
    title: 'What best describes your situation right now?',
    options: [
      'Working full-time',
      'Working part-time',
      'Self-employed',
      'Unemployed',
      'Unable to work — health',
      'Carer for someone',
      'Retired',
      'Student',
    ],
    hint: {
      note: "If you work and also care for someone, choose 'Carer for someone' — it unlocks the most support. 'Unable to work — health' applies if a doctor or assessment has confirmed you cannot work.",
    },
  },
  {
    key: 'age',
    title: 'How old are you?',
    options: ['Under 25', '25 to 34', '35 to 49', '50 to 64', '65 or over'],
    hint: {
      note: 'Age directly affects your benefit rates. Under 25 means a lower Universal Credit allowance. 65 or over opens eligibility for Pension Credit and Attendance Allowance.',
    },
  },
  {
    key: 'housing',
    title: 'What is your current housing situation?',
    options: [
      'I rent privately',
      'Council or housing association',
      'Own with a mortgage',
      'Own outright',
      'I live with family or friends',
    ],
    hint: {
      note: "'Council or housing association' means a social tenancy. If you pay rent to a family member or friend, choose 'I rent privately'. If you stay without paying rent, choose 'I live with family or friends'.",
    },
  },
  {
    key: 'children',
    title: 'Do you have any dependent children living with you?',
    options: ['No children', '1 child', '2 children', '3 or more children'],
    hint: {
      include: ['Children under 16', '16–19 year olds in full-time approved education'],
      exclude: ['Children living mainly with an ex-partner', 'Adult children aged 20 or over'],
    },
  },
  {
    key: 'income',
    title: 'What is your total household income per month after tax?',
    options: ['Under £500', '£500 to £1,000', '£1,000 to £1,500', '£1,500 to £2,500', 'Over £2,500'],
    hint: {
      include: ['Take-home pay after tax and NI (your payslip net pay)', 'Self-employment profit', 'Pension income', 'Maintenance or child support received'],
      exclude: ['Benefits already received (UC, Child Benefit, etc.)', 'One-off payments: gifts, tax refunds, inheritance'],
      note: "Use your net pay — not your gross salary.",
    },
  },
  {
    key: 'savings',
    title: 'Do you have any savings or investments?',
    options: ['No savings', 'Under £1,000', '£1,000 to £6,000', '£6,000 to £16,000', 'Over £16,000'],
    hint: {
      include: ['Bank and savings accounts', 'ISAs, Premium Bonds, shares', 'Property you do not live in'],
      exclude: ['Your main home', 'Pension pots you cannot yet access'],
      note: 'Over £16,000 in savings disqualifies you from most means-tested benefits.',
    },
  },
  {
    key: 'health',
    title: 'Do you or anyone in your household have a long-term health condition or disability?',
    options: [
      'No health conditions',
      'Yes — affects daily living',
      'Yes — unable to work',
      'Yes — need care from others',
    ],
    hint: {
      note: "'Affects daily living' means a condition limits everyday activities (mobility, concentration, pain). 'Unable to work' means a doctor has confirmed you cannot work. 'Need care from others' means you rely on someone for washing, dressing, or getting around.",
    },
  },
  {
    key: 'postcode',
    type: 'postcode',
    title: 'Finally — what\u2019s your postcode?',
    subtitle: 'We use this to find your local council\u2019s exact benefit rates for Council Tax Reduction and housing support. This makes your results significantly more accurate.',
  },
]

const PAGE_BG = {
  background: 'linear-gradient(135deg, #0f0722 0%, #1a0f3c 60%, #2d1b69 100%)',
  minHeight: '100vh',
}

// ── Teaser screen ─────────────────────────────────────────────────────────────
// Shown after the last question. Calls calculate-benefits immediately,
// shows the total only, gates the full breakdown behind signup.

function TeaserScreen({ answers, onSignInWithGoogle, onSignInWithEmail, onSkip }) {
  const [phase, setPhase]           = useState('calculating') // calculating | reveal | error
  const [totalMonthly, setTotalMonthly] = useState(null)
  const [totalAnnual, setTotalAnnual]   = useState(null)
  const [displayTotal, setDisplayTotal] = useState(0)
  const [benefitCount, setBenefitCount] = useState(null)
  const [apiData, setApiData]           = useState(null)
  const [retryCount, setRetryCount]     = useState(0)
  const frameRef = useRef(null)

  // Call API as soon as this screen mounts
  useEffect(() => {
    let aborted = false
    async function calculate() {
      // Minimum 2.5s "calculating" phase for perceived value
      const [result] = await Promise.allSettled([
        fetch('/api/calculate-benefits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        }).then(r => r.json()),
        new Promise(r => setTimeout(r, 2500)),
      ])

      if (result.status === 'fulfilled' && result.value?.totalMonthly) {
        const monthly = result.value.totalMonthly
        const annual  = result.value.totalAnnual
        const count   = result.value.benefits?.length || 0
        sessionStorage.setItem('claimsmart_benefits', JSON.stringify(result.value))
        if (!aborted) {
          setTotalMonthly(monthly)
          setTotalAnnual(annual)
          setBenefitCount(count)
          setApiData(result.value)
          setPhase('reveal')
          animateCounter(monthly)
        }
      } else {
        // API failed — show error state, never fake numbers
        if (!aborted) setPhase('error')
      }
    }
    calculate()
    return () => { aborted = true; cancelAnimationFrame(frameRef.current) }
  }, [retryCount])

  function animateCounter(target) {
    const duration = 1200
    const start = performance.now()
    function step(now) {
      const p    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplayTotal(Math.round(target * ease))
      if (p < 1) frameRef.current = requestAnimationFrame(step)
      else setDisplayTotal(Math.round(target))
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  // ── Calculating phase ──────────────────────────────────────────────────────
  if (phase === 'calculating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={PAGE_BG}>
        <div
          className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-5"
          style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
        />
        <h2 className="text-xl font-bold text-white">Analysing your entitlement...</h2>
        <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Checking against 2026/27 DWP rates
        </p>
      </div>
    )
  }

  // ── Error phase ────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={PAGE_BG}>
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(248,113,113,0.15)' }}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">Could not calculate your results</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            There was a problem connecting to our service. Please try again.
          </p>
          <button
            onClick={() => { setPhase('calculating'); setRetryCount(c => c + 1) }}
            className="w-full py-3.5 rounded-xl font-bold text-sm"
            style={{ background: '#d4960a', color: '#0f0722' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Reveal phase ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={PAGE_BG}>
      <div className="w-full max-w-sm">

        {/* Back to home */}
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <span>←</span> Back to home
        </a>

        {/* Logo mark */}
        <div className="text-center mb-6">
          <img
            src="/ClaimSmartUK_logo_clear.png"
            alt="ClaimSmart UK"
            className="w-16 h-16 mx-auto"
            style={{ display: 'block' }}
          />
        </div>

        {/* ── The teaser card ── */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ border: '1px solid rgba(212,150,10,0.4)', background: 'rgba(212,150,10,0.08)' }}
        >
          {/* Amount banner — show only the lowest benefit to create curiosity */}
          <div
            className="px-6 py-6 text-center"
            style={{ borderBottom: '1px solid rgba(212,150,10,0.2)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(212,150,10,0.7)' }}>
              Based on your answers, you may be missing at least
            </p>
            <p className="text-5xl font-extrabold mb-1" style={{ color: '#f0c040' }}>
              £{Math.round(totalMonthly || 0).toLocaleString()}
            </p>
            <p className="text-base font-semibold" style={{ color: '#d4960a' }}>
              per month
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {benefitCount === 1
                ? 'Sign up to see full details and how to claim'
                : `Sign up to see the full amount — there are ${benefitCount} benefits in total`
              }
            </p>
          </div>

          {/* Teaser row — blurred benefit names */}
          <div className="px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {benefitCount === 1 
                ? 'We found a benefit you may qualify for'
                : `We found ${benefitCount} benefits you may qualify for`
              }
            </p>

            {/* Show benefits — if only 1 benefit OR visible amount = total, lock everything */}
            {(() => {
              if (!apiData?.benefits?.length) return null
              const sorted  = [...apiData.benefits].sort((a, b) => a.monthlyAmount - b.monthlyAmount)
              const visible = sorted[0]
              const locked  = sorted.slice(1)
              const totalRounded   = Math.round(totalMonthly || 0)
              const visibleRounded = Math.round(visible.monthlyAmount)
              // Count benefits worth > £1/month (ignore trivially small amounts)
              const meaningfulBenefits = sorted.filter(b => b.monthlyAmount >= 1)
              // Lock all if: only 1 benefit, or visible IS the total (within £2), or only 1 meaningful benefit
              const allLocked = sorted.length === 1 
                || Math.abs(visibleRounded - totalRounded) < 2 
                || meaningfulBenefits.length <= 1

              // Lock placeholder row
              const LockRow = ({ key: k }) => (
                <div
                  key={k}
                  className="relative flex items-center justify-between px-3 py-2.5 rounded-lg mb-2 overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-2.5 filter blur-sm select-none" aria-hidden>
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: 'rgba(212,150,10,0.15)' }} />
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Benefit</span>
                  </div>
                  <span className="text-sm font-bold filter blur-sm select-none" style={{ color: 'rgba(212,150,10,0.5)' }} aria-hidden>£—/mo</span>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(15,7,34,0.7)' }}>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)' }}>
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.5)" strokeWidth={2}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Sign up to unlock</span>
                    </div>
                  </div>
                </div>
              )

              return (
                <>
                  {/* If all locked — show all as locked rows */}
                  {allLocked ? (
                    sorted.map((_, i) => <LockRow key={i} />)
                  ) : (
                    <>
                      {/* Visible — lowest amount (only when it differs from total) */}
                      <div
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg mb-2"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(212,150,10,0.2)' }}>
                            <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="#d4960a" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <span className="text-sm font-medium text-white">{visible.name}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: '#d4960a' }}>
                          £{visibleRounded}/mo
                        </span>
                      </div>
                    </>
                  )}

                  {/* Locked — all higher-value benefits hidden */}
                  {!allLocked && locked.map((b, i) => (
                    <div
                      key={i}
                      className="relative flex items-center justify-between px-3 py-2.5 rounded-lg mb-2 overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-2.5 filter blur-sm select-none" aria-hidden>
                        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: 'rgba(212,150,10,0.15)' }} />
                        <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.name}</span>
                      </div>
                      <span className="text-sm font-bold filter blur-sm select-none" style={{ color: 'rgba(212,150,10,0.5)' }} aria-hidden>
                        £{Math.round(b.monthlyAmount)}/mo
                      </span>
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(15,7,34,0.7)' }}
                      >
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)' }}
                        >
                          <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.5)" strokeWidth={2}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Sign up to unlock
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
        </div>

        {/* ── The gate ── */}
        <div className="text-center mb-5">
          <h2 className="text-lg font-extrabold text-white mb-1">
            Your full breakdown is ready
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Create a free account to see every benefit, exact amounts,
            and your step-by-step action plan.
          </p>
        </div>

        {/* Google CTA — primary */}
        <button
          onClick={onSignInWithGoogle}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 mb-3 min-h-[52px]"
          style={{
            background: 'linear-gradient(135deg, #d4960a, #f0c040)',
            color: '#0f0722',
          }}
        >
          {/* White circle behind G logo — must be visible on amber */}
          <span
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'white', width: 26, height: 26, boxShadow: '0 0 0 2px rgba(255,255,255,0.4)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </span>
          Sign up with Google — it's free
        </button>

        {/* Email CTA — secondary */}
        <button
          onClick={onSignInWithEmail}
          className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 mb-4 min-h-[52px]"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Sign up with email
        </button>

        {/* Legal disclaimer */}
        <p className="text-xs text-center mt-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Results are estimates based on DWP rates April 2026/27. Actual entitlement depends on your full circumstances. ClaimSmart UK is not a benefits adviser. Always confirm with DWP (0800 328 5644) or Citizens Advice (0800 144 8848).
        </p>

      </div>
    </div>
  )
}

// ── Main QuestionFlow ─────────────────────────────────────────────────────────

export default function QuestionFlow() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signInWithGoogle } = useAuth()
  const postcodeQIndex = QUESTIONS.length - 1

  const [currentQuestion, setCurrentQuestion] = useState(
    searchParams.get('restart') === 'true' ? postcodeQIndex : 0
  )
  const [answers, setAnswers]       = useState({})
  const [showTeaser, setShowTeaser] = useState(false)
  const [loading, setLoading]       = useState(false)

  // Postcode state
  const [postcodeInput, setPostcodeInput]   = useState('')
  const [postcodeError, setPostcodeError]   = useState('')
  const [postcodeResult, setPostcodeResult] = useState(null)
  const [postcodeLooking, setPostcodeLooking] = useState(false)
  const [niPostcode, setNiPostcode]         = useState(false)
  const postcodeRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('claimsmart_answers')
    if (saved) {
      try { setAnswers(JSON.parse(saved)) } catch {}
    }
  }, [])

  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      sessionStorage.setItem('claimsmart_answers', JSON.stringify(answers))
    }
  }, [answers])

  // Postcodes.io lookup — debounced 600ms
  const lookupPostcode = useCallback((value) => {
    clearTimeout(debounceRef.current)
    const trimmed = value.trim().toUpperCase()
    setPostcodeResult(null)
    setPostcodeError('')
    setNiPostcode(false)

    if (!trimmed) { setPostcodeLooking(false); return }
    if (!POSTCODE_RE.test(trimmed)) { setPostcodeLooking(false); return }

    setPostcodeLooking(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(trimmed.replace(/\s/g, ''))
        const res  = await fetch(`https://api.postcodes.io/postcodes/${encoded}`)
        const data = await res.json()
        if (data.status === 200 && data.result) {
          const isNI = /^BT/i.test(trimmed)
          setNiPostcode(isNI)
          setPostcodeResult({
            council:      data.result.admin_district || 'Unknown',
            region:       data.result.region || data.result.country || 'Unknown',
            constituency: data.result.parliamentary_constituency || null,
          })
          setPostcodeError('')
        } else {
          setPostcodeResult(null)
          setPostcodeError('Postcode not found. You can skip and we\u2019ll use a regional estimate.')
        }
      } catch {
        setPostcodeResult(null)
        setPostcodeError('Postcode not found. You can skip and we\u2019ll use a regional estimate.')
      } finally {
        setPostcodeLooking(false)
      }
    }, 600)
  }, [])

  function handleSelect(option) {
    const question = QUESTIONS[currentQuestion]
    const updated  = { ...answers, [question.key]: option }
    setAnswers(updated)

    setTimeout(() => {
      if (currentQuestion < QUESTIONS.length - 1) {
        setCurrentQuestion(currentQuestion + 1)
      } else {
        setShowTeaser(true)
      }
    }, 200)
  }

  function handleBack() {
    if (currentQuestion > 0) {
      setPostcodeError('')
      setPostcodeResult(null)
      setPostcodeInput('')
      setNiPostcode(false)
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  function handlePostcodeSubmit(skip = false) {
    const postcodeAnswers = skip
      ? { postcode: null, postcodeProvided: false, council: null, constituency: null, region: 'Unknown' }
      : { postcode: null, postcodeProvided: true, council: postcodeResult.council, region: postcodeResult.region, constituency: postcodeResult.constituency }

    setAnswers(prev => ({ ...prev, ...postcodeAnswers }))
    setShowTeaser(true)
  }

  // Called from TeaserScreen — Google path
  function handleSignInWithGoogle() {
    sessionStorage.setItem('authRedirect', '/results')
    signInWithGoogle()
  }

  // Called from TeaserScreen — email path
  function handleSignInWithEmail() {
    sessionStorage.setItem('authRedirect', '/results')
    navigate('/auth?mode=signup')
  }

  // Called from TeaserScreen — skip/continue without account
  async function handleSkip() {
    // Benefits should already be in sessionStorage from TeaserScreen API call
    const cached = sessionStorage.getItem('claimsmart_benefits')
    if (cached) {
      // Already calculated — go straight to results
      navigate('/results')
      return
    }

    // Not cached — try API one more time
    setShowTeaser(false)
    setLoading(true)
    try {
      const res  = await fetch('/api/calculate-benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (data?.totalMonthly) {
        sessionStorage.setItem('claimsmart_benefits', JSON.stringify(data))
        navigate('/results')
      } else {
        // API returned bad data — show error, never fake numbers
        setLoading(false)
        setShowTeaser(true)
        alert('We could not calculate your results. Please try again.')
      }
    } catch {
      console.error('calculate-benefits failed in handleSkip')
      setLoading(false)
      setShowTeaser(true)
      alert('We could not connect to our service. Please check your connection and try again.')
    }
  }

  // ── Loading spinner ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={PAGE_BG}>
        <div
          className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-5"
          style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
        />
        <h2 className="text-xl font-bold text-white">Analysing your entitlement...</h2>
        <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Checking against 2026/27 DWP rates
        </p>
      </div>
    )
  }

  // ── Teaser screen ───────────────────────────────────────────────────────────
  if (showTeaser) {
    return (
      <TeaserScreen
        answers={answers}
        onSignInWithGoogle={handleSignInWithGoogle}
        onSignInWithEmail={handleSignInWithEmail}
        onSkip={handleSkip}
      />
    )
  }

  // ── Question screens ────────────────────────────────────────────────────────
  const question     = QUESTIONS[currentQuestion]
  const progress     = ((currentQuestion + 1) / QUESTIONS.length) * 100
  const isPostcodeQ  = question.type === 'postcode'

  return (
    <div className="min-h-screen" style={PAGE_BG}>
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        {/* Progress bar */}
        <div className="h-1 rounded-full mb-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #d4960a, #f0c040)' }}
          />
        </div>
        <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Question {currentQuestion + 1} of {QUESTIONS.length}
        </p>

        {/* Back button */}
        <button
          onClick={currentQuestion > 0 ? handleBack : () => navigate('/')}
          className="flex items-center gap-1 text-sm mb-6 transition-opacity hover:opacity-80 min-h-[44px]"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Question title */}
        <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-3 leading-snug">
          {question.title}
        </h2>

        {/* Subtitle */}
        {question.subtitle && (
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {question.subtitle}
          </p>
        )}

        {/* Hint card */}
        {question.hint && (
          <div
            className="rounded-xl px-4 py-3 mb-5 flex gap-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span
              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
              style={{ background: 'rgba(212,150,10,0.25)', color: '#f0c040' }}
              aria-hidden="true"
            >i</span>
            <div className="min-w-0 space-y-2">
              {(question.hint.include || question.hint.exclude) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {question.hint.include && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(212,150,10,0.7)' }}>Include</p>
                      <ul className="space-y-0.5">
                        {question.hint.include.map(item => (
                          <li key={item} className="text-xs leading-snug flex gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <span style={{ color: 'rgba(212,150,10,0.6)' }}>✓</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {question.hint.exclude && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(248,113,113,0.7)' }}>Exclude</p>
                      <ul className="space-y-0.5">
                        {question.hint.exclude.map(item => (
                          <li key={item} className="text-xs leading-snug flex gap-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            <span style={{ color: 'rgba(248,113,113,0.6)' }}>✕</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {question.hint.note && (
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {question.hint.note}
                </p>
              )}
            </div>
          </div>
        )}

        {!question.hint && !question.subtitle && <div className="mb-5" />}

        {/* Postcode input */}
        {isPostcodeQ ? (
          <div>
            <input
              ref={postcodeRef}
              type="text"
              autoComplete="postal-code"
              autoCapitalize="characters"
              value={postcodeInput}
              maxLength={8}
              onChange={e => {
                // Strip anything that's not alphanumeric or space — prevents injection attempts
                const val = e.target.value.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase()
                setPostcodeInput(val)
                setPostcodeError('')
                lookupPostcode(val)
              }}
              onKeyDown={e => { if (e.key === 'Enter' && postcodeResult) handlePostcodeSubmit(false) }}
              placeholder="e.g. M14 5RZ"
              className="w-full px-4 py-4 rounded-xl text-sm sm:text-base font-medium outline-none"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: postcodeResult ? '2px solid #4ade80' : postcodeError ? '2px solid #f87171' : '2px solid rgba(255,255,255,0.2)',
                color: 'white',
                caretColor: '#f0c040',
              }}
            />
            {postcodeLooking && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'transparent' }} />
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Looking up postcode...</p>
              </div>
            )}
            {postcodeResult && !postcodeLooking && (
              <div className="flex items-center gap-2 mt-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs" style={{ color: '#4ade80' }}>{postcodeResult.council}, {postcodeResult.region}</p>
              </div>
            )}
            {niPostcode && postcodeResult && !postcodeLooking && (
              <div className="rounded-xl px-4 py-3 mt-3 flex gap-3" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <span className="flex-shrink-0 mt-0.5 text-sm" style={{ color: '#60a5fa' }}>ℹ️</span>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>Northern Ireland uses different benefit rates — your report will note where rules differ.</p>
              </div>
            )}
            {postcodeError && !postcodeLooking && (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>{postcodeError}</p>
            )}
            <div className="rounded-xl px-4 py-3 mt-5 flex gap-3" style={{ background: 'rgba(212,150,10,0.08)', border: '1px solid rgba(212,150,10,0.2)' }}>
              <span className="flex-shrink-0 mt-0.5">ℹ️</span>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                This field is optional. If you skip it, we'll use a regional estimate which may be less accurate for housing-related benefits. Skipping will not affect your eligibility check.
              </p>
            </div>
            <button
              onClick={() => handlePostcodeSubmit(false)}
              disabled={!postcodeResult}
              className="w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #d4960a, #f0c040)', color: '#0f0722' }}
            >
              Continue with this postcode
            </button>
            <button
              onClick={() => handlePostcodeSubmit(true)}
              className="w-full mt-3 text-sm transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Skip — use regional estimate instead
            </button>
            <p className="text-center mt-6 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Your postcode is used only to calculate local benefit rates. It is never stored, sold, or shared. We only keep the council name and region — not your postcode itself.
            </p>
          </div>
        ) : (
          /* Multiple-choice options */
          <div className="space-y-3">
            {question.options.map((option) => {
              const selected = answers[question.key] === option
              return (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className="w-full text-left px-4 py-4 rounded-xl transition-all text-sm sm:text-base min-h-[52px] font-medium"
                  style={{
                    background: selected ? 'rgba(212,150,10,0.15)' : 'rgba(255,255,255,0.05)',
                    border: selected ? '2px solid #d4960a' : '2px solid rgba(255,255,255,0.1)',
                    color: selected ? '#f0c040' : 'rgba(255,255,255,0.8)',
                  }}
                >
                  {option}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
