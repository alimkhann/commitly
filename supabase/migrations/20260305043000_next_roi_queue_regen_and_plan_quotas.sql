-- Commitly Next ROI: queue orchestration, stage regeneration moderation, plan-aware user quotas.

-- Queue primitives via pgmq.
create extension if not exists pgmq;

-- Ensure queue exists.
select pgmq.create('roadmap_tasks');

-- Track queue/worker state on jobs (non-breaking).
alter table if exists public.roadmap_generation_jobs
  add column if not exists queue_state text not null default 'idle' check (queue_state in ('idle', 'queued', 'processing', 'failed')),
  add column if not exists worker_attempts integer not null default 0,
  add column if not exists last_worker_at timestamptz;

-- Worker execution telemetry.
create table if not exists public.roadmap_worker_runs (
  id uuid primary key default gen_random_uuid(),
  msg_id bigint,
  task_type text not null,
  job_id uuid,
  repo_full_name text,
  status text not null check (status in ('processing', 'completed', 'failed', 'skipped')),
  attempts integer not null default 1,
  duration_ms integer,
  error_detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roadmap_worker_runs_created
  on public.roadmap_worker_runs (created_at desc);
create index if not exists idx_roadmap_worker_runs_job
  on public.roadmap_worker_runs (job_id, created_at desc);
create index if not exists idx_roadmap_worker_runs_status
  on public.roadmap_worker_runs (status, created_at desc);

-- Stage regeneration moderation workflow.
create table if not exists public.roadmap_stage_regen_flags (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text not null,
  stage_id text not null,
  requested_by text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed')),
  reason text not null,
  stage_source_hash text,
  admin_decision_by text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stage_regen_flags_status_created
  on public.roadmap_stage_regen_flags (status, created_at desc);
create index if not exists idx_stage_regen_flags_repo_stage
  on public.roadmap_stage_regen_flags (repo_full_name, stage_id, created_at desc);
create index if not exists idx_stage_regen_flags_requested_by
  on public.roadmap_stage_regen_flags (requested_by, created_at desc);

-- Plan-aware quotas for user soft budget.
create table if not exists public.plan_token_quotas (
  plan_tier text primary key check (plan_tier in ('free', 'pro', 'ultra')),
  daily_soft_limit integer not null check (daily_soft_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plan_token_quotas (plan_tier, daily_soft_limit)
values
  ('free', 120000),
  ('pro', 300000),
  ('ultra', 700000)
on conflict (plan_tier)
do update set
  daily_soft_limit = excluded.daily_soft_limit,
  updated_at = now();

create table if not exists public.user_plan_overrides (
  user_id text primary key,
  plan_tier text not null check (plan_tier in ('free', 'pro', 'ultra')),
  daily_soft_limit integer check (daily_soft_limit > 0),
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Queue wrappers (safer RPC surface than direct pgmq calls from app layer).
create or replace function public.enqueue_roadmap_task(
  p_task_type text,
  p_payload jsonb,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_msg_id bigint;
begin
  if p_task_type is null or btrim(p_task_type) = '' then
    raise exception 'task_type is required';
  end if;

  select pgmq.send(
    queue_name => 'roadmap_tasks',
    msg => jsonb_build_object(
      'task_type', p_task_type,
      'payload', coalesce(p_payload, '{}'::jsonb),
      'enqueued_at', now()
    ),
    delay => greatest(coalesce(p_delay_seconds, 0), 0)
  ) into v_msg_id;

  return v_msg_id;
end;
$$;

create or replace function public.read_roadmap_tasks(
  p_visibility_timeout integer default 60,
  p_batch_size integer default 5
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  visible_at timestamptz,
  message jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.msg_id,
    r.read_ct,
    r.enqueued_at,
    r.vt as visible_at,
    r.message
  from pgmq.read(
    queue_name => 'roadmap_tasks',
    vt => greatest(coalesce(p_visibility_timeout, 60), 10),
    qty => greatest(coalesce(p_batch_size, 5), 1)
  ) as r;
$$;

create or replace function public.archive_roadmap_task(
  p_msg_id bigint
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select pgmq.archive(
    queue_name => 'roadmap_tasks',
    msg_id => p_msg_id
  );
$$;

create or replace function public.set_roadmap_task_vt(
  p_msg_id bigint,
  p_visibility_timeout integer default 30
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select (pgmq.set_vt(
    queue_name => 'roadmap_tasks',
    msg_id => p_msg_id,
    vt => greatest(coalesce(p_visibility_timeout, 30), 10)
  )).msg_id is not null;
$$;

-- RLS.
alter table if exists public.roadmap_worker_runs enable row level security;
alter table if exists public.roadmap_stage_regen_flags enable row level security;
alter table if exists public.plan_token_quotas enable row level security;
alter table if exists public.user_plan_overrides enable row level security;

-- roadmap_worker_runs: service/admin read+write.
drop policy if exists worker_runs_service_all on public.roadmap_worker_runs;
create policy worker_runs_service_all
  on public.roadmap_worker_runs
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

-- stage regen flags: requester can create/read own; service can manage all.
drop policy if exists stage_regen_insert_own on public.roadmap_stage_regen_flags;
create policy stage_regen_insert_own
  on public.roadmap_stage_regen_flags
  for insert
  with check (((select auth.uid())::text = requested_by));

drop policy if exists stage_regen_select_own on public.roadmap_stage_regen_flags;
create policy stage_regen_select_own
  on public.roadmap_stage_regen_flags
  for select
  using (((select auth.uid())::text = requested_by));

drop policy if exists stage_regen_service_all on public.roadmap_stage_regen_flags;
create policy stage_regen_service_all
  on public.roadmap_stage_regen_flags
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

-- plan quota tables: read for authenticated, write only service.
drop policy if exists plan_quotas_read_auth on public.plan_token_quotas;
create policy plan_quotas_read_auth
  on public.plan_token_quotas
  for select
  using ((select auth.role()) in ('authenticated', 'service_role'));

drop policy if exists plan_quotas_service_write on public.plan_token_quotas;
create policy plan_quotas_service_write
  on public.plan_token_quotas
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

drop policy if exists user_plan_overrides_select_own on public.user_plan_overrides;
create policy user_plan_overrides_select_own
  on public.user_plan_overrides
  for select
  using (((select auth.uid())::text = user_id));

drop policy if exists user_plan_overrides_service_all on public.user_plan_overrides;
create policy user_plan_overrides_service_all
  on public.user_plan_overrides
  for all
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

-- Optional safety trigger: best-effort minute worker ping if pg_cron + pg_net are available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      perform cron.unschedule('commitly_roadmap_worker_drain');
    exception
      when others then
        null;
    end;

    -- Requires runtime env endpoint + secret in vault for full operation.
    -- We register job only when values are present.
    if exists (
      select 1
      from vault.decrypted_secrets
      where name in ('COMMITLY_WORKER_DRAIN_URL', 'COMMITLY_WORKER_DRAIN_SECRET')
      group by 1
      having count(*) >= 2
    ) then
      perform cron.schedule(
        'commitly_roadmap_worker_drain',
        '* * * * *',
        $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'COMMITLY_WORKER_DRAIN_URL' limit 1),
          headers := jsonb_build_object(
            'content-type', 'application/json',
            'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'COMMITLY_WORKER_DRAIN_SECRET' limit 1)
          ),
          body := '{"max_tasks":5}'::jsonb
        );
        $cron$
      );
    end if;
  end if;
exception
  when undefined_table or undefined_function then
    -- vault/cron/net may not be present in every environment.
    null;
end $$;
