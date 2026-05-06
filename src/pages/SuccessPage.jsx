import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'

export default function SuccessPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [pdfData, setPdfData] = useState(null)
  const { user } = useAuth()
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    // Simulate confirmation — in production, verify with Stripe
    const timer = setTimeout(() => {
      setStatus('complete')
      // Try to get PDF from sessionStorage if generate-pdf was called
      const storedPdf = sessionStorage.getItem('claimsmart_pdf')
      if (storedPdf) setPdfData(storedPdf)
    }, 3000)
    return () => clearTimeout(timer)
  }, [sessionId])

  function downloadPdf() {
    if (!pdfData) return
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${pdfData}`
    link.download = 'ClaimSmart-Benefits-Report.pdf'
    link.click()
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      "I used ClaimSmart UK to check my benefit entitlements and found money I didn't know I was owed. Check yours free: https://claimsmart.uk"
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (status === 'loading') {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center bg-teal-50 px-4">
          <div className="w-12 h-12 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-6" />
          <h2 className="text-xl font-medium text-teal-800">Generating your report...</h2>
          <p className="text-teal-600 mt-2 text-sm text-center">We're preparing your personalised PDF — this takes a few seconds</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Success checkmark */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-medium text-gray-900">Your report is ready</h1>
          <p className="text-gray-500 mt-2">We've sent it to your email. Check your inbox (and spam folder).</p>
        </div>

        {/* Download button */}
        <div className="space-y-3 mb-8">
          {pdfData && (
            <button
              onClick={downloadPdf}
              className="w-full bg-teal-600 text-white font-medium py-4 rounded-xl hover:bg-teal-800 transition-colors"
            >
              Download PDF report
            </button>
          )}
          {user && (
            <Link
              to="/dashboard"
              className="w-full block text-center border border-teal-600 text-teal-600 font-medium py-4 rounded-xl hover:bg-teal-50 transition-colors"
            >
              View in my dashboard
            </Link>
          )}
        </div>

        {/* Share section */}
        <div className="bg-teal-50 rounded-2xl p-6 mb-6">
          <h3 className="font-medium text-teal-800 mb-2">Know someone who might be missing out?</h3>
          <p className="text-teal-600 text-sm mb-4">Share ClaimSmart with friends and family — and earn £2 for every person who gets their report.</p>
          <button
            onClick={shareWhatsApp}
            className="w-full bg-green-600 text-white font-medium py-3 rounded-xl hover:bg-green-700 transition-colors text-sm"
          >
            Share on WhatsApp
          </button>
        </div>

        {/* What to do next */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="font-medium text-gray-900 mb-4">What to do next</h3>
          <ol className="space-y-3">
            {[
              'Open your PDF report and go to page 2 — your action plan',
              'Start with whichever benefit is marked "Claim this week"',
              'Have your National Insurance number ready before you start',
              'Visit gov.uk or call the relevant helpline — links are in your report',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600">
                <span className="w-5 h-5 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Layout>
  )
}
