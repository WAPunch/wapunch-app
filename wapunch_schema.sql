


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."attendance_log_type" AS ENUM (
    'check_in',
    'check_out',
    'start_break',
    'end_break',
    'start_transfer',
    'end_transfer'
);


ALTER TYPE "public"."attendance_log_type" OWNER TO "postgres";


CREATE TYPE "public"."attendance_session_type" AS ENUM (
    'work',
    'break',
    'transfer',
    'time_off'
);


ALTER TYPE "public"."attendance_session_type" OWNER TO "postgres";


CREATE TYPE "public"."overtime_calculation_mode" AS ENUM (
    'daily_total',
    'per_shift'
);


ALTER TYPE "public"."overtime_calculation_mode" OWNER TO "postgres";


CREATE TYPE "public"."planned_shift_ack_status" AS ENUM (
    'pending',
    'accepted',
    'declined'
);


ALTER TYPE "public"."planned_shift_ack_status" OWNER TO "postgres";


CREATE TYPE "public"."planned_shift_status" AS ENUM (
    'draft',
    'published'
);


ALTER TYPE "public"."planned_shift_status" OWNER TO "postgres";


CREATE TYPE "public"."planned_shift_type" AS ENUM (
    'work',
    'time_off'
);


ALTER TYPE "public"."planned_shift_type" OWNER TO "postgres";


CREATE TYPE "public"."time_off_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."time_off_status" OWNER TO "postgres";


CREATE TYPE "public"."time_off_type" AS ENUM (
    'vacation',
    'sick',
    'personal',
    'unpaid',
    'other'
);


ALTER TYPE "public"."time_off_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'admin',
    'supervisor',
    'employee'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."worker_work_rule_type" AS ENUM (
    'fixed',
    'planned',
    'open'
);


