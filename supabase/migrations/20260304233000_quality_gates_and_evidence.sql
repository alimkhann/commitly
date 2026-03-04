alter table if exists public.roadmap_generation_jobs
  add column if not exists quality_gate_status text not null default 'pass',
  add column if not exists quality_fail_reasons jsonb not null default '[]'::jsonb,
  add column if not exists failed_stage_ids jsonb not null default '[]'::jsonb,
  add column if not exists dedupe_score numeric(5,2) not null default 0,
  add column if not exists grounding_score numeric(5,2) not null default 0;

alter table if exists public.roadmap_generation_jobs
  drop constraint if exists rgj_quality_gate_status_check;
alter table if exists public.roadmap_generation_jobs
  add constraint rgj_quality_gate_status_check
    check (quality_gate_status in ('pass', 'fail'));

alter table if exists public.generated_roadmaps
  add column if not exists timeline_quality jsonb;

update public.generated_roadmaps
set is_catalog_visible = false,
    catalog_segment = 'quality-reset-2026-03-04',
    updated_at = now()
where repo_full_name = 'vercel/ms';

create table if not exists public.roadmap_generation_stage_evidence (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  stage_id text not null,
  evidence_refs jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_rg_stage_evidence_job_stage
  on public.roadmap_generation_stage_evidence (job_id, stage_id);
create index if not exists idx_rg_stage_evidence_created
  on public.roadmap_generation_stage_evidence (created_at desc);

create table if not exists public.roadmap_generation_quality_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  repo_full_name text not null,
  novelty_score numeric(5,2) not null default 0,
  grounding_score numeric(5,2) not null default 0,
  anti_template_pass boolean not null default false,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_rg_quality_runs_job_created
  on public.roadmap_generation_quality_runs (job_id, created_at desc);
create index if not exists idx_rg_quality_runs_repo_created
  on public.roadmap_generation_quality_runs (repo_full_name, created_at desc);

alter table public.roadmap_generation_stage_evidence enable row level security;
alter table public.roadmap_generation_quality_runs enable row level security;

drop policy if exists rgse_select_own on public.roadmap_generation_stage_evidence;
create policy rgse_select_own
  on public.roadmap_generation_stage_evidence
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs rgj
      where rgj.id = roadmap_generation_stage_evidence.job_id
        and rgj.user_id::text = (select auth.uid())::text
    )
  );

drop policy if exists rgqr_select_own on public.roadmap_generation_quality_runs;
create policy rgqr_select_own
  on public.roadmap_generation_quality_runs
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs rgj
      where rgj.id = roadmap_generation_quality_runs.job_id
        and rgj.user_id::text = (select auth.uid())::text
    )
  );
