-- SQL script to fix invalid worker_work_rule_type enum values
-- This script corrects any "fixed_schedule" or other invalid values to "fixed"

-- First, check what invalid values exist
SELECT DISTINCT rule_type, COUNT(*) as count
FROM public.worker_work_rules
WHERE rule_type NOT IN ('fixed', 'planned', 'open')
GROUP BY rule_type;

-- Update any "fixed_schedule" or "fixedSchedule" values to "fixed"
UPDATE public.worker_work_rules
SET rule_type = 'fixed'
WHERE rule_type IN ('fixed_schedule', 'fixedSchedule');

-- Update any other invalid values (you may need to adjust this based on your data)
-- For example, if there are "planner" values that should be "planned":
-- UPDATE public.worker_work_rules
-- SET rule_type = 'planned'
-- WHERE rule_type = 'planner';

-- Verify the fix
SELECT DISTINCT rule_type, COUNT(*) as count
FROM public.worker_work_rules
GROUP BY rule_type;