ALTER TYPE "public"."worker_work_rule_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_attendance_daily_summary"("p_attendance_day_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_company_id uuid;
  v_worker_id uuid;
  v_work_date date;
  v_is_modified boolean;

  v_worked_minutes int := 0;
  v_break_minutes int := 0;
  v_transfer_minutes int := 0;
  v_first_in timestamptz;
  v_last_out timestamptz;

  v_expected_minutes int := 0;
  v_expected_source text := 'open';
  v_expected_start timestamptz;
  v_expected_end timestamptz;
  v_is_time_off boolean := false;

  v_late_minutes int := 0;
  v_early_leave_minutes int := 0;
  v_overtime_minutes int := 0;

  v_late_tol int := 0;
  v_early_leave_tol int := 0;
  v_early_arrival_tol int := 0;
  v_late_departure_tol int := 0;

  v_adj_first_in timestamptz;
  v_adj_last_out timestamptz;
begin
  -- 1️⃣ Día
  select company_id, worker_id, work_date, is_modified
  into v_company_id, v_worker_id, v_work_date, v_is_modified
  from attendance_days
  where id = p_attendance_day_id;

  -- 2️⃣ Sesiones
  select
    coalesce(sum(case when session_type = 'work' then duration_minutes end), 0),
    coalesce(sum(case when session_type = 'break' then duration_minutes end), 0),
    coalesce(sum(case when session_type = 'transfer' then duration_minutes end), 0),
    min(start_time) filter (where session_type = 'work'),
    max(end_time) filter (where session_type = 'work')
  into
    v_worked_minutes,
    v_break_minutes,
    v_transfer_minutes,
    v_first_in,
    v_last_out
  from attendance_sessions
  where attendance_day_id = p_attendance_day_id;

  -- 3️⃣ Expected
  select
    coalesce(expected_minutes, 0),
    coalesce(expected_source, 'open'),
    expected_start,
    expected_end,
    coalesce(is_time_off, false)
  into
    v_expected_minutes,
    v_expected_source,
    v_expected_start,
    v_expected_end,
    v_is_time_off
  from calculate_expected_for_day(
    v_company_id,
    v_worker_id,
    v_work_date
  );

  -- 4️⃣ Tolerancias
  select
    late_tolerance_minutes,
    early_leave_tolerance_minutes,
    early_arrival_tolerance_minutes,
    late_departure_tolerance_minutes
  into
    v_late_tol,
    v_early_leave_tol,
    v_early_arrival_tol,
    v_late_departure_tol
  from company_attendance_settings
  where company_id = v_company_id;

  -- 5️⃣ Ajustar first_in / last_out para ruido
  v_adj_first_in := v_first_in;
  v_adj_last_out := v_last_out;

  if v_expected_start is not null and v_first_in is not null then
    if v_first_in < v_expected_start
       and extract(epoch from (v_expected_start - v_first_in)) / 60 <= v_early_arrival_tol
    then
      v_adj_first_in := v_expected_start;
    end if;
  end if;

  if v_expected_end is not null and v_last_out is not null then
    if v_last_out > v_expected_end
       and extract(epoch from (v_last_out - v_expected_end)) / 60 <= v_late_departure_tol
    then
      v_adj_last_out := v_expected_end;
    end if;
  end if;

  -- 6️⃣ Late
  if v_expected_start is not null and v_adj_first_in is not null then
    v_late_minutes :=
      greatest(
        extract(epoch from (v_adj_first_in - v_expected_start)) / 60 - v_late_tol,
        0
      )::int;
  end if;

  -- 7️⃣ Early leave
  if v_expected_end is not null and v_adj_last_out is not null then
    v_early_leave_minutes :=
      greatest(
        extract(epoch from (v_expected_end - v_adj_last_out)) / 60 - v_early_leave_tol,
        0
      )::int;
  end if;

  -- 8️⃣ Overtime real (sin ruido)
  if v_expected_minutes > 0 then
    v_overtime_minutes :=
      greatest(
        v_worked_minutes - v_expected_minutes,
        0
      );
  end if;

  -- 9️⃣ Upsert summary
  insert into attendance_daily_summary (
    attendance_day_id,
    company_id,
    worker_id,
    work_date,
    expected_minutes,
    expected_source,
    worked_minutes,
    break_minutes,
    transfer_minutes,
    late_minutes,
    early_leave_minutes,
    overtime_minutes,
    has_late,
    has_early_leave,
    has_overtime,
    is_time_off,
    is_modified,
    status,
    calculated_at
  )
  values (
    p_attendance_day_id,
    v_company_id,
    v_worker_id,
    v_work_date,
    v_expected_minutes,
    v_expected_source,
    v_worked_minutes,
    v_break_minutes,
    v_transfer_minutes,
    v_late_minutes,
    v_early_leave_minutes,
    v_overtime_minutes,
    v_late_minutes > 0,
    v_early_leave_minutes > 0,
    v_overtime_minutes > 0,
    v_is_time_off,
    v_is_modified,
    case
      when v_is_time_off then 'ok'
      when v_late_minutes > 0
        or v_early_leave_minutes > 0
        or v_overtime_minutes > 0
        then 'exception'
      else 'ok'
    end,
    now()
  )
  on conflict (attendance_day_id)
  do update set
    expected_minutes = excluded.expected_minutes,
    expected_source = excluded.expected_source,
    worked_minutes = excluded.worked_minutes,
    break_minutes = excluded.break_minutes,
    transfer_minutes = excluded.transfer_minutes,
    late_minutes = excluded.late_minutes,
    early_leave_minutes = excluded.early_leave_minutes,
    overtime_minutes = excluded.overtime_minutes,
    has_late = excluded.has_late,
    has_early_leave = excluded.has_early_leave,
    has_overtime = excluded.has_overtime,
    is_time_off = excluded.is_time_off,
    is_modified = excluded.is_modified,
    status = excluded.status,
    calculated_at = now();
end;
$$;


ALTER FUNCTION "public"."calculate_attendance_daily_summary"("p_attendance_day_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_expected_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") RETURNS TABLE("expected_minutes" integer, "expected_source" "text", "expected_start" timestamp with time zone, "expected_end" timestamp with time zone, "is_time_off" boolean)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_rule_type worker_work_rule_type;
begin
  /* =========================
     1️⃣ Buscar regla activa
     ========================= */
  select rule_type
  into v_rule_type
  from worker_work_rules
  where worker_id = p_worker_id
    and p_work_date between start_date and coalesce(end_date, p_work_date)
  order by start_date desc
  limit 1;

  /* =========================
     2️⃣ Fixed schedule
     ========================= */
  if v_rule_type = 'fixed' then
    return query
    select
      coalesce(
        case
          when fsd.is_working
            then extract(epoch from (fsd.end_time - fsd.start_time)) / 60
          else 0
        end::int,
        0
      ),
      'fixed'::text,
      (p_work_date + fsd.start_time)::timestamptz,
      (p_work_date + fsd.end_time)::timestamptz,
      not fsd.is_working
    from fixed_schedule_days fsd
    join fixed_schedules fs on fs.id = fsd.fixed_schedule_id
    where fs.company_id = p_company_id
      and fsd.day_of_week = extract(dow from p_work_date);

    return;
  end if;

  /* =========================
     3️⃣ Planned shifts
     ========================= */
  if v_rule_type = 'planned' then
    return query
    select
      greatest(
        coalesce(sum(
          case
            when shift_type = 'work'
              then extract(epoch from (end_time - start_time)) / 60
          end
        ), 0)
        -
        coalesce(sum(
          case
            when shift_type = 'time_off'
              then extract(epoch from (end_time - start_time)) / 60
          end
        ), 0),
        0
      )::int,
      'planned'::text,
      min(start_time)::timestamptz,
      max(end_time)::timestamptz,
      false
    from planned_shifts
    where worker_id = p_worker_id
      and shift_date = p_work_date;

    return;
  end if;

  /* =========================
     4️⃣ Fallback OPEN (CRÍTICO)
     ========================= */
  return query
  select
    0::int,
    'open'::text,
    null::timestamptz,
    null::timestamptz,
    false;
end;
$$;


ALTER FUNCTION "public"."calculate_expected_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_worker_unavailability_overlap"("p_company_id" "uuid", "p_worker_id" "uuid", "p_shift_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) RETURNS TABLE("rule_id" "uuid", "reason" "text", "conflict_details" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_shift_day_of_week integer;
    v_rule_record RECORD;
BEGIN
    -- Get day of week for the shift (0 = Sunday, 6 = Saturday)
    v_shift_day_of_week := EXTRACT(DOW FROM p_shift_date)::integer;
    
    -- Check all active unavailability rules for this worker
    FOR v_rule_record IN
        SELECT 
            id,
            start_date,
            end_date,
            day_of_week,
            start_time,
            end_time,
            wur.reason  -- Explicitly prefix with table alias
        FROM public.worker_unavailability_rules wur
        WHERE wur.company_id = p_company_id
            AND wur.worker_id = p_worker_id
            AND wur.is_active = true
            -- Date range check: shift_date must be within rule's date range
            AND p_shift_date >= wur.start_date
            AND (wur.end_date IS NULL OR p_shift_date <= wur.end_date)
            -- Day of week check: if rule has day_of_week, it must match
            AND (wur.day_of_week IS NULL OR wur.day_of_week = v_shift_day_of_week)
    LOOP
        -- Check for time overlap
        -- Two time ranges overlap if: start1 < end2 AND start2 < end1
        IF v_rule_record.start_time < p_end_time AND p_start_time < v_rule_record.end_time THEN
            -- Use explicit column assignment to avoid ambiguity
            rule_id := v_rule_record.id;
            reason := v_rule_record.reason;
            conflict_details := format(
                'Shift overlaps with unavailability rule: %s to %s on %s',
                v_rule_record.start_time::text,
                v_rule_record.end_time::text,
                CASE 
                    WHEN v_rule_record.day_of_week IS NOT NULL THEN 
                        CASE v_rule_record.day_of_week
                            WHEN 0 THEN 'Sunday'
                            WHEN 1 THEN 'Monday'
                            WHEN 2 THEN 'Tuesday'
                            WHEN 3 THEN 'Wednesday'
                            WHEN 4 THEN 'Thursday'
                            WHEN 5 THEN 'Friday'
                            WHEN 6 THEN 'Saturday'
                        END
                    ELSE format('%s to %s', v_rule_record.start_date::text, 
                        COALESCE(v_rule_record.end_date::text, 'indefinite'))
                END
            );
            RETURN NEXT;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$;


ALTER FUNCTION "public"."check_worker_unavailability_overlap"("p_company_id" "uuid", "p_worker_id" "uuid", "p_shift_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_worker_unavailability_overlap"("p_company_id" "uuid", "p_worker_id" "uuid", "p_shift_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) IS 'Checks if a planned shift overlaps with any active worker unavailability rules. 
Returns details about any conflicts found.';



CREATE OR REPLACE FUNCTION "public"."create_company_attendance_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.company_attendance_settings (
    company_id,
    late_tolerance_minutes,
    early_leave_tolerance_minutes,
    overtime_tolerance_minutes
  )
  values (
    new.id,
    5,  -- late tolerance default
    5,  -- early leave tolerance default
    0   -- overtime tolerance default
  )
  on conflict (company_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."create_company_attendance_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_time_off_categories"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.time_off_categories
    (company_id, name, code, is_paid, requires_approval, is_system)
  values
    (new.id, 'Vacation', 'VACATION', true, true, true),
    (new.id, 'Sick Leave', 'SICK', true, true, true),
    (new.id, 'Personal Leave', 'PERSONAL', false, true, true),
    (new.id, 'Unpaid Leave', 'UNPAID', false, true, true);

  return new;
end;
$$;


ALTER FUNCTION "public"."create_default_time_off_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_manual_site_for_company"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.sites (
    company_id,
    site_name,
    site_address,
    country,
    timezone,
    latitude,
    longitude,
    radius_meters,
    type,
    is_active,
    is_deleted,
    archived
  )
  values (
    new.id,
    'Manual Entry',
    'Manual entry provided by user',
    coalesce(new.country, 'Unknown'),
    coalesce(new.timezone, 'UTC'),
    null,
    null,
    0,
    'manual',
    false,
    false,
    false
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."create_manual_site_for_company"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_attendance_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_day_id uuid;
begin
  select id
  into v_day_id
  from attendance_days
  where worker_id = p_worker_id
    and work_date = p_work_date;

  if v_day_id is null then
    insert into attendance_days (company_id, worker_id, work_date)
    values (p_company_id, p_worker_id, p_work_date)
    returning id into v_day_id;
  end if;

  return v_day_id;
end;
$$;


ALTER FUNCTION "public"."ensure_attendance_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_attendance_log_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_day_id uuid;
  v_work_date date;
begin
  v_work_date := new.log_time::date;

  v_day_id := ensure_attendance_day(
    new.company_id,
    new.worker_id,
    v_work_date
  );

  perform rebuild_attendance_sessions_for_day(
    new.company_id,
    new.worker_id,
    v_work_date
  );

  perform calculate_attendance_daily_summary(v_day_id);

  return new;
end;
$$;


ALTER FUNCTION "public"."on_attendance_log_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_attendance_log_override"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_day_id uuid;
  v_work_date date;
begin
  select log_time::date
  into v_work_date
  from attendance_logs
  where id = new.original_log_id;

  update attendance_days
  set is_modified = true
  where worker_id = new.worker_id
    and work_date = v_work_date;

  v_day_id := ensure_attendance_day(
    new.company_id,
    new.worker_id,
    v_work_date
  );

  perform rebuild_attendance_sessions_for_day(
    new.company_id,
    new.worker_id,
    v_work_date
  );

  perform calculate_attendance_daily_summary(v_day_id);

  return new;
end;
$$;


ALTER FUNCTION "public"."on_attendance_log_override"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_attendance_session_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update attendance_days
  set is_modified = true
  where id = new.attendance_day_id;

  perform calculate_attendance_daily_summary(new.attendance_day_id);

  return new;
end;
$$;


ALTER FUNCTION "public"."on_attendance_session_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_company_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.company_attendance_settings (
    company_id,
    late_tolerance_minutes,
    early_leave_tolerance_minutes,
    early_arrival_tolerance_minutes,
    late_departure_tolerance_minutes,
    overtime_calculation_mode,
    created_at
  )
  values (
    new.id,
    5,   -- late tolerance
    5,   -- early leave tolerance
    0,   -- early arrival tolerance
    0,   -- late departure tolerance
    'daily_total',
    now()
  )
  on conflict (company_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."on_company_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_planned_shift_published"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Solo cuando pasa a published
  if new.status = 'published' and old.status is distinct from 'published' then

    insert into public.planned_shift_acknowledgements (
      planned_shift_id,
      worker_id,
      status,
      created_at
    )
    values (
      new.id,
      new.worker_id,
      'pending',
      now()
    )
    on conflict (planned_shift_id, worker_id)
    do nothing;

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."on_planned_shift_published"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_time_off_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_recurrence_id uuid;
  v_current_date date;
  v_start_time time;
  v_end_time time;
  v_published_at timestamptz;
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Validate required fields for time_off shifts
    IF NEW.time_off_category_id IS NULL THEN
      RAISE EXCEPTION 'time_off_category_id cannot be NULL when creating time_off planned_shifts';
    END IF;
    
    -- Generate a single recurrence_id for all shifts in this time off
    v_recurrence_id := gen_random_uuid();
    
    -- Set time values explicitly as time type
    v_start_time := '00:00:00'::time;
    v_end_time := '23:59:59'::time;
    
    -- Set published_at timestamp (required for published status)
    v_published_at := NOW();
    
    -- Loop through each date in the range (inclusive)
    v_current_date := NEW.start_date;
    
    WHILE v_current_date <= NEW.end_date LOOP
      
      -- Insert one planned_shift per day
      -- The constraint "time_off_status_only_for_time_off" requires:
      --   - When shift_type = 'time_off', time_off_status MUST NOT be NULL
      --   - status MUST be 'published' (not 'draft' or 'cancelled')
      --   - time_off_category_id MUST NOT be NULL
      --   - published_at MUST NOT be NULL when status = 'published'
      --
      -- We ensure all these conditions are met by using VALUES with explicit types
      INSERT INTO planned_shifts (
        company_id,
        worker_id,
        site_id,
        shift_date,
        start_time,
        end_time,
        shift_type,
        status,
        published_at,
        break_minutes,
        is_overtime_allowed,
        notes,
        recurrence_id,
        time_off_category_id,
        time_off_request_id,
        time_off_status
      ) VALUES (
        NEW.company_id::uuid,
        NEW.worker_id::uuid,
        NULL::uuid, -- time_off shifts don't have a site
        v_current_date::date,
        v_start_time::time,
        v_end_time::time,
        'time_off'::planned_shift_type, -- Explicit enum cast
        'published'::planned_shift_status, -- Explicit enum cast - REQUIRED for time_off
        v_published_at::timestamptz, -- NOT NULL timestamp
        0::integer,
        FALSE::boolean,
        NEW.notes::text,
        v_recurrence_id::uuid,
        NEW.time_off_category_id::uuid, -- NOT NULL (validated above)
        NEW.id::uuid, -- Link to the time_off_request
        'approved'::time_off_status -- REQUIRED: time_off_status MUST NOT be NULL when shift_type = 'time_off'
      );
      
      -- Move to next day
      v_current_date := v_current_date + INTERVAL '1 day';
      
    END LOOP;
    
    RAISE NOTICE 'Created % planned_shifts for time_off_request %', 
      (NEW.end_date - NEW.start_date + 1), NEW.id;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN check_violation THEN
    -- If constraint violation, provide more details
    RAISE EXCEPTION 'Failed to create planned_shift: Constraint violation. shift_type=%, status=%, time_off_category_id=%', 
      'time_off', 'published', NEW.time_off_category_id;
  WHEN OTHERS THEN
    -- Log the full error for debugging
    RAISE WARNING 'Error in on_time_off_approved for request %: % (SQLSTATE: %)', 
      NEW.id, SQLERRM, SQLSTATE;
    -- Re-raise the error
    RAISE;
END;
$$;


ALTER FUNCTION "public"."on_time_off_approved"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."on_time_off_approved"() IS 'Automatically creates planned_shifts (shift_type=time_off) when a time_off_request is approved. 
Creates one shift per day in the date range, all sharing the same recurrence_id.
Each shift includes time_off_category_id and time_off_request_id for tracking and relationships.
Status is set to ''published'' to satisfy the time_off_status_only_for_time_off constraint.';



CREATE OR REPLACE FUNCTION "public"."prevent_delete_system_time_off_category"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.is_system then
    raise exception 'System time off categories cannot be deleted';
  end if;

  return old;
end;
$$;


ALTER FUNCTION "public"."prevent_delete_system_time_off_category"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_attendance_sessions_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_day_id uuid;
  v_log record;

  -- estado
  v_session_start timestamptz;
  v_session_type attendance_session_type;

  -- sites
  v_current_site uuid;
  v_work_start_site uuid;
  v_has_transfer_between boolean := false;
begin
  -- 1️⃣ asegurar attendance_day
  v_day_id := ensure_attendance_day(
    p_company_id,
    p_worker_id,
    p_work_date
  );

  -- 2️⃣ borrar sesiones previas
  delete from attendance_sessions
  where attendance_day_id = v_day_id
    and source = 'attendance';

  -- 3️⃣ recorrer logs
  for v_log in
    select *
    from attendance_logs_effective
    where company_id = p_company_id
      and worker_id = p_worker_id
      and log_time::date = p_work_date
    order by log_time
  loop
    v_current_site := v_log.site_id;

    -- CHECK IN
    if v_log.log_type = 'check_in' then
      v_session_start := v_log.log_time;
      v_session_type := 'work';
      v_work_start_site := v_current_site;
      v_has_transfer_between := false;
    end if;

    -- START BREAK
    if v_log.log_type = 'start_break' then
      if v_session_type = 'work' then
        insert into attendance_sessions (
          attendance_day_id,
          company_id,
          worker_id,
          session_type,
          start_time,
          end_time,
          duration_minutes,
          source,
          start_site_id,
          end_site_id,
          location_inconsistent,
          inconsistency_reason
        )
        values (
          v_day_id,
          p_company_id,
          p_worker_id,
          'work',
          v_session_start,
          v_log.log_time,
          extract(epoch from (v_log.log_time - v_session_start)) / 60,
          'attendance',
          v_work_start_site,
          v_current_site,
          false,
          null
        );
      end if;

      v_session_start := v_log.log_time;
      v_session_type := 'break';
    end if;

    -- END BREAK
    if v_log.log_type = 'end_break' then
      insert into attendance_sessions (
        attendance_day_id,
        company_id,
        worker_id,
        session_type,
        start_time,
        end_time,
        duration_minutes,
        source,
        start_site_id,
        end_site_id
      )
      values (
        v_day_id,
        p_company_id,
        p_worker_id,
        'break',
        v_session_start,
        v_log.log_time,
        extract(epoch from (v_log.log_time - v_session_start)) / 60,
        'attendance',
        v_current_site,
        v_current_site
      );

      -- volver a work en ESTE site
      v_session_start := v_log.log_time;
      v_session_type := 'work';
      v_work_start_site := v_current_site;
    end if;

    -- START TRANSFER
    if v_log.log_type = 'start_transfer' then
      if v_session_type = 'work' then
        insert into attendance_sessions (
          attendance_day_id,
          company_id,
          worker_id,
          session_type,
          start_time,
          end_time,
          duration_minutes,
          source,
          start_site_id,
          end_site_id,
          location_inconsistent,
          inconsistency_reason
        )
        values (
          v_day_id,
          p_company_id,
          p_worker_id,
          'work',
          v_session_start,
          v_log.log_time,
          extract(epoch from (v_log.log_time - v_session_start)) / 60,
          'attendance',
          v_work_start_site,
          v_current_site,
          false,
          null
        );
      end if;

      v_session_start := v_log.log_time;
      v_session_type := 'transfer';
      v_has_transfer_between := true;
    end if;

    -- END TRANSFER
    if v_log.log_type = 'end_transfer' then
      insert into attendance_sessions (
        attendance_day_id,
        company_id,
        worker_id,
        session_type,
        start_time,
        end_time,
        duration_minutes,
        source,
        start_site_id,
        end_site_id
      )
      values (
        v_day_id,
        p_company_id,
        p_worker_id,
        'transfer',
        v_session_start,
        v_log.log_time,
        extract(epoch from (v_log.log_time - v_session_start)) / 60,
        'attendance',
        v_current_site,
        v_current_site
      );

      -- volver a work en nuevo site
      v_session_start := v_log.log_time;
      v_session_type := 'work';
      v_work_start_site := v_current_site;
    end if;

    -- CHECK OUT
    if v_log.log_type = 'check_out' then
      if v_session_type = 'work' then
        insert into attendance_sessions (
          attendance_day_id,
          company_id,
          worker_id,
          session_type,
          start_time,
          end_time,
          duration_minutes,
          source,
          start_site_id,
          end_site_id,
          location_inconsistent,
          inconsistency_reason
        )
        values (
          v_day_id,
          p_company_id,
          p_worker_id,
          'work',
          v_session_start,
          v_log.log_time,
          extract(epoch from (v_log.log_time - v_session_start)) / 60,
          'attendance',
          v_work_start_site,
          v_current_site,
          v_work_start_site != v_current_site
            and not v_has_transfer_between,
          case
            when v_work_start_site != v_current_site
              and not v_has_transfer_between
              then 'missing_transfer_between_sites'
            else null
          end
        );
      end if;

      v_session_start := null;
      v_session_type := null;
      v_work_start_site := null;
      v_has_transfer_between := false;
    end if;

  end loop;
end;
$$;


ALTER FUNCTION "public"."rebuild_attendance_sessions_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_attendance_session_crosses_midnight"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Una sesión cruza medianoche si la fecha del end es mayor a la del start
  new.crosses_midnight := (new.end_time::date > new.start_time::date);
  return new;
end;
$$;


ALTER FUNCTION "public"."set_attendance_session_crosses_midnight"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_attendance_day_modified_flag"("p_day_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update attendance_days
  set is_modified = exists (
    select 1
    from attendance_sessions
    where attendance_day_id = p_day_id
      and is_modified = true
  );
end;
$$;


ALTER FUNCTION "public"."update_attendance_day_modified_flag"("p_day_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_planned_shift_against_unavailability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_overlap RECORD;
BEGIN
    -- Only check for active shifts (not deleted)
    IF NEW.is_deleted = true THEN  -- FIXED: was is_delete, removed cancelled check
        RETURN NEW;
    END IF;
    
    -- Check for overlap with worker unavailability rules
    FOR v_overlap IN
        SELECT 
            rule_id,
            reason,
            conflict_details
        FROM public.check_worker_unavailability_overlap(
            NEW.company_id,
            NEW.worker_id,
            NEW.shift_date,
            NEW.start_time,
            NEW.end_time
        )
    LOOP
        RAISE EXCEPTION 'Shift overlaps with worker unavailability rule. %', 
            COALESCE(v_overlap.conflict_details, 
                COALESCE(v_overlap.reason, 'Worker is unavailable during this time period'));
    END LOOP;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_planned_shift_against_unavailability"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_planned_shift_against_unavailability"() IS 'Validates that a planned shift does not overlap with worker unavailability rules. Uses is_deleted column.';



CREATE OR REPLACE FUNCTION "public"."validate_planned_shift_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_range tstzrange;
BEGIN
  -- Construir rango del nuevo shift
  IF NEW.end_time <= NEW.start_time THEN
    v_new_range :=
      tstzrange(
        (NEW.shift_date + NEW.start_time)::timestamptz,
        ((NEW.shift_date + 1) + NEW.end_time)::timestamptz,
        '[)'
      );
  ELSE
    v_new_range :=
      tstzrange(
        (NEW.shift_date + NEW.start_time)::timestamptz,
        (NEW.shift_date + NEW.end_time)::timestamptz,
        '[)'
      );
  END IF;

  -- Validar overlap con otros shifts
  IF EXISTS (
    SELECT 1
    FROM planned_shifts ps
    WHERE ps.worker_id = NEW.worker_id
      AND ps.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
      AND ps.is_deleted = false  -- FIXED: was is_delete
      AND (
        CASE
          WHEN ps.end_time <= ps.start_time THEN
            tstzrange(
              (ps.shift_date + ps.start_time)::timestamptz,
              ((ps.shift_date + 1) + ps.end_time)::timestamptz,
              '[)'
            )
          ELSE
            tstzrange(
              (ps.shift_date + ps.start_time)::timestamptz,
              (ps.shift_date + ps.end_time)::timestamptz,
              '[)'
            )
        END
      ) && v_new_range
  ) THEN
    RAISE EXCEPTION 'Planned shift overlaps with an existing shift';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_planned_shift_overlap"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_planned_shift_overlap"() IS 'Validates that a planned shift does not overlap with existing shifts for the same worker. Uses is_deleted column.';



CREATE OR REPLACE FUNCTION "public"."validate_shift_vs_fixed_schedule"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."validate_shift_vs_fixed_schedule"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_time_off_request_category_company"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_category_company_id uuid;
begin
  select company_id
  into v_category_company_id
  from time_off_categories
  where id = new.time_off_category_id;

  if v_category_company_id is null then
    raise exception 'Invalid time off category';
  end if;

  if v_category_company_id <> new.company_id then
    raise exception 'Time off category does not belong to the same company';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."validate_time_off_request_category_company"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."attendance_daily_summary" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "attendance_day_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "work_date" "date" NOT NULL,
    "expected_minutes" integer DEFAULT 0 NOT NULL,
    "expected_source" "text" DEFAULT 'none'::"text" NOT NULL,
    "worked_minutes" integer DEFAULT 0 NOT NULL,
    "break_minutes" integer DEFAULT 0 NOT NULL,
    "transfer_minutes" integer DEFAULT 0 NOT NULL,
    "late_minutes" integer DEFAULT 0 NOT NULL,
    "early_leave_minutes" integer DEFAULT 0 NOT NULL,
    "overtime_minutes" integer DEFAULT 0 NOT NULL,
    "approved_overtime_minutes" integer DEFAULT 0 NOT NULL,
    "unapproved_overtime_minutes" integer DEFAULT 0 NOT NULL,
    "has_missing_sessions" boolean DEFAULT false NOT NULL,
    "has_late" boolean DEFAULT false NOT NULL,
    "has_early_leave" boolean DEFAULT false NOT NULL,
    "has_overtime" boolean DEFAULT false NOT NULL,
    "has_unapproved_overtime" boolean DEFAULT false NOT NULL,
    "is_time_off" boolean DEFAULT false NOT NULL,
    "is_modified" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'ok'::"text" NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance_daily_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_days" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "work_date" "date" NOT NULL,
    "is_modified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_log_overrides" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "original_log_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "overridden_log_time" timestamp with time zone NOT NULL,
    "overridden_log_type" "public"."attendance_log_type" NOT NULL,
    "reason" "text",
    "modified_by" "uuid" NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance_log_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "log_type" "public"."attendance_log_type" NOT NULL,
    "log_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" numeric(10,6),
    "longitude" numeric(10,6),
    "source" "text" DEFAULT 'whatsapp'::"text",
    "raw_message" "text",
    "anonymized" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."attendance_logs_effective" AS
 SELECT "l"."id" AS "log_id",
    "l"."worker_id",
    "l"."company_id",
    "l"."site_id",
    COALESCE("o"."overridden_log_type", "l"."log_type") AS "log_type",
    COALESCE("o"."overridden_log_time", "l"."log_time") AS "log_time",
    ("o"."id" IS NOT NULL) AS "is_modified",
    "l"."source",
    "l"."latitude",
    "l"."longitude"
   FROM ("public"."attendance_logs" "l"
     LEFT JOIN LATERAL ( SELECT "o_1"."id",
            "o_1"."original_log_id",
            "o_1"."company_id",
            "o_1"."worker_id",
            "o_1"."overridden_log_time",
            "o_1"."overridden_log_type",
            "o_1"."reason",
            "o_1"."modified_by",
            "o_1"."modified_at"
           FROM "public"."attendance_log_overrides" "o_1"
          WHERE ("o_1"."original_log_id" = "l"."id")
          ORDER BY "o_1"."modified_at" DESC
         LIMIT 1) "o" ON (true));


ALTER VIEW "public"."attendance_logs_effective" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "attendance_day_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "session_type" "public"."attendance_session_type" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "duration_minutes" integer NOT NULL,
    "source" "text" DEFAULT 'attendance'::"text" NOT NULL,
    "is_modified" boolean DEFAULT false NOT NULL,
    "modified_by" "uuid",
    "modified_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "crosses_midnight" boolean DEFAULT false NOT NULL,
    "location_inconsistent" boolean DEFAULT false NOT NULL,
    "inconsistency_reason" "text",
    "start_site_id" "uuid",
    "end_site_id" "uuid",
    CONSTRAINT "attendance_sessions_time_check" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."attendance_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "country" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "industry" "text",
    "city" "text",
    "phone_country_code" "text",
    "phone_number" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    CONSTRAINT "companies_email_format_check" CHECK ((("email" IS NULL) OR ("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))),
    CONSTRAINT "companies_website_format_check" CHECK ((("website" IS NULL) OR ("website" ~* '^https?://.*'::"text")))
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."industry" IS 'Industry or business sector of the company';



COMMENT ON COLUMN "public"."companies"."city" IS 'City where the company is located';



COMMENT ON COLUMN "public"."companies"."phone_country_code" IS 'Country code for phone number (e.g., +1, +34)';



COMMENT ON COLUMN "public"."companies"."phone_number" IS 'Company phone number';



COMMENT ON COLUMN "public"."companies"."email" IS 'Company contact email';



COMMENT ON COLUMN "public"."companies"."website" IS 'Company website URL';



COMMENT ON COLUMN "public"."companies"."logo_url" IS 'URL or path to company logo image';



CREATE TABLE IF NOT EXISTS "public"."company_attendance_settings" (
    "company_id" "uuid" NOT NULL,
    "late_tolerance_minutes" integer DEFAULT 5 NOT NULL,
    "early_leave_tolerance_minutes" integer DEFAULT 5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "early_arrival_tolerance_minutes" integer DEFAULT 0 NOT NULL,
    "late_departure_tolerance_minutes" integer DEFAULT 0 NOT NULL,
    "overtime_calculation_mode" "public"."overtime_calculation_mode" DEFAULT 'daily_total'::"public"."overtime_calculation_mode" NOT NULL
);


ALTER TABLE "public"."company_attendance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'employee'::"public"."user_role" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


COMMENT ON TABLE "public"."departments" IS 'Departments within a company. Each company can have multiple departments.';



CREATE TABLE IF NOT EXISTS "public"."fixed_schedule_days" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "fixed_schedule_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "is_working" boolean DEFAULT true NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "break_minutes" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "fixed_schedule_days_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."fixed_schedule_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fixed_schedules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fixed_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_titles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_titles" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_titles" IS 'Job titles within a company. Each company can have multiple job titles.';



CREATE TABLE IF NOT EXISTS "public"."planned_shift_acknowledgements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "planned_shift_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "status" "public"."planned_shift_ack_status" DEFAULT 'pending'::"public"."planned_shift_ack_status" NOT NULL,
    "responded_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."planned_shift_acknowledgements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planned_shifts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "site_id" "uuid",
    "shift_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "shift_type" "public"."planned_shift_type" DEFAULT 'work'::"public"."planned_shift_type" NOT NULL,
    "break_minutes" integer DEFAULT 0 NOT NULL,
    "is_overtime_allowed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."planned_shift_status" DEFAULT 'draft'::"public"."planned_shift_status" NOT NULL,
    "published_at" timestamp with time zone,
    "published_by" "uuid",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "edited_published_shift_id" "uuid",
    "time_off_status" "public"."time_off_status",
    "time_off_category_id" "uuid",
    "time_off_decided_at" timestamp with time zone,
    "time_off_decided_by" "uuid",
    "recurrence_id" "uuid",
    "time_off_request_id" "uuid",
    CONSTRAINT "planned_shifts_no_breaks_for_time_off" CHECK ((("shift_type" <> 'time_off'::"public"."planned_shift_type") OR ("break_minutes" = 0))),
    CONSTRAINT "planned_shifts_no_overtime_for_time_off" CHECK ((("shift_type" <> 'time_off'::"public"."planned_shift_type") OR ("is_overtime_allowed" = false))),
    CONSTRAINT "planned_shifts_site_by_type" CHECK (((("shift_type" = 'work'::"public"."planned_shift_type") AND ("site_id" IS NOT NULL)) OR (("shift_type" = 'time_off'::"public"."planned_shift_type") AND ("site_id" IS NULL)))),
    CONSTRAINT "planned_shifts_time_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "time_off_category_only_for_time_off" CHECK ((("shift_type" <> 'time_off'::"public"."planned_shift_type") OR ("time_off_category_id" IS NOT NULL))),
    CONSTRAINT "time_off_published_must_be_approved" CHECK ((("shift_type" <> 'time_off'::"public"."planned_shift_type") OR ("status" <> 'published'::"public"."planned_shift_status") OR ("time_off_status" = 'approved'::"public"."time_off_status"))),
    CONSTRAINT "time_off_status_only_for_time_off" CHECK ((("shift_type" <> 'time_off'::"public"."planned_shift_type") OR ("time_off_status" IS NOT NULL)))
);


ALTER TABLE "public"."planned_shifts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."planned_shifts"."recurrence_id" IS 'UUID generated by frontend to group related shifts (recurring shifts or multi-day time off). Shifts with the same recurrence_id are part of the same series.';



CREATE TABLE IF NOT EXISTS "public"."sites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "site_name" "text" NOT NULL,
    "site_address" "text" NOT NULL,
    "country" "text" NOT NULL,
    "latitude" numeric(10,6),
    "longitude" numeric(10,6),
    "is_active" boolean DEFAULT true NOT NULL,
    "type" "text" DEFAULT 'company_branch'::"text" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "custom_site_id" "text",
    CONSTRAINT "manual_site_must_be_active" CHECK ((("type" <> ALL (ARRAY['manual'::"text", 'manual_entry'::"text"])) OR (("is_active" = true) AND ("is_deleted" = false))))
);


ALTER TABLE "public"."sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_off_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_paid" boolean DEFAULT false NOT NULL,
    "requires_approval" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."time_off_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_off_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "public"."time_off_status" DEFAULT 'pending'::"public"."time_off_status" NOT NULL,
    "approved_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "time_off_category_id" "uuid" NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "is_full_day" boolean DEFAULT true NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "calculated_hours" numeric(6,2),
    "requested_by" "uuid",
    "approved_at" timestamp with time zone,
    CONSTRAINT "time_off_full_day_vs_partial_check" CHECK (((("is_full_day" = true) AND ("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("is_full_day" = false) AND ("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("start_date" = "end_date"))))
);


ALTER TABLE "public"."time_off_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_unavailability_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "day_of_week" integer,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "reason" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_recurring" boolean DEFAULT true NOT NULL,
    CONSTRAINT "worker_unavailability_rules_date_check" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "worker_unavailability_rules_day_of_week_check" CHECK ((("day_of_week" IS NULL) OR (("day_of_week" >= 0) AND ("day_of_week" <= 6)))),
    CONSTRAINT "worker_unavailability_rules_recurring_day_check" CHECK (((("is_recurring" = true) AND ("day_of_week" IS NOT NULL)) OR (("is_recurring" = false) AND ("day_of_week" IS NULL)))),
    CONSTRAINT "worker_unavailability_rules_scope_check" CHECK ((("is_recurring" = true) OR ("end_date" IS NOT NULL))),
    CONSTRAINT "worker_unavailability_rules_time_check" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."worker_unavailability_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_unavailability_rules" IS 'Negative scheduling rules that block planned_shifts from being created during specific time periods. 
These are NOT events or shifts, but RULES that prevent scheduling. 
They behave like fixed_schedules but are per-worker and block rather than require shifts.';



COMMENT ON COLUMN "public"."worker_unavailability_rules"."end_date" IS 'End date of the rule. NULL means the rule applies indefinitely from start_date.';



COMMENT ON COLUMN "public"."worker_unavailability_rules"."day_of_week" IS 'Day of week (0=Sunday, 6=Saturday). NULL means the rule applies to all days within the date range.';



COMMENT ON COLUMN "public"."worker_unavailability_rules"."is_active" IS 'Whether this rule is currently active. Inactive rules do not block scheduling.';



CREATE TABLE IF NOT EXISTS "public"."worker_work_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "rule_type" "public"."worker_work_rule_type" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fixed_schedule_id" "uuid"
);


ALTER TABLE "public"."worker_work_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "whatsapp_number" "text" NOT NULL,
    "worker_code" "text",
    "position" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "anonymized_at" timestamp with time zone,
    "current_status" "text" DEFAULT 'out'::"text" NOT NULL,
    "worker_type" "text" DEFAULT 'employee'::"text" NOT NULL,
    "department_id" "uuid",
    "job_title_id" "uuid",
    "email" "text",
    "custom_worker_id" "text",
    "logs_breaks" boolean DEFAULT false NOT NULL,
    "logs_transfers" boolean DEFAULT false NOT NULL,
    CONSTRAINT "employees_current_status_check" CHECK (("current_status" = ANY (ARRAY['out'::"text", 'in'::"text", 'on_break'::"text", 'on_transfer'::"text"]))),
    CONSTRAINT "workers_worker_type_check" CHECK (("worker_type" = ANY (ARRAY['employee'::"text", 'contractor'::"text"])))
);


ALTER TABLE "public"."workers" OWNER TO "postgres";


COMMENT ON TABLE "public"."workers" IS 'Workers are NOT users. They are employees/contractors who can mark attendance. Only Super Admin, Admin, and Manager roles are users (in company_users table).';



COMMENT ON COLUMN "public"."workers"."worker_type" IS 'Type of worker: employee (full-time/part-time staff) or contractor (freelance/temporary)';



COMMENT ON COLUMN "public"."workers"."department_id" IS 'Reference to the department this worker belongs to. Can be null.';



COMMENT ON COLUMN "public"."workers"."job_title_id" IS 'Reference to the job title of this worker. Can be null.';



COMMENT ON COLUMN "public"."workers"."email" IS 'Email address of the worker. This is a duplicate of auth.users.email for easier querying and management.';



COMMENT ON COLUMN "public"."workers"."logs_breaks" IS 'Indicates whether this worker logs breaks in the time and attendance system';



COMMENT ON COLUMN "public"."workers"."logs_transfers" IS 'Indicates whether this worker logs transfers between sites or locations';



ALTER TABLE ONLY "public"."attendance_daily_summary"
    ADD CONSTRAINT "attendance_daily_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_daily_summary"
    ADD CONSTRAINT "attendance_daily_summary_unique" UNIQUE ("attendance_day_id");



ALTER TABLE ONLY "public"."attendance_days"
    ADD CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_days"
    ADD CONSTRAINT "attendance_days_unique" UNIQUE ("worker_id", "work_date");



ALTER TABLE ONLY "public"."attendance_log_overrides"
    ADD CONSTRAINT "attendance_log_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_attendance_settings"
    ADD CONSTRAINT "company_attendance_settings_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixed_schedule_days"
    ADD CONSTRAINT "fixed_schedule_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixed_schedules"
    ADD CONSTRAINT "fixed_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_titles"
    ADD CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planned_shift_acknowledgements"
    ADD CONSTRAINT "planned_shift_ack_unique" UNIQUE ("planned_shift_id", "worker_id");



ALTER TABLE ONLY "public"."planned_shift_acknowledgements"
    ADD CONSTRAINT "planned_shift_acknowledgements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planned_shifts"
    ADD CONSTRAINT "planned_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_off_categories"
    ADD CONSTRAINT "time_off_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_off_categories"
    ADD CONSTRAINT "time_off_categories_unique_code_per_company" UNIQUE ("company_id", "code");



ALTER TABLE ONLY "public"."time_off_requests"
    ADD CONSTRAINT "time_off_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_unavailability_rules"
    ADD CONSTRAINT "worker_unavailability_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_work_rules"
    ADD CONSTRAINT "worker_work_rules_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "company_users_user_company_uniq" ON "public"."company_users" USING "btree" ("user_id", "company_id") WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "departments_company_name_uniq" ON "public"."departments" USING "btree" ("company_id", "name") WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "employees_company_code_uniq" ON "public"."workers" USING "btree" ("company_id", "worker_code") WHERE (("worker_code" IS NOT NULL) AND ("is_deleted" = false));



CREATE UNIQUE INDEX "employees_company_whatsapp_uniq" ON "public"."workers" USING "btree" ("company_id", "whatsapp_number") WHERE ("is_deleted" = false);



CREATE INDEX "idx_attendance_days_company_date" ON "public"."attendance_days" USING "btree" ("company_id", "work_date");



CREATE INDEX "idx_attendance_days_worker_date" ON "public"."attendance_days" USING "btree" ("worker_id", "work_date");



CREATE INDEX "idx_attendance_sessions_day_start" ON "public"."attendance_sessions" USING "btree" ("attendance_day_id", "start_time");



CREATE INDEX "idx_attendance_sessions_modified" ON "public"."attendance_sessions" USING "btree" ("attendance_day_id") WHERE ("is_modified" = true);



CREATE INDEX "idx_attendance_sessions_worker_start" ON "public"."attendance_sessions" USING "btree" ("worker_id", "start_time");



CREATE INDEX "idx_attendance_summary_company_date" ON "public"."attendance_daily_summary" USING "btree" ("company_id", "work_date");



CREATE INDEX "idx_attendance_summary_status" ON "public"."attendance_daily_summary" USING "btree" ("status");



CREATE INDEX "idx_attendance_summary_worker_date" ON "public"."attendance_daily_summary" USING "btree" ("worker_id", "work_date");



CREATE INDEX "idx_companies_email" ON "public"."companies" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_companies_industry" ON "public"."companies" USING "btree" ("industry") WHERE ("industry" IS NOT NULL);



CREATE INDEX "idx_departments_company_id" ON "public"."departments" USING "btree" ("company_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_job_titles_company_id" ON "public"."job_titles" USING "btree" ("company_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_planned_shifts_active" ON "public"."planned_shifts" USING "btree" ("company_id", "shift_date", "worker_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_planned_shifts_company_date_status" ON "public"."planned_shifts" USING "btree" ("company_id", "shift_date", "status");



CREATE INDEX "idx_planned_shifts_recurrence_id" ON "public"."planned_shifts" USING "btree" ("recurrence_id") WHERE ("recurrence_id" IS NOT NULL);



CREATE INDEX "idx_planned_shifts_time_off_request_id" ON "public"."planned_shifts" USING "btree" ("time_off_request_id") WHERE ("time_off_request_id" IS NOT NULL);



CREATE INDEX "idx_shift_ack_shift" ON "public"."planned_shift_acknowledgements" USING "btree" ("planned_shift_id");



CREATE INDEX "idx_shift_ack_worker" ON "public"."planned_shift_acknowledgements" USING "btree" ("worker_id");



CREATE INDEX "idx_time_off_requests_active" ON "public"."time_off_requests" USING "btree" ("company_id", "worker_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_time_off_requests_pending" ON "public"."time_off_requests" USING "btree" ("company_id", "status") WHERE (("status" = 'pending'::"public"."time_off_status") AND ("is_deleted" = false));



CREATE INDEX "idx_worker_unavailability_rules_company_id" ON "public"."worker_unavailability_rules" USING "btree" ("company_id") WHERE ("is_active" = true);



CREATE INDEX "idx_worker_unavailability_rules_dates" ON "public"."worker_unavailability_rules" USING "btree" ("start_date", "end_date") WHERE ("is_active" = true);



CREATE INDEX "idx_worker_unavailability_rules_day_of_week" ON "public"."worker_unavailability_rules" USING "btree" ("day_of_week") WHERE (("is_active" = true) AND ("day_of_week" IS NOT NULL));



CREATE INDEX "idx_worker_unavailability_rules_worker_id" ON "public"."worker_unavailability_rules" USING "btree" ("worker_id") WHERE ("is_active" = true);



CREATE INDEX "idx_workers_department_id" ON "public"."workers" USING "btree" ("department_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_workers_email" ON "public"."workers" USING "btree" ("email") WHERE (("is_deleted" = false) AND ("email" IS NOT NULL));



CREATE INDEX "idx_workers_job_title_id" ON "public"."workers" USING "btree" ("job_title_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_workers_worker_type" ON "public"."workers" USING "btree" ("worker_type") WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "job_titles_company_name_uniq" ON "public"."job_titles" USING "btree" ("company_id", "name") WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "unique_manual_site_per_company" ON "public"."sites" USING "btree" ("company_id") WHERE ("type" = 'manual'::"text");



CREATE OR REPLACE TRIGGER "trg_attendance_log_insert_recalc" AFTER INSERT ON "public"."attendance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."on_attendance_log_insert"();



CREATE OR REPLACE TRIGGER "trg_attendance_log_override_recalc" AFTER INSERT ON "public"."attendance_log_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."on_attendance_log_override"();



CREATE OR REPLACE TRIGGER "trg_attendance_session_update" AFTER INSERT OR UPDATE ON "public"."attendance_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."on_attendance_session_update"();



CREATE OR REPLACE TRIGGER "trg_company_attendance_settings" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."on_company_created"();



CREATE OR REPLACE TRIGGER "trg_create_company_attendance_settings" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."create_company_attendance_settings"();



CREATE OR REPLACE TRIGGER "trg_create_default_time_off_categories" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_time_off_categories"();



CREATE OR REPLACE TRIGGER "trg_create_manual_site" AFTER INSERT ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."create_manual_site_for_company"();



CREATE OR REPLACE TRIGGER "trg_planned_shift_published" AFTER UPDATE OF "status" ON "public"."planned_shifts" FOR EACH ROW WHEN (("new"."status" = 'published'::"public"."planned_shift_status")) EXECUTE FUNCTION "public"."on_planned_shift_published"();



CREATE OR REPLACE TRIGGER "trg_prevent_delete_system_time_off_category" BEFORE DELETE ON "public"."time_off_categories" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_delete_system_time_off_category"();



CREATE OR REPLACE TRIGGER "trg_sessions_crosses_midnight" BEFORE INSERT OR UPDATE ON "public"."attendance_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_attendance_session_crosses_midnight"();



CREATE OR REPLACE TRIGGER "trg_time_off_approved" AFTER UPDATE OF "status" ON "public"."time_off_requests" FOR EACH ROW EXECUTE FUNCTION "public"."on_time_off_approved"();



CREATE OR REPLACE TRIGGER "trg_validate_planned_shift_overlap" BEFORE INSERT OR UPDATE ON "public"."planned_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."validate_planned_shift_overlap"();



CREATE OR REPLACE TRIGGER "trg_validate_planned_shift_unavailability_insert" BEFORE INSERT ON "public"."planned_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."validate_planned_shift_against_unavailability"();



CREATE OR REPLACE TRIGGER "trg_validate_planned_shift_unavailability_update" BEFORE UPDATE ON "public"."planned_shifts" FOR EACH ROW WHEN ((("old"."shift_date" IS DISTINCT FROM "new"."shift_date") OR ("old"."start_time" IS DISTINCT FROM "new"."start_time") OR ("old"."end_time" IS DISTINCT FROM "new"."end_time") OR ("old"."worker_id" IS DISTINCT FROM "new"."worker_id") OR ("old"."status" IS DISTINCT FROM "new"."status") OR ("old"."is_deleted" IS DISTINCT FROM "new"."is_deleted"))) EXECUTE FUNCTION "public"."validate_planned_shift_against_unavailability"();



CREATE OR REPLACE TRIGGER "trg_validate_shift_vs_fixed" BEFORE INSERT OR UPDATE ON "public"."planned_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."validate_shift_vs_fixed_schedule"();



CREATE OR REPLACE TRIGGER "trg_validate_time_off_request_category" BEFORE INSERT OR UPDATE ON "public"."time_off_requests" FOR EACH ROW EXECUTE FUNCTION "public"."validate_time_off_request_category_company"();



ALTER TABLE ONLY "public"."attendance_daily_summary"
    ADD CONSTRAINT "attendance_daily_summary_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_daily_summary"
    ADD CONSTRAINT "attendance_daily_summary_day_fkey" FOREIGN KEY ("attendance_day_id") REFERENCES "public"."attendance_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_daily_summary"
    ADD CONSTRAINT "attendance_daily_summary_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_days"
    ADD CONSTRAINT "attendance_days_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_days"
    ADD CONSTRAINT "attendance_days_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_log_overrides"
    ADD CONSTRAINT "attendance_log_overrides_original_fkey" FOREIGN KEY ("original_log_id") REFERENCES "public"."attendance_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_branch_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_employee_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_day_fkey" FOREIGN KEY ("attendance_day_id") REFERENCES "public"."attendance_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_end_site_fkey" FOREIGN KEY ("end_site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_start_site_fkey" FOREIGN KEY ("start_site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance_sessions"
    ADD CONSTRAINT "attendance_sessions_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_attendance_settings"
    ADD CONSTRAINT "company_attendance_settings_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_schedule_days"
    ADD CONSTRAINT "fixed_schedule_days_schedule_fkey" FOREIGN KEY ("fixed_schedule_id") REFERENCES "public"."fixed_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_schedules"
    ADD CONSTRAINT "fixed_schedules_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_titles"
    ADD CONSTRAINT "job_titles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_shift_acknowledgements"
    ADD CONSTRAINT "planned_shift_ack_shift_fkey" FOREIGN KEY ("planned_shift_id") REFERENCES "public"."planned_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_shift_acknowledgements"
    ADD CONSTRAINT "planned_shift_ack_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_shifts"
    ADD CONSTRAINT "planned_shifts_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_shifts"
    ADD CONSTRAINT "planned_shifts_edited_published_fk" FOREIGN KEY ("edited_published_shift_id") REFERENCES "public"."planned_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planned_shifts"
    ADD CONSTRAINT "planned_shifts_site_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_shifts"
    ADD CONSTRAINT "planned_shifts_time_off_category_fkey" FOREIGN KEY ("time_off_category_id") REFERENCES "public"."time_off_categories"("id");



ALTER TABLE ONLY "public"."planned_shifts"
    ADD CONSTRAINT "planned_shifts_time_off_request_fkey" FOREIGN KEY ("time_off_request_id") REFERENCES "public"."time_off_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planned_shifts"
    ADD CONSTRAINT "planned_shifts_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_off_categories"
    ADD CONSTRAINT "time_off_categories_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_off_requests"
    ADD CONSTRAINT "time_off_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_off_requests"
    ADD CONSTRAINT "time_off_requests_category_fkey" FOREIGN KEY ("time_off_category_id") REFERENCES "public"."time_off_categories"("id");



ALTER TABLE ONLY "public"."time_off_requests"
    ADD CONSTRAINT "time_off_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_unavailability_rules"
    ADD CONSTRAINT "worker_unavailability_rules_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_unavailability_rules"
    ADD CONSTRAINT "worker_unavailability_rules_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_work_rules"
    ADD CONSTRAINT "worker_work_rules_company_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_work_rules"
    ADD CONSTRAINT "worker_work_rules_fixed_schedule_fkey" FOREIGN KEY ("fixed_schedule_id") REFERENCES "public"."fixed_schedules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_work_rules"
    ADD CONSTRAINT "worker_work_rules_worker_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "workers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workers"
    ADD CONSTRAINT "workers_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "public"."job_titles"("id") ON DELETE SET NULL;



ALTER TABLE "public"."attendance_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_logs_select" ON "public"."attendance_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "attendance_logs"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "branches_admin_delete" ON "public"."sites" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "sites"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "branches_admin_insert" ON "public"."sites" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "sites"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "branches_admin_update" ON "public"."sites" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "sites"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "sites"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "branches_select_company_members" ON "public"."sites" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "sites"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_deleted" = false)))));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_select" ON "public"."companies" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "companies"."id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "companies_select_members_only" ON "public"."companies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "companies"."id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "companies_update" ON "public"."companies" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "companies"."id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "companies"."id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



ALTER TABLE "public"."company_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_users_select_self" ON "public"."company_users" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "company_users_super_admin_delete" ON "public"."company_users" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "company_users"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = 'super_admin'::"public"."user_role") AND ("cu"."is_deleted" = false)))));



CREATE POLICY "company_users_super_admin_insert" ON "public"."company_users" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "company_users"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = 'super_admin'::"public"."user_role") AND ("cu"."is_deleted" = false)))));



