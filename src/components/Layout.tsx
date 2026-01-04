import React, { ReactNode, useState, useCallback, useMemo, useEffect, memo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCompany } from '../hooks/useCompany';
import { useCompanyStore } from '../stores/company-store';
import { router } from '../lib/router';
import { useSubmoduleNav } from '../hooks/useSubmoduleNav';
import { useUIStore } from '../stores/ui-store';
import { usePreviousPage } from '../hooks/usePreviousPage';
import { 
  getSidebarStyles, 
  getButtonStyles, 
  getHoverStyles, 
  getTextStyles, 
  getLogoTextColor,
  getSettingsUrl,
  getDashboardUrl,
  getViewModeLabel,
  getNavigationButtonProps,
  getDashboardButtonProps,
  getSettingsButtonState,
  createNavItemContent,
  createCollapseExpandContent
} from '../utils/viewModeStyles';
import { 
  Users, 
  User,
  Clock, 
  Calendar,
  CalendarDays,
  NotebookTabs,
  Settings, 
  Home, 
  Bell, 
  Search, 
  HelpCircle,
  ChevronLeft, 
  ChevronRight,
  Building, 
  Building2,
  Printer,
  CalendarCheck,
  Flag,
  MessageCircleCode,
  Check,
  LogOut
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

interface Submodule {
  id: string;
  label: string;
  href: string;
}

// Modules that can expand to show submodules (sidebar-only navigation helper).
// Keep routes aligned with `src/App.tsx` router.addRoute(...) definitions.
const MODULE_SUBMODULES: Record<string, Submodule[]> = {
  Directory: [
    { id: 'workers', label: 'Workers', href: '/directory/workers' },
    { id: 'sites', label: 'Sites', href: '/directory/sites' },
  ],
  Schedule: [
    { id: 'schedule', label: 'Schedule', href: '/schedule/schedule' },
    { id: 'time-off', label: 'Time Off', href: '/schedule/time-off' },
  ],
  'Time & Attendance': [
    { id: 'whos-working', label: "Who's Working", href: '/time-and-attendance/whos-working' },
    { id: 'team-attendance', label: 'Team Attendance', href: '/time-and-attendance/team-attendance' },
    { id: 'team-attendance3', label: 'Team Attendance 3', href: '/time-and-attendance/team-attendance3' },
    { id: 'attendance-flags', label: 'Attendance Flags', href: '/time-and-attendance/attendance-flags' },
  ],
};

// Memoized navigation item component
const NavigationItem = memo(({ 
  item, 
  isActive, 
  isCollapsed, 
  onClick,
  viewMode
}: {
  item: { name: string; href: string; icon: React.ComponentType<{ style?: React.CSSProperties }> };
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  viewMode: 'manager';
}) => {
  const buttonStyles = getButtonStyles(viewMode, isActive);
  const textStyles = getTextStyles(viewMode, isActive);
  const hoverStyles = getHoverStyles(viewMode);

  return (
  <button
    onClick={onClick}
      className="flex items-center font-normal transition-colors group relative w-full"
    style={{
      fontSize: '14px',
      minHeight: '36px',
        padding: '12px 16px 12px 14px',
        ...buttonStyles
    }}
    onMouseEnter={(e) => {
      if (!isActive) {
          e.currentTarget.style.backgroundColor = hoverStyles.backgroundColor;
      }
    }}
    onMouseLeave={(e) => {
      if (!isActive) {
        e.currentTarget.style.backgroundColor = 'transparent';
      }
    }}
    aria-current={isActive ? 'page' : undefined}
      aria-label={`${item.name}${isActive ? ' (current page)' : ''}`}
      aria-describedby={isCollapsed ? `${item.name.toLowerCase().replace(/\s+/g, '-')}-tooltip` : undefined}
    >
      <div 
        className="flex items-center justify-center" 
        style={{ width: '18px', height: '18px', flexShrink: 0 }}
        aria-hidden="true"
      >
      <item.icon style={{ width: '18px', height: '18px' }} />
    </div>
    <span 
      className="absolute left-12 transition-opacity duration-300 whitespace-nowrap"
      style={{
        opacity: isCollapsed ? 0 : 1,
        pointerEvents: isCollapsed ? 'none' : 'auto',
        fontSize: '14px',
          ...textStyles
      }}
    >
      {item.name}
    </span>
  </button>
  );
});

NavigationItem.displayName = 'NavigationItem';

const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home }, // Will be handled dynamically based on view mode
  { name: 'Directory', href: '/directory/workers', icon: NotebookTabs },
  { name: 'Schedule', href: '/schedule/schedule', icon: CalendarDays },
  { name: 'Time & Attendance', href: '/time-and-attendance/whos-working', icon: Clock },
];



