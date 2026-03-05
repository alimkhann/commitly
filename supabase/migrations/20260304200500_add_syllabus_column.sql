alter table if exists public.roadmap_syllabi
  add column if not exists syllabus jsonb not null default '[]'::jsonb;
