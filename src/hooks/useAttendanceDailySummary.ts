import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './useCompany';

export interface DailySummaryRecord {
  id: string;
  attendance_day_id: string;
  worker_id: string;
  work_date: string;
  expected_minutes: number | null;
  expected_source: string | null;
  worked_minutes: number;
  break_minutes: number;
  transfer_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  is_time_off: boolean;
  is_modified: boolean;
  has_late: boolean;
  has_early_leave: boolean;
  has_overtime: boolean;
  // Joined worker data
  worker_first_name: string;
  worker_last_name: string;
  worker_code: string | null;
  department_name: string | null;
  job_title_name: string | null;
  site_name: string | null;
}

interface UseAttendanceDailySummaryResult {
  records: DailySummaryRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAttendanceDailySummary = (workDate: string): UseAttendanceDailySummaryResult => {
  const { currentCompany } = useCompany();
  const [records, setRecords] = useState<DailySummaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    if (!currentCompany?.id || !workDate) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Query attendance_daily_summary with worker joins
      const { data, error: fetchError } = await supabase
        .from('attendance_daily_summary')
        .select(`
          *,
          worker:workers!inner(
            first_name,
            last_name,
            worker_code,
            department:departments(name),
            job_title:job_titles(name)
          ),
          attendance_day:attendance_days!inner(
            id
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('work_date', workDate)
        .order('worker_id');

      if (fetchError) throw fetchError;

      // Map to interface
      const mappedRecords: DailySummaryRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        attendance_day_id: row.attendance_day_id,
        worker_id: row.worker_id,
        work_date: row.work_date,
        expected_minutes: row.expected_minutes,
        expected_source: row.expected_source,
        worked_minutes: row.worked_minutes || 0,
        break_minutes: row.break_minutes || 0,
        transfer_minutes: row.transfer_minutes || 0,
        late_minutes: row.late_minutes || 0,
        early_leave_minutes: row.early_leave_minutes || 0,
        overtime_minutes: row.overtime_minutes || 0,
        is_time_off: row.is_time_off || false,
        is_modified: row.is_modified || false,
        has_late: row.has_late || false,
        has_early_leave: row.has_early_leave || false,
        has_overtime: row.has_overtime || false,
        worker_first_name: row.worker?.first_name || '',
        worker_last_name: row.worker?.last_name || '',
        worker_code: row.worker?.worker_code || null,
        department_name: row.worker?.department?.name || null,
        job_title_name: row.worker?.job_title?.name || null,
        site_name: null
      }));

      setRecords(mappedRecords);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [currentCompany?.id, workDate]);

  return {
    records,
    isLoading,
    error,
    refetch: fetchRecords,
  };
};

