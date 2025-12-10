import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';

export interface Company {
  id: string;
  name: string;
  country?: string;
  timezone: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  user_id: string;
  company_id: string;
  role: 'super_admin' | 'admin' | 'supervisor' | 'employee';
  is_deleted: boolean;
  created_at: string;
  company?: Company;
}

interface CompanyState {
  // Current company
  currentCompany: Company | null;
  currentCompanyUser: CompanyUser | null;
  
  // Available companies
  availableCompanies: CompanyUser[];
  
  // Loading state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentCompany: (company: Company, companyUser: CompanyUser) => void;
  loadUserCompanies: (userId: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  clearCompanies: () => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentCompany: null,
      currentCompanyUser: null,
      availableCompanies: [],
      isLoading: false,
      error: null,

      // Set current company
      setCurrentCompany: (company: Company, companyUser: CompanyUser) => {
        logger.info('Company switched', { companyId: company.id, companyName: company.name });
        set({
          currentCompany: company,
          currentCompanyUser: companyUser,
        });
      },

      // Load all companies for a user
      loadUserCompanies: async (userId: string) => {
        try {
          set({ isLoading: true, error: null });

          if (import.meta.env.DEV) {
            console.log('🔍 Loading companies for user:', userId);
          }

          const { data, error } = await supabase
            .from('company_users')
            .select(`
              *,
              company:companies(*)
            `)
            .eq('user_id', userId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true });

          if (error) {
            if (import.meta.env.DEV) {
              console.error('❌ Error loading companies:', error);
            }
            throw error;
          }

          if (import.meta.env.DEV) {
            console.log('📦 Companies data received:', data);
          }

          const companyUsers = (data || []).map((cu: any) => ({
            id: cu.id,
            user_id: cu.user_id,
            company_id: cu.company_id,
            role: cu.role,
            is_deleted: cu.is_deleted,
            created_at: cu.created_at,
            company: cu.company,
          })) as CompanyUser[];

          if (import.meta.env.DEV) {
            console.log('✅ Processed companies:', companyUsers.length, companyUsers);
          }

          // Set available companies
          set({ availableCompanies: companyUsers });

          // If no current company is set, use the first one
          if (!get().currentCompany && companyUsers.length > 0) {
            const firstCompanyUser = companyUsers[0];
            if (firstCompanyUser?.company) {
              get().setCurrentCompany(firstCompanyUser.company, firstCompanyUser);
            }
          }

          logger.info('User companies loaded', { count: companyUsers.length });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load companies';
          logger.error('Error loading user companies', error instanceof Error ? error : new Error(String(error)));
          if (import.meta.env.DEV) {
            console.error('❌ Error in loadUserCompanies:', error);
          }
          set({ 
            error: errorMessage,
            availableCompanies: [],
          });
        } finally {
          set({ isLoading: false });
        }
      },

      // Switch to a different company
      switchCompany: async (companyId: string) => {
        const { availableCompanies } = get();
        const companyUser = availableCompanies.find(
          (cu) => cu.company_id === companyId && cu.company
        );

        if (!companyUser || !companyUser.company) {
          logger.error('Company not found', new Error(`Company with id ${companyId} not found`));
          set({ error: 'Company not found' });
          return;
        }

        get().setCurrentCompany(companyUser.company, companyUser);
        
        // Reload the page to refresh all data with new company context
        window.location.reload();
      },

      // Clear companies (on logout)
      clearCompanies: () => {
        set({
          currentCompany: null,
          currentCompanyUser: null,
          availableCompanies: [],
          error: null,
        });
      },
    }),
    {
      name: 'company-storage',
      partialize: (state) => ({
        currentCompany: state.currentCompany,
        currentCompanyUser: state.currentCompanyUser,
        // Don't persist availableCompanies to force refresh on load
      }),
    }
  )
);

