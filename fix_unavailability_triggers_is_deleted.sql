-- Fix unavailability validation triggers to use is_deleted instead of is_delete
-- This fixes the "column ps.is_delete does not exist" error when adding shifts

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trg_validate_planned_shift_unavailability_insert ON public.planned_shifts;
DROP TRIGGER IF EXISTS trg_validate_planned_shift_unavailability_update ON public.planned_shifts;

-- Recreate the validation function with correct column name
CREATE OR REPLACE FUNCTION public.validate_planned_shift_against_unavailability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_overlap RECORD;
BEGIN
    -- Only check for published or draft shifts (not cancelled/deleted)
    IF NEW.status = 'cancelled' OR NEW.is_deleted = true THEN
        RETURN NEW;
    END IF;
    
    -- Check for overlap with worker unavailability rules
    FOR v_overlap IN
        SELECT * FROM public.check_worker_unavailability_overlap(
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

-- Recreate trigger BEFORE INSERT on planned_shifts
CREATE TRIGGER trg_validate_planned_shift_unavailability_insert
    BEFORE INSERT ON public.planned_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_planned_shift_against_unavailability();

-- Recreate trigger BEFORE UPDATE on planned_shifts
CREATE TRIGGER trg_validate_planned_shift_unavailability_update
    BEFORE UPDATE ON public.planned_shifts
    FOR EACH ROW
    WHEN (OLD.shift_date IS DISTINCT FROM NEW.shift_date 
        OR OLD.start_time IS DISTINCT FROM NEW.start_time 
        OR OLD.end_time IS DISTINCT FROM NEW.end_time
        OR OLD.worker_id IS DISTINCT FROM NEW.worker_id
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.is_deleted IS DISTINCT FROM NEW.is_deleted)
    EXECUTE FUNCTION public.validate_planned_shift_against_unavailability();

