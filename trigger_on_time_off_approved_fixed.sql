-- Trigger to automatically create planned_shifts when a time_off_request is approved
-- This trigger creates one planned_shift per day in the request's date range
-- All shifts share the same recurrence_id for grouping
-- FIXED VERSION: Handles type casting issues

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS trg_time_off_approved ON time_off_requests;
DROP FUNCTION IF EXISTS on_time_off_approved();

-- Create the trigger function
CREATE OR REPLACE FUNCTION on_time_off_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_recurrence_id uuid;
  v_current_date date;
  v_start_time time;
  v_end_time time;
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
    
    -- Loop through each date in the range (inclusive)
    v_current_date := NEW.start_date;
    
    WHILE v_current_date <= NEW.end_date LOOP
      
      -- Insert one planned_shift per day
      -- IMPORTANT: The constraint "time_off_status_only_for_time_off" requires:
      --   When shift_type = 'time_off', status MUST be 'published' (not 'draft' or 'cancelled')
      --   This ensures approved time off requests appear on the calendar immediately
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
        time_off_request_id
      ) VALUES (
        NEW.company_id,
        NEW.worker_id,
        NULL, -- time_off shifts don't have a site
        v_current_date,
        v_start_time,
        v_end_time,
        'time_off', -- shift_type enum value
        'published', -- status enum value - MUST be 'published' for time_off (constraint requirement)
        NOW(), -- published_at timestamp (required when status = 'published')
        0,
        FALSE,
        NEW.notes,
        v_recurrence_id,
        NEW.time_off_category_id, -- MUST NOT be NULL (validated above)
        NEW.id -- Link to the time_off_request
      );
      
      -- Move to next day
      v_current_date := v_current_date + INTERVAL '1 day';
      
    END LOOP;
    
    RAISE NOTICE 'Created % planned_shifts for time_off_request %', 
      (NEW.end_date - NEW.start_date + 1), NEW.id;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the full error for debugging
    RAISE WARNING 'Error in on_time_off_approved for request %: % (SQLSTATE: %)', 
      NEW.id, SQLERRM, SQLSTATE;
    -- Re-raise the error
    RAISE;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_time_off_approved
AFTER UPDATE OF status ON time_off_requests
FOR EACH ROW
EXECUTE FUNCTION on_time_off_approved();

-- Add comment
COMMENT ON FUNCTION on_time_off_approved() IS 
'Automatically creates planned_shifts (shift_type=time_off) when a time_off_request is approved. 
Creates one shift per day in the date range, all sharing the same recurrence_id.
Each shift includes time_off_category_id and time_off_request_id for tracking and relationships.';

