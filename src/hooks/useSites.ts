import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';
import { logger } from '../lib/logger';

export interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  country: string;
  // Additional fields from database
  site_name: string;
  site_address: string;
  timezone: string;
  radius_meters?: number;
  type: string;
  is_active: boolean;
}

interface UseSitesResult {
  sites: Site[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useSites = (): UseSitesResult => {
  const { currentCompany } = useCompany();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSites = async () => {
    if (!currentCompany?.id) {
      setSites([]);
      setIsLoading(false);
      return;
    }

    try {
      // Don't set loading to true if we already have data to avoid flickering
      if (sites.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      if (import.meta.env.DEV) {
        console.log('🔍 Fetching sites for company:', currentCompany.id);
      }

      // Fetch sites from Supabase
      const { data, error: fetchError } = await supabase
        .from('sites')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching sites:', fetchError);
        }
        throw fetchError;
      }

      if (import.meta.env.DEV) {
        console.log('📦 Sites data received:', data?.length || 0, 'sites');
      }

      // Map database sites to UI Site interface
      const mappedSites: Site[] = (data || []).map((site: any) => {
        // Parse address to extract city, state, zipCode if possible
        // Format: "address, city, state zipCode" or just "address"
        const siteAddress = site.site_address || '';
        const addressParts = siteAddress.split(',').map((s: string) => s.trim()) || [];
        let city = '';
        let state = '';
        let zipCode = '';

        if (addressParts.length >= 2) {
          city = addressParts[1] || '';
          if (addressParts.length >= 3) {
            const stateZip = addressParts[2]?.split(' ') || [];
            state = stateZip[0] || '';
            zipCode = stateZip.slice(1).join(' ') || '';
          }
        }

        const siteName = site.site_name || 'Unnamed Site';

        return {
          id: site.id,
          name: siteName,
          address: siteAddress,
          city,
          state,
          zipCode,
          latitude: site.latitude ? Number(site.latitude) : undefined,
          longitude: site.longitude ? Number(site.longitude) : undefined,
          country: site.country || '',
          site_name: site.site_name,
          site_address: site.site_address,
          timezone: site.timezone || 'UTC',
          radius_meters: site.radius_meters,
          type: site.type || 'branch',
          is_active: site.is_active ?? true,
        };
      });

      setSites(mappedSites);
      logger.info('Sites loaded', { count: mappedSites.length, companyId: currentCompany.id });
    } catch (err: any) {
      logger.error('Error loading sites', err);
      setError(err?.message || 'Failed to load sites');
      setSites([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [currentCompany?.id]);

  return {
    sites,
    isLoading,
    error,
    refetch: fetchSites,
  };
};

