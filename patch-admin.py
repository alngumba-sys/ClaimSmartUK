with open('src/pages/AdminDashboard.jsx', 'r') as f:
    content = f.read()

errors = []

# 1. Add 'rates' to tabs array
old = "const tabs = ['overview', 'transactions', 'users', 'maintenance']"
new = "const tabs = ['overview', 'transactions', 'users', 'maintenance', 'rates']"
if old in content: content = content.replace(old, new, 1)
else: errors.append("TABS")

# 2. Add rates state after activeTab state
old = "  const [activeTab, setActiveTab] = useState('overview')"
new = """  const [activeTab, setActiveTab] = useState('overview')
  const [rates, setRates]               = useState([])
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesError, setRatesError]     = useState(null)
  const [editingRate, setEditingRate]   = useState(null)
  const [editValue, setEditValue]       = useState('')
  const [rateSaving, setRateSaving]     = useState(false)"""
if old in content: content = content.replace(old, new, 1)
else: errors.append("STATE")

# 3. Add loadRates + saveRate before loadStats
old = "  async function loadStats(token) {"
new = """  async function loadRates() {
    setRatesLoading(true)
    setRatesError(null)
    try {
      const token = localStorage.getItem('adminAuth') || ''
      const res = await fetch('/.netlify/functions/admin-rates', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.rates) setRates(data.rates)
      else setRatesError(data.error || 'Failed to load rates')
    } catch (e) {
      setRatesError(e.message)
    } finally {
      setRatesLoading(false)
    }
  }

  async function saveRate(id, newAmount) {
    setRateSaving(true)
    try {
      const token = localStorage.getItem('adminAuth') || ''
      const res = await fetch('/.netlify/functions/admin-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, amount_monthly: parseFloat(newAmount) }),
      })
      const data = await res.json()
      if (data.rate) {
        setRates(prev => prev.map(r => r.id === id ? { ...r, amount_monthly: data.rate.amount_monthly } : r))
        setEditingRate(null)
      }
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally {
      setRateSaving(false)
    }
  }

  async function loadStats(token) {"""
if old in content: content = content.replace(old, new, 1)
else: errors.append("LOAD_STATS")

# 4. Add useEffect for rates tab after loadMaintenance useEffect
old = "  async function loadMaintenance(token) {"
new = """  async function loadMaintenance(token) {"""
# Find a good insertion point for the useEffect - after the existing useEffects
# Look for the navigate useEffect or similar
import re
# Add rates useEffect near other useEffects
old4 = "  useEffect(() => () => cancelAnimationFrame"
if old4 not in content:
    # Try inserting before loadStats
    old4_alt = "  async function loadRates() {"
    if old4_alt in content:
        new4_alt = "  useEffect(() => { if (activeTab === 'rates' && rates.length === 0) loadRates() }, [activeTab])\n\n  async function loadRates() {"
        content = content.replace(old4_alt, new4_alt, 1)
    else:
        errors.append("USE_EFFECT")

# 5. Add Rates tab before Maintenance tab
old5 = "        {/* ── Maintenance tab"
new5 = """        {/* ── Rates tab ───────────────────────────────────────────────────── */}
        {activeTab === 'rates' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Benefit Rates 2026/27</h2>
                <p className="text-xs text-gray-500 mt-0.5">Click Edit on any rate to update it. Changes apply to all new calculations immediately.</p>
              </div>
              <button onClick={loadRates} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                ↻ Refresh
              </button>
            </div>

            {ratesLoading && <p className="text-sm text-gray-400 py-8 text-center">Loading rates…</p>}
            {ratesError && <p className="text-sm text-red-500 py-4">{ratesError}</p>}

            {!ratesLoading && rates.length > 0 && (() => {
              const categoryLabels = {
                uc: 'Universal Credit',
                pip: 'Personal Independence Payment (PIP)',
                child_benefit: 'Child Benefit',
                council_tax: 'Council Tax Reduction',
                carers: "Carer's Allowance",
                pension: 'Pension Credit',
                attendance: 'Attendance Allowance',
              }
              const categories = [...new Set(rates.map(r => r.category))].sort()
              return categories.map(cat => (
                <div key={cat} className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
                    {categoryLabels[cat] || cat}
                  </h3>
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Benefit</th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs hidden md:table-cell">Notes</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Monthly</th>
                          <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs hidden sm:table-cell">Annual</th>
                          <th className="w-20 px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.filter(r => r.category === cat).map((rate, i, arr) => (
                          <tr key={rate.id} className={`${i < arr.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50`}>
                            <td className="px-4 py-3 font-medium text-gray-800 text-xs leading-snug">{rate.label}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell max-w-xs leading-snug">{rate.notes || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              {editingRate === rate.id ? (
                                <input
                                  type="number" step="0.01" value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  className="w-24 text-right border border-yellow-400 rounded px-2 py-1 text-sm font-mono focus:outline-none"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveRate(rate.id, editValue)
                                    if (e.key === 'Escape') setEditingRate(null)
                                  }}
                                />
                              ) : (
                                <span className="font-mono font-semibold text-gray-800 text-xs">£{Number(rate.amount_monthly).toFixed(2)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-400 text-xs hidden sm:table-cell">
                              £{(Number(rate.amount_monthly) * 12).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {editingRate === rate.id ? (
                                <div className="flex gap-1 justify-end">
                                  <button onClick={() => saveRate(rate.id, editValue)} disabled={rateSaving}
                                    className="text-xs px-2 py-1 bg-yellow-400 text-black rounded font-semibold hover:bg-yellow-500 disabled:opacity-50">
                                    {rateSaving ? '…' : 'Save'}
                                  </button>
                                  <button onClick={() => setEditingRate(null)}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditingRate(rate.id); setEditValue(Number(rate.amount_monthly).toFixed(2)) }}
                                  className="text-xs px-2 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            })()}
            <p className="text-xs text-gray-400 mt-2 text-center">Rates updated each April per DWP annual uprating.</p>
          </div>
        )}

        {/* ── Maintenance tab"""
if old5 in content: content = content.replace(old5, new5, 1)
else: errors.append("MAINTENANCE_TAB")

if errors:
    print("❌ Failed sections:", errors)
else:
    with open('src/pages/AdminDashboard.jsx', 'w') as f:
        f.write(content)
    print("✅ All patches applied successfully")
