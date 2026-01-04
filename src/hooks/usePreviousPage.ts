import { useEffect } from 'react';
import { router } from '../lib/router';

export const usePreviousPage = () => {
  useEffect(() => {
    // Save current page to localStorage when navigating
    const currentPath = window.location.pathname;
    // Only save if it's not the settings page
    if (!currentPath.includes('/settings')) {
      localStorage.setItem('previousPage', currentPath);
    }
  }, []);

  const getPreviousPage = (): string => {
    return localStorage.getItem('previousPage') || '/time-and-attendance/whos-working';
  };

  const clearPreviousPage = (): void => {
    localStorage.removeItem('previousPage');
  };

  // Function to save current page before navigating to settings
  const saveCurrentPageBeforeSettings = (): void => {
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/settings')) {
      localStorage.setItem('previousPage', currentPath);
    }
  };

  return {
    getPreviousPage,
    clearPreviousPage,
    saveCurrentPageBeforeSettings
  };
};