CREATE POLICY "company_users_super_admin_update" ON "public"."company_users" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "company_users"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = 'super_admin'::"public"."user_role") AND ("cu"."is_deleted" = false))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "company_users"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = 'super_admin'::"public"."user_role") AND ("cu"."is_deleted" = false)))));



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_insert" ON "public"."departments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "departments"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'supervisor'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "departments_select" ON "public"."departments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "departments"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "departments_update" ON "public"."departments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "departments"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'supervisor'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "employees_admin_delete" ON "public"."workers" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "workers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "employees_admin_insert" ON "public"."workers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "workers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "employees_admin_update" ON "public"."workers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "workers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "workers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



ALTER TABLE "public"."job_titles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_titles_insert" ON "public"."job_titles" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "job_titles"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'supervisor'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "job_titles_select" ON "public"."job_titles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "job_titles"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_deleted" = false)))));



CREATE POLICY "job_titles_update" ON "public"."job_titles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "job_titles"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."role" = ANY (ARRAY['admin'::"public"."user_role", 'supervisor'::"public"."user_role", 'super_admin'::"public"."user_role"])) AND ("cu"."is_deleted" = false)))));



ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workers_select" ON "public"."workers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "workers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_deleted" = false)))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_attendance_daily_summary"("p_attendance_day_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_attendance_daily_summary"("p_attendance_day_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_attendance_daily_summary"("p_attendance_day_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_expected_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_expected_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_expected_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_worker_unavailability_overlap"("p_company_id" "uuid", "p_worker_id" "uuid", "p_shift_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."check_worker_unavailability_overlap"("p_company_id" "uuid", "p_worker_id" "uuid", "p_shift_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_worker_unavailability_overlap"("p_company_id" "uuid", "p_worker_id" "uuid", "p_shift_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_company_attendance_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_company_attendance_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_company_attendance_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_time_off_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_time_off_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_time_off_categories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_manual_site_for_company"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_manual_site_for_company"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_manual_site_for_company"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_attendance_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_attendance_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_attendance_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."on_attendance_log_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_attendance_log_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_attendance_log_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_attendance_log_override"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_attendance_log_override"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_attendance_log_override"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_attendance_session_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_attendance_session_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_attendance_session_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_company_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_company_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_company_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_planned_shift_published"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_planned_shift_published"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_planned_shift_published"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_time_off_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_time_off_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_time_off_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_delete_system_time_off_category"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_delete_system_time_off_category"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_delete_system_time_off_category"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_attendance_sessions_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_attendance_sessions_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_attendance_sessions_for_day"("p_company_id" "uuid", "p_worker_id" "uuid", "p_work_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_attendance_session_crosses_midnight"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_attendance_session_crosses_midnight"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_attendance_session_crosses_midnight"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_attendance_day_modified_flag"("p_day_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_attendance_day_modified_flag"("p_day_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_attendance_day_modified_flag"("p_day_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_planned_shift_against_unavailability"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_planned_shift_against_unavailability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_planned_shift_against_unavailability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_planned_shift_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_planned_shift_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_planned_shift_overlap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_shift_vs_fixed_schedule"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_shift_vs_fixed_schedule"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_shift_vs_fixed_schedule"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_time_off_request_category_company"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_time_off_request_category_company"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_time_off_request_category_company"() TO "service_role";



GRANT ALL ON TABLE "public"."attendance_daily_summary" TO "anon";
GRANT ALL ON TABLE "public"."attendance_daily_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_daily_summary" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_days" TO "anon";
GRANT ALL ON TABLE "public"."attendance_days" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_days" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_log_overrides" TO "anon";
GRANT ALL ON TABLE "public"."attendance_log_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_log_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_logs" TO "anon";
GRANT ALL ON TABLE "public"."attendance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_logs" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_logs_effective" TO "anon";
GRANT ALL ON TABLE "public"."attendance_logs_effective" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_logs_effective" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_sessions" TO "anon";
GRANT ALL ON TABLE "public"."attendance_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_attendance_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_attendance_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_attendance_settings" TO "service_role";



GRANT ALL ON TABLE "public"."company_users" TO "anon";
GRANT ALL ON TABLE "public"."company_users" TO "authenticated";
GRANT ALL ON TABLE "public"."company_users" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."fixed_schedule_days" TO "anon";
GRANT ALL ON TABLE "public"."fixed_schedule_days" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_schedule_days" TO "service_role";



GRANT ALL ON TABLE "public"."fixed_schedules" TO "anon";
GRANT ALL ON TABLE "public"."fixed_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."job_titles" TO "anon";
GRANT ALL ON TABLE "public"."job_titles" TO "authenticated";
GRANT ALL ON TABLE "public"."job_titles" TO "service_role";



GRANT ALL ON TABLE "public"."planned_shift_acknowledgements" TO "anon";
GRANT ALL ON TABLE "public"."planned_shift_acknowledgements" TO "authenticated";
GRANT ALL ON TABLE "public"."planned_shift_acknowledgements" TO "service_role";



GRANT ALL ON TABLE "public"."planned_shifts" TO "anon";
GRANT ALL ON TABLE "public"."planned_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."planned_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."sites" TO "anon";
GRANT ALL ON TABLE "public"."sites" TO "authenticated";
GRANT ALL ON TABLE "public"."sites" TO "service_role";



GRANT ALL ON TABLE "public"."time_off_categories" TO "anon";
GRANT ALL ON TABLE "public"."time_off_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."time_off_categories" TO "service_role";



GRANT ALL ON TABLE "public"."time_off_requests" TO "anon";
GRANT ALL ON TABLE "public"."time_off_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."time_off_requests" TO "service_role";



GRANT ALL ON TABLE "public"."worker_unavailability_rules" TO "anon";
GRANT ALL ON TABLE "public"."worker_unavailability_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_unavailability_rules" TO "service_role";



GRANT ALL ON TABLE "public"."worker_work_rules" TO "anon";
GRANT ALL ON TABLE "public"."worker_work_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_work_rules" TO "service_role";



GRANT ALL ON TABLE "public"."workers" TO "anon";
GRANT ALL ON TABLE "public"."workers" TO "authenticated";
GRANT ALL ON TABLE "public"."workers" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







