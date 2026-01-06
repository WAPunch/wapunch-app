-- Diagnostic script to understand the time_off_status_only_for_time_off constraint
-- Run this to see exactly what the constraint requires

-- 1. Check the constraint definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.planned_shifts'::regclass
AND conname = 'time_off_status_only_for_time_off';

-- 2. Check all constraints on planned_shifts related to time_off
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.planned_shifts'::regclass
AND (conname LIKE '%time_off%' OR pg_get_constraintdef(oid) LIKE '%time_off%');

-- 3. Check the status enum type
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'planned_shift_status'
ORDER BY e.enumsortorder;

-- 4. Check the shift_type enum type
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'planned_shift_type'
ORDER BY e.enumsortorder;

-- 5. Check if there are any existing time_off shifts and their status
SELECT 
    shift_type,
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN time_off_category_id IS NULL THEN 1 END) as null_category_count
FROM planned_shifts
WHERE shift_type = 'time_off'
GROUP BY shift_type, status;

