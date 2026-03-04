create table if not exists public.roadmap_generation_stage_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  stage_id text not null,
  attempt_no integer not null check (attempt_no > 0),
  model text not null,
  fail_codes jsonb not null default '[]'::jsonb,
  fail_reasons jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rg_stage_attempts_job_created
  on public.roadmap_generation_stage_attempts (job_id, created_at desc);
create index if not exists idx_rg_stage_attempts_job_stage
  on public.roadmap_generation_stage_attempts (job_id, stage_id, created_at desc);

alter table if exists public.roadmap_generation_quality_runs
  add column if not exists dedupe_score numeric(5,2) not null default 0,
  add column if not exists concept_coverage_score numeric(5,2) not null default 0,
  add column if not exists template_risk_score numeric(5,2) not null default 100;

create index if not exists idx_rg_quality_runs_job_created_ext
  on public.roadmap_generation_quality_runs (job_id, created_at desc);

alter table public.roadmap_generation_stage_attempts enable row level security;

drop policy if exists rgsa_select_own on public.roadmap_generation_stage_attempts;
create policy rgsa_select_own
  on public.roadmap_generation_stage_attempts
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs rgj
      where rgj.id = roadmap_generation_stage_attempts.job_id
        and rgj.user_id::text = (select auth.uid())::text
    )
  );
