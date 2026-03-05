-- Operational QA reset: unblock roadmap generation for active testers today.
update public.user_daily_token_budget
set used = 0,
    updated_at = now()
where usage_date = (now() at time zone 'utc')::date;
