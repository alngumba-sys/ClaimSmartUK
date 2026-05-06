-- Run this entire file in your Supabase SQL editor
-- ClaimSmart UK — Initial Schema

-- Users profile (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  full_name text,
  avatar_url text,
  referral_code text unique default substring(md5(random()::text), 1, 8),
  referred_by text,
  referral_earnings_pence integer default 0,
  subscription_status text default 'free',
  chat_questions_used integer default 0,
  chat_questions_reset_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  answers jsonb not null,
  benefits jsonb not null,
  total_monthly_pence integer not null default 0,
  total_annual_pence integer not null default 0,
  pdf_url text,
  stripe_session_id text,
  paid boolean default false,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Claim status per benefit per user
create table if not exists public.claim_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  report_id uuid references public.reports(id),
  benefit_name text not null,
  status text default 'not_started',
  steps_completed integer[] default '{}',
  notes text,
  updated_at timestamptz default now()
);

-- Notifications / reminders
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  type text not null,
  title text not null,
  description text,
  due_date date not null,
  remind_days_before integer default 7,
  email_sent boolean default false,
  dismissed boolean default false,
  created_at timestamptz default now()
);

-- Referrals
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles(id),
  referred_email text,
  referred_user_id uuid references public.profiles(id),
  paid boolean default false,
  earnings_pence integer default 200,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.claim_status enable row level security;
alter table public.notifications enable row level security;
alter table public.referrals enable row level security;

-- Policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can view own reports"
  on public.reports for all using (auth.uid() = user_id);
create policy "Users can insert own reports"
  on public.reports for insert with check (auth.uid() = user_id OR user_id IS NULL);

create policy "Users can manage own claim status"
  on public.claim_status for all using (auth.uid() = user_id);

create policy "Users can manage own notifications"
  on public.notifications for all using (auth.uid() = user_id);

create policy "Users can view own referrals"
  on public.referrals for select using (auth.uid() = referrer_id);

-- Auto-create profile on signup trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
