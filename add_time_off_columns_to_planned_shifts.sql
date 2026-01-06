-- Migration: Add time_off_category_id and time_off_request_id to planned_shifts
-- This allows planned_shifts to track which time off category they belong to
-- and which time_off_request created them

BEGIN;

-- Add time_off_category_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'planned_shifts' 
        AND column_name = 'time_off_category_id'
    ) THEN
        ALTER TABLE public.planned_shifts
        ADD COLUMN time_off_category_id uuid NULL;
        
        -- Add foreign key constraint
        ALTER TABLE public.planned_shifts
        ADD CONSTRAINT planned_shifts_time_off_category_fkey
        FOREIGN KEY (time_off_category_id)
        REFERENCES public.time_off_categories(id)
        ON DELETE SET NULL;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_planned_shifts_time_off_category_id
        ON public.planned_shifts(time_off_category_id)
        WHERE time_off_category_id IS NOT NULL;
        
        RAISE NOTICE 'Added time_off_category_id column to planned_shifts';
    ELSE
        RAISE NOTICE 'Column time_off_category_id already exists in planned_shifts';
    END IF;
END
$$;

-- Add time_off_request_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'planned_shifts' 
        AND column_name = 'time_off_request_id'
    ) THEN
        ALTER TABLE public.planned_shifts
        ADD COLUMN time_off_request_id uuid NULL;
        
        -- Add foreign key constraint
        ALTER TABLE public.planned_shifts
        ADD CONSTRAINT planned_shifts_time_off_request_fkey
        FOREIGN KEY (time_off_request_id)
        REFERENCES public.time_off_requests(id)
        ON DELETE SET NULL;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_planned_shifts_time_off_request_id
        ON public.planned_shifts(time_off_request_id)
        WHERE time_off_request_id IS NOT NULL;
        
        RAISE NOTICE 'Added time_off_request_id column to planned_shifts';
    ELSE
        RAISE NOTICE 'Column time_off_request_id already exists in planned_shifts';
    END IF;
END
$$;

COMMIT;

