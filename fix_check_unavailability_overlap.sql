-- Fix the check_worker_unavailability_overlap function to avoid ambiguous column references

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
            -- Use explicit column aliases to avoid ambiguity
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