function Layout({ children }: LayoutProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { logout, user } = useAuth();
  const { currentCompany, availableCompanies, canSwitchCompany, switchCompany, isLoading } = useCompany();
  const { clearCompanies } = useCompanyStore();
  const [currentRoute, setCurrentRoute] = useState('/');
  const { tabs: submoduleTabs, breadcrumbs } = useSubmoduleNav();
  const { saveCurrentPageBeforeSettings } = usePreviousPage();
  const sidebarRef = useRef<HTMLElement | null>(null);
  
  // Use UI store for sidebar and view mode state
  const { 
    sidebarCollapsed: isCollapsed, 
    viewMode: storeViewMode, 
    toggleSidebarCollapsed,
    setSidebarCollapsed, 
    setViewMode 
  } = useUIStore();
  
  // Ensure viewMode is always valid, default to 'manager'
  const viewMode = storeViewMode || 'manager';

  // Scroll to top when route changes
  useEffect(() => {
    const routeFromRouter = router.getCurrentRoute();
    if (routeFromRouter !== currentRoute) {
      setCurrentRoute(routeFromRouter);
      // Additional scroll to top to ensure it works
      window.scrollTo(0, 0);
      // Also scroll the main content area if it exists
      const mainElement = document.querySelector('main[role="main"]');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }
  }, [currentRoute]);

  // Update current route when router changes
  useEffect(() => {
    const updateRoute = () => {
      setCurrentRoute(router.getCurrentRoute());
    };
    
    // Listen for route changes
    const removeListener = router.addListener(updateRoute);
    
    // Set initial route
    updateRoute();
    
    return () => {
      removeListener();
    };
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-user-menu]')) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  // Prevent scroll-chaining: when the mouse is inside the sidebar, never scroll the main content/page.
  // Allow scrolling inside the sidebar list when it can actually scroll.
  useEffect(() => {
    const sidebarEl = sidebarRef.current;
    if (!sidebarEl) return;

    const onWheel = (event: WheelEvent) => {
      const scrollEl = sidebarEl.querySelector('.sidebar-scroll') as HTMLElement | null;
      const targetNode = event.target as Node | null;
      const isInScrollArea = Boolean(scrollEl && targetNode && scrollEl.contains(targetNode));

      // If the wheel happens on footer/logo/etc, always block page scroll.
      if (!isInScrollArea || !scrollEl) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollEl;

      // No scroll available in sidebar: block page scroll.
      if (scrollHeight <= clientHeight) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // If we're at the bounds and user keeps scrolling, prevent the "overflow" from scrolling the page.
      const deltaY = event.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        event.preventDefault();
      }

      event.stopPropagation();
    };

    sidebarEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      sidebarEl.removeEventListener('wheel', onWheel as EventListener);
    };
  }, []);

  // Helper function to determine if a navigation item is active
  const isNavItemActive = useCallback((itemName: string, itemHref: string) => {
    switch (itemName) {
      case 'Dashboard':
        // Dashboard is active if we're on root or dashboard route
        return currentRoute === '/' || currentRoute === '/dashboard' || currentRoute.includes('/dashboard');
      case 'Directory':
        // Directory is active if we're on any directory route (workers or sites)
        return currentRoute.includes('/directory/workers') || currentRoute.includes('/directory/sites') || currentRoute.includes('/workers') || currentRoute.includes('/sites');
      case 'Workers':
        // Legacy: Workers is active if we're on any directory route (workers or sites)
        return currentRoute.includes('/directory/workers') || currentRoute.includes('/directory/sites') || currentRoute.includes('/workers') || currentRoute.includes('/sites');
      case 'Schedule':
        // Schedule is active if we're on any schedule route
        return currentRoute.includes('/schedule');
      case 'My Info':
        // My Info is active if we're on any workers or my-info route
        return currentRoute.includes('/workers') || currentRoute.includes('/my-info');
      case 'Time & Attendance':
        // Time & Attendance is active if we're on any time-and-attendance route
        return currentRoute.includes('/time-and-attendance');
      case 'Reports':
        // Reports is active if we're on any reports route
        return currentRoute.includes('/reports');
      case 'Settings':
        // Settings is active if we're on any settings route
        return currentRoute.includes('/settings');
      default:
        // For other items, use exact match or check if current route starts with the href
        return currentRoute === itemHref || currentRoute.startsWith(itemHref + '/');
    }
  }, [currentRoute]);

  // Memoized navigation items for management view
  const navigation = useMemo(() => {
    // Create navigation with order: Dashboard, Workers, Schedule, Time & Attendance, Reports
    return [
      baseNavigation[0], // Dashboard
      baseNavigation[1], // Workers
      baseNavigation[2], // Schedule
      baseNavigation[3], // Time & Attendance
      { name: 'Reports', href: '/reports', icon: Printer }
    ];
  }, []);

  const dashboardItem = useMemo(() => 
    navigation.find(item => item?.name === 'Dashboard' || item?.name === 'Home'), [navigation]
  );
  
  const otherNavItems = useMemo(() => 
    navigation.filter(item => 
      item?.name !== 'Dashboard' && 
      item?.name !== 'Home' && 
      item?.name !== 'Settings' // Exclude Settings since it's rendered separately
    ), [navigation]
  );

  // Memoized handlers
  const handleCollapseToggle = useCallback(() => {
    toggleSidebarCollapsed();
  }, [toggleSidebarCollapsed]);


  const handleHelpClick = useCallback(() => {
    if (import.meta.env.DEV) {
    console.log('Help/Knowledgebase clicked');
    }
  }, []);

  const handleNavigation = useCallback((path: string, moduleName?: string) => {
    // If the module has submodules, navigate to the first submodule instead
    if (moduleName && MODULE_SUBMODULES[moduleName] && MODULE_SUBMODULES[moduleName].length > 0) {
      const firstSubmodule = MODULE_SUBMODULES[moduleName][0];
      if (firstSubmodule) {
        path = firstSubmodule.href;
      }
    }
    
    // Save current page before navigating to settings
    if (path.includes('/settings')) {
      saveCurrentPageBeforeSettings();
    }
    
    // If navigating to Workers from WorkerInfo (breadcrumb click), set flag to restore state
    if (path === '/directory/workers' || path === '/workers') {
      const isOnWorkerInfoPage = sessionStorage.getItem('isOnWorkerInfoPage') === 'true';
      if (isOnWorkerInfoPage) {
        sessionStorage.setItem('comingFromWorkerInfo', 'true');
        sessionStorage.removeItem('isOnWorkerInfoPage');
      }
    } else if (path === '/directory/sites' || path === '/sites') {
      // If navigating to Sites from SiteInfo (breadcrumb click), set flag to restore state
      const isOnSiteInfoPage = sessionStorage.getItem('isOnSiteInfoPage') === 'true';
      if (isOnSiteInfoPage) {
        sessionStorage.setItem('comingFromSiteInfo', 'true');
        sessionStorage.removeItem('isOnSiteInfoPage');
      }
    } else {
      // Navigating to other pages, clear flags
      sessionStorage.removeItem('isOnWorkerInfoPage');
      sessionStorage.removeItem('comingFromWorkerInfo');
      sessionStorage.removeItem('isOnSiteInfoPage');
      sessionStorage.removeItem('comingFromSiteInfo');
    }
    
    // Handle dynamic navigation
    if (path === '/dashboard') {
      const actualPath = '/dashboard';
      router.navigate(actualPath);
      setCurrentRoute(actualPath);
    } else if (path === '/workers' || path === '/directory/workers') {
      const actualPath = '/directory/workers';
      router.navigate(actualPath);
      setCurrentRoute(actualPath);
    } else {
      router.navigate(path);
      setCurrentRoute(path);
    }
  }, [saveCurrentPageBeforeSettings]);

  // Memoized sidebar width calculations
  const sidebarWidth = useMemo(() => 
    isCollapsed ? '3.5rem' : '15rem', 
    [isCollapsed]
  );

  const mainMarginLeft = useMemo(() => 
    isCollapsed ? '3.5rem' : '15rem', 
    [isCollapsed]
  );

  const mainPaddingTop = useMemo(() => {
    const hasSecondaryNav = submoduleTabs.length > 0 || breadcrumbs.length > 0;
    return hasSecondaryNav ? '5.8125rem' : '3.3125rem';
  }, [submoduleTabs.length, breadcrumbs.length]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--gray-200)' }} data-testid="main-layout">
      {/* Enhanced Skip Links for comprehensive keyboard navigation */}
      <div className="skip-links-container">
        <a 
          href="#main-content" 
          className="skip-link"
          onClick={(e) => {
            e.preventDefault();
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
              mainContent.focus();
              mainContent.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          Skip to main content
        </a>
        
        <a 
          href="#main-navigation" 
          className="skip-link"
          onClick={(e) => {
            e.preventDefault();
            const mainNav = document.getElementById('main-navigation');
            if (mainNav) {
              const firstButton = mainNav.querySelector('button');
              if (firstButton) {
                firstButton.focus();
                firstButton.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }}
        >
          Skip to navigation
        </a>

        {submoduleTabs.length > 0 && (
          <a 
            href="#secondary-navigation" 
            className="skip-link"
            onClick={(e) => {
              e.preventDefault();
              const secondaryNav = document.getElementById('secondary-navigation');
              if (secondaryNav) {
                const firstTab = secondaryNav.querySelector('button');
                if (firstTab) {
                  firstTab.focus();
                  firstTab.scrollIntoView({ behavior: 'smooth' });
                }
              }
            }}
          >
            Skip to page navigation
          </a>
        )}

        <a 
          href="#user-menu" 
          className="skip-link"
          onClick={(e) => {
            e.preventDefault();
            const userMenu = document.getElementById('user-menu');
            if (userMenu) {
              userMenu.focus();
              userMenu.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          Skip to user menu
        </a>
      </div>
      
      <div className="flex">
        {/* Sidebar Navigation */}
        <nav 
          id="main-navigation"
          className={`min-h-screen fixed left-0 top-0 bottom-0 overflow-x-hidden transition-[width] duration-300 z-50 border-r flex flex-col ${
            isCollapsed ? 'w-14' : 'w-60'
          }`}
          style={{ 
            width: sidebarWidth,
            ...getSidebarStyles(viewMode)
          }}
          role="navigation"
          aria-label="Main navigation"
          data-testid="main-navigation"
          ref={sidebarRef}
        >
          {/* Logo Section */}
          <div>
            <div 
              className="flex items-center relative w-full"
              style={{ 
                height: '56px',
                padding: '0 12px 0 13px'
              }}
            >
              <div className="flex items-center justify-center" style={{ width: '27px', height: '27px', flexShrink: 0 }}>
                <MessageCircleCode size={27} style={{ color: 'var(--primary-brand-hex)' }} />
              </div>
              <span
                className="absolute transition-opacity duration-300 whitespace-nowrap font-normal"
                style={{
                  left: '52px',
                  opacity: isCollapsed ? 0 : 1,
                  pointerEvents: isCollapsed ? 'none' : 'auto',
                  color: getLogoTextColor(viewMode),
                  fontSize: '16px'
                }}
              >
                WAPunch
              </span>
            </div>
          </div>

          {/* Scrollable navigation items (only scrolls when content would overlap footer) */}
          <div className="flex-1 overflow-y-auto pb-4 sidebar-scroll">
            {/* Dashboard Button - Separate */}
            {dashboardItem && (
              <div style={{ marginTop: '-1px' }}>
                <button
                    {...getDashboardButtonProps(
                      viewMode, 
                      isNavItemActive(dashboardItem.name, dashboardItem.href),
                      () => handleNavigation(dashboardItem.href)
                    )}
                    title={isCollapsed ? dashboardItem.name : undefined}
                    aria-label={`${dashboardItem.name}${isNavItemActive(dashboardItem.name, dashboardItem.href) ? ' (current page)' : ''}`}
                    aria-current={isNavItemActive(dashboardItem.name, dashboardItem.href) ? 'page' : undefined}
                  >
                    {createNavItemContent(dashboardItem.icon, dashboardItem.name, isCollapsed)}
                  </button>
              </div>
            )}

            {/* Spacer between Dashboard and other items */}
            <div style={{ height: '18px' }}></div>

            {/* Other Navigation Items */}
            <div 
              style={{ gap: '1px', marginTop: '-3px' }} 
              className="flex flex-col" 
              role="navigation"
              aria-label="Main navigation items"
            >
              {otherNavItems.map((item) => {
                if (!item) return null;
                const isActive = isNavItemActive(item.name, item.href);
                const Icon = item.icon;

                return (
                  <button
                    key={item.name}
                    {...getNavigationButtonProps(
                      viewMode,
                      isActive,
                      () => {
                        handleNavigation(item.href, item.name);
                      }
                    )}
                    title={isCollapsed ? item.name : undefined}
                    aria-label={item.name}
                  >
                    {createNavItemContent(Icon, item.name, isCollapsed)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Help, Settings and Collapse/Expand Buttons */}
          <div style={{ paddingBottom: '1rem' }}>
            <div style={{ gap: '1px' }} className="flex flex-col">
              {/* Settings Button */}
              {(() => {
                const { settingsUrl, isActive } = getSettingsButtonState(viewMode, isNavItemActive);
                return (
              <button
                    {...getNavigationButtonProps(viewMode, isActive, () => handleNavigation(settingsUrl))}
              title="Settings"
                    aria-label={`Settings${isActive ? ' (current page)' : ''}`}
                  >
                    {createNavItemContent(Settings, 'Settings', isCollapsed)}
            </button>
                );
              })()}

              {/* Collapse/Expand Button */}
              <button
                {...getNavigationButtonProps(viewMode, false, handleCollapseToggle, {
                  borderLeft: '3px solid transparent'
                })}
                aria-label={isCollapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
              aria-expanded={!isCollapsed}
                aria-controls="main-navigation"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {createCollapseExpandContent(isCollapsed, ChevronRight, ChevronLeft, 'Show Labels', 'Hide Labels')}
            </button>
            </div>
          </div>
        </nav>

        {/* Main Navigation Bar */}
        <header 
          className="bg-white border-b fixed top-0 right-0 z-40 transition-all duration-300"
          style={{
            height: '3.5rem',
            left: mainMarginLeft,
            borderColor: 'var(--gray-250)'
          }}
          role="banner"
        >
          <div className="flex items-center justify-between h-full px-6">
            {/* Left side - Company name */}
            <div className="flex items-center" style={{ marginLeft: '-4px', minWidth: '300px' }}>
              <Building style={{ width: '16px', height: '16px', color: 'var(--gray-950)', marginRight: '12px' }} />
              <div className="flex items-center font-medium" style={{ color: 'var(--gray-950)', fontSize: '14px' }}>
                <span>{currentCompany?.name || 'WAPunch'}</span>
              </div>
            </div>

            {/* Center - Empty space for future use */}
            <div className="flex-1"></div>

            {/* Right side - User actions */}
            <div className="flex items-center gap-3">
              <button 
                className="p-1 rounded"
                style={{ color: 'var(--gray-950)' }}
                aria-label="Open search"
                title="Search"
              >
                <Search style={{ width: '16px', height: '16px' }} />
              </button>
              
              <button 
                className="p-1 rounded"
                style={{ color: 'var(--gray-950)' }}
                aria-label="View notifications"
                title="Notifications"
              >
                <Bell style={{ width: '16px', height: '16px' }} />
              </button>

              <button 
                onClick={handleHelpClick}
                className="p-1 rounded"
                style={{ color: 'var(--gray-950)' }}
                aria-label="Open help and knowledge base"
                title="Help & Knowledge Base"
              >
                <HelpCircle style={{ width: '16px', height: '16px' }} />
              </button>

              <span className="font-medium" style={{ color: 'var(--gray-950)', fontSize: '14px' }}>
                {user?.name || user?.email || getViewModeLabel(viewMode)}
              </span>


              {/* User Menu */}
              <div className="relative" data-user-menu>
                <button 
                  id="user-menu"
                  className="rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ 
                    width: '32px', 
                    height: '32px',
                    backgroundColor: 'var(--primary-brand-hex)',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'white'
                  }}
                  aria-label={`My Account${isUserMenuOpen ? ' (menu open)' : ' (menu closed)'}`}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  data-testid="view-toggle"
                  title="My Account"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : user?.email?.substring(0, 2).toUpperCase() || 'WA'}
                </button>

                {/* User Dropdown Menu - Asana Style */}
                {isUserMenuOpen && (
                  <div 
                    className="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-xl z-50"
                    style={{ 
                      top: '100%',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)'
                    }}
                    role="menu"
                    aria-label="User account menu"
                    aria-orientation="vertical"
                  >
                    {/* User Profile Section */}
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ 
                            width: '48px', 
                            height: '48px',
                            backgroundColor: 'var(--primary-brand-hex)',
                            fontSize: '18px',
                            fontWeight: '600',
                            color: 'white'
                          }}
                        >
                          {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : user?.email?.substring(0, 2).toUpperCase() || 'WA'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate" style={{ fontSize: '15px' }}>
                            {user?.name || user?.email || 'Demo User'}
                          </div>
                          {user?.email && user?.name && (
                            <div className="text-gray-500 truncate" style={{ fontSize: '13px' }}>
                              {user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Company Section */}
                    {availableCompanies.length > 0 && (
                      <div className="border-t border-gray-100">
                        <div className="px-4 py-2.5">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {availableCompanies.length > 1 ? 'Switch Organization' : 'Current Organization'}
                          </div>
                          {availableCompanies.map((companyUser) => {
                            const isCurrent = currentCompany?.id === companyUser.company_id;
                            return (
                              <button
                                key={companyUser.id}
                                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2 transition-colors ${
                                  isCurrent ? 'bg-gray-50' : ''
                                }`}
                                onClick={async () => {
                                  if (!isCurrent && companyUser.company && availableCompanies.length > 1) {
                                    setIsUserMenuOpen(false);
                                    await switchCompany(companyUser.company_id);
                                  }
                                }}
                                role="menuitem"
                                aria-label={`${isCurrent ? 'Current workspace' : 'Switch to'} ${companyUser.company?.name || 'company'}`}
                                disabled={isCurrent || availableCompanies.length === 1}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div 
                                    className={`flex items-center justify-center flex-shrink-0 ${isCurrent ? 'rounded-md' : 'rounded-full'}`}
                                    style={{ 
                                      width: '32px', 
                                      height: '32px',
                                      backgroundColor: isCurrent ? 'var(--primary-brand-hex)' : '#E5E7EB',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      color: isCurrent ? 'white' : '#6B7280'
                                    }}
                                  >
                                    {companyUser.company?.name?.substring(0, 2).toUpperCase() || 'CP'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate" style={{ fontSize: '14px' }}>
                                      {companyUser.company?.name || 'Unknown Company'}
                                    </div>
                                    <div className="text-gray-500 capitalize truncate" style={{ fontSize: '12px' }}>
                                      {companyUser.role.replace('_', ' ')}
                                    </div>
                                  </div>
                                </div>
                                {isCurrent && (
                                  <Check 
                                    style={{ 
                                      width: '18px', 
                                      height: '18px',
                                      color: 'var(--primary-brand-hex)',
                                      flexShrink: 0
                                    }} 
                                    aria-hidden="true" 
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Menu Actions */}
                    <div className="border-t border-gray-100 py-1.5">
                      <button
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.navigate('/organizations/manage');
                        }}
                        role="menuitem"
                        aria-label="Manage organizations"
                      >
                        <Building2 
                          style={{ 
                            width: '18px', 
                            height: '18px',
                            color: '#6B7280'
                          }} 
                          aria-hidden="true" 
                        />
                        <span className="text-gray-700" style={{ fontSize: '14px' }}>
                          Manage Organizations
                        </span>
                      </button>
                      
                      <button
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.navigate(getSettingsUrl(viewMode));
                        }}
                        role="menuitem"
                        aria-label="Settings"
                      >
                        <Settings 
                          style={{ 
                            width: '18px', 
                            height: '18px',
                            color: '#6B7280'
                          }} 
                          aria-hidden="true" 
                        />
                        <span className="text-gray-700" style={{ fontSize: '14px' }}>
                          Settings
                        </span>
                      </button>
                      


                      <button
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors border-t border-gray-100 mt-1.5 pt-3"
                        onClick={async () => {
                          setIsUserMenuOpen(false);
                          try {
                            clearCompanies();
                            await logout();
                          } finally {
                            router.navigate('/login', true);
                          }
                        }}
                      >
                        <LogOut 
                          style={{ 
                            width: '18px', 
                            height: '18px',
                            color: '#6B7280'
                          }} 
                          aria-hidden="true" 
                        />
                        <span className="text-gray-700" style={{ fontSize: '14px' }}>
                          Log out
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Secondary Navigation Bar for Submodules */}
        {(submoduleTabs.length > 0 || breadcrumbs.length > 0) && (
          <div 
            className="border-b fixed right-0 z-30 transition-all duration-300"
            style={{
              top: '3.5rem',
              height: '2.625rem',
              left: mainMarginLeft,
              backgroundColor: 'var(--gray-100)',
              borderColor: 'var(--gray-250)'
            }}
            role="navigation"
            aria-label="Secondary navigation"
          >
            <div className="flex items-center h-full" style={{ paddingRight: '1.5rem' }}>
              {submoduleTabs.length > 0 ? (
                <div id="secondary-navigation" className="flex items-stretch h-full" role="tablist">
                  {submoduleTabs.map((tab) => {
                    return (
                      <button
                        key={tab.id}
                        onClick={tab.onClick}
                        className={`transition-colors flex items-center justify-start border-r ${
                          tab.isActive
                            ? 'bg-white font-semibold'
                            : 'hover:bg-white/50 font-normal'
                        }`}
                        style={{
                          fontSize: '12px',
                          padding: '0 48px',
                          height: '100%',
                          minWidth: '140px',
                          width: 'auto',
                                                     color: tab.isActive ? 'var(--primary-brand-hex)' : 'var(--graphite-black-hex)',
                          borderColor: 'var(--gray-250)',
                          borderBottom: tab.isActive ? '2px solid var(--primary-brand-hex)' : 'none'
                        }}
                        role="tab"
                        aria-selected={tab.isActive}
                        aria-label={`${tab.label}${tab.isActive ? ' (current tab)' : ''}`}
                        aria-controls={`${tab.id}-panel`}
                        tabIndex={tab.isActive ? 0 : -1}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              ) : breadcrumbs.length > 0 ? (
                <nav className="flex items-center h-full" style={{ paddingLeft: '3rem' }} aria-label="Breadcrumb">
                  <ol className="flex items-center gap-2" style={{ fontSize: '12px', color: 'var(--gray-950)' }}>
                    {breadcrumbs.map((crumb, index) => (
                      <li key={index} className="flex items-center gap-2">
                        {crumb.href ? (
                          <button onClick={() => handleNavigation(crumb.href!)} className="hover:text-primary">
                            {crumb.label}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--gray-950)' }}>{crumb.label}</span>
                        )}
                        {index < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
                      </li>
                    ))}
                  </ol>
                </nav>
              ) : null}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main 
          id="main-content"
          className="flex-1 transition-all duration-300"
          style={{
            marginLeft: mainMarginLeft,
            paddingTop: mainPaddingTop,
            padding: `${mainPaddingTop} 1.5rem 1.5rem`,
            backgroundColor: 'var(--gray-200)'
          }}
          role="main"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default memo(Layout);

