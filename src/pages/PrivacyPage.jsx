import Layout from '../components/Layout'

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: May 2026</p>

        {[
          {
            title: 'What we collect',
            body: 'When you use ClaimSmart UK, we collect: your email address (via Google sign-in or Stripe), your answers to our 8 questions (stored anonymously by default), and payment confirmation from Stripe. We do not collect your name unless you provide it through Google sign-in.'
          },
          {
            title: 'How we use it',
            body: 'We use your information to generate your personalised benefits report, send you your PDF by email, send you reminders you have set up, and improve our service. We never use your data for advertising.'
          },
          {
            title: 'Who we share it with',
            body: 'We share data only with: Stripe (payment processing), Supabase (secure database hosting in EU), Resend (email delivery), and Anthropic (Claude API — anonymised question answers only, no personal data). We never sell your data to third parties.'
          },
          {
            title: 'How long we keep it',
            body: 'Your account data is kept until you delete your account. Report data is retained for 12 months so you can access it again. You can request deletion of all your data at any time by emailing privacy@claimsmart.uk.'
          },
          {
            title: 'Your rights',
            body: 'Under UK GDPR, you have the right to access your data, correct inaccurate data, delete your data, and object to processing. To exercise any of these rights, email privacy@claimsmart.uk.'
          },
          {
            title: 'Security',
            body: 'All data is encrypted in transit (TLS) and at rest. We use Supabase row-level security to ensure users can only access their own data. Payments are handled entirely by Stripe — we never see or store card details.'
          },
          {
            title: 'Contact',
            body: 'For privacy questions, email privacy@claimsmart.uk. For general support, email hello@claimsmart.uk.'
          },
        ].map(section => (
          <div key={section.title} className="mb-6">
            <h2 className="text-base font-medium text-gray-900 mb-2">{section.title}</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </Layout>
  )
}
