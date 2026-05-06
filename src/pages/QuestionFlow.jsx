import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'

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
  },
  {
    key: 'age',
    title: 'How old are you?',
    options: ['Under 25', '25 to 34', '35 to 49', '50 to 64', '65 or over'],
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
  },
  {
    key: 'children',
    title: 'Do you have any dependent children living with you?',
    options: ['No children', '1 child', '2 children', '3 or more children'],
  },
  {
    key: 'income',
    title: 'What is your total household income per month after tax?',
    options: ['Under £500', '£500 to £1,000', '£1,000 to £1,500', '£1,500 to £2,500', 'Over £2,500'],
  },
  {
    key: 'savings',
    title: 'Do you have any savings or investments?',
    options: ['No savings', 'Under £1,000', '£1,000 to £6,000', '£6,000 to £16,000', 'Over £16,000'],
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
  },
  {
    key: 'region',
    title: 'Which region of the UK are you in?',
    options: [
      'London',
      'South East',
      'South West',
      'Midlands',
      'North of England',
      'Wales',
      'Scotland',
      'Northern Ireland',
    ],
  },
]

export default function QuestionFlow() {
  const navigate = useNavigate()
  const { signInWithGoogle } = useAuth()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showSignIn, setShowSignIn] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('claimsmart_answers')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setAnswers(parsed)
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      sessionStorage.setItem('claimsmart_answers', JSON.stringify(answers))
    }
  }, [answers])

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
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1)
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-teal-50">
        <div className="w-12 h-12 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-medium text-teal-800">Analysing your entitlement...</h2>
        <p className="text-teal-600 mt-2 text-sm">Checking against 2026/27 DWP rates</p>
      </div>
    )
  }

  if (showSignIn) {
    return (
      <Layout showNav={false}>
        <div className="max-w-sm mx-auto mt-20 px-4 text-center">
          <div className="w-10 h-10 bg-teal-600 rounded-md flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-sm font-bold">CS</span>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">
            Sign in to save your results and access your personal dashboard
          </h2>
          <p className="text-sm text-gray-500 mb-6">Your answers are saved — we'll calculate your results right away.</p>
          <button
            onClick={handleSignInAndCalculate}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
          <button
            onClick={calculateBenefits}
            className="mt-4 text-sm text-teal-600 hover:text-teal-800"
          >
            Skip — just show me my results
          </button>
        </div>
      </Layout>
    )
  }

  const question = QUESTIONS[currentQuestion]

  return (
    <Layout showNav={false}>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-16 sm:pb-12">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200 rounded-full">
          <div
            className="h-1.5 bg-teal-600 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / 8) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">Question {currentQuestion + 1} of 8</p>

        {/* Back button */}
        {currentQuestion > 0 && (
          <button
            onClick={handleBack}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {/* Question */}
        <h2 className="text-lg sm:text-xl font-medium text-gray-900 mt-6 mb-6 leading-snug">{question.title}</h2>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              className={`w-full text-left px-4 py-4 rounded-xl transition-colors text-sm sm:text-base min-h-[48px] ${
                answers[question.key] === option
                  ? 'border-2 border-teal-600 bg-teal-50 text-teal-800'
                  : 'border-2 border-gray-200 bg-white hover:border-teal-200 text-gray-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  )
}
