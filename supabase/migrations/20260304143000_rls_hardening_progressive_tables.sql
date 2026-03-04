-- RLS hardening for token/governance and progressive generation tables.

alter table if exists public.roadmap_generation_jobs enable row level security;
alter table if exists public.roadmap_generation_chunks enable row level security;
alter table if exists public.roadmap_stage_artifacts enable row level security;
alter table if exists public.user_daily_token_budget enable row level security;
alter table if exists public.global_token_budget enable row level security;
alter table if exists public.token_usage_events enable row level security;
alter table if exists public.github_oauth_states enable row level security;

drop policy if exists rgj_select_own on public.roadmap_generation_jobs;
create policy rgj_select_own
  on public.roadmap_generation_jobs
  for select
  using (((select auth.uid())::text = user_id));

drop policy if exists rgj_insert_own on public.roadmap_generation_jobs;
create policy rgj_insert_own
  on public.roadmap_generation_jobs
  for insert
  with check (((select auth.uid())::text = user_id));

drop policy if exists rgj_update_own on public.roadmap_generation_jobs;
create policy rgj_update_own
  on public.roadmap_generation_jobs
  for update
  using (((select auth.uid())::text = user_id))
  with check (((select auth.uid())::text = user_id));

drop policy if exists rgj_delete_own on public.roadmap_generation_jobs;
create policy rgj_delete_own
  on public.roadmap_generation_jobs
  for delete
  using (((select auth.uid())::text = user_id));

drop policy if exists rgc_select_own on public.roadmap_generation_chunks;
create policy rgc_select_own
  on public.roadmap_generation_chunks
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs j
      where j.id = roadmap_generation_chunks.job_id
        and j.user_id = ((select auth.uid())::text)
    )
  );

drop policy if exists rsa_select_own on public.roadmap_stage_artifacts;
create policy rsa_select_own
  on public.roadmap_stage_artifacts
  for select
  using (
    exists (
      select 1
      from public.roadmap_generation_jobs j
      where j.id = roadmap_stage_artifacts.job_id
        and j.user_id = ((select auth.uid())::text)
    )
  );
