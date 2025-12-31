import React, { ReactNode, useState, useCallback, useMemo, useEffect, memo } from 'react';
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
  MessageCircleCode,
  Check
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

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
      { name: 'Reports', href: '/reports/company-reports', icon: Printer }
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

  const handleNavigation = useCallback((path: string) => {
    // Save current page before navigating to settings
    if (path.includes('/settings/company-settings')) {
      saveCurrentPageBeforeSettings();
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
          className={`min-h-screen fixed left-0 top-0 bottom-0 overflow-y-auto overflow-x-hidden transition-all duration-300 z-50 border-r ${
            isCollapsed ? 'w-14' : 'w-60'
          }`}
          style={{ 
            width: sidebarWidth,
            ...getSidebarStyles(viewMode)
          }}
          role="navigation"
          aria-label="Main navigation"
          data-testid="main-navigation"
          onMouseLeave={() => {
            // Auto-collapse sidebar when mouse leaves the area (only if expanded)
            if (!isCollapsed) {
              setSidebarCollapsed(true);
            }
          }}
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

          <div className="pb-4">
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
                      () => handleNavigation(item.href)
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
          <div className="absolute left-0 right-0" style={{ bottom: '1rem' }}>
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
                  className="rounded-full flex items-center justify-center hover:opacity-80 transition-colors"
                  style={{ 
                    width: '28px', 
                    height: '28px',
                                         backgroundColor: 'var(--primary-brand-hex)'
                  }}
                  aria-label={`My Account${isUserMenuOpen ? ' (menu open)' : ' (menu closed)'}`}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  data-testid="view-toggle"
                  title="My Account"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <User style={{ width: '14px', height: '14px', color: 'white' }} />
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                    style={{ top: '100%' }}
                    role="menu"
                    aria-label="User account menu"
                    aria-orientation="vertical"
                  >
                    {/* User Info Section */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm text-gray-500 mb-1">Logged in as</div>
                      <div className="font-medium text-gray-900">{user?.name || user?.email || 'Demo User'}</div>
                      {currentCompany && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Building2 style={{ width: '12px', height: '12px' }} />
                          {currentCompany.name}
                        </div>
                      )}
                    </div>

                    {/* Company Section */}
                    <div className="py-1 border-b border-gray-100">
                      <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {availableCompanies.length > 1 ? 'Switch Company' : 'Company'}
                      </div>
                      {availableCompanies.length === 0 ? (
                        <div className="px-4 py-2">
                          <div className="text-sm text-gray-500 mb-1">No companies associated</div>
                          <div className="text-xs text-gray-400">
                            Contact your administrator to be added to a company
                          </div>
                        </div>
                      ) : (
                        availableCompanies.map((companyUser) => {
                          const isCurrent = currentCompany?.id === companyUser.company_id;
                          return (
                            <button
                              key={companyUser.id}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${
                                isCurrent ? 'bg-gray-50' : 'text-gray-700'
                              }`}
                              onClick={async () => {
                                if (!isCurrent && companyUser.company && availableCompanies.length > 1) {
                                  setIsUserMenuOpen(false);
                                  await switchCompany(companyUser.company_id);
                                }
                              }}
                              role="menuitem"
                              aria-label={`${isCurrent ? 'Current company' : 'Switch to'} ${companyUser.company?.name || 'company'}`}
                              disabled={isCurrent || availableCompanies.length === 1}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Building2 
                                  style={{ 
                                    width: '16px', 
                                    height: '16px',
                                    color: isCurrent ? 'var(--primary-brand-hex)' : 'var(--gray-600)',
                                    flexShrink: 0
                                  }} 
                                  aria-hidden="true" 
                                />
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium truncate ${isCurrent ? 'text-primary' : 'text-gray-900'}`}>
                                    {companyUser.company?.name || 'Unknown Company'}
                                  </div>
                                  <div className="text-xs text-gray-500 capitalize">
                                    {companyUser.role.replace('_', ' ')}
                                  </div>
                                </div>
                              </div>
                              {isCurrent && (
                                <Check 
                                  style={{ 
                                    width: '16px', 
                                    height: '16px',
                                    color: 'var(--primary-brand-hex)',
                                    flexShrink: 0
                                  }} 
                                  aria-hidden="true" 
                                />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.navigate('/organizations/manage');
                        }}
                        role="menuitem"
                        aria-label="Manage organizations"
                      >
                        <Building2 style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                        Manage Organizations
                      </button>
                      
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          // Add navigation to account page if needed
                        }}
                        role="menuitem"
                        aria-label="Go to my account settings"
                      >
                        <User style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                        My Account
                      </button>
                      


                      <button
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 mt-1 pt-3"
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
                        <span style={{ width: '16px', height: '16px', display: 'inline-block' }}>⏻</span>
                        Log out
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

