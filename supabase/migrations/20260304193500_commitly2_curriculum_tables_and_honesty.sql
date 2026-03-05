-- Commitly 2.0 curriculum compiler tables + bug reports + RLS.

create table if not exists public.repo_ingest_snapshots (
  snapshot_key text primary key,
  pipeline_version text not null default 'v2',
  repo_full_name varchar(255) not null,
  default_branch varchar(255) not null,
  head_sha varchar(64) not null,
  repo_summary jsonb not null default '{}'::jsonb,
  commit_context jsonb not null default '[]'::jsonb,
  tree_stats jsonb not null default '{}'::jsonb,
  readme_excerpt text not null default '',
  complexity jsonb not null default '{}'::jsonb,
  stage_target integer not null default 10,
  logical_stage_target integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_repo_ingest_snapshots_repo_updated
  on public.repo_ingest_snapshots (repo_full_name, updated_at desc);

create table if not exists public.repo_commit_clusters (
  id bigserial primary key,
  snapshot_key text not null references public.repo_ingest_snapshots(snapshot_key) on delete cascade,
  cluster_rank integer not null,
  theme text not null,
  commit_count integer not null default 0,
  samples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_key, cluster_rank)
);

create index if not exists idx_repo_commit_clusters_snapshot_rank
  on public.repo_commit_clusters (snapshot_key, cluster_rank);

