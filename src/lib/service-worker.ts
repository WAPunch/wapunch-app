/// <reference types="vite/client" />
// Service Worker registration and management
import { logger } from './logger';

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported = this.checkSupport();
  }

  private checkSupport(): boolean {
    return 'serviceWorker' in navigator;
  }

  async register(): Promise<void> {
    if (!this.isSupported) {
      logger.warn('Service Worker not supported in this browser');
      return;
    }

    try {
      // Only register in production or when explicitly enabled
      if (import.meta.env.PROD || import.meta.env.VITE_SW_ENABLED === 'true') {
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        logger.info('Service Worker registered successfully', {
          scope: this.registration.scope,
          state: this.registration.installing?.state || 'unknown',
        });

        // Set up event listeners
        this.setupEventListeners();
      } else {
        // IMPORTANT:
        // In dev, we intentionally do NOT register a service worker, but Chrome may still have
        // an old SW + caches from a previous production build on the same origin (localhost),
        // which can cause the app to load stale assets and appear "broken" (no data anywhere).
        // So we proactively unregister any existing SWs and clear caches in dev.
        logger.debug('Service Worker registration skipped in development - ensuring old SW/caches are cleared');
        await this.unregister();
        await this.clearCaches();
      }
    } catch (error) {
      logger.error('Service Worker registration failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private setupEventListeners(): void {
    if (!this.registration) return;

    // Listen for service worker updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      logger.info('New Service Worker version found');

      newWorker.addEventListener('statechange', () => {
        logger.debug('Service Worker state changed', { state: newWorker.state });

        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is available
          this.notifyUpdate();
        }
      });
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      logger.debug('Message from Service Worker', event.data);
      
      if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
        this.notifyUpdate();
      }
    });

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      logger.info('Service Worker controller changed - reloading page');
      window.location.reload();
    });
  }

  private notifyUpdate(): void {
    logger.info('Service Worker update available');
    
    // You could show a user notification here
    // For now, we'll just log it and auto-update
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  async unregister(): Promise<void> {
    if (!this.isSupported) return;

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
        logger.info('Service Worker unregistered');
      }
    } catch (error) {
      logger.error('Service Worker unregistration failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported) return null;

    try {
      return (await navigator.serviceWorker.getRegistration()) || null;
    } catch (error) {
      logger.error('Failed to get Service Worker registration', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
      logger.debug('Checked for Service Worker updates');
    } catch (error) {
      logger.error('Failed to check for Service Worker updates', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Get service worker status
  getStatus(): string {
    if (!this.isSupported) return 'not_supported';
    if (!this.registration) return 'not_registered';

    const sw = this.registration.active || this.registration.installing || this.registration.waiting;
    return sw?.state || 'unknown';
  }

  // Send message to service worker
  async sendMessage(message: unknown): Promise<unknown> {
    if (!navigator.serviceWorker.controller) {
      throw new Error('No active service worker to send message to');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      navigator.serviceWorker.controller!.postMessage(message, [messageChannel.port2]);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Service Worker message timeout'));
      }, 10000);
    });
  }

  // Cache management
  async clearCaches(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cacheNames = await caches.keys();
      
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      
      logger.info('All caches cleared');
    } catch (error) {
      logger.error('Failed to clear caches', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Get cache usage information
  async getCacheInfo(): Promise<{ name: string; size: number }[]> {
    if (!('caches' in window)) return [];

    try {
      const cacheNames = await caches.keys();
      const cacheInfos = [];

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        cacheInfos.push({
          name: cacheName,
          size: keys.length,
        });
      }

      return cacheInfos;
    } catch (error) {
      logger.error('Failed to get cache info', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}

// Create and export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Initialize service worker on module load
if (typeof window !== 'undefined') {
  // Register service worker after page load
  window.addEventListener('load', () => {
    serviceWorkerManager.register();
  });

  // Check for updates periodically (every 30 minutes)
  setInterval(() => {
    serviceWorkerManager.checkForUpdates();
  }, 30 * 60 * 1000);
}
