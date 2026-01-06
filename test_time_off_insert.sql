-- Test script to understand what the constraint requires
-- Replace the UUIDs with actual values from your database

-- First, let's see the exact constraint definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.planned_shifts'::regclass
AND conname = 'time_off_status_only_for_time_off';

-- Now let's try to insert a test record to see what fails
-- Replace these values with actual ones from your time_off_request
DO $$
DECLARE
  v_test_company_id uuid := (SELECT company_id FROM time_off_requests LIMIT 1);
  v_test_worker_id uuid := (SELECT worker_id FROM time_off_requests LIMIT 1);
  v_test_category_id uuid := (SELECT time_off_category_id FROM time_off_requests LIMIT 1);
  v_test_request_id uuid := (SELECT id FROM time_off_requests LIMIT 1);
BEGIN
  -- Try to insert a test record
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
    v_test_company_id,
    v_test_worker_id,
    NULL,
    CURRENT_DATE,
    '00:00:00'::time,
    '23:59:59'::time,
    'time_off',
    'published',
    NOW(),
    0,
    FALSE,
    NULL,
    gen_random_uuid(),
    v_test_category_id,
    v_test_request_id
  );
  
  RAISE NOTICE 'Test insert succeeded!';
  
  -- Clean up
  DELETE FROM planned_shifts 
  WHERE time_off_request_id = v_test_request_id 
  AND shift_date = CURRENT_DATE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Test insert failed: %', SQLERRM;
    RAISE;
END $$;

