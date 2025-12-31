-- Migration: Add company profile fields to companies table
-- Purpose: Persist Company Settings fields (industry, city, phone, email, website)
-- Date: 2025-12-31

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industry text NULL,
  ADD COLUMN IF NOT EXISTS city text NULL,
  ADD COLUMN IF NOT EXISTS phone_country_code text NULL,
  ADD COLUMN IF NOT EXISTS phone_number text NULL,
  ADD COLUMN IF NOT EXISTS email text NULL,
  ADD COLUMN IF NOT EXISTS website text NULL;

-- Ensure logo_url exists (used by CompanySettings logo uploader)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text NULL;

COMMIT;

-- Verification:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'companies'
--   AND column_name IN ('industry','city','phone_country_code','phone_number','email','website','logo_url');

