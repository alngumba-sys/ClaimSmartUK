-- Benefits Watch subscription columns
alter table public.profiles
  add column if not exists benefits_watch_active boolean default false,
  add column if not exists benefits_watch_started_at timestamptz,
  add column if not exists benefits_watch_stripe_subscription_id text,
  add column if not exists benefits_watch_current_period_end timestamptz,
  add column if not exists total_value_protected_pence integer default 0;

-- Watch alerts table
create table if not exists public.watch_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  alert_type text not null,
  title text not null,
  previous_monthly_pence integer,
  new_monthly_pence integer,
  difference_pence integer,
  email_sent boolean default false,
  created_at timestamptz default now()
);

alter table public.watch_alerts enable row level security;
create policy "Users see own alerts" on public.watch_alerts
  for select using (auth.uid() = user_id);
