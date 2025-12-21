import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { router } from './lib/router';
import { SubmoduleNavProvider } from './hooks/useSubmoduleNav';
import { logger } from './lib/logger';
import { useUIStore } from './stores/ui-store';
import { useAuthStore } from './stores/auth-store';
import { supabase, getUserProfile } from './lib/supabase';

// Code splitting with React.lazy
const ManagementDashboard = lazy(() => {
  logger.debug('Loading ManagementDashboard component');
  return import('./pages/Dashboard');
});



// Error pages
const BadRequest = lazy(() => {
  logger.debug('Loading BadRequest component');
  return import('./pages/error-pages/BadRequest');
});

const Unauthorized = lazy(() => {
  logger.debug('Loading Unauthorized component');
  return import('./pages/error-pages/Unauthorized');
});

const Forbidden = lazy(() => {
  logger.debug('Loading Forbidden component');
  return import('./pages/error-pages/Forbidden');
});

const NotFound = lazy(() => {
  logger.debug('Loading NotFound component');
  return import('./pages/error-pages/NotFound');
});

const InternalServerError = lazy(() => {
  logger.debug('Loading InternalServerError component');
  return import('./pages/error-pages/InternalServerError');
});

const BadGateway = lazy(() => {
  logger.debug('Loading BadGateway component');
  return import('./pages/error-pages/BadGateway');
});

const ServiceUnavailable = lazy(() => {
  logger.debug('Loading ServiceUnavailable component');
  return import('./pages/error-pages/ServiceUnavailable');
});

const GatewayTimeout = lazy(() => {
  logger.debug('Loading GatewayTimeout component');
  return import('./pages/error-pages/GatewayTimeout');
});


const Directory = lazy(() => {
  logger.debug('Loading Directory component');
  return import('./pages/workers/Directory');
});

const WorkerInfo = lazy(() => {
  logger.debug('Loading WorkerInfo component');
  return import('./pages/workers/WorkerInfo');
});

const Sites = lazy(() => {
  logger.debug('Loading Sites component');
  return import('./pages/sites/Sites');
});
const SiteInfo = lazy(() => {
  logger.debug('Loading SiteInfo component');
  return import('./pages/sites/SiteInfo');
});

const WhosWorking = lazy(() => {
  logger.debug('Loading Whos Working component');
  return import('./pages/time-and-attendance/WhosWorking');
});

const TeamSchedule = lazy(() => {
  logger.debug('Loading Team Schedule component');
  return import('./pages/time-and-attendance/TeamSchedule');
});

const TeamAttendance = lazy(() => {
  logger.debug('Loading Team Attendance component');
  return import('./pages/time-and-attendance/TeamAttendance');
});

const AttendanceFlags = lazy(() => {
  logger.debug('Loading Attendance Flags component');
  return import('./pages/time-and-attendance/AttendanceFlags');
});


const WorkerTimesheet = lazy(() => {
  logger.debug('Loading Worker Timesheet component');
  return import('./pages/time-and-attendance/WorkerTimesheet');
});



const CompanyReports = lazy(() => {
  logger.debug('Loading Company Reports component');
  return import('./pages/reports/CompanyReports');
});

const CompanySettings = lazy(() => {
  logger.debug('Loading Company Settings component');
  return import('./pages/settings/CompanySettings');
});

const ManageOrganizations = lazy(() => {
  logger.debug('Loading Manage Organizations component');
  return import('./pages/organizations/ManageOrganizations');
});

// Auth pages
const Login = lazy(() => {
  logger.debug('Loading Login component');
  return import('./pages/auth/Login');
});

const Signup = lazy(() => {
  logger.debug('Loading Signup component');
  return import('./pages/auth/Signup');
});

const CompanyRegistration = lazy(() => {
  logger.debug('Loading Company Registration component');
  return import('./pages/auth/CompanyRegistration');
});

const ResetPassword = lazy(() => {
  logger.debug('Loading Reset Password component');
  return import('./pages/auth/ResetPassword');
});

const NewPassword = lazy(() => {
  logger.debug('Loading New Password component');
  return import('./pages/auth/NewPassword');
});



function ThemeToggle() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('theme') || 'light');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  return (
    <button
      className="rounded-xl px-4 py-2 shadow-card border border-border bg-primary text-primary-foreground"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle theme"
    >
      Toggle theme
    </button>
  );
}



