-- Ensure roadmap worker queue drains even if request-triggered fire-and-forget misses.
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

    perform cron.schedule(
      'commitly_roadmap_worker_drain',
      '* * * * *',
      $job$
      select net.http_post(
        url := 'https://krxngpbvmnbkjfkquhgd.supabase.co/functions/v1/api-v1/api/v1/internal/worker/drain',
        headers := '{"content-type":"application/json"}'::jsonb,
        body := '{"max_tasks":5}'::jsonb
      );
      $job$
    );
  end if;
exception
  when undefined_table or undefined_function then
    null;
end $$;
