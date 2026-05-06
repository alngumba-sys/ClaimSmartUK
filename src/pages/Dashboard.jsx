import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatGBP } from '../data/benefitsRates2026'

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started', color: 'bg-gray-100 text-gray-600' },
  { value: 'in_progress', label: 'In progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'claimed', label: 'Claimed', color: 'bg-green-100 text-green-700' },
  { value: 'not_applicable', label: 'Not applicable', color: 'bg-gray-100 text-gray-400' },
]

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [report, setReport] = useState(null)
  const [claimStatuses, setClaimStatuses] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadDashboard()
  }, [user])

  async function loadDashboard() {
    setLoading(true)
    try {
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('paid', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (reports && reports.length > 0) {
        setReport(reports[0])

        const { data: statuses } = await supabase
          .from('claim_status')
          .select('*')
          .eq('report_id', reports[0].id)

        const statusMap = {}
        statuses?.forEach(s => { statusMap[s.benefit_name] = s })
        setClaimStatuses(statusMap)
      }
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(benefitName, newStatus) {
    const existing = claimStatuses[benefitName]
    const update = { user_id: user.id, report_id: report.id, benefit_name: benefitName, status: newStatus }

    if (existing) {
      await supabase.from('claim_status').update({ status: newStatus }).eq('id', existing.id)
    } else {
      await supabase.from('claim_status').insert(update)
    }

    setClaimStatuses(prev => ({
      ...prev,
      [benefitName]: { ...(existing || update), status: newStatus },
    }))
  }

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  )

  if (!report) return (
    <DashboardLayout>
      <div className="max-w-lg">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Welcome to ClaimSmart</h1>
        <p className="text-gray-500 mb-6">You haven't run a benefits check yet. Find out what you're entitled to in 8 minutes.</p>
        <Link to="/check" className="inline-block bg-teal-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-teal-800 transition-colors">
          Check my entitlement — free
        </Link>
      </div>
    </DashboardLayout>
  )

  const benefits = report.benefits || []
  const claimedCount = Object.values(claimStatuses).filter(s => s.status === 'claimed').length
  const totalMonthly = report.total_monthly_pence / 100

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-medium text-gray-900 mb-1">
          Hi {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-gray-500 mb-6 text-sm">
          Report generated {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Monthly entitlement', value: formatGBP(totalMonthly), color: 'text-teal-600' },
            { label: 'Benefits found', value: String(benefits.length), color: 'text-gray-900' },
            { label: 'Benefits claimed', value: `${claimedCount} of ${benefits.length}`, color: 'text-green-600' },
            { label: 'Referral earnings', value: formatGBP((profile?.referral_earnings_pence || 0) / 100), color: 'text-gray-900' },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
              <p className={`text-xl font-medium ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Benefits list */}
        <h2 className="text-base font-medium text-gray-900 mb-3">Your benefits</h2>
        <div className="space-y-3 mb-8">
          {benefits.map(benefit => {
            const statusEntry = claimStatuses[benefit.name]
            const currentStatus = statusEntry?.status || 'not_started'
            const statusConfig = STATUS_OPTIONS.find(s => s.value === currentStatus)

            return (
              <div key={benefit.name} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">{benefit.name}</h3>
                    <p className="text-teal-600 font-medium">{formatGBP(benefit.monthlyAmount)}/month</p>
                  </div>
                  <select
                    value={currentStatus}
                    onChange={e => updateStatus(benefit.name, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${statusConfig.color}`}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mb-3">{benefit.explanation}</p>
                <div className="space-y-1">
                  {benefit.howToClaim.map((step, i) => (
                    <p key={i} className="text-xs text-gray-400 flex gap-2">
                      <span className="text-teal-400 font-medium flex-shrink-0">{i + 1}.</span>
                      {step}
                    </p>
                  ))}
                </div>
                <a
                  href={benefit.officialLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-xs text-teal-600 hover:underline block"
                >
                  Official claim page →
                </a>
              </div>
            )
          })}
        </div>

        {/* Re-check CTA */}
        <div className="bg-teal-50 rounded-2xl p-6">
          <h3 className="font-medium text-teal-800 mb-1">Circumstances changed?</h3>
          <p className="text-teal-600 text-sm mb-4">New job, new baby, change in health? Re-run your assessment to see your updated entitlement.</p>
          <Link
            to="/check"
            className="inline-block bg-teal-600 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-teal-800 transition-colors text-sm"
          >
            Re-check my entitlement — £4
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
