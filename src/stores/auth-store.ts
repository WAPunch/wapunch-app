import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '../lib/logger';
import { errorTracker } from '../lib/error-tracker';
import { externalMonitoring } from '../lib/external-monitoring';
import { supabase, getUserProfile } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  department?: string;
  position?: string;
}

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state - Start as loading to check session
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true, // Start as loading to check session
      error: null,

      // Initialize: Check for existing session
      init: async () => {
        try {
          set({ isLoading: true });
          
          // Check if Supabase is configured
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
            // If Supabase is not configured, set default demo state
            logger.warn('Supabase not configured, using demo mode');
            set({ 
              isLoading: false,
              isAuthenticated: false,
              user: null,
              accessToken: null,
            });
            return;
          }
          
          // Check for existing session with short timeout (fast-first render)
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Session check timeout')), 2000)
          );

          const { data: { session }, error } = (await Promise.race([
            sessionPromise,
            timeoutPromise,
          ]) as any);
          
          if (error) {
            logger.error('Error getting session', error);
            set({ isLoading: false, isAuthenticated: false });
            return;
          }
          
          if (session?.user) {
            // Set basic user immediately for fast UI
            const basicUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.email || '',
              role: 'user',
            };
            get().setAuth(basicUser, session.access_token);

            // Load profile in background and merge
            getUserProfile(session.user.id)
              .then((profile) => {
                if (!profile) return;
                const updatedUser: User = {
                  id: session.user.id,
                  email: session.user.email || '',
                  name: profile.name || session.user.user_metadata?.name || session.user.email || '',
                  role: (profile.role as 'user' | 'admin') || 'user',
                  department: profile.department,
                  position: profile.position,
                };
                set({ user: updatedUser });
              })
              .catch(() => {
                // ignore profile errors for speed
              })
              .finally(() => {
                set({ isLoading: false });
              });
            return;
          } else {
            set({ isLoading: false, isAuthenticated: false });
          }

          // Subscribe to auth state changes once
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const storeAny: any = useAuthStore as any;
          if (!storeAny.__authListenerSet) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
              if (event === 'SIGNED_IN' && session?.user) {
                const basicUser: User = {
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.name || session.user.email || '',
                  role: 'user',
                };
                get().setAuth(basicUser, session.access_token);
                // Background enrich
                getUserProfile(session.user.id)
                  .then((profile) => {
                    if (!profile) return;
                    set({
                      user: {
                        id: session.user.id,
                        email: session.user.email || '',
                        name: profile.name || session.user.email || '',
                        role: (profile.role as 'user' | 'admin') || 'user',
                        department: profile.department,
                        position: profile.position,
                      },
                    });
                  })
                  .catch(() => {});
              } else if (event === 'SIGNED_OUT') {
                set({
                  user: null,
                  accessToken: null,
                  isAuthenticated: false,
                  error: null,
                  isLoading: false,
                });
              }
            });
            storeAny.__authListenerSet = subscription;
          }
        } catch (error) {
          logger.error('Error initializing auth', error instanceof Error ? error : new Error(String(error)));
          // Always set loading to false, even on error
          set({ 
            isLoading: false,
            isAuthenticated: false,
            user: null,
            accessToken: null,
          });
        }
      },

      // Actions
      setAuth: (user: User, token: string) => {
        logger.info('User authenticated', { userId: user.id, email: user.email });
        
        // Set user context for external monitoring
        externalMonitoring.setUser({
          id: user.id,
          email: user.email,
          name: user.name,
        });
        
        set({
          user,
          accessToken: token,
          isAuthenticated: true,
          error: null,
        });
      },

      clearAuth: async () => {
        const currentUser = get().user;
        logger.info('User logged out', { userId: currentUser?.id });
        
        // Sign out from Supabase
        try {
          await supabase.auth.signOut();
        } catch (error) {
          logger.error('Error signing out from Supabase', error instanceof Error ? error : new Error(String(error)));
        }
        
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        if (error) {
          logger.error('Auth error occurred', new Error(error));
          errorTracker.trackError(new Error(error), {
            component: 'auth-store',
            action: 'setError',
          });
        }
        set({ error });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (!currentUser) {
          logger.warn('Attempted to update user data when no user is authenticated');
          return;
        }

        const updatedUser = { ...currentUser, ...userData };
        logger.info('User data updated', { 
          userId: currentUser.id, 
          updatedFields: Object.keys(userData) 
        });
        
        set({ user: updatedUser });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist non-sensitive data
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Note: We don't persist the access token for security
      }),
    }
  )
);
