// Key UK benefit dates pre-loaded for all users
export const UK_DEADLINES = [
  {
    id: 'rate-change-2027',
    date: '2027-04-06',
    title: 'DWP rates update 2027/28',
    description: 'All benefit rates (UC, Child Benefit, PIP etc.) update. Re-check your entitlement.',
    type: 'rate_change',
  },
  {
    id: 'sa-deadline-jan27',
    date: '2027-01-31',
    title: 'Self-assessment filing deadline',
    description: 'Online tax return for 2025/26 tax year due to HMRC.',
    type: 'deadline',
  },
  {
    id: 'sa-payment-jul26',
    date: '2026-07-31',
    title: 'Self-assessment payment due',
    description: 'Second payment on account for 2025/26 due to HMRC.',
    type: 'deadline',
  },
  {
    id: 'child-benefit-renewal',
    date: '2026-08-31',
    title: 'Child Benefit — annual check',
    description: 'Confirm your circumstances haven\'t changed affecting Child Benefit eligibility.',
    type: 'review',
  },
  {
    id: 'pip-review-reminder',
    date: '2026-10-01',
    title: 'PIP reassessment reminder',
    description: 'Check your PIP award letter for your personal review date. DWP will contact you.',
    type: 'review',
  },
  {
    id: 'winter-fuel-oct26',
    date: '2026-10-15',
    title: 'Winter Fuel Payment',
    description: 'Paid automatically to eligible households (pension age on certain benefits).',
    type: 'payment',
  },
  {
    id: 'cold-weather-nov26',
    date: '2026-11-01',
    title: 'Cold Weather Payment season starts',
    description: '£25 paid automatically when local temperature averages 0°C or below for 7 days.',
    type: 'payment',
  },
  {
    id: 'uc-migration-deadline',
    date: '2026-12-31',
    title: 'Legacy benefit migration deadline',
    description: 'Final date for most legacy benefit claimants to move to Universal Credit.',
    type: 'deadline',
  },
  {
    id: 'rate-change-2026',
    date: '2026-04-06',
    title: 'DWP rates updated (2026/27)',
    description: 'Benefit rates increased for 2026/27. Check your new entitlement amounts.',
    type: 'rate_change',
  },
  {
    id: 'healthy-start-review',
    date: '2026-06-01',
    title: 'Healthy Start — check eligibility',
    description: 'Eligible if pregnant or have child under 4 and on UC or low income. £36.83/month in vouchers.',
    type: 'review',
  },
]

export const EVENT_TYPE_CONFIG = {
  payment: { color: '#0F6E56', bg: '#E1F5EE', label: 'Payment' },
  deadline: { color: '#A32D2D', bg: '#FCEBEB', label: 'Deadline' },
  review: { color: '#854F0B', bg: '#FAEEDA', label: 'Review' },
  rate_change: { color: '#185FA5', bg: '#E6F1FB', label: 'Rate change' },
  custom: { color: '#5F5E5A', bg: '#F1EFE8', label: 'Custom' },
  uc_payment: { color: '#0F6E56', bg: '#E1F5EE', label: 'UC payment' },
}
