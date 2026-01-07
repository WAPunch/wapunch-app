-- Migration: Create worker_unavailability_rules table and validation
-- Date: 2024-XX-XX
-- Description:
--   Create worker_unavailability_rules table to store negative scheduling rules
--   that block planned_shifts from being created during specific time periods.
--   These are NOT events, NOT shifts, but RULES that prevent scheduling.

BEGIN;

-- Create worker_unavailability_rules table
CREATE TABLE IF NOT EXISTS public.worker_unavailability_rules (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    company_id uuid NOT NULL,
    worker_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NULL,
    day_of_week integer NULL CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
    start_time time NOT NULL,
    end_time time NOT NULL,
    reason text NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT worker_unavailability_rules_pkey PRIMARY KEY (id),
    CONSTRAINT worker_unavailability_rules_company_fkey FOREIGN KEY (company_id) 
        REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT worker_unavailability_rules_worker_fkey FOREIGN KEY (worker_id) 
        REFERENCES public.workers(id) ON DELETE CASCADE,
    CONSTRAINT worker_unavailability_rules_time_check CHECK (end_time > start_time),
    CONSTRAINT worker_unavailability_rules_date_check CHECK (end_date IS NULL OR end_date >= start_date)
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_unavailability_rules_company_id 
    ON public.worker_unavailability_rules(company_id)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_worker_unavailability_rules_worker_id 
    ON public.worker_unavailability_rules(worker_id)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_worker_unavailability_rules_dates 
    ON public.worker_unavailability_rules(start_date, end_date)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_worker_unavailability_rules_day_of_week 
    ON public.worker_unavailability_rules(day_of_week)
    WHERE is_active = true AND day_of_week IS NOT NULL;

-- Create function to check overlap with worker unavailability rules
CREATE OR REPLACE FUNCTION public.check_worker_unavailability_overlap(
    p_company_id uuid,
    p_worker_id uuid,
    p_shift_date date,
    p_start_time time,
    p_end_time time
)
RETURNS TABLE(
    rule_id uuid,
    reason text,
    conflict_details text
)
LANGUAGE plpgsql
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

-- Create trigger function to validate planned_shifts against unavailability rules
CREATE OR REPLACE FUNCTION public.validate_planned_shift_against_unavailability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_overlap RECORD;
BEGIN
    -- Only check for active shifts (not deleted)
    IF NEW.is_deleted = true THEN
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

-- Create trigger BEFORE INSERT on planned_shifts
DROP TRIGGER IF EXISTS trg_validate_planned_shift_unavailability_insert ON public.planned_shifts;
CREATE TRIGGER trg_validate_planned_shift_unavailability_insert
    BEFORE INSERT ON public.planned_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_planned_shift_against_unavailability();

-- Create trigger BEFORE UPDATE on planned_shifts
DROP TRIGGER IF EXISTS trg_validate_planned_shift_unavailability_update ON public.planned_shifts;
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

-- Add comments
COMMENT ON TABLE public.worker_unavailability_rules IS 
'Negative scheduling rules that block planned_shifts from being created during specific time periods. 
These are NOT events or shifts, but RULES that prevent scheduling. 
They behave like fixed_schedules but are per-worker and block rather than require shifts.';

COMMENT ON COLUMN public.worker_unavailability_rules.day_of_week IS 
'Day of week (0=Sunday, 6=Saturday). NULL means the rule applies to all days within the date range.';

COMMENT ON COLUMN public.worker_unavailability_rules.end_date IS 
'End date of the rule. NULL means the rule applies indefinitely from start_date.';

COMMENT ON COLUMN public.worker_unavailability_rules.is_active IS 
'Whether this rule is currently active. Inactive rules do not block scheduling.';

COMMENT ON FUNCTION public.check_worker_unavailability_overlap IS 
'Checks if a planned shift overlaps with any active worker unavailability rules. 
Returns details about any conflicts found.';

COMMENT ON FUNCTION public.validate_planned_shift_against_unavailability IS 
'Trigger function that validates planned_shifts against worker_unavailability_rules 
before INSERT or UPDATE operations. Blocks shifts that overlap with unavailability rules.';

COMMIT;

