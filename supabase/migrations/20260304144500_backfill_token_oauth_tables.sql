-- Backfill token budget and GitHub OAuth state objects that were previously marked as applied
-- but may not exist on the remote database.

create table if not exists public.global_token_budget (
  budget_date date primary key,
  daily_limit integer not null check (daily_limit > 0),
  used bigint not null default 0 check (used >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.token_usage_events (
  id bigserial primary key,
  kind text not null,
  user_id text,
  endpoint text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_token_usage_events_created_at
  on public.token_usage_events (created_at desc);

create index if not exists idx_token_usage_events_endpoint_created_at
  on public.token_usage_events (endpoint, created_at desc);

create table if not exists public.github_oauth_states (
  state text primary key,
  user_id text not null,
  redirect text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_github_oauth_states_expires_at
  on public.github_oauth_states (expires_at);

create or replace function public.get_global_token_budget(p_daily_limit integer default 2500000)
returns table (
  daily_limit integer,
  used bigint,
  remaining bigint,
  mode text,
  reset_at timestamptz
)
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_tomorrow timestamptz := ((v_today + 1)::timestamp at time zone 'utc');
  v_limit integer := greatest(coalesce(p_daily_limit, 2500000), 1);
  v_used bigint;
begin
  insert into public.global_token_budget (budget_date, daily_limit, used, updated_at)
  values (v_today, v_limit, 0, now())
  on conflict (budget_date)
  do update set
    daily_limit = excluded.daily_limit,
    updated_at = now();

  select g.used, g.daily_limit
  into v_used, v_limit
  from public.global_token_budget g
  where g.budget_date = v_today;

  daily_limit := v_limit;
  used := v_used;
  remaining := greatest(v_limit::bigint - v_used, 0);
  mode := case
    when remaining <= 0 then 'critical'
    when remaining <= (v_limit::bigint * 0.15) then 'low'
    else 'normal'
  end;
  reset_at := v_tomorrow;

  return next;
end;
$$;

create or replace function public.record_token_usage(
  p_kind text,
  p_user_id text,
  p_endpoint text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_total_tokens integer,
  p_metadata jsonb default '{}'::jsonb,
  p_daily_limit integer default 2500000
)
returns table (
  daily_limit integer,
  used bigint,
  remaining bigint,
  mode text,
  reset_at timestamptz
)
language plpgsql
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_tomorrow timestamptz := ((v_today + 1)::timestamp at time zone 'utc');
  v_limit integer := greatest(coalesce(p_daily_limit, 2500000), 1);
  v_total integer := greatest(coalesce(p_total_tokens, 0), 0);
  v_used bigint;
begin
  insert into public.global_token_budget (budget_date, daily_limit, used, updated_at)
  values (v_today, v_limit, 0, now())
  on conflict (budget_date)
  do update set
    daily_limit = excluded.daily_limit,
    updated_at = now();

  update public.global_token_budget
  set
    used = used + v_total,
    updated_at = now()
  where budget_date = v_today;

  insert into public.token_usage_events (
    kind,
    user_id,
    endpoint,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    metadata
  ) values (
    coalesce(p_kind, 'unknown'),
    p_user_id,
    coalesce(p_endpoint, 'unknown'),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_completion_tokens, 0), 0),
    v_total,
    coalesce(p_metadata, '{}'::jsonb)
  );

  select g.used, g.daily_limit
  into v_used, v_limit
  from public.global_token_budget g
  where g.budget_date = v_today;

  daily_limit := v_limit;
  used := v_used;
  remaining := greatest(v_limit::bigint - v_used, 0);
  mode := case
    when remaining <= 0 then 'critical'
    when remaining <= (v_limit::bigint * 0.15) then 'low'
    else 'normal'
  end;
  reset_at := v_tomorrow;

  return next;
end;
$$;
