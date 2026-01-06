-- Trigger to automatically create planned_shifts when a time_off_request is approved
-- This trigger creates one planned_shift per day in the request's date range
-- All shifts share the same recurrence_id for grouping
-- FINAL VERSION: Handles the time_off_status_only_for_time_off constraint

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

-- Create the trigger
CREATE TRIGGER trg_time_off_approved
AFTER UPDATE OF status ON time_off_requests
FOR EACH ROW
EXECUTE FUNCTION on_time_off_approved();

-- Add comment
COMMENT ON FUNCTION on_time_off_approved() IS 
'Automatically creates planned_shifts (shift_type=time_off) when a time_off_request is approved. 
Creates one shift per day in the date range, all sharing the same recurrence_id.
Each shift includes time_off_category_id and time_off_request_id for tracking and relationships.
Status is set to ''published'' to satisfy the time_off_status_only_for_time_off constraint.';

