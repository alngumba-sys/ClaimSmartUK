import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'

export default function ResultsPreview() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)

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
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Payment is not yet configured. This will work once Stripe is set up in Phase 3.')
    }
  }

  if (!data) return null

  const { benefits = [], totalMonthly = 0, totalAnnual = 0 } = data

  return (
    <Layout>
      {/* Teal hero */}
      <div className="bg-teal-600 text-white py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-teal-200 text-sm mb-2">Based on your answers, you may be missing:</p>
          <p className="text-5xl font-medium">&pound;{Math.round(totalMonthly).toLocaleString()}</p>
          <p className="text-teal-200 text-lg mt-1">per month</p>
          <p className="text-teal-100 mt-3 text-sm">
            That's up to &pound;{Math.round(totalAnnual).toLocaleString()} per year you could be entitled to
          </p>
        </div>
      </div>

      {/* Benefits list */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
        {benefits.map((benefit, i) =>
          i < 2 ? (
            <div key={benefit.name} className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium text-gray-900">{benefit.name}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                      benefit.likelihood === 'high'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {benefit.likelihood === 'high' ? 'High likelihood' : 'Worth checking'}
                  </span>
                </div>
                <span className="text-teal-600 font-medium text-lg">
                  &pound;{benefit.monthlyAmount.toFixed(2)}/mo
                </span>
              </div>
              <p className="text-sm text-gray-500">{benefit.explanation}</p>
            </div>
          ) : (
            <div key={benefit.name} className="relative bg-white border border-gray-200 rounded-xl p-4 mb-3 overflow-hidden">
              <div className="blur-sm select-none">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900">{benefit.name}</h3>
                  <span className="text-teal-600 font-medium text-lg">&pound;XXX/mo</span>
                </div>
                <p className="text-sm text-gray-400">Unlock to see full details and how to claim</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span className="text-xs text-gray-500 font-medium">Unlock to view</span>
                </div>
              </div>
            </div>
          )
        )}

        {/* Unlock section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-6 mb-8">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Unlock your full report</h2>
          <ul className="space-y-2 mb-6 text-sm text-gray-600">
            {[
              'Complete list of all benefits you qualify for',
              'Exact monthly amounts for your circumstances',
              'Step-by-step how to claim each benefit',
              'Priority action plan — what to do this week',
              'Personal claim calendar with all key dates',
              'Downloadable PDF report',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800">
            If you claim just one benefit we've found, you'll recover this cost in minutes.
          </div>
          <button
            onClick={handleUnlock}
            className="w-full bg-teal-600 text-white font-medium py-4 rounded-xl hover:bg-teal-800 transition-colors text-base"
          >
            Get my full report — &pound;9
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
            One-time payment · No subscription · Secure via Stripe
          </p>
        </div>
      </div>
    </Layout>
  )
}
