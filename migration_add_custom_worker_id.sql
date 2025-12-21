-- Migration: Add custom_worker_id column to workers table
-- Date: 2024-01-XX
-- Description: 
--   Add custom_worker_id column (optional string) for client integration
--   This allows clients to store their own worker identifier for integration with other platforms

BEGIN;

-- Add custom_worker_id column (optional, nullable)
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS custom_worker_id text NULL;

COMMIT;

-- Verification queries (run these after the migration to verify):
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'workers' AND column_name = 'custom_worker_id';
-- (Should show custom_worker_id as text, nullable)

