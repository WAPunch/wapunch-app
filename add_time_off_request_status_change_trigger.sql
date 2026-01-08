-- Trigger to manage planned_shifts when time_off_requests status changes or is deleted

CREATE OR REPLACE FUNCTION public.on_time_off_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_recurrence_id uuid;
    v_current_date date;
    v_start_time time := '00:00:00'::time;
    v_end_time time := '23:59:59'::time;
    v_published_at timestamptz := NOW();
BEGIN
    -- Case 1: Request is approved (INSERT with approved or UPDATE to approved)
    IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved' OR OLD.is_deleted = true) THEN
        -- Delete any existing planned_shifts for this request first, to avoid duplicates on re-approval
        DELETE FROM public.planned_shifts
        WHERE time_off_request_id = NEW.id;

        -- Generate a single recurrence_id for all shifts in this time off
        v_recurrence_id := gen_random_uuid();
        
        -- Loop through each date in the range (inclusive)
        v_current_date := NEW.start_date;
        WHILE v_current_date <= NEW.end_date LOOP
            INSERT INTO public.planned_shifts (
                company_id, worker_id, site_id, shift_date, start_time, end_time,
                shift_type, status, published_at, break_minutes, is_overtime_allowed, notes,
                recurrence_id, time_off_category_id, time_off_request_id, time_off_status, is_deleted
            ) VALUES (
                NEW.company_id, NEW.worker_id, NULL, v_current_date, v_start_time, v_end_time,
                'time_off', 'published', v_published_at, 0, FALSE, NEW.notes,
                v_recurrence_id, NEW.time_off_category_id, NEW.id, 'approved', FALSE
            );
            v_current_date := v_current_date + INTERVAL '1 day';
        END LOOP;
        RAISE NOTICE 'Created % planned_shifts for time_off_request %', (NEW.end_date - NEW.start_date + 1), NEW.id;

    -- Case 2: Request is rejected, pending, or deleted (from approved state)
    ELSIF (NEW.status = 'rejected' OR NEW.status = 'pending' OR NEW.is_deleted = true) 
          AND OLD.status = 'approved' THEN
        -- Delete associated planned_shifts
        DELETE FROM public.planned_shifts
        WHERE time_off_request_id = OLD.id;
        RAISE NOTICE 'Deleted planned_shifts for time_off_request % due to status change to % or deletion', OLD.id, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_time_off_approved ON public.time_off_requests;
DROP TRIGGER IF EXISTS trg_time_off_request_status_change ON public.time_off_requests;
DROP TRIGGER IF EXISTS trg_time_off_request_after_insert ON public.time_off_requests;
DROP TRIGGER IF EXISTS trg_time_off_request_before_delete ON public.time_off_requests;

-- Create or replace the main trigger for status changes and deletion
CREATE TRIGGER trg_time_off_request_status_change
AFTER UPDATE OF status, is_deleted ON public.time_off_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_time_off_request_status_change();

-- Also handle INSERT to create shifts when request is created directly with approved status
CREATE TRIGGER trg_time_off_request_after_insert
AFTER INSERT ON public.time_off_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_time_off_request_status_change();

-- Also handle BEFORE DELETE to ensure shifts are removed if request is hard deleted
CREATE TRIGGER trg_time_off_request_before_delete
BEFORE DELETE ON public.time_off_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_time_off_request_status_change();

-- Add comments
COMMENT ON FUNCTION public.on_time_off_request_status_change IS 
'Manages planned_shifts lifecycle when time_off_request is created or status changes:
- Creates shifts when request is INSERTED with approved status
- Creates shifts when request status is UPDATED to approved
- Deletes shifts when rejected, reverted to pending, or deleted
- Prevents duplicate shifts on re-approval';
