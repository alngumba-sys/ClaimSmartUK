import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

// ─── data ───────────────────────────────────────────────────────────────────

const myths = [
  {
    myth: '"I work so I won\'t qualify."',
    fact: 'Working Tax Credit, Universal Credit top-ups, and childcare support are all available to people in employment. Millions of working households are missing out.',
  },
  {
    myth: '"I own my home so I can\'t claim."',
    fact: 'Homeownership disqualifies you from Housing Benefit, but not from Universal Credit, PIP, Child Benefit, Carer\'s Allowance, or Council Tax Reduction.',
  },
  {
    myth: '"I\'ll have to pay it back one day."',
    fact: 'Benefits are not loans. You are entitled to them under law. There is nothing to repay if your circumstances are reported honestly.',
  },
  {
    myth: '"The application will be too complicated."',
    fact: 'Many people use the free GOV.UK online portals. ClaimSmart gives you a step-by-step action plan with exact links so you know what to do first.',
  },
  {
    myth: '"I don\'t want to take money meant for others."',
    fact: 'The benefits system is funded by national insurance contributions — including yours. Claiming what you\'re entitled to does not take from anyone else.',
  },
]

const commonReasons = [
  { label: "Didn't know they qualified", pct: 43 },
  { label: 'Thought it was too complicated', pct: 31 },
  { label: 'Felt embarrassed or stigmatised', pct: 18 },
  { label: 'Believed they would be rejected', pct: 8 },
]

const steps = [
  {
    num: '01/',
    badge: 'Takes 8 minutes',
    title: 'Answer 8 questions',
    body: 'Your situation, age, income, housing, health, children, savings, and region. No personal data required to see your results.',
  },
  {
    num: '02/',
    badge: 'Instant results',
    title: 'See your entitlement',
    body: 'A personalised list of the benefits you likely qualify for, with estimated amounts based on 2026/27 DWP rates.',
  },
  {
    num: '03/',
    badge: 'Full report — £9',
    title: 'Unlock your action plan',
    body: 'Step-by-step claim instructions, official links, a claim tracker, and a downloadable PDF — for less than the cost of one missed day.',
  },
]

const bigStats = [
  { value: '£24B', label: 'Unclaimed every year', sub: 'DWP estimate · 2026' },
  { value: '7M+',  label: 'Households missing out', sub: 'UK-wide · all income levels' },
  { value: '£3,428', label: 'Average missed per home', sub: 'Per year · after tax' },
  { value: '8 min', label: 'To check your entitlement', sub: 'No login required to start' },
]

const comparisonRows = [
  { label: 'Annual household income',  notClaiming: 'Your earnings only',        claiming: 'Earnings + entitlements' },
  { label: 'Time to check',            notClaiming: 'Hours of DWP research',     claiming: '8 minutes with ClaimSmart' },
  { label: 'Outcome certainty',        notClaiming: 'Unknown — guesswork',       claiming: 'Personalised to your answers' },
  { label: 'Action plan',              notClaiming: 'None',                       claiming: 'Step-by-step with official links' },
  { label: 'Claim tracking',           notClaiming: 'None',                       claiming: 'Dashboard + reminders' },
]

const whoQualifies = [
  {
    icon: 'briefcase', title: 'Working full or part time',
    items: ['Universal Credit top-up', 'Working Tax Credit', 'Childcare support (up to 85%)', 'Free school meals'],
  },
  {
    icon: 'home', title: 'Renting or with a mortgage',
    items: ['Housing Benefit / UC housing element', 'Council Tax Reduction', 'Support for Mortgage Interest'],
  },
  {
    icon: 'child', title: 'Families with children',
    items: ['Child Benefit (£110.93/mo first child)', 'Child Tax Credit', 'Healthy Start vouchers', 'Free school meals'],
  },
  {
    icon: 'health', title: 'Living with a health condition',
    items: ['Personal Independence Payment (PIP)', 'Attendance Allowance (65+)', 'UC limited capacity element', "Carer's Allowance"],
  },
  {
    icon: 'retirement', title: 'At or near retirement',
    items: ['Pension Credit (£944.98/mo)', 'Attendance Allowance', 'Council Tax Reduction', 'Free TV licence (75+)'],
  },
  {
    icon: 'caring', title: 'Caring for someone',
    items: ["Carer's Allowance (£354.90/mo)", "Carer's Credit (NI protection)", 'UC carer element', 'Council Tax Reduction'],
  },
]

