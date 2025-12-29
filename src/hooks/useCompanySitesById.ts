import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';
import { logger } from '../lib/logger';

export interface SitesByIdResult {
  sitesById: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCompanySitesById(): SitesByIdResult {
  const { currentCompany } = useCompany();
  const [sites, setSites] = useState<Array<{ id: string; site_name: string | null }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = async () => {
    if (!currentCompany?.id) {
      setSites([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('sites')
        .select('id, site_name')
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSites((data || []) as Array<{ id: string; site_name: string | null }>);
    } catch (err: any) {
      logger.error('Error loading sites for lookup', err);
      setError(err?.message || 'Failed to load sites');
      setSites([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  const sitesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sites) {
      if (s?.id && s?.site_name) map[s.id] = s.site_name;
    }
    return map;
  }, [sites]);

  return { sitesById, isLoading, error, refetch: fetchSites };
}