create table if not exists public.roadmap_syllabi (
  id uuid primary key default gen_random_uuid(),
  repo_full_name varchar(255) not null,
  snapshot_key text,
  pipeline_version text not null default 'v2',
  stage_target integer not null default 10,
  logical_stage_target integer not null default 10,
  curriculum_mode text not null default 'single_track' check (curriculum_mode in ('single_track', 'multi_track')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roadmap_syllabi_repo_updated
  on public.roadmap_syllabi (repo_full_name, updated_at desc);

create unique index if not exists uq_roadmap_syllabi_snapshot_pipeline
  on public.roadmap_syllabi (snapshot_key, pipeline_version)
  where snapshot_key is not null;

create table if not exists public.roadmap_syllabus_nodes (
  id bigserial primary key,
  syllabus_id uuid not null references public.roadmap_syllabi(id) on delete cascade,
  stage_id varchar(64) not null,
  stage_index integer not null,
  title text not null,
  summary text not null,
  category varchar(32) not null default 'feature',
  difficulty varchar(16) not null default 'easy',
  goals jsonb not null default '[]'::jsonb,
  prerequisites jsonb not null default '[]'::jsonb,
  checkpoints jsonb not null default '[]'::jsonb,
  source_themes jsonb not null default '[]'::jsonb,
  optional_peeks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (syllabus_id, stage_id),
  unique (syllabus_id, stage_index)
);

create index if not exists idx_roadmap_syllabus_nodes_syllabus_idx
  on public.roadmap_syllabus_nodes (syllabus_id, stage_index);

create table if not exists public.roadmap_stage_details (
  id bigserial primary key,
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  syllabus_id uuid references public.roadmap_syllabi(id) on delete set null,
  repo_full_name varchar(255) not null,
  stage_id varchar(64) not null,
  stage_index integer not null,
  detail jsonb not null,
  quality_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, stage_id)
);

create index if not exists idx_roadmap_stage_details_job_stage
  on public.roadmap_stage_details (job_id, stage_index);

create index if not exists idx_roadmap_stage_details_repo_stage
  on public.roadmap_stage_details (repo_full_name, stage_index);

create table if not exists public.roadmap_quality_reports (
  id bigserial primary key,
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  repo_full_name varchar(255) not null,
  stage_id varchar(64) not null,
  stage_index integer not null,
  quality_score integer not null default 0,
  checks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_roadmap_quality_reports_job_stage
  on public.roadmap_quality_reports (job_id, stage_index, created_at desc);

create index if not exists idx_roadmap_quality_reports_repo_stage
  on public.roadmap_quality_reports (repo_full_name, stage_index);

create table if not exists public.roadmap_reference_peeks (
  id bigserial primary key,
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  repo_full_name varchar(255) not null,
  stage_id varchar(64) not null,
  stage_index integer not null,
  peek_rank integer not null default 1,
  peek_text text not null,
  created_at timestamptz not null default now(),
  unique (job_id, stage_id, peek_rank)
);

create index if not exists idx_roadmap_reference_peeks_job_stage
  on public.roadmap_reference_peeks (job_id, stage_index, peek_rank);

create table if not exists public.bug_reports (
  id bigserial primary key,
  user_id text not null,
  title varchar(180) not null,
  description text not null,
  route_path varchar(500),
  user_agent varchar(500),
  status text not null default 'open' check (status in ('open', 'triaged', 'resolved', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bug_reports_user_created
  on public.bug_reports (user_id, created_at desc);

create index if not exists idx_bug_reports_status_created
  on public.bug_reports (status, created_at desc);

-- Backfill minimal syllabus/nodes from existing generated roadmaps when missing.
insert into public.roadmap_syllabi (
  repo_full_name,
  snapshot_key,
  pipeline_version,
  stage_target,
  logical_stage_target,
  curriculum_mode,
  metadata,
  created_at,
  updated_at
)
select
  gr.repo_full_name,
  null,
  'legacy-v1',
  greatest(json_array_length(gr.timeline) - 1, 1),
  greatest(json_array_length(gr.timeline) - 1, 1),
  'single_track',
  jsonb_build_object('source', 'generated_roadmaps_backfill'),
  gr.created_at,
  gr.updated_at
from public.generated_roadmaps gr
where not exists (
  select 1
  from public.roadmap_syllabi rs
  where rs.repo_full_name = gr.repo_full_name
)
on conflict do nothing;

with latest_syllabi as (
  select distinct on (repo_full_name)
    id,
    repo_full_name
  from public.roadmap_syllabi
  order by repo_full_name, updated_at desc
),
expanded as (
  select
    ls.id as syllabus_id,
    ls.repo_full_name,
    elem.value as stage_json,
    elem.ordinality as stage_ordinal
  from latest_syllabi ls
  join public.generated_roadmaps gr
    on gr.repo_full_name = ls.repo_full_name
  cross join lateral json_array_elements(gr.timeline) with ordinality as elem(value, ordinality)
),
normalized as (
  select
    syllabus_id,
    coalesce(nullif(stage_json ->> 'id', ''), format('stage-%s', stage_ordinal)) as stage_id,
    greatest(coalesce((stage_json ->> 'index')::integer, stage_ordinal), 1) as stage_index,
    coalesce(nullif(stage_json ->> 'title', ''), format('Stage %s', stage_ordinal)) as title,
    coalesce(nullif(stage_json ->> 'summary', ''), 'Build this stage from scratch with concrete outputs.') as summary,
    coalesce(nullif(stage_json ->> 'category', ''), 'feature') as category,
    coalesce(nullif(stage_json ->> 'difficulty', ''), 'easy') as difficulty,
    coalesce((stage_json -> 'goals')::jsonb, '[]'::jsonb) as goals,
    coalesce((stage_json -> 'prerequisites')::jsonb, '[]'::jsonb) as prerequisites,
    coalesce((stage_json -> 'checkpoints')::jsonb, '[]'::jsonb) as checkpoints
  from expanded
  where coalesce((stage_json ->> 'index')::integer, stage_ordinal) > 0
)
insert into public.roadmap_syllabus_nodes (
  syllabus_id,
  stage_id,
  stage_index,
  title,
  summary,
  category,
  difficulty,
  goals,
  prerequisites,
  checkpoints,
  source_themes,
  optional_peeks
)
select
  n.syllabus_id,
  n.stage_id,
  n.stage_index,
  n.title,
  n.summary,
  n.category,
  n.difficulty,
  n.goals,
  n.prerequisites,
  n.checkpoints,
  '[]'::jsonb,
  '[]'::jsonb
from normalized n
on conflict (syllabus_id, stage_index) do nothing;

alter table if exists public.repo_ingest_snapshots enable row level security;
alter table if exists public.repo_commit_clusters enable row level security;
alter table if exists public.roadmap_syllabi enable row level security;
alter table if exists public.roadmap_syllabus_nodes enable row level security;
alter table if exists public.roadmap_stage_details enable row level security;
alter table if exists public.roadmap_quality_reports enable row level security;
alter table if exists public.roadmap_reference_peeks enable row level security;
alter table if exists public.bug_reports enable row level security;

drop policy if exists rs_select_public on public.roadmap_syllabi;
create policy rs_select_public
  on public.roadmap_syllabi
  for select
  using (true);

drop policy if exists rsn_select_public on public.roadmap_syllabus_nodes;
create policy rsn_select_public
  on public.roadmap_syllabus_nodes
  for select
  using (true);

drop policy if exists rs_service_write on public.roadmap_syllabi;
create policy rs_service_write
  on public.roadmap_syllabi
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists rsn_service_write on public.roadmap_syllabus_nodes;
create policy rsn_service_write
  on public.roadmap_syllabus_nodes
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists ris_service_write on public.repo_ingest_snapshots;
create policy ris_service_write
  on public.repo_ingest_snapshots
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists rcc_service_write on public.repo_commit_clusters;
create policy rcc_service_write
  on public.repo_commit_clusters
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists rsd_select_own on public.roadmap_stage_details;
create policy rsd_select_own
  on public.roadmap_stage_details
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs j
      where j.id = roadmap_stage_details.job_id
        and j.user_id = ((select auth.uid())::text)
    )
  );

drop policy if exists rqr_select_own on public.roadmap_quality_reports;
create policy rqr_select_own
  on public.roadmap_quality_reports
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs j
      where j.id = roadmap_quality_reports.job_id
        and j.user_id = ((select auth.uid())::text)
    )
  );

drop policy if exists rrp_select_own on public.roadmap_reference_peeks;
create policy rrp_select_own
  on public.roadmap_reference_peeks
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs j
      where j.id = roadmap_reference_peeks.job_id
        and j.user_id = ((select auth.uid())::text)
    )
  );

drop policy if exists rsd_service_write on public.roadmap_stage_details;
create policy rsd_service_write
  on public.roadmap_stage_details
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists rqr_service_write on public.roadmap_quality_reports;
create policy rqr_service_write
  on public.roadmap_quality_reports
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists rrp_service_write on public.roadmap_reference_peeks;
create policy rrp_service_write
  on public.roadmap_reference_peeks
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists br_select_own on public.bug_reports;
create policy br_select_own
  on public.bug_reports
  for select
  using (((select auth.uid())::text = user_id) or ((select auth.role()) = 'service_role'::text));

drop policy if exists br_insert_own on public.bug_reports;
create policy br_insert_own
  on public.bug_reports
  for insert
  with check (((select auth.uid())::text = user_id) or ((select auth.role()) = 'service_role'::text));

drop policy if exists br_update_service on public.bug_reports;
create policy br_update_service
  on public.bug_reports
  for update
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);
