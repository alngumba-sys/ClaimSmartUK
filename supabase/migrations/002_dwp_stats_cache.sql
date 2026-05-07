-- DWP Stat-Xplore statistics cache
-- Populated monthly by the refresh-dwp-stats Netlify function.
-- The app reads the most-recent row; old rows are kept for audit/trend tracking.

create table if not exists public.dwp_stats_cache (
  id           bigint generated always as identity primary key,
  stats        jsonb        not null,
  refreshed_at timestamptz  not null default now()
);

-- Index so the latest-row query is fast
create index if not exists dwp_stats_cache_refreshed_at_idx
  on public.dwp_stats_cache (refreshed_at desc);

-- RLS policies (drop-then-create so this file is safe to re-run)
alter table public.dwp_stats_cache enable row level security;

drop policy if exists "Public read"          on public.dwp_stats_cache;
drop policy if exists "Service role insert"  on public.dwp_stats_cache;

create policy "Public read" on public.dwp_stats_cache
  for select using (true);

create policy "Service role insert" on public.dwp_stats_cache
  for insert with check (true);

comment on table public.dwp_stats_cache is
  'Cached DWP benefit statistics from the Stat-Xplore Open Data API. '
  'Refreshed on the 10th of each month by the refresh-dwp-stats function.';
