-- SQL para agregar columnas department_id y job_title_id a la tabla workers
-- y crear las tablas departments y job_titles

-- ============================================
-- 1. Crear tabla departments
-- ============================================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id) 
    REFERENCES public.companies (id) ON DELETE CASCADE
);

-- Índice para búsquedas por company_id
CREATE INDEX IF NOT EXISTS idx_departments_company_id 
ON public.departments(company_id) 
WHERE is_deleted = false;

-- Índice único para nombre de departamento por empresa
CREATE UNIQUE INDEX IF NOT EXISTS departments_company_name_uniq
ON public.departments (company_id, name)
WHERE is_deleted = false;

-- Comentario para documentar la tabla
COMMENT ON TABLE public.departments IS 'Departments within a company. Each company can have multiple departments.';

-- ============================================
-- 2. Crear tabla job_titles
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT job_titles_pkey PRIMARY KEY (id),
  CONSTRAINT job_titles_company_id_fkey FOREIGN KEY (company_id) 
    REFERENCES public.companies (id) ON DELETE CASCADE
);

-- Índice para búsquedas por company_id
CREATE INDEX IF NOT EXISTS idx_job_titles_company_id 
ON public.job_titles(company_id) 
WHERE is_deleted = false;

-- Índice único para nombre de job title por empresa
CREATE UNIQUE INDEX IF NOT EXISTS job_titles_company_name_uniq
ON public.job_titles (company_id, name)
WHERE is_deleted = false;

-- Comentario para documentar la tabla
COMMENT ON TABLE public.job_titles IS 'Job titles within a company. Each company can have multiple job titles.';

-- ============================================
-- 3. Agregar columnas a la tabla workers
-- ============================================

-- Agregar department_id (nullable, puede ser null si no tiene departamento asignado)
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS department_id uuid NULL;

-- Agregar foreign key constraint para department_id
ALTER TABLE public.workers
ADD CONSTRAINT workers_department_id_fkey 
FOREIGN KEY (department_id) 
REFERENCES public.departments (id) 
ON DELETE SET NULL;

-- Agregar job_title_id (nullable, puede ser null si no tiene job title asignado)
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS job_title_id uuid NULL;

-- Agregar foreign key constraint para job_title_id
ALTER TABLE public.workers
ADD CONSTRAINT workers_job_title_id_fkey 
FOREIGN KEY (job_title_id) 
REFERENCES public.job_titles (id) 
ON DELETE SET NULL;

-- Índices para mejorar performance en queries que filtren por department o job_title
CREATE INDEX IF NOT EXISTS idx_workers_department_id 
ON public.workers(department_id) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_workers_job_title_id 
ON public.workers(job_title_id) 
WHERE is_deleted = false;

-- Comentarios para documentar las columnas
COMMENT ON COLUMN public.workers.department_id IS 'Reference to the department this worker belongs to. Can be null.';
COMMENT ON COLUMN public.workers.job_title_id IS 'Reference to the job title of this worker. Can be null.';

-- ============================================
-- 4. Habilitar RLS (Row Level Security)
-- ============================================

-- RLS para departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Policy: Ver departamentos solo de mi empresa
DROP POLICY IF EXISTS departments_select ON public.departments;
CREATE POLICY departments_select
ON public.departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = departments.company_id
      AND cu.user_id = auth.uid()
      AND cu.is_deleted = false
  )
);

-- Policy: Crear departamentos (admin / manager)
DROP POLICY IF EXISTS departments_insert ON public.departments;
CREATE POLICY departments_insert
ON public.departments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = departments.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'supervisor', 'super_admin')
      AND cu.is_deleted = false
  )
);

-- Policy: Actualizar departamentos (admin / manager)
DROP POLICY IF EXISTS departments_update ON public.departments;
CREATE POLICY departments_update
ON public.departments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = departments.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'supervisor', 'super_admin')
      AND cu.is_deleted = false
  )
);

-- RLS para job_titles
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

-- Policy: Ver job titles solo de mi empresa
DROP POLICY IF EXISTS job_titles_select ON public.job_titles;
CREATE POLICY job_titles_select
ON public.job_titles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = job_titles.company_id
      AND cu.user_id = auth.uid()
      AND cu.is_deleted = false
  )
);

-- Policy: Crear job titles (admin / manager)
DROP POLICY IF EXISTS job_titles_insert ON public.job_titles;
CREATE POLICY job_titles_insert
ON public.job_titles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = job_titles.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'supervisor', 'super_admin')
      AND cu.is_deleted = false
  )
);

-- Policy: Actualizar job titles (admin / manager)
DROP POLICY IF EXISTS job_titles_update ON public.job_titles;
CREATE POLICY job_titles_update
ON public.job_titles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = job_titles.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'supervisor', 'super_admin')
      AND cu.is_deleted = false
  )
);
