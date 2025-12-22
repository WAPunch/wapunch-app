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
  current_status?: 'out' | 'in' | 'on_break' | 'on_transfer';
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

// Format activity - returns object with action and dateTime
const formatActivity = (logType: string, timestamp: string): { action: string; dateTime: string } => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === new Date(now.getTime() - 86400000).toDateString();
  
  // Format date
  let dateStr = '';
  if (isToday) {
    dateStr = 'Today';
  } else if (isYesterday) {
    dateStr = 'Yesterday';
  } else {
    dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  }
  
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  // Map log_type to readable action name
  let actionName = '';
  switch (logType) {
    case 'check_in':
      actionName = 'Clock In';
      break;
    case 'start_break':
      actionName = 'Start Break';
      break;
    case 'start_transfer':
      actionName = 'Start Transfer';
      break;
    case 'check_out':
      actionName = 'Clock Out';
      break;
    case 'end_break':
      actionName = 'End Break';
      break;
    case 'end_transfer':
      actionName = 'End Transfer';
      break;
    default:
      actionName = 'Activity';
  }
  
  return {
    action: actionName,
    dateTime: `${dateStr} ${timeStr}`
  };
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
          email,
          department_id,
          department:departments(name),
          job_title_id,
          job_title:job_titles(name)
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .order('first_name', { ascending: true});

      if (workersError) {
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching workers:', workersError);
        }
        throw workersError;
      }

      // Fetch latest attendance log for each worker
      const workerIds = (workersData || []).map((worker: any) => worker.id);
      
      if (import.meta.env.DEV) {
        console.log('🔍 Worker IDs to fetch logs for:', workerIds);
      }
      
      let latestLogs: any[] = [];
      if (workerIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('attendance_logs')
          .select('id, worker_id, log_type, log_time, latitude, longitude, source, raw_message, site_id')
          .eq('company_id', currentCompany.id)
          .in('worker_id', workerIds)
          .order('log_time', { ascending: false })
          .limit(1000);

        if (logsError) {
          if (import.meta.env.DEV) {
            console.error('❌ Error fetching attendance logs:', logsError);
            console.error('❌ Error details:', JSON.stringify(logsError, null, 2));
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('📋 Fetched attendance logs:', logsData?.length || 0);
            if (logsData && logsData.length > 0) {
              console.log('📋 Sample log data:', logsData[0]);
            }
          }
          
          // Get unique site IDs from logs
          const siteIds = [...new Set((logsData || []).map((log: any) => log.site_id).filter(Boolean))];
          
          // Fetch site details
          let sitesMap = new Map<string, any>();
          if (siteIds.length > 0) {
            const { data: sitesData, error: sitesError } = await supabase
              .from('sites')
              .select('id, name, type, address, city, state, zip_code, latitude, longitude')
              .in('id', siteIds);
            
            if (sitesError) {
              if (import.meta.env.DEV) {
                console.error('❌ Error fetching sites:', sitesError);
              }
            } else {
              (sitesData || []).forEach((site: any) => {
                sitesMap.set(site.id, site);
              });
              if (import.meta.env.DEV) {
                console.log('📍 Fetched sites:', sitesData?.length || 0);
              }
            }
          }
          
          // Attach site data to logs
          const logsWithSites = (logsData || []).map((log: any) => ({
            ...log,
            site: log.site_id ? sitesMap.get(log.site_id) : null
          }));
          
          // Get the latest log for each worker
          const logsByWorker = new Map<string, any>();
          logsWithSites.forEach((log: any) => {
            if (!logsByWorker.has(log.worker_id)) {
              logsByWorker.set(log.worker_id, log);
            }
          });
          
          latestLogs = Array.from(logsByWorker.values());
          if (import.meta.env.DEV) {
            console.log('📍 Latest logs by worker:', latestLogs.length);
            if (latestLogs.length > 0) {
              console.log('📍 Sample latest log:', latestLogs[0]);
            }
          }
        }
      }
      
      if (import.meta.env.DEV) {
        console.log('📊 Final latestLogs array length:', latestLogs.length);
      }

      // Map workers to WhosWorkingEmployee interface
      const mappedEmployees: WhosWorkingEmployee[] = (workersData || []).map((worker: any) => {
        const latestLog = latestLogs.find((log: any) => log.worker_id === worker.id);
        
        const status = mapStatus(worker.current_status || 'out', worker.is_active, worker.archived);
        
        // Get location from site - build full address
        let location = 'N/A';
        let latitude: number | undefined;
        let longitude: number | undefined;
        
        if (latestLog?.site) {
          const site = latestLog.site;
          const siteType = site.type?.toLowerCase();
          
          // Check if it's a manual entry site
          if (siteType === 'manual' || siteType === 'manual_entry' || siteType === 'manual-entry') {
            // For manual entry, use raw_message if available
            if (latestLog.raw_message) {
              location = `Manual Entry: ${latestLog.raw_message}`;
            } else {
              location = 'Manual Entry';
            }
          } else {
            // Build location string from site address components
            const addressParts: string[] = [];
            if (site.address) addressParts.push(site.address);
            if (site.city) addressParts.push(site.city);
            if (site.state) addressParts.push(site.state);
            if (site.zip_code) addressParts.push(site.zip_code);
            
            if (addressParts.length > 0) {
              location = addressParts.join(', ');
            } else if (site.name) {
              location = site.name;
            }
          }
          
          // Use coordinates from log if available (priority), otherwise use site coordinates
          // For manual entries, coordinates should come from the log
          if (latestLog.latitude != null && latestLog.longitude != null) {
            latitude = Number(latestLog.latitude);
            longitude = Number(latestLog.longitude);
          } else if (site.latitude != null && site.longitude != null) {
            latitude = Number(site.latitude);
            longitude = Number(site.longitude);
          }
        } else if (latestLog) {
          // If we have a log but no site, check if it has raw_message (likely manual entry)
          if (latestLog.raw_message) {
            location = `Manual Entry: ${latestLog.raw_message}`;
          }
          // Always try to get coordinates from log if available
          if (latestLog.latitude != null && latestLog.longitude != null) {
            latitude = Number(latestLog.latitude);
            longitude = Number(latestLog.longitude);
            if (!location || location === 'N/A') {
              location = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
            }
          }
        }

        // Get last activity info
        const lastActivity = latestLog ? mapLastActivity(latestLog.log_type) : 'clock-out';
        const lastActivityInfo = latestLog ? formatActivity(latestLog.log_type, latestLog.log_time) : { action: 'N/A', dateTime: '' };
        const lastActivityTime = latestLog ? `${lastActivityInfo.action}|${lastActivityInfo.dateTime}` : 'N/A|';

        // Get department name
        const departmentName = (worker.department as any)?.name || '';
        // Get job title name
        const jobTitleName = (worker.job_title as any)?.name || worker.position || '';

        if (import.meta.env.DEV && latestLog) {
          console.log(`Worker ${worker.first_name} ${worker.last_name}:`, {
            hasLog: !!latestLog,
            hasSite: !!latestLog?.site,
            siteType: latestLog?.site?.type,
            rawMessage: latestLog?.raw_message,
            location,
            latitude,
            longitude,
            lastActivity,
            lastActivityTime,
          });
        }

        return {
          id: worker.id,
          firstName: worker.first_name || '',
          lastName: worker.last_name || '',
          email: worker.email || '',
          jobTitle: jobTitleName,
          department: departmentName,
          status,
          current_status: worker.current_status || 'out',
          location,
          lastActivityTime,
          lastActivity,
          activityDetails: '',
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