const reportIncludes = [
  ['Personalised benefit list',          'Every benefit you likely qualify for, with 2026/27 rates'],
  ['Estimated monthly & annual amounts', 'Calculated from your exact answers, not generic figures'],
  ['Step-by-step claim instructions',    'What to do, in what order, with official GOV.UK links'],
  ['Claim status tracker',               'Dashboard to mark each benefit as "in progress" or "claimed"'],
  ['Deadline reminders',                 'Email alerts before renewal dates and annual uprating'],
  ['Downloadable PDF report',            'Save or print your full plan for future reference'],
]

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#d4960a' }} />
      <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: '#d4960a' }}>
        {children}
      </span>
    </div>
  )
}

function QualifyIcon({ type }) {
  const iconPaths = {
    briefcase: <><path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a1 1 0 00-1 1v10a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></>,
    home: <><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-6a1 1 0 011-1h4a1 1 0 011 1v6" /></>,
    child: <><circle cx="12" cy="7" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 10c-4 0-6 2-6 5v2h12v-2c0-3-2-5-6-5z" /></>,
    health: <><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4m-2-2h4" /></>,
    retirement: <><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 21v-1a6 6 0 0112 0v1" /></>,
    caring: <><path strokeLinecap="round" strokeLinejoin="round" d="M16 4h2a2 2 0 012 2v1m-4-3v3m0-3H8m0 0H6a2 2 0 00-2 2v1m4-3v3" /><circle cx="9" cy="13" r="2.5" /><circle cx="15" cy="13" r="2.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 21v-1a3.5 3.5 0 017 0v1m0 0v-1a3.5 3.5 0 017 0v1" /></>,
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.75}>
      {iconPaths[type]}
    </svg>
  )
}

