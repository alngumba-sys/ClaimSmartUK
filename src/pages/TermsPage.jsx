import Layout from '../components/Layout'

export default function TermsPage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Terms & Conditions</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: May 2026</p>

        {[
          {
            title: '1. About ClaimSmart UK',
            body: 'ClaimSmart UK is operated as an information service. We help people in the United Kingdom understand which welfare benefits they may be entitled to, based on self-reported circumstances. By using this website and purchasing a report, you agree to these terms.',
          },
          {
            title: '2. Results are estimates, not advice',
            body: 'The benefit amounts and eligibility assessments shown on this site are estimates only. They are generated using your self-reported answers and publicly available DWP rates for 2026/27. ClaimSmart UK is not a financial adviser, benefits adviser, or regulated entity under the Financial Services and Markets Act 2000. Nothing on this site constitutes financial, legal, or welfare advice. You should always confirm your entitlement directly with the Department for Work and Pensions (DWP), your local council, or an accredited adviser such as Citizens Advice before making a claim.',
          },
          {
            title: '3. Accuracy of information',
            body: 'We make reasonable efforts to keep our benefit rates and eligibility rules up to date. However, DWP rules change frequently and your actual entitlement may differ significantly from our estimates — higher or lower — depending on factors not captured by our 8 questions. We accept no liability for decisions made on the basis of estimates shown on this site.',
          },
          {
            title: '4. Payment and access',
            body: 'The full personalised report, including step-by-step claim instructions and PDF download, is available for a one-off payment of £9.00 (including VAT where applicable). Payment is processed securely by Stripe. ClaimSmart UK does not store your card details.',
          },
          {
            title: '5. Refund policy',
            body: 'Because the full report is a digital product delivered immediately upon payment, we are unable to offer refunds once the report has been generated and made accessible in your account. If you experience a technical problem preventing access to your report, contact us at hello@claimsmart.uk within 7 days of purchase and we will resolve it or issue a refund at our discretion. This does not affect your statutory rights under the Consumer Rights Act 2015.',
          },
          {
            title: '6. Referral programme',
            body: 'You may earn £2 for each friend who purchases a full report using your referral link. Referral earnings are credited to your account within 48 hours of a referred purchase being confirmed. Earnings are paid out by bank transfer upon request, subject to a minimum balance of £10. ClaimSmart UK reserves the right to withhold earnings where fraudulent referral activity is suspected, and to modify or discontinue the referral programme at any time with 14 days\u2019 notice.',
          },
          {
            title: '7. Acceptable use',
            body: 'You agree not to misuse this service. Prohibited uses include: providing false information to manipulate results; using automated tools to submit requests in bulk; attempting to reverse-engineer or scrape the site; and any use that is unlawful or harmful to others. We reserve the right to suspend or terminate accounts that breach these terms.',
          },
          {
            title: '8. Intellectual property',
            body: 'All content on this site — including the question flow, benefit summaries, report format, and written copy — is the intellectual property of ClaimSmart UK. You may not reproduce, distribute, or create derivative works from any part of the site without our written permission.',
          },
          {
            title: '9. Limitation of liability',
            body: 'To the fullest extent permitted by law, ClaimSmart UK shall not be liable for any indirect, incidental, or consequential loss arising from your use of this service — including loss arising from reliance on benefit estimates. Our total liability for any claim arising out of or related to these terms shall not exceed the amount you paid for your report.',
          },
          {
            title: '10. Changes to these terms',
            body: 'We may update these terms from time to time. The date at the top of this page shows when they were last revised. Continued use of the site after changes are posted constitutes acceptance of the updated terms.',
          },
          {
            title: '11. Governing law',
            body: 'These terms are governed by the law of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.',
          },
          {
            title: '12. Contact',
            body: 'For questions about these terms, email hello@claimsmart.uk.',
          },
        ].map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="text-base font-medium text-gray-900 mb-2">{section.title}</h2>
            <p className="text-gray-500 text-sm leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </Layout>
  )
}
