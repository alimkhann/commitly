-- QA reset: restore token budgets so progressive roadmap tests can continue.
update public.global_token_budget
set
  used = 0,
  updated_at = timezone('utc'::text, now())
where budget_date = (timezone('utc'::text, now()))::date;

update public.user_daily_token_budget
set
  used = 0,
  updated_at = timezone('utc'::text, now())
where usage_date = (timezone('utc'::text, now()))::date;
