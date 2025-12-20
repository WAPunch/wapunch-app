-- SQL para agregar la columna email a la tabla workers

-- Agregar la columna email (opcional, puede ser null)
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS email text NULL;

-- Crear índice para mejorar performance en queries que filtren por email
CREATE INDEX IF NOT EXISTS idx_workers_email 
ON public.workers(email) 
WHERE is_deleted = false AND email IS NOT NULL;

-- Comentario para documentar la columna
COMMENT ON COLUMN public.workers.email IS 'Email address of the worker. This is a duplicate of auth.users.email for easier querying and management.';

