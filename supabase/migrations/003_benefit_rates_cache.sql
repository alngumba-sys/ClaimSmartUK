-- GOV.UK scraped benefit rates cache
-- Populated each April (and on-demand) by the refresh-rates Netlify function.
-- Single-row table (id=1) storing the most recent GOV.UK scrape snapshot.

create table if not exists public.benefit_rates_cache (
  id          int          primary key default 1,
  scraped_at  timestamptz  not null,
  data        jsonb        not null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- Constraint ensures only one row ever exists (id is always 1)
alter table public.benefit_rates_cache
  add constraint benefit_rates_cache_single_row check (id = 1);

-- Auto-update updated_at on upsert
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists benefit_rates_cache_updated_at on public.benefit_rates_cache;
create trigger benefit_rates_cache_updated_at
  before update on public.benefit_rates_cache
  for each row execute function public.set_updated_at();

-- RLS
alter table public.benefit_rates_cache enable row level security;

drop policy if exists "Public read"         on public.benefit_rates_cache;
drop policy if exists "Service role upsert" on public.benefit_rates_cache;

create policy "Public read" on public.benefit_rates_cache
  for select using (true);

-- Service role can insert and update (needed for upsert)
create policy "Service role upsert" on public.benefit_rates_cache
  for all using (true) with check (true);

comment on table public.benefit_rates_cache is
  'Most-recent GOV.UK benefit rate scrape. '
  'Refreshed each April and on-demand via POST /api/refresh-rates. '
  'Single row (id=1). Diff vs hardcoded RATES is emailed to admin on each run.';