function GoldCheck() {
  return (
    <span
      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
      style={{ background: '#d4960a' }}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#0f0722" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <Layout>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0722 0%, #1a0f3c 55%, #2d1b69 100%)' }}
      >
        {/* amber glow blob */}
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(212,150,10,0.25) 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-16">
          <SectionLabel>The UK Benefits Gap</SectionLabel>

          <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-[1.1] mb-6 max-w-3xl">
            Find out what you're owed.{' '}
            <span className="serif-italic" style={{ color: '#d4960a' }}>In 8 minutes.</span>
          </h1>

          <p className="text-lg max-w-2xl mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Over <strong className="text-white">£24 billion</strong> goes unclaimed every year in the UK.
            The average household misses <strong className="text-white">£3,428</strong>.
            Not because they don't qualify — because they don't know.
          </p>

          <Link
            to="/check"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-opacity hover:opacity-90"
            style={{ background: '#d4960a', color: '#0f0722' }}
          >
            Check what you're owed — free
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>

          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-5 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span>No login required to start</span>
            <span>·</span>
            <span>Takes 8 minutes</span>
            <span>·</span>
            <span>2026/27 DWP rates</span>
            <span>·</span>
            <span>Results are estimates</span>
          </div>
        </div>
      </section>

      {/* ── Big stats ─────────────────────────────────────────────────────── */}
      <section style={{ background: '#1a0f3c', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {bigStats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              <p className="text-4xl font-extrabold" style={{ color: '#d4960a' }}>{s.value}</p>
              <p className="text-white text-sm font-semibold mt-1">{s.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The Trap ──────────────────────────────────────────────────────── */}
      <section style={{ background: '#231350' }} className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>The Problem</SectionLabel>

          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Not claiming costs you.{' '}
            <span className="serif-italic" style={{ color: '#d4960a' }}>Every single month.</span>
          </h2>
          <p className="text-lg max-w-2xl mb-12 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            The UK benefits system paid out <strong className="text-white">£268 billion</strong> in 2025/26.
            Yet billions more went uncollected — not due to fraud or error, but because
            eligible households simply never applied.
          </p>

          {/* comparison table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <div
              className="grid grid-cols-3 text-xs font-bold tracking-widest uppercase px-6 py-3"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.35)' }}></span>
              <span className="text-red-400 text-center">Not Claiming</span>
              <span className="text-center" style={{ color: '#d4960a' }}>ClaimSmart</span>
            </div>
            {comparisonRows.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-3 px-6 py-4 text-sm"
                style={{
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span className="font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                <span className="text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>{row.notClaiming}</span>
                <span className="text-center font-semibold" style={{ color: '#d4960a' }}>{row.claiming}</span>
              </div>
            ))}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#d4960a' }}>
              <span className="font-bold text-sm" style={{ color: '#0f0722' }}>What you're leaving on the table</span>
              <span className="font-extrabold text-lg" style={{ color: '#0f0722' }}>Up to £3,428/yr</span>
            </div>
          </div>

          {/* why people don't claim */}
          <div className="mt-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Why the £24B goes unclaimed · DWP research
            </p>
            <div className="space-y-4">
              {commonReasons.map((r) => (
                <div key={r.label} className="flex items-center gap-4">
                  <span className="text-white text-sm w-64 flex-shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.pct}%`, background: 'linear-gradient(90deg, #d4960a, #f0c040)' }}
                    />
                  </div>
                  <span className="font-bold text-sm w-8 text-right" style={{ color: '#d4960a' }}>{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Myths ─────────────────────────────────────────────────────────── */}
      <section style={{ background: '#1a0f3c' }} className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Common Misconceptions</SectionLabel>

          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Five myths that stop{' '}
            <span className="serif-italic" style={{ color: '#d4960a' }}>people claiming.</span>
          </h2>
          <p className="text-lg max-w-2xl mb-12" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Most people who miss out do so because of a false belief, not a real disqualification.
          </p>

          <div className="space-y-4">
            {myths.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex gap-4">
                  <GoldCheck />
                  <div>
                    <p className="text-white font-bold mb-1">{item.myth}</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.fact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-8 rounded-2xl p-5 flex items-start gap-4"
            style={{ background: 'rgba(212,150,10,0.1)', border: '1px solid rgba(212,150,10,0.25)' }}
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              <strong style={{ color: '#d4960a' }}>The DWP does not chase you to claim.</strong> It is your
              responsibility to apply. ClaimSmart was built to remove the barriers — from confusion about
              eligibility to not knowing which form to complete first.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section style={{ background: '#0f0722' }} className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>The Process</SectionLabel>

          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Three steps.{' '}
            <span className="serif-italic" style={{ color: '#d4960a' }}>Full report.</span>
          </h2>
          <p className="text-lg max-w-2xl mb-12" style={{ color: 'rgba(255,255,255,0.55)' }}>
            From your first answer to a personalised action plan — in under 10 minutes.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {steps.map((step) => (
              <div
                key={step.num}
                className="rounded-2xl p-6"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="text-3xl font-extrabold" style={{ color: 'rgba(255,255,255,0.15)' }}>{step.num}</span>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(212,150,10,0.15)', color: '#d4960a', border: '1px solid rgba(212,150,10,0.3)' }}
                  >
                    {step.badge}
                  </span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.body}</p>
              </div>
            ))}
          </div>

          {/* what's in the full report */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="text-white font-semibold text-sm">Your full report includes</span>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#d4960a' }}>£9 one-off</span>
            </div>
            {reportIncludes.map(([title, desc], i) => (
              <div
                key={title}
                className="px-6 py-4 flex items-center gap-4"
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <GoldCheck />
                <p className="text-sm">
                  <span className="text-white font-semibold">{title}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}> · {desc}</span>
                </p>
              </div>
            ))}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: '#d4960a' }}>
              <span className="font-bold text-sm" style={{ color: '#0f0722' }}>Total value of what you could unlock</span>
              <span className="font-extrabold text-lg" style={{ color: '#0f0722' }}>Up to £3,428/yr</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who qualifies ─────────────────────────────────────────────────── */}
      <section style={{ background: '#231350' }} className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <SectionLabel>Who Qualifies</SectionLabel>

          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            More people qualify{' '}
            <span className="serif-italic" style={{ color: '#d4960a' }}>than you'd think.</span>
          </h2>
          <p className="text-lg max-w-2xl mb-12" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Benefits aren't just for the unemployed. Many are available regardless of employment status.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {whoQualifies.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl p-6"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <QualifyIcon type={card.icon} />
                  </span>
                  <h3 className="text-white font-bold text-sm">{card.title}</h3>
                </div>
                <ul className="space-y-1.5">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#d4960a' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section style={{ background: '#d4960a' }} className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p
            className="text-xs font-bold tracking-[0.2em] uppercase mb-4"
            style={{ color: 'rgba(15,7,34,0.5)' }}
          >
            Takes 8 minutes · Free to start
          </p>
          <h2
            className="text-4xl md:text-5xl font-extrabold leading-tight mb-4"
            style={{ color: '#0f0722' }}
          >
            Stop guessing.{' '}
            <span className="serif-italic" style={{ color: '#3d2486' }}>Start claiming.</span>
          </h2>
          <p className="text-lg mb-10 leading-relaxed" style={{ color: 'rgba(15,7,34,0.65)' }}>
            Check what you're entitled to for free. No email required, no login needed —
            just 8 questions between you and knowing.
          </p>
          <Link
            to="/check"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-xl text-lg font-extrabold transition-opacity hover:opacity-90"
            style={{ background: '#0f0722', color: '#d4960a' }}
          >
            Check what you're owed — free
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="text-xs mt-6" style={{ color: 'rgba(15,7,34,0.4)' }}>
            Results are estimates only. Always confirm with DWP or Citizens Advice before claiming.
          </p>
        </div>
      </section>

    </Layout>
  )
}
