-- Admin maintenance log
-- Tracks when recurring admin tasks were last completed.
-- Apply via Supabase dashboard → SQL editor.

CREATE TABLE IF NOT EXISTS public.admin_maintenance_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key    text        NOT NULL,   -- 'annual_rates' | 'monthly_spotcheck' | 'policy_review' | 'complaint_logged' | 'complaint_review'
  completed_at timestamptz NOT NULL DEFAULT now(),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast "latest per task_key" queries
CREATE INDEX IF NOT EXISTS idx_maintenance_log_task_key
  ON public.admin_maintenance_log (task_key, completed_at DESC);

-- RLS: only the service role (Netlify functions) can read/write
ALTER TABLE public.admin_maintenance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.admin_maintenance_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.admin_maintenance_log IS
  'Tracks completion of recurring admin tasks. task_key values:
   annual_rates      — April rates update (due every April 5)
   monthly_spotcheck — Monthly live-app accuracy check (due every 30 days)
   policy_review     — DWP policy change review (triggered manually)
   complaint_logged  — Incremented each time a user complaint is logged (threshold: 10)
   complaint_review  — Logged when a batch of complaints is reviewed';
