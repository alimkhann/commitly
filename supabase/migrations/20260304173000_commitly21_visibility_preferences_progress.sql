-- Commitly 2.1: catalog visibility, generation progress telemetry, and user preferences.

alter table if exists public.generated_roadmaps
  add column if not exists is_catalog_visible boolean not null default true,
  add column if not exists catalog_segment text not null default 'default';

create index if not exists idx_generated_roadmaps_catalog_visibility
  on public.generated_roadmaps (is_catalog_visible, generated_at desc);

alter table if exists public.roadmap_generation_jobs
  add column if not exists progress_percent integer not null default 0,
  add column if not exists current_phase text not null default 'ingest',
  add column if not exists phase_message text;

update public.roadmap_generation_jobs
set
  progress_percent = least(
    100,
    greatest(
      0,
      case
        when total_planned_stages <= 0 then 0
        else round((generated_stages::numeric / greatest(total_planned_stages, 1)::numeric) * 100)::integer
      end
    )
  )
where progress_percent is null or progress_percent < 0 or progress_percent > 100;

update public.roadmap_generation_jobs
set current_phase = case
  when status = 'completed' then 'complete'
  when status = 'failed' then coalesce(nullif(current_phase, ''), 'validate')
  when status = 'partial_ready' then 'hydrate'
  when status = 'running' then coalesce(nullif(current_phase, ''), 'hydrate')
  else coalesce(nullif(current_phase, ''), 'ingest')
end;

create table if not exists public.user_preferences (
  user_id text primary key,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  language text not null default 'en' check (language in ('en', 'zh-HK', 'kz', 'ru')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
  on public.user_preferences
  for select
  using (((select auth.uid())::text = user_id));

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
  on public.user_preferences
  for insert
  with check (((select auth.uid())::text = user_id));

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
  on public.user_preferences
  for update
  using (((select auth.uid())::text = user_id))
  with check (((select auth.uid())::text = user_id));

drop policy if exists user_preferences_service_write on public.user_preferences;
create policy user_preferences_service_write
  on public.user_preferences
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);
