-- Add logs_breaks and logs_transfers columns to workers table
-- These columns specify whether a worker logs breaks and transfers

ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS logs_breaks BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS logs_transfers BOOLEAN NOT NULL DEFAULT false;

-- Add comments to document the columns
COMMENT ON COLUMN public.workers.logs_breaks IS 'Indicates whether this worker logs breaks in the time and attendance system';
COMMENT ON COLUMN public.workers.logs_transfers IS 'Indicates whether this worker logs transfers between sites or locations';

