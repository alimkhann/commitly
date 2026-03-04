alter table if exists public.roadmap_syllabi
  add column if not exists complexity_score double precision not null default 0;

create index if not exists idx_roadmap_syllabi_complexity
  on public.roadmap_syllabi (complexity_score desc, updated_at desc);
