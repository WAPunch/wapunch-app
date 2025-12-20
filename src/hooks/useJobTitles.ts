import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';
import { logger } from '../lib/logger';

export interface JobTitle {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface UseJobTitlesResult {
  jobTitles: JobTitle[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addJobTitle: (name: string, description?: string) => Promise<string>; // Returns the new job title ID
}

export const useJobTitles = (): UseJobTitlesResult => {
  const { currentCompany } = useCompany();
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobTitles = async () => {
    if (!currentCompany?.id) {
      setJobTitles([]);
      setIsLoading(false);
      return;
    }

    try {
      if (jobTitles.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      if (import.meta.env.DEV) {
        console.log('🔍 Fetching job titles for company:', currentCompany.id);
      }

      const { data, error: fetchError } = await supabase
        .from('job_titles')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (fetchError) {
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching job titles:', fetchError);
        }
        throw fetchError;
      }

      if (import.meta.env.DEV) {
        console.log('📦 Job titles data received:', data?.length || 0, 'job titles');
      }

      const mappedJobTitles: JobTitle[] = (data || []).map((title: any) => ({
        id: title.id,
        name: title.name || '',
        description: title.description || undefined,
        is_active: title.is_active ?? true,
      }));

      setJobTitles(mappedJobTitles);
      logger.info('Job titles loaded', { count: mappedJobTitles.length, companyId: currentCompany.id });
    } catch (err: any) {
      logger.error('Error loading job titles', err);
      setError(err?.message || 'Failed to load job titles');
      setJobTitles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addJobTitle = async (name: string, description?: string): Promise<string> => {
    if (!currentCompany?.id) {
      throw new Error('No company selected');
    }

    try {
      const { data, error: insertError } = await supabase
        .from('job_titles')
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
      await fetchJobTitles();
      
      logger.info('Job title added', { jobTitleId: data.id, name });
      return data.id;
    } catch (err: any) {
      logger.error('Error adding job title', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchJobTitles();
  }, [currentCompany?.id]);

  return {
    jobTitles,
    isLoading,
    error,
    refetch: fetchJobTitles,
    addJobTitle,
  };
};

