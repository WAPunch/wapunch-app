import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AttendanceSession {
  id: string;
  attendance_day_id: string;
  session_type: 'work' | 'break' | 'transfer' | 'time_off';
  start_time: string;
  end_time: string;
  duration_minutes: number;
  source: string;
  is_modified: boolean;
  crosses_midnight: boolean;
  notes: string | null;
  modified_by: string | null;
  modified_at: string | null;
  start_site_id?: string | null;
  end_site_id?: string | null;
  location_inconsistent?: boolean;
  inconsistency_reason?: string | null;
}

interface UseAttendanceSessionsResult {
  sessions: AttendanceSession[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useAttendanceSessions = (
  attendanceDayId: string | null
): UseAttendanceSessionsResult => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!attendanceDayId) {
      setSessions([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('attendance_sessions')
        .select(
          'id, attendance_day_id, session_type, start_time, end_time, duration_minutes, source, is_modified, crosses_midnight, notes, modified_by, modified_at, start_site_id, end_site_id, location_inconsistent, inconsistency_reason'
        )
        .eq('attendance_day_id', attendanceDayId)
        .order('start_time');

      if (fetchError) throw fetchError;

      setSessions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [attendanceDayId]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
  };
};

