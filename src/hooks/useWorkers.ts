import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';
import { logger } from '../lib/logger';

export interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  status: 'Active' | 'Suspended' | 'Onboarding' | 'On Leave';
  location: string;
  startDate: string;
  avatar?: string;
  phone?: string;
  // Additional fields from database
  worker_code?: string;
  worker_type: 'employee' | 'contractor';
  department_id?: string;
  job_title_id?: string;
  whatsapp_number?: string;
  custom_worker_id?: string;
  current_status?: 'out' | 'in' | 'on_break' | 'on_transfer';
  is_active?: boolean;
}

// Helper function to get status dot color based on current_status from database
export const getCurrentStatusDotColor = (currentStatus: string | undefined): string => {
  switch (currentStatus) {
    case 'in':
      return 'var(--avatar-status-green)'; // Green - Worker is clocked in
    case 'out':
      return 'var(--avatar-status-gray)'; // Gray - Worker is clocked out
    case 'on_break':
      return 'var(--avatar-status-yellow)'; // Yellow - Worker is on break
    case 'on_transfer':
      return 'var(--avatar-status-blue)'; // Blue - Worker is on transfer
    default:
      return 'var(--avatar-status-gray)'; // Default to gray if status is unknown
  }
};

interface UseWorkersResult {
  workers: Worker[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useWorkers = (): UseWorkersResult => {
  const { currentCompany } = useCompany();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = async () => {
    if (!currentCompany?.id) {
      setWorkers([]);
      setIsLoading(false);
      return;
    }

    try {
      // Don't set loading to true if we already have data to avoid flickering
      if (workers.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      if (import.meta.env.DEV) {
        console.log('🔍 Fetching workers for company:', currentCompany.id);
      }

      // Fetch workers from Supabase with department and job_title relations
      const { data, error: fetchError } = await supabase
        .from('workers')
        .select(`
          *,
          department:departments(name),
          job_title:job_titles(name)
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching workers:', fetchError);
        }
        throw fetchError;
      }

      if (import.meta.env.DEV) {
        console.log('📦 Workers data received:', data?.length || 0, 'workers');
      }

      // Map database workers to UI Worker interface
      const mappedWorkers: Worker[] = (data || []).map((worker: any) => {
        // Map current_status to UI status
        let status: 'Active' | 'Suspended' | 'Onboarding' | 'On Leave' = 'Active';
        if (!worker.is_active) {
          status = 'Suspended';
        } else if (worker.archived) {
          status = 'On Leave';
        }

        // Format start date
        const startDate = worker.created_at 
          ? new Date(worker.created_at).toLocaleDateString('en-US', {
              month: 'numeric',
              day: 'numeric',
              year: 'numeric'
            })
          : '';

        // Get department and job title names from relations
        const departmentName = (worker.department as any)?.name || '';
        const jobTitleName = (worker.job_title as any)?.name || worker.position || '';

        return {
          id: worker.id,
          firstName: worker.first_name || '',
          lastName: worker.last_name || '',
          email: worker.email || '', // Email is stored directly in workers table
          jobTitle: jobTitleName,
          department: departmentName,
          status,
          location: '', // Location would come from sites
          startDate,
          phone: worker.whatsapp_number || undefined,
          worker_code: worker.worker_code,
          worker_type: worker.worker_type || 'employee',
          department_id: worker.department_id || undefined,
          job_title_id: worker.job_title_id || undefined,
          whatsapp_number: worker.whatsapp_number,
          custom_worker_id: worker.custom_worker_id,
          current_status: worker.current_status,
          is_active: worker.is_active,
        };
      });

      setWorkers(mappedWorkers);
      logger.info('Workers loaded', { count: mappedWorkers.length, companyId: currentCompany.id });
    } catch (err: any) {
      logger.error('Error loading workers', err);
      setError(err?.message || 'Failed to load workers');
      setWorkers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [currentCompany?.id]);

  return {
    workers,
    isLoading,
    error,
    refetch: fetchWorkers,
  };
};

