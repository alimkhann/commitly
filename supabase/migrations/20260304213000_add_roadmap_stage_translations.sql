create table if not exists public.roadmap_stage_translations (
  id bigserial primary key,
  repo_full_name varchar(255) not null,
  stage_id varchar(64) not null,
  target_language varchar(16) not null check (target_language in ('en', 'zh-HK', 'kz', 'ru')),
  source_hash varchar(64) not null,
  translated_payload jsonb not null,
  quality_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repo_full_name, stage_id, target_language, source_hash)
);

create index if not exists idx_roadmap_stage_translations_repo_lang_updated
  on public.roadmap_stage_translations (repo_full_name, target_language, updated_at desc);

create index if not exists idx_roadmap_stage_translations_repo_stage
  on public.roadmap_stage_translations (repo_full_name, stage_id);

alter table if exists public.roadmap_stage_translations enable row level security;

drop policy if exists rst_select_visible on public.roadmap_stage_translations;
create policy rst_select_visible
  on public.roadmap_stage_translations
  for select
  using (
    (select auth.role()) = 'service_role'::text
    or exists (
      select 1
      from public.generated_roadmaps gr
      where gr.repo_full_name = roadmap_stage_translations.repo_full_name
        and coalesce(gr.is_catalog_visible, true) = true
    )
    or exists (
      select 1
      from public.user_synced_repos usr
      where usr.repo_full_name = roadmap_stage_translations.repo_full_name
        and usr.user_id = ((select auth.uid())::text)
        and usr.is_archived = false
    )
  );

drop policy if exists rst_service_write on public.roadmap_stage_translations;
create policy rst_service_write
  on public.roadmap_stage_translations
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);
