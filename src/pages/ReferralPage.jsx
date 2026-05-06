import { useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatGBP } from '../data/benefitsRates2026'

export default function ReferralPage() {
  const { user, profile } = useAuth()
  const [referrals, setReferrals] = useState([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (user) loadReferrals()
  }, [user])

  async function loadReferrals() {
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })
    setReferrals(data || [])
  }

  const referralLink = `${window.location.origin}?ref=${profile?.referral_code || ''}`
  const earningsPence = profile?.referral_earnings_pence || 0
  const paidReferrals = referrals.filter(r => r.paid)

  function copyLink() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      `I found benefits I didn't know I was owed using ClaimSmart UK. Check what you're entitled to — it only takes 8 minutes: ${referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-medium text-gray-900 mb-1">Refer & earn</h1>
        <p className="text-gray-500 text-sm mb-6">Earn £2 for every friend who gets their full report.</p>

        {/* Earnings summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total earned', value: formatGBP(earningsPence / 100) },
            { label: 'Successful referrals', value: String(paidReferrals.length) },
            { label: 'Per referral', value: '£2.00' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-xl font-medium text-teal-600">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Referral link */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <h2 className="font-medium text-gray-900 mb-3">Your referral link</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              readOnly
              value={referralLink}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-gray-600 min-w-0"
            />
            <button
              onClick={copyLink}
              className="bg-teal-600 text-white text-sm px-4 py-3 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap min-h-[44px]"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <button
            onClick={shareWhatsApp}
            className="w-full bg-green-600 text-white font-medium py-3 rounded-xl hover:bg-green-700 transition-colors text-sm"
          >
            Share on WhatsApp
          </button>
        </div>

        {/* How it works */}
        <div className="bg-teal-50 rounded-2xl p-6 mb-6">
          <h2 className="font-medium text-teal-800 mb-3">How it works</h2>
          {[
            'Share your unique link with friends and family',
            'They check their entitlement (free) and buy their full report (£9)',
            'You automatically earn £2 per successful referral',
          ].map((step, i) => (
            <div key={i} className="flex gap-3 mb-2 text-sm text-teal-700">
              <span className="w-5 h-5 bg-teal-200 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">{i + 1}</span>
              {step}
            </div>
          ))}
        </div>

        {/* Payout request */}
        {earningsPence >= 200 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
            <h2 className="font-medium text-gray-900 mb-2">Request payout</h2>
            <p className="text-sm text-gray-500 mb-4">You have {formatGBP(earningsPence / 100)} available to withdraw via PayPal.</p>
            <a
              href={`mailto:payouts@claimsmart.uk?subject=Payout Request&body=Please send ${formatGBP(earningsPence / 100)} to my PayPal account. My ClaimSmart email is ${user?.email}.`}
              className="block text-center border border-teal-600 text-teal-600 font-medium py-3 rounded-xl hover:bg-teal-50 transition-colors text-sm"
            >
              Request payout via email
            </a>
          </div>
        )}

        {/* Referrals table */}
        {referrals.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-900 text-sm">Your referrals</h2>
            </div>
            {referrals.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0">
                <div>
                  <p className="text-sm text-gray-900">{r.referred_email?.replace(/(.{2}).*@/, '$1***@') || 'Anonymous'}</p>
                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.paid ? '+£2 earned' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