function App() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { setViewMode } = useUIStore();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { init: initAuth } = useAuthStore();

  // Check if current page is error page (memoized - must be before all useEffect)
  const isErrorPage = useMemo(() => [
    'bad-request', 'unauthorized', 'forbidden', 'not-found',
    'internal-server-error', 'bad-gateway', 'service-unavailable', 'gateway-timeout'
  ].includes(currentPage), [currentPage]);

  // Check if current page is auth page (memoized - must be before all useEffect)
  const isAuthPage = useMemo(() => [
    'login', 'signup', 'company-registration', 'reset-password', 'new-password'
  ].includes(currentPage), [currentPage]);

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await initAuth();
      } catch (error) {
        logger.error('Error initializing auth', error instanceof Error ? error : new Error(String(error)));
        // Don't break the app if auth init fails
        useAuthStore.getState().setLoading(false);
      }
    };
    
    initializeAuth();
  }, [initAuth]);

  // Note: auth state changes handled inside auth store init

  if (import.meta.env.DEV) {
  console.log('App render - isAuthenticated:', isAuthenticated, 'user:', user, 'isLoading:', isLoading);
  }

  // Setup routing - Auth routes are always available
  useEffect(() => {
    // Auth routes (available without authentication)
    router.addRoute('/login', () => setCurrentPage('login'));
    router.addRoute('/auth/login', () => setCurrentPage('login'));
    router.addRoute('/signup', () => setCurrentPage('signup'));
    router.addRoute('/auth/signup', () => setCurrentPage('signup'));
    router.addRoute('/company-registration', () => setCurrentPage('company-registration'));
    router.addRoute('/auth/company-registration', () => setCurrentPage('company-registration'));
    router.addRoute('/reset-password', () => setCurrentPage('reset-password'));
    router.addRoute('/auth/reset-password', () => setCurrentPage('reset-password'));
    router.addRoute('/new-password', () => setCurrentPage('new-password'));
    router.addRoute('/auth/new-password', () => setCurrentPage('new-password'));

    // Initialize router (always, even if not authenticated, so auth routes work)
    router.init();
    
    // Add listener for route changes to sync with current page
    const unsubscribe = router.addListener(() => {
      // This ensures the UI updates when router redirects
      const currentRoute = router.getCurrentRoute();
      if (import.meta.env.DEV) {
        console.log('Route changed to:', currentRoute);
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

  // Setup authenticated routes when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initialize router view mode to match UI store
    const { viewMode } = useUIStore.getState();
    router.setViewMode(viewMode);
    if (import.meta.env.DEV) {
      console.log('Router initialized with view mode:', viewMode);
    }
    
    // Set up view mode change handler to sync router changes with UI store
    router.setViewModeChangeHandler((newViewMode) => {
      if (import.meta.env.DEV) {
        console.log('Router detected view mode change, updating UI store:', newViewMode);
      }
      setViewMode(newViewMode);
    });
    
    // Set up unauthorized redirect handler
    router.setUnauthorizedRedirectHandler(() => {
      if (import.meta.env.DEV) {
        console.log('Unauthorized access attempt blocked - redirecting to management dashboard');
      }
      setCurrentPage('management-dashboard');
    });
    
    // Set up routes - default route goes to management dashboard
    router.addRoute('/', () => setCurrentPage('management-dashboard'));
    
    // Error routes
    router.addRoute('/400', () => setCurrentPage('bad-request'));
    router.addRoute('/401', () => setCurrentPage('unauthorized'));
    router.addRoute('/403', () => setCurrentPage('forbidden'));
    router.addRoute('/404', () => setCurrentPage('not-found'));
    router.addRoute('/500', () => setCurrentPage('internal-server-error'));
    router.addRoute('/502', () => setCurrentPage('bad-gateway'));
    router.addRoute('/503', () => setCurrentPage('service-unavailable'));
    router.addRoute('/504', () => setCurrentPage('gateway-timeout'));
    
    // 404 route handler for unknown routes
    router.addRoute('*', () => setCurrentPage('not-found'));
    // Dashboard route
    router.addRoute('/dashboard', () => setCurrentPage('management-dashboard'));
    router.addRoute('/', () => setCurrentPage('management-dashboard'));
    
    // Workers routes
    router.addRoute('/workers/directory', () => setCurrentPage('directory'));
    router.addRoute('/workers/worker-info/:slug', () => setCurrentPage('worker-info'));
    router.addRoute('/workers/worker-info', () => setCurrentPage('worker-info'));
    // Sites routes
    router.addRoute('/sites', () => setCurrentPage('sites'));
    router.addRoute('/sites/site-info/:slug', () => setCurrentPage('site-info'));
    router.addRoute('/sites/site-info', () => setCurrentPage('site-info'));
    
    // Time & Attendance routes
    router.addRoute('/time-and-attendance/whos-working', () => setCurrentPage('whos-working'));
    router.addRoute('/time-and-attendance/team-schedule', () => setCurrentPage('team-schedule'));
    router.addRoute('/time-and-attendance/team-attendance', () => setCurrentPage('team-attendance'));
    router.addRoute('/time-and-attendance/attendance-flags', () => setCurrentPage('attendance-flags'));
    router.addRoute('/time-and-attendance/worker-timesheet/:slug', () => setCurrentPage('worker-timesheet'));
    router.addRoute('/time-and-attendance/worker-timesheet', () => setCurrentPage('worker-timesheet'));
    
    // Reports routes
    router.addRoute('/reports', () => setCurrentPage('company-reports'));
    router.addRoute('/reports/company-reports', () => setCurrentPage('company-reports'));
    
    // Settings routes
    router.addRoute('/settings', () => setCurrentPage('company-settings'));
    router.addRoute('/settings/company-settings', () => setCurrentPage('company-settings'));
    
    // Organizations routes
    router.addRoute('/organizations', () => setCurrentPage('manage-organizations'));
    router.addRoute('/organizations/manage', () => setCurrentPage('manage-organizations'));
    
    // Legacy routes (still supported)
    router.addRoute('/workers', () => setCurrentPage('directory'));
    
    // Other routes - redirect to management dashboard
    router.addRoute('/time-tracking', () => setCurrentPage('management-dashboard'));
    router.addRoute('/settings', () => setCurrentPage('company-settings'));
  }, [isAuthenticated, setViewMode]);

  // Monitor URL changes and trigger router navigation (for direct navigation like tests)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleLocationChange = () => {
      const currentPath = window.location.pathname;
      const routerPath = router.getCurrentRoute();
      
      // If URL changed but router hasn't been notified, trigger navigation
      if (currentPath !== routerPath) {
        if (import.meta.env.DEV) {
        console.log('Direct navigation detected:', currentPath, '-> triggering router navigation');
        }
        router.navigate(currentPath, false);
      }
    };

    // Check on initial load and when URL changes
    handleLocationChange();
    
    // Set up interval to check for URL changes (fallback for direct navigation)
    const interval = setInterval(handleLocationChange, 100);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, currentPage]);

  // Redirect to login if not authenticated (except for auth pages and error pages)
  useEffect(() => {
    if (!isAuthenticated && !isLoading && !isAuthPage && !isErrorPage) {
      router.navigate('/login', true);
    }
  }, [isAuthenticated, isLoading, isAuthPage, isErrorPage]);


  const renderPage = () => {
    switch (currentPage) {
      
      // Error pages
      case 'bad-request':
        return <BadRequest />;
      case 'unauthorized':
        return <Unauthorized />;
      case 'forbidden':
        return <Forbidden />;
      case 'not-found':
        return <NotFound />;
      case 'internal-server-error':
        return <InternalServerError />;
      case 'bad-gateway':
        return <BadGateway />;
      case 'service-unavailable':
        return <ServiceUnavailable />;
      case 'gateway-timeout':
        return <GatewayTimeout />;
      
      // Dashboard pages
      case 'management-dashboard':
        return <ManagementDashboard />;
      case 'directory':
        return <Directory />;
      case 'worker-info':
        return <WorkerInfo />;
      case 'sites':
        return <Sites />;
      case 'site-info':
        return <SiteInfo />;

      case 'reports':
        return <CompanyReports />;
      case 'whos-working':
        return <WhosWorking />;
      case 'team-schedule':
        return <TeamSchedule />;
      case 'team-attendance':
        return <TeamAttendance />;
      case 'attendance-flags':
        return <AttendanceFlags />;
      case 'worker-timesheet':
        return <WorkerTimesheet />;
      case 'company-reports':
        return <CompanyReports />;
      case 'company-settings':
        return <CompanySettings />;
      case 'manage-organizations':
        return <ManageOrganizations />;
      
      // Auth pages
      case 'login':
        return <Login />;
      case 'signup':
        return <Signup />;
      case 'company-registration':
        return <CompanyRegistration />;
      case 'reset-password':
        return <ResetPassword />;
      case 'new-password':
        return <NewPassword />;
      
      default:
        return <ManagementDashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-dvh bg-background">
        {!isAuthenticated && !isAuthPage ? (
          <div className="min-h-dvh flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-muted-foreground">Redirecting to login...</p>
            </div>
          </div>
        ) : isAuthPage ? (
          // Auth pages without layout
          <ErrorBoundary>
            <Suspense fallback={null}>
              {renderPage()}
            </Suspense>
          </ErrorBoundary>
        ) : isErrorPage ? (
          // Error pages without layout
          <ErrorBoundary>
            <Suspense fallback={null}>
              {renderPage()}
            </Suspense>
          </ErrorBoundary>
        ) : currentPage === 'company-settings' ? (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <CompanySettings />
            </Suspense>
          </ErrorBoundary>
        ) : (
          // Regular pages with layout
          <SubmoduleNavProvider>
            <Layout>
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  </div>
                }>
                  {renderPage()}
                </Suspense>
              </ErrorBoundary>
            </Layout>
          </SubmoduleNavProvider>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;

