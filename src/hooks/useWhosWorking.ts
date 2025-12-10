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
  employees: WhosWorkingEmployee[];
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
  const [employees, setEmployees] = useState<WhosWorkingEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    if (!currentCompany?.id) {
      setEmployees([]);
      setIsLoading(false);
      return;
    }

    try {
      if (employees.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      if (import.meta.env.DEV) {
        console.log('🔍 Fetching who\'s working for company:', currentCompany.id);
      }

      // Fetch employees with their current status
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select(`
          id,
          first_name,
          last_name,
          position,
          current_status,
          is_active,
          archived,
          whatsapp_number,
          user_id
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .order('first_name', { ascending: true });

      if (employeesError) {
        if (import.meta.env.DEV) {
          console.error('❌ Error fetching employees:', employeesError);
        }
        throw employeesError;
      }

      // Fetch latest attendance log for each employee
      const employeeIds = (employeesData || []).map((emp: any) => emp.id);
      
      let latestLogs: any[] = [];
      if (employeeIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('attendance_logs')
          .select(`
            id,
            employee_id,
            log_type,
            log_time,
            latitude,
            longitude,
            source,
            branch_id,
            branch:branches(branch_name, branch_address)
          `)
          .in('employee_id', employeeIds)
          .order('log_time', { ascending: false });

        if (logsError) {
          if (import.meta.env.DEV) {
            console.warn('⚠️ Error fetching attendance logs:', logsError);
          }
        } else {
          // Get the latest log for each employee
          const logsByEmployee = new Map<string, any>();
          (logsData || []).forEach((log: any) => {
            if (!logsByEmployee.has(log.employee_id)) {
              logsByEmployee.set(log.employee_id, log);
            }
          });
          latestLogs = Array.from(logsByEmployee.values());
        }
      }

      // Map employees to WhosWorkingEmployee interface
      const mappedEmployees: WhosWorkingEmployee[] = (employeesData || []).map((emp: any) => {
        const latestLog = latestLogs.find((log: any) => log.employee_id === emp.id);
        
        const status = mapStatus(emp.current_status || 'out', emp.is_active, emp.archived);
        
        // Get location from branch or default
        let location = 'N/A';
        let latitude: number | undefined;
        let longitude: number | undefined;
        
        if (latestLog?.branch) {
          location = latestLog.branch.branch_name || latestLog.branch.branch_address || 'N/A';
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
          id: emp.id,
          firstName: emp.first_name || '',
          lastName: emp.last_name || '',
          email: '', // Email would need to come from profiles table or auth.users via RPC
          jobTitle: emp.position || 'Employee',
          department: '', // Department not in employees table
          status,
          location,
          lastActivityTime,
          lastActivity,
          activityDetails,
          phone: emp.whatsapp_number || undefined,
          latitude,
          longitude,
        };
      });

      setEmployees(mappedEmployees);
      logger.info('Who\'s working data loaded', { count: mappedEmployees.length, companyId: currentCompany.id });
    } catch (err: any) {
      logger.error('Error loading who\'s working data', err);
      setError(err?.message || 'Failed to load who\'s working data');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [currentCompany?.id]);

  return {
    employees,
    isLoading,
    error,
    refetch: fetchEmployees,
  };
};

