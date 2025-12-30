-- Fixed version of validate_shift_vs_fixed_schedule function
-- Issues fixed:
-- 1. Added check for is_working = true
-- 2. Fixed date range check for NULL end_date
-- 3. Improved range construction logic

create or replace function validate_shift_vs_fixed_schedule()
returns trigger
language plpgsql
as $$
declare
  -- Use timestamp (no timezone) to avoid session timezone affecting overlap math.
  v_shift_range tsrange;
begin
  -- Only validate for work shifts
  if new.shift_type <> 'work' then
    return new;
  end if;

  -- Build planned shift range (supports cross-midnight)
  if new.end_time <= new.start_time then
    v_shift_range :=
      tsrange(
        (new.shift_date + new.start_time)::timestamp,
        ((new.shift_date + 1) + new.end_time)::timestamp,
        '[)'
      );
  else
    v_shift_range :=
      tsrange(
        (new.shift_date + new.start_time)::timestamp,
        (new.shift_date + new.end_time)::timestamp,
        '[)'
      );
  end if;

  /*
    IMPORTANT:
    A fixed schedule day can cross midnight (e.g. 22:00–06:00).
    In that case, a planned shift on the *next calendar date* (e.g. 02:00–04:00)
    must still be considered overlapping with the previous day's fixed schedule.

    Also, if the planned shift itself crosses midnight, it can overlap with
    the next day's fixed schedule as well.
  */

  if exists (
    select 1
    from (
      -- Case A: fixed schedule for NEW.shift_date weekday
      select
        tsrange(
          (new.shift_date + fsd.start_time)::timestamp,
          case
            when fsd.end_time <= fsd.start_time then ((new.shift_date + 1) + fsd.end_time)::timestamp
            else (new.shift_date + fsd.end_time)::timestamp
          end,
          '[)'
        ) as fixed_range
      from worker_work_rules wwr
      join fixed_schedules fs on fs.id = wwr.fixed_schedule_id
      join fixed_schedule_days fsd on fsd.fixed_schedule_id = fs.id
      where
        wwr.company_id = new.company_id
        and wwr.worker_id = new.worker_id
        and wwr.rule_type = 'fixed'
        and new.shift_date >= wwr.start_date
        and (wwr.end_date is null or new.shift_date <= wwr.end_date)
        and fsd.is_working = true
        and fsd.start_time is not null
        and fsd.end_time is not null
        and fsd.day_of_week = extract(dow from new.shift_date)

      union all

      -- Case B: previous day's fixed schedule crosses midnight into NEW.shift_date
      select
        tsrange(
          ((new.shift_date - 1) + fsd.start_time)::timestamp,
          (new.shift_date + fsd.end_time)::timestamp,
          '[)'
        ) as fixed_range
      from worker_work_rules wwr
      join fixed_schedules fs on fs.id = wwr.fixed_schedule_id
      join fixed_schedule_days fsd on fsd.fixed_schedule_id = fs.id
      where
        wwr.company_id = new.company_id
        and wwr.worker_id = new.worker_id
        and wwr.rule_type = 'fixed'
        and (new.shift_date - 1) >= wwr.start_date
        and (wwr.end_date is null or (new.shift_date - 1) <= wwr.end_date)
        and fsd.is_working = true
        and fsd.start_time is not null
        and fsd.end_time is not null
        and fsd.end_time <= fsd.start_time
        and fsd.day_of_week = extract(dow from (new.shift_date - 1))

      union all

      -- Case C: if planned shift crosses midnight, compare against next day's fixed schedule too
      select
        tsrange(
          ((new.shift_date + 1) + fsd.start_time)::timestamp,
          case
            when fsd.end_time <= fsd.start_time then (((new.shift_date + 1) + 1) + fsd.end_time)::timestamp
            else ((new.shift_date + 1) + fsd.end_time)::timestamp
          end,
          '[)'
        ) as fixed_range
      from worker_work_rules wwr
      join fixed_schedules fs on fs.id = wwr.fixed_schedule_id
      join fixed_schedule_days fsd on fsd.fixed_schedule_id = fs.id
      where
        new.end_time <= new.start_time
        and wwr.company_id = new.company_id
        and wwr.worker_id = new.worker_id
        and wwr.rule_type = 'fixed'
        and (new.shift_date + 1) >= wwr.start_date
        and (wwr.end_date is null or (new.shift_date + 1) <= wwr.end_date)
        and fsd.is_working = true
        and fsd.start_time is not null
        and fsd.end_time is not null
        and fsd.day_of_week = extract(dow from (new.shift_date + 1))
    ) fixed_ranges
    where fixed_ranges.fixed_range && v_shift_range
  ) then
    raise exception 'Planned shift overlaps with worker fixed schedule';
  end if;

  return new;
end;
$$;

-- Recreate the trigger
drop trigger if exists trg_validate_shift_vs_fixed on planned_shifts;

create trigger trg_validate_shift_vs_fixed
before insert or update on planned_shifts
for each row
execute function validate_shift_vs_fixed_schedule();

