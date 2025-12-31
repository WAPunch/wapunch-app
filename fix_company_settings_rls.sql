-- ============================================
-- Fix RLS Policies for Company Settings
-- ============================================
-- This script fixes RLS policies for:
-- 1. Storage bucket 'company-logos' 
-- 2. Companies table updates
-- ============================================

-- ============================================
-- 1. Storage Bucket Policies for company-logos
-- ============================================

-- Primero, asegurarse de que el bucket existe (esto se hace desde el dashboard de Supabase)
-- Luego, configurar las políticas:

-- Policy: Permitir a usuarios autenticados subir logos
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
);

-- Policy: Permitir a usuarios autenticados leer logos
DROP POLICY IF EXISTS "Authenticated users can read company logos" ON storage.objects;
CREATE POLICY "Authenticated users can read company logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'company-logos');

-- Policy: Permitir acceso público de lectura (para mostrar logos)
DROP POLICY IF EXISTS "Public can read company logos" ON storage.objects;
CREATE POLICY "Public can read company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Policy: Permitir a usuarios autenticados actualizar logos
DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
CREATE POLICY "Authenticated users can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos')
WITH CHECK (bucket_id = 'company-logos');

-- Policy: Permitir a usuarios autenticados eliminar logos
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');

-- ============================================
-- 2. Companies Table RLS Policies
-- ============================================

-- Verificar si RLS está habilitado
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir a usuarios autenticados ver empresas de las que son miembros
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = companies.id
      AND cu.user_id = auth.uid()
      AND cu.is_deleted = false
  )
);

-- Policy: Permitir a usuarios autenticados actualizar empresas de las que son miembros
-- Solo admins y super_admins pueden actualizar
DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update
ON public.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = companies.id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'super_admin')
      AND cu.is_deleted = false
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = companies.id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('admin', 'super_admin')
      AND cu.is_deleted = false
  )
);

-- ============================================
-- 3. Agregar columna logo_url si no existe
-- ============================================

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS logo_url text NULL;

-- ============================================
-- IMPORTANTE: Configuración del Bucket
-- ============================================
-- DESPUÉS de ejecutar este script, DEBES:
-- 
-- 1. Ir a Supabase Dashboard → Storage → company-logos
-- 2. Hacer clic en "Settings" o el ícono de configuración
-- 3. Marcar el bucket como "PUBLIC" (esto es CRÍTICO)
-- 4. Verificar que las políticas RLS están activas
-- 
-- Si el bucket NO es público, las imágenes no se mostrarán
-- aunque las políticas RLS estén correctas.
-- ============================================

-- ============================================
-- Verificación
-- ============================================
-- Después de ejecutar este script, verifica:
-- 1. Que el bucket 'company-logos' existe y es PÚBLICO (muy importante)
-- 2. Que las políticas RLS están activas
-- 3. Que la columna logo_url existe en companies
-- 
-- Para verificar que el bucket es público:
-- SELECT * FROM storage.buckets WHERE id = 'company-logos';
-- La columna 'public' debe ser 'true'

