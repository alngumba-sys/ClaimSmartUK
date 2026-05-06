import { useEffect, useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { UK_DEADLINES, EVENT_TYPE_CONFIG } from '../data/ukDeadlines2026'

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadNotifications()
  }, [user])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date')
    setNotifications(data || [])
    setLoading(false)
  }

  async function dismiss(id) {
    await supabase.from('notifications').update({ dismissed: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function updateRemindDays(id, days) {
    await supabase.from('notifications').update({ remind_days_before: days }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, remind_days_before: days } : n))
  }

  const today = new Date()
  const upcoming = notifications.filter(n => !n.dismissed && new Date(n.due_date) >= today)

  function daysUntil(dateStr) {
    return Math.ceil((new Date(dateStr) - today) / (1000 * 60 * 60 * 24))
  }

  function NotificationCard({ n }) {
    const days = daysUntil(n.due_date)
    const config = EVENT_TYPE_CONFIG[n.type] || EVENT_TYPE_CONFIG.custom
    const isUrgent = days <= 7 && days >= 0

    return (
      <div className={`bg-white border rounded-xl p-4 ${isUrgent ? 'border-amber-200' : 'border-gray-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div
              className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ background: config.bg }}
            >
              <svg className="w-4 h-4" style={{ color: config.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{n.title}</p>
              {n.description && <p className="text-xs text-gray-500 mt-0.5">{n.description}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(n.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                {days >= 0 && <span className={`ml-2 ${isUrgent ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>{days === 0 ? 'Today' : `${days} days away`}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => dismiss(n.id)}
            className="text-gray-300 hover:text-gray-500 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">Remind me</span>
          <select
            value={n.remind_days_before}
            onChange={e => updateRemindDays(n.id, parseInt(e.target.value))}
            className="text-xs border border-gray-200 rounded px-2 py-0.5 text-gray-600"
          >
            <option value={1}>1 day before</option>
            <option value={7}>7 days before</option>
            <option value={14}>14 days before</option>
            <option value={30}>30 days before</option>
          </select>
          {n.email_sent && <span className="text-xs text-green-600">Email sent</span>}
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-medium text-gray-900 mb-1">Notifications</h1>
        <p className="text-gray-500 text-sm mb-6">Your upcoming benefit deadlines and reminders</p>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Upcoming</h2>
                <div className="space-y-2">
                  {upcoming.map(n => <NotificationCard key={n.id} n={n} />)}
                </div>
              </div>
            )}

            {/* System deadlines always shown */}
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Key UK benefit dates</h2>
              <div className="space-y-2">
                {UK_DEADLINES.filter(d => new Date(d.date) >= today).slice(0, 5).map(d => {
                  const config = EVENT_TYPE_CONFIG[d.type]
                  return (
                    <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-3 flex gap-3">
                      <div
                        className="w-2 rounded-full self-stretch flex-shrink-0"
                        style={{ background: config?.color || '#888' }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {upcoming.length === 0 && (
              <div className="bg-teal-50 rounded-2xl p-6 text-center">
                <p className="text-teal-700 font-medium mb-1">No upcoming personal reminders</p>
                <p className="text-teal-600 text-sm">Go to the calendar to add your own reminders for PIP reviews, UC payment dates, and more.</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
