import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';
import { logger } from '../lib/logger';

export interface WhosWorkingEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  status: 'present' | 'on-break' | 'on-transfer' | 'on-leave' | 'absent';
  location: string;
  lastActivityTime: string;
  lastActivity: 'clock-in' | 'break-start' | 'transfer-start' | 'clock-out' | 'break-end' | 'transfer-end';
  activityDetails: string;
  avatar?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

interface UseWhosWorkingResult {
  workers: WhosWorkingEmployee[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Map database current_status to UI status
const mapStatus = (currentStatus: string, isActive: boolean, archived: boolean): 'present' | 'on-break' | 'on-transfer' | 'on-leave' | 'absent' => {
  if (!isActive || archived) {
    return 'on-leave';
  }
  
  switch (currentStatus) {
    case 'in':
      return 'present';
    case 'on_break':
      return 'on-break';
    case 'on_transfer':
      return 'on-transfer';
    case 'out':
    default:
      return 'absent';
  }
};

// Map log_type to lastActivity
const mapLastActivity = (logType: string): 'clock-in' | 'break-start' | 'transfer-start' | 'clock-out' | 'break-end' | 'transfer-end' => {
  switch (logType) {
    case 'check_in':
      return 'clock-in';
    case 'start_break':
      return 'break-start';
    case 'start_transfer':
      return 'transfer-start';
    case 'check_out':
      return 'clock-out';
    case 'end_break':
      return 'break-end';
    case 'end_transfer':
      return 'transfer-end';
    default:
      return 'clock-in';
  }
};

// Format time for display
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
};

export const useWhosWorking = (): UseWhosWorkingResult => {
  const { currentCompany } = useCompany();
  const [workers, setWorkers] = useState<WhosWorkingEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = async () => {
    if (!currentCompany?.id) {
      setWorkers([]);
      setIsLoading(false);
      return;
    }

    try {
      if (workers.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      if (import.meta.env.DEV) {
        console.log('🔍 Fetching who\'s working for company:', currentCompany.id);
      }

      // Fetch workers with their current status
      // Note: Workers are NOT users, so we don't select user_id
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select(`
          id,
          first_name,
          last_name,
          position,
          current_status,
          is_active,
          archived,
          whatsapp_number,
          email
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .order('first_name', { ascending: true });

      if (workersError) {
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching workers:', workersError);
        }
        throw workersError;
      }

      // Fetch latest attendance log for each worker
      const workerIds = (workersData || []).map((worker: any) => worker.id);
      
      let latestLogs: any[] = [];
      if (workerIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('attendance_logs')
          .select(`
            id,
            worker_id,
            log_type,
            log_time,
            latitude,
            longitude,
            source,
            site_id,
            site:sites(name, address)
          `)
          .in('worker_id', workerIds)
          .order('log_time', { ascending: false });

        if (logsError) {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Error fetching attendance logs:', logsError);
          }
        } else {
          // Get the latest log for each worker
          const logsByWorker = new Map<string, any>();
          (logsData || []).forEach((log: any) => {
            if (!logsByWorker.has(log.worker_id)) {
              logsByWorker.set(log.worker_id, log);
            }
          });
          latestLogs = Array.from(logsByWorker.values());
        }
      }

      // Map workers to WhosWorkingEmployee interface
      const mappedEmployees: WhosWorkingEmployee[] = (workersData || []).map((worker: any) => {
        const latestLog = latestLogs.find((log: any) => log.worker_id === worker.id);
        
        const status = mapStatus(worker.current_status || 'out', worker.is_active, worker.archived);
        
        // Get location from site or default
        let location = 'N/A';
        let latitude: number | undefined;
        let longitude: number | undefined;
        
        if (latestLog?.site) {
          location = latestLog.site.name || latestLog.site.address || 'N/A';
        }
        if (latestLog?.latitude && latestLog?.longitude) {
          latitude = Number(latestLog.latitude);
          longitude = Number(latestLog.longitude);
        }

        // Get last activity info
        const lastActivity = latestLog ? mapLastActivity(latestLog.log_type) : 'clock-out';
        const lastActivityTime = latestLog ? formatTime(latestLog.log_time) : 'N/A';
        const activityDetails = latestLog 
          ? `${lastActivity.replace('-', ' ')} - ${latestLog.source || 'Unknown'}`
          : 'No recent activity';

        return {
          id: worker.id,
          firstName: worker.first_name || '',
          lastName: worker.last_name || '',
          email: worker.email || '', // Email is stored directly in workers table
          jobTitle: worker.position || 'Worker',
          department: '', // Department not in workers table
          status,
          location,
          lastActivityTime,
          lastActivity,
          activityDetails,
          phone: worker.whatsapp_number || undefined,
          latitude,
          longitude,
        };
      });

      setWorkers(mappedEmployees);
      logger.info('Who\'s working data loaded', { count: mappedEmployees.length, companyId: currentCompany.id });
    } catch (err: any) {
      logger.error('Error loading who\'s working data', err);
      setError(err?.message || 'Failed to load who\'s working data');
      setWorkers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [currentCompany?.id]);

  return {
    workers,
    isLoading,
    error,
    refetch: fetchWorkers,
  };
};

