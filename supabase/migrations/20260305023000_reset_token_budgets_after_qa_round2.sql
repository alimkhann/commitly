-- QA reset round 2: restore token budgets for end-to-end generation validation.
update public.global_token_budget
set used = 0,
    updated_at = timezone('utc'::text, now())
where budget_date = (timezone('utc'::text, now()))::date;

update public.user_daily_token_budget
set used = 0,
    updated_at = timezone('utc'::text, now())
where usage_date = (timezone('utc'::text, now()))::date;
