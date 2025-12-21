-- Migration: Update sites table to use new type values, remove timezone and radius_meters, add custom_site_id
-- Date: 2024-01-XX
-- Description: 
--   1. Update type values from 'branch' to 'company_branch' and 'client_site' to 'customer_site'
--   2. Allow types: 'company_branch', 'customer_site', 'manual_entry' (or existing 'manual')
--   3. Remove timezone column completely
--   4. Remove radius_meters column (will be a global setting)
--   5. Add custom_site_id column (optional string for client integration)

BEGIN;

-- Step 1: Update existing type values
UPDATE public.sites 
SET type = 'company_branch' 
WHERE type = 'branch';

UPDATE public.sites 
SET type = 'customer_site' 
WHERE type = 'client_site';

-- Step 2: Drop the timezone column
ALTER TABLE public.sites 
DROP COLUMN IF EXISTS timezone;

-- Step 3: Drop the radius_meters column (will be a global setting)
ALTER TABLE public.sites 
DROP COLUMN IF EXISTS radius_meters;

-- Step 4: Add custom_site_id column (optional, for client integration)
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS custom_site_id text NULL;

-- Step 5: Update the default value for type column
ALTER TABLE public.sites 
ALTER COLUMN type SET DEFAULT 'company_branch';

-- Step 6: Update the check constraint to allow the new types
-- First, drop the existing constraint if it exists
ALTER TABLE public.sites 
DROP CONSTRAINT IF EXISTS manual_site_must_be_active;

-- Recreate the constraint with updated type check
ALTER TABLE public.sites 
ADD CONSTRAINT manual_site_must_be_active CHECK (
  (
    (type NOT IN ('manual', 'manual_entry'))
    OR (
      (is_active = true)
      AND (is_deleted = false)
    )
  )
);

-- Step 7: Update the unique index if you're using 'manual_entry' instead of 'manual'
-- The existing index uses 'manual'::text. If you want to use 'manual_entry', uncomment:
-- DROP INDEX IF EXISTS unique_manual_site_per_company;
-- CREATE UNIQUE INDEX IF NOT EXISTS unique_manual_site_per_company 
-- ON public.sites (company_id) 
-- WHERE type = 'manual_entry';

-- If you're keeping 'manual' (as in the original schema), the existing index will continue to work
-- No changes needed to the index in that case

COMMIT;

-- Verification queries (run these after the migration to verify):
-- SELECT DISTINCT type FROM public.sites;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sites' AND column_name IN ('timezone', 'radius_meters');
-- (Should return no rows if timezone and radius_meters were successfully removed)
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'custom_site_id';
-- (Should show custom_site_id as text, nullable)

