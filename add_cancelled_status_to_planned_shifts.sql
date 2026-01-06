-- Migration: Add 'cancelled' status to planned_shifts
-- Date: 2025-01-05
-- Description: 
--   Add 'cancelled' as a valid status for planned_shifts to support rejected time off requests
--   Status mapping:
--   - 'draft' = pending approval
--   - 'published' = approved
--   - 'cancelled' = rejected

BEGIN;

-- Check if status column exists and what type it is
-- If it's already an enum, we need to add the new value
-- If it's text with a check constraint, we need to update the constraint

-- Option 1: If status is an enum type (most likely based on codebase patterns)
-- First, check if the enum type exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planned_shift_status') THEN
    -- Add 'cancelled' to the enum if it doesn't exist
    ALTER TYPE public.planned_shift_status ADD VALUE IF NOT EXISTS 'cancelled';
    RAISE NOTICE 'Added cancelled to planned_shift_status enum';
  ELSE
    RAISE NOTICE 'planned_shift_status enum does not exist, status might be text with check constraint';
  END IF;
END $$;

-- Option 2: If status is text with a check constraint
-- Update the check constraint to allow 'cancelled'
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'planned_shifts_status_check' 
    AND table_name = 'planned_shifts'
  ) THEN
    ALTER TABLE public.planned_shifts 
    DROP CONSTRAINT planned_shifts_status_check;
    
    -- Add new constraint with 'cancelled'
    ALTER TABLE public.planned_shifts 
    ADD CONSTRAINT planned_shifts_status_check 
    CHECK (status IN ('draft', 'published', 'cancelled'));
    
    RAISE NOTICE 'Updated planned_shifts_status_check constraint to include cancelled';
  END IF;
END $$;

COMMIT;

-- Verification query (run after migration):
-- SELECT column_name, data_type, udt_name
-- FROM information_schema.columns 
-- WHERE table_name = 'planned_shifts' AND column_name = 'status';

-- If enum, check values:
-- SELECT enumlabel FROM pg_enum 
-- WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'planned_shift_status')
-- ORDER BY enumsortorder;

