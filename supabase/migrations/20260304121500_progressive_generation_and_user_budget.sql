-- Progressive roadmap generation state + per-user soft token budget.

alter table if exists public.generated_roadmaps
  add column if not exists job_state text not null default 'completed',
  add column if not exists last_generated_stage integer not null default 0;

create table if not exists public.roadmap_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo_full_name varchar(255) not null,
  repo_url text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'partial_ready', 'completed', 'failed')),
  generated_stages integer not null default 0,
  total_planned_stages integer not null default 0,
  stage_budget integer not null default 0,
  mode text not null default 'normal' check (mode in ('normal', 'low', 'critical')),
  initial_timeline json not null default '[]'::json,
  repo_summary json not null default '{}'::json,
  commit_context json not null default '[]'::json,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roadmap_generation_jobs_user_created
  on public.roadmap_generation_jobs (user_id, created_at desc);

create index if not exists idx_roadmap_generation_jobs_repo_status
  on public.roadmap_generation_jobs (repo_full_name, status);

create table if not exists public.roadmap_generation_chunks (
  id bigserial primary key,
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  chunk_index integer not null,
  stage_start integer not null,
  stage_end integer not null,
  stages_generated integer not null,
  timeline_chunk json not null default '[]'::json,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  unique (job_id, chunk_index)
);

create index if not exists idx_roadmap_generation_chunks_job_created
  on public.roadmap_generation_chunks (job_id, created_at desc);

create table if not exists public.roadmap_stage_artifacts (
  id bigserial primary key,
  job_id uuid not null references public.roadmap_generation_jobs(id) on delete cascade,
  stage_index integer not null,
  artifact_type text not null default 'context-summary',
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, stage_index, artifact_type)
);

create index if not exists idx_roadmap_stage_artifacts_job_stage
  on public.roadmap_stage_artifacts (job_id, stage_index);

create table if not exists public.user_daily_token_budget (
  usage_date date not null,
  user_id text not null,
  daily_limit integer not null check (daily_limit > 0),
  used bigint not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, user_id)
);

create index if not exists idx_user_daily_token_budget_user_date
  on public.user_daily_token_budget (user_id, usage_date desc);

create or replace function public.get_user_soft_token_budget(
  p_user_id text,
  p_daily_limit integer default 120000
)
returns table (
  daily_limit integer,
  used bigint,
  remaining bigint,
  reset_at timestamptz
)
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_tomorrow timestamptz := ((v_today + 1)::timestamp at time zone 'utc');
  v_limit integer := greatest(coalesce(p_daily_limit, 120000), 1);
  v_used bigint;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    daily_limit := v_limit;
    used := 0;
    remaining := v_limit;
    reset_at := v_tomorrow;
    return next;
    return;
  end if;

  insert into public.user_daily_token_budget (usage_date, user_id, daily_limit, used, updated_at)
  values (v_today, p_user_id, v_limit, 0, now())
  on conflict (usage_date, user_id)
  do update set
    daily_limit = excluded.daily_limit,
    updated_at = now();

  select b.used, b.daily_limit
    into v_used, v_limit
  from public.user_daily_token_budget b
  where b.usage_date = v_today and b.user_id = p_user_id;

  daily_limit := v_limit;
  used := v_used;
  remaining := greatest(v_limit::bigint - v_used, 0);
  reset_at := v_tomorrow;

  return next;
end;
$$;

create or replace function public.record_user_soft_token_usage(
  p_user_id text,
  p_total_tokens integer,
  p_daily_limit integer default 120000
)
returns table (
  daily_limit integer,
  used bigint,
  remaining bigint,
  reset_at timestamptz
)
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_tomorrow timestamptz := ((v_today + 1)::timestamp at time zone 'utc');
  v_limit integer := greatest(coalesce(p_daily_limit, 120000), 1);
  v_total integer := greatest(coalesce(p_total_tokens, 0), 0);
  v_used bigint;
begin
  if p_user_id is null or btrim(p_user_id) = '' then
    daily_limit := v_limit;
    used := 0;
    remaining := v_limit;
    reset_at := v_tomorrow;
    return next;
    return;
  end if;

  insert into public.user_daily_token_budget (usage_date, user_id, daily_limit, used, updated_at)
  values (v_today, p_user_id, v_limit, v_total, now())
  on conflict (usage_date, user_id)
  do update set
    daily_limit = excluded.daily_limit,
    used = public.user_daily_token_budget.used + v_total,
    updated_at = now();

  select b.used, b.daily_limit
    into v_used, v_limit
  from public.user_daily_token_budget b
  where b.usage_date = v_today and b.user_id = p_user_id;

  daily_limit := v_limit;
  used := v_used;
  remaining := greatest(v_limit::bigint - v_used, 0);
  reset_at := v_tomorrow;

  return next;
end;
$$;
