import { useEffect, useState } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { UK_DEADLINES, EVENT_TYPE_CONFIG } from '../data/ukDeadlines2026'
import { downloadICS } from '../utils/generateICS'

export default function CalendarPage() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [userNotifications, setUserNotifications] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: 'custom', description: '' })

  useEffect(() => {
    if (user) loadNotifications()
  }, [user])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('due_date')
    setUserNotifications(data || [])
  }

  // Combine UK deadlines with user's personal notifications
  const allEvents = [
    ...UK_DEADLINES.map(d => ({ ...d, source: 'system' })),
    ...userNotifications.map(n => ({
      id: n.id,
      date: n.due_date,
      title: n.title,
      description: n.description,
      type: n.type,
      source: 'user',
    })),
  ]

  function getEventsForDate(date) {
    const dateStr = date.toISOString().split('T')[0]
    return allEvents.filter(e => e.date === dateStr)
  }

  function tileContent({ date }) {
    const events = getEventsForDate(date)
    if (events.length === 0) return null
    return (
      <div className="flex justify-center gap-0.5 mt-0.5">
        {events.slice(0, 3).map((e, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: EVENT_TYPE_CONFIG[e.type]?.color || '#888' }}
          />
        ))}
      </div>
    )
  }

  const selectedDateEvents = getEventsForDate(selectedDate)

  // Upcoming events (next 60 days)
  const today = new Date()
  const upcoming = allEvents
    .filter(e => {
      const d = new Date(e.date)
      return d >= today && d <= new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  async function addCustomEvent() {
    if (!newEvent.title || !newEvent.date) return
    const { data } = await supabase.from('notifications').insert({
      user_id: user.id,
      type: newEvent.type,
      title: newEvent.title,
      description: newEvent.description,
      due_date: newEvent.date,
      remind_days_before: 7,
    }).select().single()
    if (data) {
      setUserNotifications(prev => [...prev, data])
      setShowAddModal(false)
      setNewEvent({ title: '', date: '', type: 'custom', description: '' })
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-medium text-gray-900">Claim calendar</h1>
            <p className="text-gray-500 text-sm">Key benefit dates, deadlines, and your personal reminders</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadICS(allEvents)}
              className="text-sm border border-gray-200 text-gray-600 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sm bg-teal-600 text-white px-3 py-2.5 rounded-lg hover:bg-teal-800 transition-colors min-h-[44px]"
            >
              Add reminder
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(EVENT_TYPE_CONFIG).slice(0, 4).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: config.color }} />
              {config.label}
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 overflow-hidden">
            <style>{`
              .react-calendar { border: none; width: 100%; font-family: inherit; }
              .react-calendar__tile { border-radius: 8px; padding: 8px 4px; }
              .react-calendar__tile--active { background: #0F6E56 !important; color: white; }
              .react-calendar__tile--now { background: #E1F5EE; }
              .react-calendar__navigation button { border-radius: 8px; }
            `}</style>
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              tileContent={tileContent}
              locale="en-GB"
            />

            {/* Selected date events */}
            {selectedDateEvents.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">
                  {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                </p>
                {selectedDateEvents.map(e => (
                  <div
                    key={e.id}
                    className="rounded-lg p-2.5 mb-2 text-sm"
                    style={{ background: EVENT_TYPE_CONFIG[e.type]?.bg || '#f5f5f5' }}
                  >
                    <p className="font-medium" style={{ color: EVENT_TYPE_CONFIG[e.type]?.color }}>
                      {e.title}
                    </p>
                    {e.description && <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming events */}
          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Coming up</h2>
            <div className="space-y-2">
              {upcoming.map(e => {
                const daysUntil = Math.ceil((new Date(e.date) - today) / (1000 * 60 * 60 * 24))
                const config = EVENT_TYPE_CONFIG[e.type] || EVENT_TYPE_CONFIG.custom
                return (
                  <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-3 flex gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-medium"
                      style={{ background: config.bg, color: config.color }}
                    >
                      {daysUntil}d
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              {upcoming.length === 0 && (
                <p className="text-sm text-gray-400">No upcoming events in the next 60 days</p>
              )}
            </div>
          </div>
        </div>

        {/* Add event modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 sm:px-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Add reminder</h2>
                <button onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Reminder title"
                  value={newEvent.title}
                  onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base"
                />
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base"
                />
                <select
                  value={newEvent.type}
                  onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base"
                >
                  <option value="custom">Custom reminder</option>
                  <option value="deadline">Claim deadline</option>
                  <option value="review">Review date</option>
                  <option value="uc_payment">UC payment date</option>
                </select>
                <textarea
                  placeholder="Notes (optional)"
                  value={newEvent.description}
                  onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base h-24 resize-none"
                />
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustomEvent}
                  className="flex-1 bg-teal-600 text-white py-3 rounded-xl text-sm hover:bg-teal-800 min-h-[48px]"
                >
                  Add reminder
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
