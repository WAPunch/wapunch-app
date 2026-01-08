-- Add default_daily_hours and default_weekly_hours columns to workers table
-- These are used when worker_work_rule_type is 'planned' or 'open' (flexible)
-- When rule_type is 'fixed', these should be NULL

ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS default_daily_hours numeric(4,2),
ADD COLUMN IF NOT EXISTS default_weekly_hours numeric(5,2);

-- Add comments
COMMENT ON COLUMN public.workers.default_daily_hours IS 
'Default daily hours for workers with planned or open work rules. NULL for fixed schedule workers.';

COMMENT ON COLUMN public.workers.default_weekly_hours IS 
'Default weekly hours for workers with planned or open work rules. NULL for fixed schedule workers.';

-- Add check constraints to ensure valid ranges
ALTER TABLE public.workers
ADD CONSTRAINT workers_default_daily_hours_check 
CHECK (default_daily_hours IS NULL OR (default_daily_hours >= 0 AND default_daily_hours <= 24));

ALTER TABLE public.workers
ADD CONSTRAINT workers_default_weekly_hours_check 
CHECK (default_weekly_hours IS NULL OR (default_weekly_hours >= 0 AND default_weekly_hours <= 168));

