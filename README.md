# ClaimSmart UK

A UK benefits eligibility checker. Users answer 8 questions about their circumstances, get a free AI-powered preview of the benefits they may qualify for, then pay £9 to unlock a full personalised report with step-by-step claim instructions and a downloadable PDF.

## Tech stack

- **Frontend** — React 19, Vite, Tailwind CSS, React Router
- **Backend** — Netlify Functions (serverless, Node)
- **Database** — Supabase (Postgres + Auth + Row Level Security)
- **Payments** — Stripe Checkout (one-off £9 payment)
- **AI** — Anthropic Claude (benefit calculation via `calculate-benefits` function)
- **Email** — Resend (report delivery, notifications)
- **Deployment** — Netlify (frontend + functions)

## Project structure

```
claimsmart-uk/
├── src/
│   ├── pages/          # Route-level components
│   │   ├── LandingPage.jsx
│   │   ├── QuestionFlow.jsx     # 8-question eligibility quiz
│   │   ├── ResultsPreview.jsx   # Blurred preview + paywall
│   │   ├── SuccessPage.jsx      # Post-payment confirmation
│   │   ├── Dashboard.jsx        # Claim status tracker
│   │   ├── CalendarPage.jsx     # Deadline reminders
│   │   ├── NotificationsPage.jsx
│   │   ├── ReferralPage.jsx     # Refer-a-friend (£2/referral)
│   │   ├── AdminDashboard.jsx
│   │   ├── PrivacyPage.jsx
│   │   └── TermsPage.jsx
│   ├── components/
│   │   ├── Layout.jsx           # Nav + footer wrapper
│   │   ├── DashboardLayout.jsx
│   │   ├── ProtectedRoute.jsx   # Requires Supabase auth
│   │   └── AdminRoute.jsx       # Requires admin credentials
│   ├── contexts/
│   │   └── AuthContext.jsx      # Supabase auth state
│   ├── lib/
│   │   └── supabase.js          # Supabase client
│   └── data/
│       └── benefitsRates2026.js # Rate constants + formatGBP helper
├── netlify/
│   └── functions/
│       ├── calculate-benefits.js  # Claude API call — returns benefit JSON
│       ├── create-checkout.js     # Creates Stripe Checkout session
│       ├── stripe-webhook.js      # Marks report as paid, triggers PDF
│       ├── generate-pdf.js        # Builds and stores PDF report
│       ├── resend-report.js       # Emails PDF to user via Resend
│       ├── check-notifications.js # Daily cron — sends deadline reminders
│       └── admin-stats.js         # Admin dashboard data endpoint
├── supabase/
│   └── migrations/
│       └── 001_initial.sql       # Full schema — run once in Supabase SQL editor
├── public/                       # Static assets (favicon, icons)
├── netlify.toml                  # Build config + function routing
├── .env.example                  # Required environment variables (see below)
└── vite.config.js
```

## Database schema

Five tables, all with Row Level Security enabled:

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` — referral code, earnings, subscription status |
| `reports` | Stores answers, AI-generated benefits JSON, payment status |
| `claim_status` | Per-benefit status (not started / in progress / claimed) per user |
| `notifications` | Scheduled reminders (review dates, annual uprating) |
| `referrals` | Tracks referral links and £2 earnings |

A Postgres trigger (`on_auth_user_created`) auto-creates a profile row on sign-up.

## Environment variables

Copy `.env.example` to `.env` and fill in every value before running locally or deploying.

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API (keep secret — server-side only) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (keep secret) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → signing secret |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |
| `RESEND_API_KEY` | resend.com → API keys |
| `VITE_APP_URL` | Your deployed URL (e.g. `https://claimsmart.netlify.app`) |
| `ADMIN_EMAIL` | Admin login email (checked in `AdminRoute`) |
| `ADMIN_PASSWORD` | Admin login password — change from default immediately |

`VITE_` prefixed variables are embedded in the frontend bundle at build time. All others are server-side only and must be set in Netlify's environment variable settings for production.

## Local development

```bash
# Install dependencies
npm install

# Start Netlify Dev (runs Vite + Netlify Functions together on port 8888)
npx netlify dev
```

Netlify Dev proxies `/api/*` requests to your local functions automatically, matching the production setup. You do not need to run `npm run dev` separately.

## Database setup

Run the migration once in the Supabase SQL editor:

```
supabase/migrations/001_initial.sql
```

This creates all tables, enables RLS, sets up policies, and installs the new-user trigger.

## Stripe webhook (local testing)

```bash
# Install Stripe CLI, then forward events to local function
stripe listen --forward-to localhost:8888/api/stripe-webhook
```

The webhook handler (`stripe-webhook.js`) listens for `checkout.session.completed` to mark reports as paid and trigger PDF generation.

## Deployment

The project deploys automatically to Netlify on push to `main`. Ensure all environment variables are set in **Netlify → Site settings → Environment variables** before deploying.

The `check-notifications` function runs daily at 08:00 UTC via the cron schedule in `netlify.toml`.

## User flow

1. User visits `/` and clicks "Check what you're owed — free"
2. `/check` — 8-question flow (situation, age, housing, children, income, savings, health, region)
3. Answers posted to `/api/calculate-benefits` → Claude returns a JSON array of eligible benefits
4. `/results` — free preview shows first 2 benefits; rest are blurred
5. User clicks "Unlock full report" → `/api/create-checkout` → Stripe Checkout
6. On payment: Stripe webhook → report marked paid → PDF generated → emailed to user
7. User logs in → `/dashboard` to track claim progress per benefit

## Key design decisions

- **No auth required to see results** — users can skip sign-in and still get a preview. This maximises top-of-funnel conversion. Sign-in is encouraged before payment to associate the report with an account.
- **AI rates hardcoded in system prompt** — Claude is given the exact 2026/27 DWP rates to prevent hallucinated figures. Update `calculate-benefits.js` each April when rates change.
- **Rate limiting on the AI endpoint** — `calculate-benefits.js` enforces 5 requests per 15 minutes per IP to prevent API cost abuse. Answers are validated against the known option lists before any Claude call is made.
- **Fallback benefits** — if the Claude API fails, two generic high-likelihood benefits (Universal Credit, Council Tax Reduction) are returned so the user flow never fully breaks.
