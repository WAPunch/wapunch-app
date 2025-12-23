import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';
import { logger } from '../lib/logger';

export interface AttendanceLog {
  id: string;
  workerId: string;
  logType: 'check_in' | 'check_out' | 'start_break' | 'end_break' | 'start_transfer' | 'end_transfer';
  logTime: string;
  siteId: string;
  siteName: string;
}

export interface AttendanceSummarySession {
  id: string;
  workerId: string;
  sessionType: 'work' | 'break' | 'transfer';
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  siteId: string;
  siteName: string;
}

export interface WorkerAttendanceData {
  workerId: string;
  workerName: string;
  department: string;
  jobTitle: string;
  currentStatus: 'out' | 'in' | 'on_break' | 'on_transfer';
  logs: AttendanceLog[];
  summarySessions: AttendanceSummarySession[];
  firstClockIn: string | null;
  lastClockOut: string | null;
  totalWorkHours: number;
  totalBreakMinutes: number;
  totalTransferMinutes: number;
  primaryLocation: string;
}

interface UseAttendanceResult {
  workers: WorkerAttendanceData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAttendance = (selectedDate: string): UseAttendanceResult => {
  const { currentCompany } = useCompany();
  const [workers, setWorkers] = useState<WorkerAttendanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = async () => {
    if (!currentCompany?.id) {
      setWorkers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Calculate date range for the selected date (00:00:00 to 23:59:59)
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      if (import.meta.env.DEV) {
        console.log('📅 Fetching attendance for date:', selectedDate);
      }

      // Step 1: Fetch ALL workers for the company
      const { data: allWorkers, error: workersError } = await supabase
        .from('workers')
        .select(`
          id,
          first_name,
          last_name,
          current_status,
          department:departments(name),
          job_title:job_titles(name)
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false)
        .order('first_name', { ascending: true });

      if (workersError) {
        throw workersError;
      }

      // Step 2: Fetch attendance_logs for the date
      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select(`
          id,
          worker_id,
          log_type,
          log_time,
          site_id,
          site:sites(site_name)
        `)
        .eq('company_id', currentCompany.id)
        .gte('log_time', startOfDay.toISOString())
        .lte('log_time', endOfDay.toISOString())
        .order('log_time', { ascending: true });

      if (logsError) {
        throw logsError;
      }

      // Step 3: Fetch attendance_summary for the date
      const { data: summaryData, error: summaryError } = await supabase
        .from('attendance_summary')
        .select(`
          id,
          worker_id,
          session_type,
          start_time,
          end_time,
          duration_seconds,
          site_id,
          site:sites(site_name)
        `)
        .eq('company_id', currentCompany.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (summaryError) {
        throw summaryError;
      }

      if (import.meta.env.DEV) {
        console.log('📦 Data received:', {
          workers: allWorkers?.length || 0,
          logs: logsData?.length || 0,
          summary: summaryData?.length || 0
        });
      }

      // Step 4: Map logs
      const logsByWorker = (logsData || []).reduce((acc, log: any) => {
        if (!log.worker_id) return acc;
        if (!acc[log.worker_id]) {
          acc[log.worker_id] = [];
        }
        const workerLogs = acc[log.worker_id];
        if (workerLogs) {
          workerLogs.push({
            id: log.id,
            workerId: log.worker_id,
            logType: log.log_type,
            logTime: log.log_time,
            siteId: log.site_id,
            siteName: (log.site as any)?.site_name || 'Unknown Site'
          });
        }
        return acc;
      }, {} as Record<string, AttendanceLog[]>);

      // Step 5: Map summary sessions
      const summaryByWorker = (summaryData || []).reduce((acc, session: any) => {
        if (!session.worker_id) return acc;
        if (!acc[session.worker_id]) {
          acc[session.worker_id] = [];
        }
        const workerSessions = acc[session.worker_id];
        if (workerSessions) {
          workerSessions.push({
            id: session.id,
            workerId: session.worker_id,
            sessionType: session.session_type,
            startTime: session.start_time,
            endTime: session.end_time,
            durationSeconds: session.duration_seconds,
            siteId: session.site_id,
            siteName: (session.site as any)?.site_name || 'Unknown Site'
          });
        }
        return acc;
      }, {} as Record<string, AttendanceSummarySession[]>);

      // Step 6: Combine all workers with their attendance data
      const mappedWorkers: WorkerAttendanceData[] = (allWorkers || []).map((worker: any) => {
        const workerId = worker.id;
        const logs = logsByWorker[workerId] || [];
        const summarySessions = summaryByWorker[workerId] || [];

        // Find first 'check_in' log and last 'check_out' log
        const inLogs = logs.filter(l => l.logType === 'check_in').sort((a, b) => a.logTime.localeCompare(b.logTime));
        const outLogs = logs.filter(l => l.logType === 'check_out').sort((a, b) => b.logTime.localeCompare(a.logTime));
        
        const firstClockIn = inLogs.length > 0 && inLogs[0] ? inLogs[0].logTime : null;
        const lastClockOut = outLogs.length > 0 && outLogs[0] ? outLogs[0].logTime : null;

        // Calculate totals from summary
        const workSessions = summarySessions.filter(s => s.sessionType === 'work');
        const breakSessions = summarySessions.filter(s => s.sessionType === 'break');
        const transferSessions = summarySessions.filter(s => s.sessionType === 'transfer');

        const totalWorkHours = workSessions.reduce((sum, s) => sum + ((s.durationSeconds || 0) / 3600), 0);
        const totalBreakMinutes = breakSessions.reduce((sum, s) => sum + ((s.durationSeconds || 0) / 60), 0);
        const totalTransferMinutes = transferSessions.reduce((sum, s) => sum + ((s.durationSeconds || 0) / 60), 0);

        // Get primary location (most common site from work sessions, or first log site)
        const siteCounts: Record<string, number> = {};
        workSessions.forEach(s => {
          siteCounts[s.siteName] = (siteCounts[s.siteName] || 0) + 1;
        });
        const primaryLocation = Object.entries(siteCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 
          (logs.length > 0 && logs[0] ? logs[0].siteName : 'Unknown');

        const department = (worker.department as any)?.name || '';
        const jobTitle = (worker.job_title as any)?.name || '';

        return {
          workerId,
          workerName: `${worker.first_name || ''} ${worker.last_name || ''}`.trim() || 'Unknown Worker',
          department,
          jobTitle,
          currentStatus: worker.current_status || 'out',
          logs,
          summarySessions,
          firstClockIn,
          lastClockOut,
          totalWorkHours,
          totalBreakMinutes,
          totalTransferMinutes,
          primaryLocation
        };
      });

      setWorkers(mappedWorkers);
      logger.info('Attendance data loaded', { 
        count: mappedWorkers.length, 
        companyId: currentCompany.id,
        date: selectedDate 
      });
    } catch (err: any) {
      logger.error('Error loading attendance data', err);
      setError(err?.message || 'Failed to load attendance');
      setWorkers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [currentCompany?.id, selectedDate]);

  return {
    workers,
    isLoading,
    error,
    refetch: fetchAttendance,
  };
};
