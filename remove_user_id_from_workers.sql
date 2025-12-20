-- SQL para eliminar la columna user_id de la tabla workers
-- Los workers NO son users. Solo Super Admin, Admin y Manager son users (en company_users).

-- ============================================
-- 1. Eliminar políticas RLS que dependen de user_id
-- ============================================

-- Eliminar política de workers que usa user_id (si existe con nombre employees_select_scoped)
DROP POLICY IF EXISTS employees_select_scoped ON public.workers;
DROP POLICY IF EXISTS workers_select_scoped ON public.workers;

-- Eliminar política de attendance_logs que usa user_id
DROP POLICY IF EXISTS attendance_logs_select_scoped ON public.attendance_logs;

-- Eliminar política de attendance_summary que usa user_id
DROP POLICY IF EXISTS attendance_summary_select_scoped ON public.attendance_summary;

-- ============================================
-- 2. Eliminar el foreign key constraint
-- ============================================

ALTER TABLE public.workers
DROP CONSTRAINT IF EXISTS workers_user_id_fkey;

-- ============================================
-- 3. Eliminar la columna user_id
-- ============================================

ALTER TABLE public.workers
DROP COLUMN IF EXISTS user_id;

-- ============================================
-- 4. Recrear políticas RLS sin dependencia de user_id
-- ============================================

-- Política para workers (basada solo en company_id, no en user_id)
DROP POLICY IF EXISTS workers_select ON public.workers;
CREATE POLICY workers_select
ON public.workers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = workers.company_id
      AND cu.user_id = auth.uid()
      AND cu.is_deleted = false
  )
);

-- Política para attendance_logs (basada solo en company_id, no en user_id)
DROP POLICY IF EXISTS attendance_logs_select ON public.attendance_logs;
CREATE POLICY attendance_logs_select
ON public.attendance_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = attendance_logs.company_id
      AND cu.user_id = auth.uid()
      AND cu.is_deleted = false
  )
);

-- Política para attendance_summary (basada solo en company_id, no en user_id)
DROP POLICY IF EXISTS attendance_summary_select ON public.attendance_summary;
CREATE POLICY attendance_summary_select
ON public.attendance_summary
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = attendance_summary.company_id
      AND cu.user_id = auth.uid()
      AND cu.is_deleted = false
  )
);

-- ============================================
-- 5. Comentarios para documentar
-- ============================================

COMMENT ON TABLE public.workers IS 'Workers are NOT users. They are employees/contractors who can mark attendance. Only Super Admin, Admin, and Manager roles are users (in company_users table).';
