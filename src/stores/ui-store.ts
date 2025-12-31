import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '../lib/logger';
import { ViewMode } from '../utils/viewModeStyles';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Theme state
  theme: 'light' | 'dark' | 'system';

  // View mode state
  viewMode: ViewMode;

  // Notifications
  notifications: Notification[];
  unreadNotificationCount: number;

  // Loading states
  globalLoading: boolean;
  loadingStates: Record<string, boolean>;

  // Modal states
  modals: Record<string, boolean>;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  setViewMode: (mode: ViewMode) => void;
  
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  setGlobalLoading: (loading: boolean) => void;
  setLoading: (key: string, loading: boolean) => void;
  
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  toggleModal: (modalId: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarOpen: false,
      sidebarCollapsed: true,
      theme: 'system',
      viewMode: 'manager',
      notifications: [],
      unreadNotificationCount: 0,
      globalLoading: false,
      loadingStates: {},
      modals: {},

      // Sidebar actions
      toggleSidebar: () => {
        const newState = !get().sidebarOpen;
        logger.debug('Sidebar toggled', { sidebarOpen: newState });
        set({ sidebarOpen: newState });
      },

      setSidebarOpen: (open: boolean) => {
        logger.debug('Sidebar state set', { sidebarOpen: open });
        set({ sidebarOpen: open });
      },

      toggleSidebarCollapsed: () => {
        const newState = !get().sidebarCollapsed;
        logger.debug('Sidebar collapsed toggled', { sidebarCollapsed: newState });
        set({ sidebarCollapsed: newState });
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        logger.debug('Sidebar collapsed set', { sidebarCollapsed: collapsed });
        set({ sidebarCollapsed: collapsed });
      },

      // Theme actions
      setTheme: (theme: 'light' | 'dark' | 'system') => {
        logger.info('Theme changed', { theme });
        set({ theme });
        
        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'system') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
          root.setAttribute('data-theme', theme);
        }
      },

      // View mode actions
      setViewMode: (mode: ViewMode) => {
        logger.info('View mode changed', { viewMode: mode });
        set({ viewMode: mode });
      },

      // Notification actions
      addNotification: (notification) => {
        const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
          read: false,
        };

        const notifications = [newNotification, ...get().notifications];
        const unreadCount = notifications.filter(n => !n.read).length;

        logger.info('Notification added', { 
          type: notification.type, 
          title: notification.title,
          notificationId: id 
        });

        set({
          notifications,
          unreadNotificationCount: unreadCount,
        });

        // Auto-remove success notifications after 5 seconds
        if (notification.type === 'success') {
          setTimeout(() => {
            get().removeNotification(id);
          }, 5000);
        }
      },

      markNotificationRead: (id: string) => {
        const notifications = get().notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        );
        const unreadCount = notifications.filter(n => !n.read).length;

        set({
          notifications,
          unreadNotificationCount: unreadCount,
        });
      },

      removeNotification: (id: string) => {
        const notifications = get().notifications.filter(n => n.id !== id);
        const unreadCount = notifications.filter(n => !n.read).length;

        set({
          notifications,
          unreadNotificationCount: unreadCount,
        });
      },

      clearAllNotifications: () => {
        logger.info('All notifications cleared');
        set({
          notifications: [],
          unreadNotificationCount: 0,
        });
      },

      // Loading actions
      setGlobalLoading: (loading: boolean) => {
        set({ globalLoading: loading });
      },

      setLoading: (key: string, loading: boolean) => {
        const loadingStates = { ...get().loadingStates };
        if (loading) {
          loadingStates[key] = true;
        } else {
          delete loadingStates[key];
        }
        set({ loadingStates });
      },

      // Modal actions
      openModal: (modalId: string) => {
        logger.debug('Modal opened', { modalId });
        set({ modals: { ...get().modals, [modalId]: true } });
      },

      closeModal: (modalId: string) => {
        logger.debug('Modal closed', { modalId });
        const modals = { ...get().modals };
        delete modals[modalId];
        set({ modals });
      },

      toggleModal: (modalId: string) => {
        const isOpen = get().modals[modalId];
        if (isOpen) {
          get().closeModal(modalId);
        } else {
          get().openModal(modalId);
        }
      },
    }),
    {
      name: 'ui-storage',
      // Persist UI preferences
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        viewMode: state.viewMode,
      }),
    }
  )
);
