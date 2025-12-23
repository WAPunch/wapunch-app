-- Rename registers_breaks and registers_transfers columns to logs_breaks and logs_transfers
-- This script renames the columns if they already exist with the old names

-- Rename registers_breaks to logs_breaks
ALTER TABLE public.workers
RENAME COLUMN registers_breaks TO logs_breaks;

-- Rename registers_transfers to logs_transfers
ALTER TABLE public.workers
RENAME COLUMN registers_transfers TO logs_transfers;

-- Update comments to reflect the new column names
COMMENT ON COLUMN public.workers.logs_breaks IS 'Indicates whether this worker logs breaks in the time and attendance system';
COMMENT ON COLUMN public.workers.logs_transfers IS 'Indicates whether this worker logs transfers between sites or locations';

