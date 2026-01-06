-- Trigger to automatically create planned_shifts when a time_off_request is approved
-- This trigger creates one planned_shift per day in the request's date range
-- All shifts share the same recurrence_id for grouping

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
  v_start_time time := '00:00:00';
  v_end_time time := '23:59:59';
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Generate a single recurrence_id for all shifts in this time off
    v_recurrence_id := gen_random_uuid();
    
    -- Loop through each date in the range (inclusive)
    v_current_date := NEW.start_date;
    
    WHILE v_current_date <= NEW.end_date LOOP
      
      -- Insert one planned_shift per day
      -- Try to insert with all possible columns, but handle if some don't exist
      BEGIN
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
          time_off_category_id
        ) VALUES (
          NEW.company_id,
          NEW.worker_id,
          NULL, -- time off has no site
          v_current_date,
          v_start_time, -- Start of day (type: time)
          v_end_time, -- End of day (type: time)
          'time_off',
          'published', -- Approved time off is published
          CURRENT_TIMESTAMP, -- Use CURRENT_TIMESTAMP instead of NOW()
          0, -- No breaks for time off
          FALSE, -- Not overtime
          NEW.notes,
          v_recurrence_id,
          NEW.time_off_category_id
        );
      EXCEPTION
        WHEN undefined_column THEN
          -- If time_off_category_id doesn't exist, try without it
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
            recurrence_id
          ) VALUES (
            NEW.company_id,
            NEW.worker_id,
            NULL,
            v_current_date,
            v_start_time,
            v_end_time,
            'time_off',
            'published',
            CURRENT_TIMESTAMP,
            0,
            FALSE,
            NEW.notes,
            v_recurrence_id
          );
      END;
      
      -- Move to next day
      v_current_date := v_current_date + INTERVAL '1 day';
      
    END LOOP;
    
    RAISE NOTICE 'Created % planned_shifts for time_off_request %', 
      (NEW.end_date - NEW.start_date + 1), NEW.id;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE WARNING 'Error in on_time_off_approved: %', SQLERRM;
    -- Re-raise the error so the transaction fails
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
Creates one shift per day in the date range, all sharing the same recurrence_id.';

