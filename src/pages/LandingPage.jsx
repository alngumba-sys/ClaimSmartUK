import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

const steps = [
  { num: 1, text: 'Answer 8 quick questions about your circumstances — takes about 8 minutes' },
  { num: 2, text: 'See which benefits you qualify for and estimated amounts — free preview' },
  { num: 3, text: 'Unlock your full personalised report and action plan for £9' },
]

const features = [
  {
    title: 'Personalised to you',
    desc: 'Not a generic calculator. Based on your exact age, income, housing, health, and family situation.',
  },
  {
    title: 'Plain English',
    desc: 'No jargon, no confusing forms. Just clear answers about what you\'re entitled to and why.',
  },
  {
    title: 'Step-by-step action plan',
    desc: 'Exactly what to do, in what order, this week. With links to the official claim pages.',
  },
]

const stats = [
  { value: '7 million', label: 'households missing out' },
  { value: '£24 billion', label: 'unclaimed every year' },
  { value: '£3,428', label: 'average missed per household' },
]

export default function LandingPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-medium text-gray-900 leading-tight">
          Find out what benefits you're owed — in 8 minutes
        </h1>
        <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">
          Over £24 billion goes unclaimed every year in the UK. The average household misses out on £3,428. See what you're entitled to.
        </p>
        <div className="mt-8">
          <Link
            to="/check"
            className="inline-block w-full sm:w-auto bg-teal-600 text-white py-4 px-8 rounded-xl text-base font-medium hover:bg-teal-800 transition-colors"
          >
            Check what you're owed — free
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-gray-400">
          <span>No login required to start</span>
          <span className="hidden sm:inline">·</span>
          <span>Takes 8 minutes</span>
          <span className="hidden sm:inline">·</span>
          <span>2026/27 DWP rates</span>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-teal-600 text-white py-8">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-medium">{s.value}</p>
              <p className="text-teal-100 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-medium text-gray-900 text-center mb-10">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center text-lg font-medium mx-auto mb-4">
                {step.num}
              </div>
              <p className="text-gray-600 text-sm">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-medium text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <div className="bg-teal-50 rounded-2xl p-8 text-center">
          <p className="text-gray-700 text-lg italic">
            "I had no idea I was missing Carer's Allowance and Council Tax Reduction. ClaimSmart found me an extra £890 a month."
          </p>
          <p className="text-sm text-gray-400 mt-4">— Sarah T., Manchester (illustrative example)</p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-4 pb-16 text-center">
        <h2 className="text-2xl font-medium text-gray-900 mb-6">Ready to find out what you're owed?</h2>
        <Link
          to="/check"
          className="inline-block w-full sm:w-auto bg-teal-600 text-white py-4 px-8 rounded-xl text-base font-medium hover:bg-teal-800 transition-colors"
        >
          Check what you're owed — free
        </Link>
        <p className="text-xs text-gray-400 mt-4 max-w-md mx-auto">
          Results are estimates based on DWP rates April 2026/27. Always confirm with DWP or Citizens Advice.
        </p>
      </section>
    </Layout>
  )
}
