import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';
import { logger } from '../lib/logger';

export interface Department {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface UseDepartmentsResult {
  departments: Department[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addDepartment: (name: string, description?: string) => Promise<string>; // Returns the new department ID
}

export const useDepartments = (): UseDepartmentsResult => {
  const { currentCompany } = useCompany();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = async () => {
    if (!currentCompany?.id) {
      setDepartments([]);
      setIsLoading(false);
      return;
    }

    try {
      if (departments.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      if (import.meta.env.DEV) {
        console.log('🔍 Fetching departments for company:', currentCompany.id);
      }

      const { data, error: fetchError } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (fetchError) {
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching departments:', fetchError);
        }
        throw fetchError;
      }

      if (import.meta.env.DEV) {
        console.log('📦 Departments data received:', data?.length || 0, 'departments');
      }

      const mappedDepartments: Department[] = (data || []).map((dept: any) => ({
        id: dept.id,
        name: dept.name || '',
        description: dept.description || undefined,
        is_active: dept.is_active ?? true,
      }));

      setDepartments(mappedDepartments);
      logger.info('Departments loaded', { count: mappedDepartments.length, companyId: currentCompany.id });
    } catch (err: any) {
      logger.error('Error loading departments', err);
      setError(err?.message || 'Failed to load departments');
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addDepartment = async (name: string, description?: string): Promise<string> => {
    if (!currentCompany?.id) {
      throw new Error('No company selected');
    }

    try {
      const { data, error: insertError } = await supabase
        .from('departments')
        .insert({
          company_id: currentCompany.id,
          name: name.trim(),
          description: description?.trim() || null,
          is_active: true,
          is_deleted: false,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Refresh the list
      await fetchDepartments();
      
      logger.info('Department added', { departmentId: data.id, name });
      return data.id;
    } catch (err: any) {
      logger.error('Error adding department', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [currentCompany?.id]);

  return {
    departments,
    isLoading,
    error,
    refetch: fetchDepartments,
    addDepartment,
  };
};

