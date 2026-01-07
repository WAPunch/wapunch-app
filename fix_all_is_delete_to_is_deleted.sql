-- Fix ALL functions that use is_delete to use is_deleted instead
-- This fixes the "column ps.is_delete does not exist" error

-- 1. Fix validate_planned_shift_overlap function
CREATE OR REPLACE FUNCTION public.validate_planned_shift_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- 2. Fix validate_planned_shift_against_unavailability function
DROP TRIGGER IF EXISTS trg_validate_planned_shift_unavailability_insert ON public.planned_shifts;
DROP TRIGGER IF EXISTS trg_validate_planned_shift_unavailability_update ON public.planned_shifts;

CREATE OR REPLACE FUNCTION public.validate_planned_shift_against_unavailability()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Recreate unavailability triggers
CREATE TRIGGER trg_validate_planned_shift_unavailability_insert
    BEFORE INSERT ON public.planned_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_planned_shift_against_unavailability();

CREATE TRIGGER trg_validate_planned_shift_unavailability_update
    BEFORE UPDATE ON public.planned_shifts
    FOR EACH ROW
    WHEN (OLD.shift_date IS DISTINCT FROM NEW.shift_date 
        OR OLD.start_time IS DISTINCT FROM NEW.start_time 
        OR OLD.end_time IS DISTINCT FROM NEW.end_time
        OR OLD.worker_id IS DISTINCT FROM NEW.worker_id
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.is_deleted IS DISTINCT FROM NEW.is_deleted)  -- FIXED: was is_delete
    EXECUTE FUNCTION public.validate_planned_shift_against_unavailability();

-- Add comments
COMMENT ON FUNCTION public.validate_planned_shift_overlap IS 
'Validates that a planned shift does not overlap with existing shifts for the same worker. Uses is_deleted column.';

COMMENT ON FUNCTION public.validate_planned_shift_against_unavailability IS 
'Validates that a planned shift does not overlap with worker unavailability rules. Uses is_deleted column.';

