-- Verify the trigger and function currently installed in the DB

-- 1) Confirm the trigger exists and is enabled
select
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as trigger_enabled,
  pg_get_triggerdef(t.oid, true) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname = 'planned_shifts'
order by t.tgname;

-- 2) Print the function definition currently installed
select pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'validate_shift_vs_fixed_schedule';

-- 3) Quick sanity: show a sample of fixed rules and their schedule id
select company_id, worker_id, rule_type, fixed_schedule_id, start_date, end_date
from public.worker_work_rules
where rule_type = 'fixed'
order by start_date desc
limit 20;

-- 4) Show the fixed schedule days for those fixed schedules (check day_of_week + times + is_working)
select
  fsd.fixed_schedule_id,
  fsd.day_of_week,
  fsd.is_working,
  fsd.start_time,
  fsd.end_time,
  fsd.break_minutes
from public.fixed_schedule_days fsd
where fsd.fixed_schedule_id in (
  select distinct fixed_schedule_id
  from public.worker_work_rules
  where rule_type = 'fixed'
  order by fixed_schedule_id
  limit 20
)
order by fsd.fixed_schedule_id, fsd.day_of_week;

-- 5) Show planned shifts recently created for workers with fixed rules (to pick an example overlap)
select
  ps.id,
  ps.company_id,
  ps.worker_id,
  ps.shift_date,
  ps.start_time,
  ps.end_time,
  ps.shift_type,
  ps.status,
  ps.created_at
from public.planned_shifts ps
where ps.worker_id in (
  select distinct worker_id
  from public.worker_work_rules
  where rule_type = 'fixed'
)
order by ps.created_at desc
limit 50;


