-- Script to check the time_off_status_only_for_time_off constraint
-- This will help us understand what the constraint requires

-- Check all constraints on planned_shifts
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.planned_shifts'::regclass
AND conname LIKE '%time_off%';

-- Also check the table structure to see status column
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'planned_shifts'
AND column_name IN ('status', 'shift_type');

