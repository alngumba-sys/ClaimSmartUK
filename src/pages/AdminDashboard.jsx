import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

function formatGBP(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const navigate = useNavigate()

  useEffect(() => {
    const token = sessionStorage.getItem('adminToken')
    if (!token) { navigate('/admin/login'); return }
    loadStats(token)
  }, [])

  async function loadStats(token) {
    try {
      const res = await fetch('/.netlify/functions/admin-stats', {
        headers: { 'x-admin-token': token || sessionStorage.getItem('adminToken') },
      })
      if (res.status === 401) { navigate('/admin/login'); return }
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Stats load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function resendReport(reportId, email) {
    const token = sessionStorage.getItem('adminToken')
    await fetch('/.netlify/functions/resend-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ reportId, email }),
    })
    alert('Report resent to ' + email)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const signupLabels = stats ? Object.keys(stats.dailySignups).slice(-14) : []
  const signupData = stats ? Object.values(stats.dailySignups).slice(-14) : []

  const regionLabels = stats ? Object.keys(stats.regionCounts) : []
  const regionData = stats ? Object.values(stats.regionCounts) : []

  const tabs = ['overview', 'transactions', 'users']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin nav */}
      <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">CS</span>
          </div>
          <span className="font-medium text-gray-900 text-sm">ClaimSmart Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => loadStats()} className="text-sm text-teal-600 hover:underline">Refresh</button>
          <button
            onClick={() => { sessionStorage.removeItem('adminAuth'); sessionStorage.removeItem('adminToken'); navigate('/admin/login') }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && stats && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Total users', value: stats.totalUsers.toLocaleString() },
                { label: 'Paid reports', value: stats.totalReports.toLocaleString() },
                { label: 'Revenue', value: formatGBP(stats.totalRevenuePence / 100) },
                { label: 'Avg benefits found', value: String(stats.avgBenefits) },
                { label: 'Avg monthly found', value: formatGBP(stats.avgMonthly) },
              ].map(s => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                  <p className="text-xl font-medium text-teal-600">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Daily signups (last 14 days)</h3>
                <Line
                  data={{
                    labels: signupLabels.map(d => d.slice(5)),
                    datasets: [{
                      label: 'Signups',
                      data: signupData,
                      borderColor: '#0F6E56',
                      backgroundColor: '#E1F5EE',
                      tension: 0.3,
                      fill: true,
                    }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
                />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Reports by region</h3>
                <Bar
                  data={{
                    labels: regionLabels,
                    datasets: [{
                      label: 'Reports',
                      data: regionData,
                      backgroundColor: '#E1F5EE',
                      borderColor: '#0F6E56',
                      borderWidth: 1,
                    }],
                  }}
                  options={{ responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'transactions' && stats && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-900">Recent transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Date', 'Region', 'Benefits', 'Monthly', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTransactions.map(t => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-gray-600">{t.region}</td>
                      <td className="px-4 py-3 text-gray-600">{t.benefitsFound}</td>
                      <td className="px-4 py-3 text-teal-600 font-medium">{formatGBP(t.totalMonthly)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            const email = prompt('Enter email to resend report to:')
                            if (email) resendReport(t.id, email)
                          }}
                          className="text-xs text-teal-600 hover:underline"
                        >
                          Resend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && stats && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-medium text-gray-900">Users ({stats.totalUsers})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Email', 'Name', 'Joined', 'Referral earnings', 'Referred by'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">{u.full_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-teal-600">{formatGBP((u.referral_earnings_pence || 0) / 100)}</td>
                      <td className="px-4 py-3 text-gray-400">{u.referred_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
