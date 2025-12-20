-- SQL para agregar la columna worker_type a la tabla workers

-- Agregar la columna worker_type con valores permitidos 'employee' o 'contractor'
ALTER TABLE public.workers
ADD COLUMN worker_type text NOT NULL DEFAULT 'employee'::text;

-- Agregar constraint para validar que solo pueda ser 'employee' o 'contractor'
ALTER TABLE public.workers
ADD CONSTRAINT workers_worker_type_check 
CHECK (worker_type IN ('employee', 'contractor'));

-- Crear índice para mejorar performance en queries que filtren por worker_type
CREATE INDEX IF NOT EXISTS idx_workers_worker_type 
ON public.workers(worker_type) 
WHERE is_deleted = false;

-- Comentario para documentar la columna
COMMENT ON COLUMN public.workers.worker_type IS 'Type of worker: employee (full-time/part-time staff) or contractor (freelance/temporary)';

