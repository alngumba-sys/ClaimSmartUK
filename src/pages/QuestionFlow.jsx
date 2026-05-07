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

export default function QuestionFlow() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signInWithGoogle } = useAuth()
  const postcodeQIndex = QUESTIONS.length - 1
  const [currentQuestion, setCurrentQuestion] = useState(
    searchParams.get('restart') === 'true' ? postcodeQIndex : 0
  )
  const [answers, setAnswers] = useState({})
  const [showSignIn, setShowSignIn] = useState(false)
  const [loading, setLoading] = useState(false)

  // Postcode state
  const [postcodeInput, setPostcodeInput] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [postcodeResult, setPostcodeResult] = useState(null) // { council, region, constituency }
  const [postcodeLooking, setPostcodeLooking] = useState(false)
  const [niPostcode, setNiPostcode] = useState(false)
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

    // Empty input — reset everything
    if (!trimmed) {
      setPostcodeLooking(false)
      return
    }

    // Wait for full postcode before calling API
    if (!POSTCODE_RE.test(trimmed)) {
      setPostcodeLooking(false)
      return
    }

    setPostcodeLooking(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(trimmed.replace(/\s/g, ''))
        const res = await fetch(`https://api.postcodes.io/postcodes/${encoded}`)
        const data = await res.json()
        if (data.status === 200 && data.result) {
          const isNI = /^BT/i.test(trimmed)
          setNiPostcode(isNI)
          setPostcodeResult({
            council: data.result.admin_district || 'Unknown',
            region: data.result.region || data.result.country || 'Unknown',
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
    const updated = { ...answers, [question.key]: option }
    setAnswers(updated)

    setTimeout(() => {
      if (currentQuestion < QUESTIONS.length - 1) {
        setCurrentQuestion(currentQuestion + 1)
      } else {
        setShowSignIn(true)
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
    if (skip) {
      setAnswers({
        ...answers,
        postcode: null,
        postcodeProvided: false,
        council: null,
        constituency: null,
        region: 'Unknown',
      })
    } else if (postcodeResult) {
      setAnswers({
        ...answers,
        postcode: null,
        postcodeProvided: true,
        council: postcodeResult.council,
        region: postcodeResult.region,
        constituency: postcodeResult.constituency,
      })
    }
    setShowSignIn(true)
  }

  async function calculateBenefits() {
    setShowSignIn(false)
    setLoading(true)

    await new Promise((r) => setTimeout(r, 2500))

    try {
      const res = await fetch('/api/calculate-benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      sessionStorage.setItem('claimsmart_benefits', JSON.stringify(data))
    } catch (err) {
      console.error('Failed to calculate benefits:', err)
      const fallback = {
        benefits: [
          {
            name: 'Universal Credit',
            monthlyAmount: 424.90,
            annualAmount: 5098.80,
            likelihood: 'high',
            explanation: 'Based on your income level you may qualify for Universal Credit support.',
            howToClaim: ['Visit gov.uk/universal-credit', 'Click "Start now"', 'Have your NI number ready'],
            urgency: 'Claim this week',
            officialLink: 'https://www.gov.uk/universal-credit',
          },
          {
            name: 'Council Tax Reduction',
            monthlyAmount: 120,
            annualAmount: 1440,
            likelihood: 'high',
            explanation: 'Most people on low incomes qualify for a reduction on their council tax bill.',
            howToClaim: ['Contact your local council', 'Ask about Council Tax Reduction', 'Apply online'],
            urgency: 'Claim this week',
            officialLink: 'https://www.gov.uk/council-tax-reduction',
          },
        ],
        totalMonthly: 544.90,
        totalAnnual: 6538.80,
        fallback: true,
      }
      sessionStorage.setItem('claimsmart_benefits', JSON.stringify(fallback))
    }

    navigate('/results')
  }

  function handleSignInAndCalculate() {
    sessionStorage.setItem('authRedirect', '/results')
    signInWithGoogle()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={PAGE_BG}>
        <div
          className="w-12 h-12 border-[3px] border-t-transparent rounded-full animate-spin mb-6"
          style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
        />
        <h2 className="text-xl font-bold text-white">Analysing your entitlement...</h2>
        <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Checking against 2026/27 DWP rates
        </p>
      </div>
    )
  }

  if (showSignIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={PAGE_BG}>
        <div className="w-full max-w-sm text-center">
          {/* Logo mark */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #d4960a, #f0c040)' }}
          >
            <span className="text-xs font-extrabold" style={{ color: '#0f0722' }}>CS</span>
          </div>

          <h2 className="text-xl font-extrabold text-white mb-2">
            Save your results & track your claims
          </h2>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your answers are saved — we'll calculate your results right away.
          </p>

          {/* Google button */}
          <button
            onClick={handleSignInAndCalculate}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 mb-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={calculateBenefits}
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Skip — just show me my results
          </button>
        </div>
      </div>
    )
  }

  const question = QUESTIONS[currentQuestion]
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100
  const isPostcodeQuestion = question.type === 'postcode'

  return (
    <div className="min-h-screen" style={PAGE_BG}>
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        {/* Progress */}
        <div
          className="h-1 rounded-full mb-2 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #d4960a, #f0c040)',
            }}
          />
        </div>
        <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Question {currentQuestion + 1} of {QUESTIONS.length}
        </p>

        {/* Back button */}
        {currentQuestion > 0 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm mb-6 transition-opacity hover:opacity-80 min-h-[44px]"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

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

        {/* Hint card — shown on every MC question that has hint data */}
        {question.hint && (
          <div
            className="rounded-xl px-4 py-3 mb-5 flex gap-3"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
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
                            <span style={{ color: 'rgba(212,150,10,0.6)' }}>{'\u2713'}</span>{item}
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
                            <span style={{ color: 'rgba(248,113,113,0.6)' }}>{'\u2715'}</span>{item}
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

        {/* Postcode input screen */}
        {isPostcodeQuestion ? (
          <div>
            <input
              ref={postcodeRef}
              type="text"
              autoComplete="postal-code"
              autoCapitalize="characters"
              value={postcodeInput}
              onChange={e => {
                const val = e.target.value.toUpperCase()
                setPostcodeInput(val)
                setPostcodeError('')
                lookupPostcode(val)
              }}
              onKeyDown={e => { if (e.key === 'Enter' && postcodeResult) handlePostcodeSubmit(false) }}
              placeholder="e.g. M14 5RZ"
              className="w-full px-4 py-4 rounded-xl text-sm sm:text-base font-medium outline-none"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: postcodeResult
                  ? '2px solid #4ade80'
                  : postcodeError
                    ? '2px solid #f87171'
                    : '2px solid rgba(255,255,255,0.2)',
                color: 'white',
                caretColor: '#f0c040',
              }}
            />

            {/* Lookup spinner */}
            {postcodeLooking && (
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'transparent' }}
                />
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Looking up postcode...</p>
              </div>
            )}

            {/* Success — council name */}
            {postcodeResult && !postcodeLooking && (
              <div className="flex items-center gap-2 mt-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs" style={{ color: '#4ade80' }}>
                  {postcodeResult.council}, {postcodeResult.region}
                </p>
              </div>
            )}

            {/* Northern Ireland note */}
            {niPostcode && postcodeResult && !postcodeLooking && (
              <div
                className="rounded-xl px-4 py-3 mt-3 flex gap-3"
                style={{
                  background: 'rgba(96,165,250,0.08)',
                  border: '1px solid rgba(96,165,250,0.2)',
                }}
              >
                <span className="flex-shrink-0 mt-0.5 text-sm" style={{ color: '#60a5fa' }}>{'\u2139\uFE0F'}</span>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Northern Ireland uses different benefit rates — your report will note where rules differ.
                </p>
              </div>
            )}

            {/* Error */}
            {postcodeError && !postcodeLooking && (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>{postcodeError}</p>
            )}

            {/* Optional notice */}
            <div
              className="rounded-xl px-4 py-3 mt-5 flex gap-3"
              style={{
                background: 'rgba(212,150,10,0.08)',
                border: '1px solid rgba(212,150,10,0.2)',
              }}
            >
              <span className="flex-shrink-0 mt-0.5">{'\u2139\uFE0F'}</span>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                This field is optional. If you skip it, we'll use a regional estimate which may be less accurate
                for housing-related benefits. Skipping will not affect your eligibility check.
              </p>
            </div>

            {/* Continue button — enabled only when postcode verified */}
            <button
              onClick={() => handlePostcodeSubmit(false)}
              disabled={!postcodeResult}
              className="w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #d4960a, #f0c040)', color: '#0f0722' }}
            >
              Continue with this postcode
            </button>

            {/* Skip link */}
            <button
              onClick={() => handlePostcodeSubmit(true)}
              className="w-full mt-3 text-sm transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Skip — use regional estimate instead
            </button>

            {/* Privacy note */}
            <p className="text-center mt-6 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Your postcode is used only to calculate local benefit rates.
              It is never stored, sold, or shared. We only keep the council name and region — not your postcode itself.
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
