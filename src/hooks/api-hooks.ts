import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '../lib/logger';
import { errorTracker } from '../lib/error-tracker';

// API response types
interface ApiError {
  message: string;
  status?: number;
  data?: unknown;
}

// Mock API client - replace with actual API implementation
const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    logger.debug('API GET request', { endpoint });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock responses
    if (endpoint === '/api/user/profile') {
      return {
        id: '1',
        name: 'Demo User',
        email: 'user@securecorp.com',
        department: 'Engineering',
        position: 'Software Developer',
      } as T;
    }
    
    if (endpoint === '/api/employees') {
      return [
        { id: '1', name: 'John Doe', email: 'john@example.com', department: 'Engineering' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', department: 'Marketing' },
      ] as T;
    }
    
    throw new Error(`Endpoint not implemented: ${endpoint}`);
  },

  post: async <T>(endpoint: string, data: unknown): Promise<T> => {
    logger.debug('API POST request', { endpoint, data });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock successful response
    return { success: true, data } as T;
  },

  put: async <T>(endpoint: string, data: unknown): Promise<T> => {
    logger.debug('API PUT request', { endpoint, data });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return { success: true, data } as T;
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    logger.debug('API DELETE request', { endpoint });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return { success: true } as T;
  },
};

// Generic API query hook
export function useApiQuery<TData>(
  queryKey: string[],
  endpoint: string,
  options?: Record<string, unknown>
) {
  return useQuery({
    queryKey,
    queryFn: () => apiClient.get<TData>(endpoint),
    ...options,
  });
}

// Generic API mutation hook
export function useApiMutation<TData, TVariables>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  options?: Record<string, unknown> & { invalidateQueries?: string[] }
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (variables: TVariables) => {
      switch (method) {
        case 'POST':
          return apiClient.post<TData>(endpoint, variables);
        case 'PUT':
          return apiClient.put<TData>(endpoint, variables);
        case 'DELETE':
          return apiClient.delete<TData>(endpoint);
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    },
    onError: (error: ApiError) => {
      errorTracker.trackApiError(error, endpoint, method);
    },
    onSuccess: (_data) => {
      logger.info('API mutation successful', { endpoint, method });
      
      // Invalidate related queries on successful mutations
      if (options?.invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: options.invalidateQueries });
      }
    },
    ...options,
  });
}

// Specific hooks for common operations

// User profile hooks
export function useUserProfile() {
  return useApiQuery(['user', 'profile'], '/api/user/profile');
}

export function useUpdateUserProfile() {
  return useApiMutation('/api/user/profile', 'PUT', {
    invalidateQueries: ['user', 'profile'],
  });
}

// Worker management hooks
export function useWorkers() {
  return useApiQuery(['workers'], '/api/workers');
}

export function useCreateWorker() {
  return useApiMutation('/api/workers', 'POST', {
    invalidateQueries: ['workers'],
  });
}

export function useUpdateWorker() {
  return useApiMutation('/api/workers', 'PUT', {
    invalidateQueries: ['workers'],
  });
}

export function useDeleteWorker() {
  return useApiMutation('/api/workers', 'DELETE', {
    invalidateQueries: ['workers'],
  });
}

// Reports hooks
export function useReports(filters?: Record<string, string>) {
  const filtersKey = filters ? JSON.stringify(filters) : 'no-filters';
  return useApiQuery(
    ['reports', filtersKey], 
    `/api/reports${filters ? `?${new URLSearchParams(filters)}` : ''}`,
    {
      enabled: !!filters, // Only fetch when filters are provided
    }
  );
}

// Dashboard data hooks
export function useDashboardData() {
  return useApiQuery(['dashboard'], '/api/dashboard');
}

// Search hooks
export function useSearch(query: string) {
  return useApiQuery(
    ['search', query],
    `/api/search?q=${encodeURIComponent(query)}`,
    {
      enabled: !!query && query.length > 2, // Only search with meaningful queries
      staleTime: 30 * 1000, // Search results are stale after 30 seconds
    }
  );
}
