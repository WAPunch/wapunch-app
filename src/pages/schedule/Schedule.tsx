import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { getCurrentStatusDotColor } from '../../hooks/useWorkers';
import { useCompany } from '../../hooks/useCompany';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Users, 
  Plus, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Bell,
  Copy,
  Wand2,
  EyeOff,
  Download,
  Upload,
  Share2,
  Menu,
  Printer,
  FileSpreadsheet,
  CalendarX,
  Settings,
  AlertTriangle,
  CheckCircle,
  User,
  MoreVertical,
  Edit,
  Trash2,
  Eraser,
  Eye,
  Flag,
  SortAsc,
  SortDesc,
  X
} from 'lucide-react';

// Function to generate avatar initials
const generateAvatarInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Function to get proportional dot size based on avatar size
const getDotSize = (avatarSize: 'sm' | 'md' | 'lg') => {
  switch (avatarSize) {
    case 'sm': // w-8 h-8 (32px)
      return 'w-2.5 h-2.5'; // 10px
    case 'md': // w-10 h-10 (40px)
      return 'w-3 h-3'; // 12px
    case 'lg': // w-12 h-12 (48px)
      return 'w-3.5 h-3.5'; // 14px
    default:
      return 'w-2.5 h-2.5';
  }
};


interface Employee {
  id: string;
  name: string;
  role: string; // Job title
  department: string;
  workerType?: string; // 'employee' | 'contractor'
  avatar?: string;
  status: string;
  current_status?: 'out' | 'in' | 'on_break' | 'on_transfer';
  availability: {
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
    saturday: string[];
    sunday: string[];
  };
  qualifications: string[];
  hourlyRate: number;
  maxHoursPerWeek: number;
}

interface Shift {
  id: string;
  workerId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  location: string;
  status: 'draft' | 'published';
  notes?: string;
  breakMinutes?: number;
  isOvertimeAllowed?: boolean;
  isDelete?: boolean; // Draft delete intent
  originalPublishedId?: string; // ID of the published shift this delete intent targets
}

type PlannedShiftRow = {
  id: string;
  company_id: string;
  worker_id: string;
  site_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  break_minutes?: number | null;
  is_overtime_allowed?: boolean | null;
  notes?: string | null;
  is_delete?: boolean | null;
  edited_published_shift_id?: string | null;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
  archived: boolean | null;
  worker_type?: string | null;
  job_title?: { name: string } | { name: string }[] | null;
};

type SiteRow = { id: string; site_name: string | null };

type WorkerWorkRuleRow = {
  worker_id: string;
  rule_type: string | null;
  fixed_schedule_id: string | null;
  start_date: string | null;
  end_date: string | null;
};

type FixedScheduleRow = {
  id: string;
  company_id: string;
  name: string;
  fixed_schedule_days?: FixedScheduleDayRow[];
};

type FixedScheduleDayRow = {
  id: string;
  fixed_schedule_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
};

function normalizeTime(value: string): string {
  // Supabase time columns often come back as "HH:MM:SS". UI expects "HH:MM".
  if (!value) return '';
  if (value.length >= 5 && value[2] === ':') return value.slice(0, 5);
  return value;
}

export default function Schedule() {
  const { registerSubmodules } = useSubmoduleNav();
  const { currentCompany, currentCompanyUser } = useCompany();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [showMultipleShifts, setShowMultipleShifts] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [showEraseDraftsConfirm, setShowEraseDraftsConfirm] = useState(false);
  const [isErasingDrafts, setIsErasingDrafts] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingShift, setIsDeletingShift] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  
  // Create shift modal form state (Single Shift)
  const [shiftForm, setShiftForm] = useState({
    workerId: '',
    shiftDate: '',
    startTime: '',
    endTime: '',
    siteId: '',
    shiftTitle: '',
    notes: '',
    breakMinutes: 0,
    isOvertimeAllowed: false,
    isRepeating: false,
    repeatFrequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    repeatEndDate: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [shiftFormError, setShiftFormError] = useState<string | null>(null);
  
  // Multiple shifts form state
  const [multipleShifts, setMultipleShifts] = useState<Array<{
    id: string;
    workerId: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    siteId: string;
    shiftTitle: string;
    notes: string;
    breakMinutes: number;
    isOvertimeAllowed: boolean;
  }>>([{
    id: `row-${Date.now()}`,
    workerId: '',
    shiftDate: '',
    startTime: '',
    endTime: '',
    siteId: '',
    shiftTitle: '',
    notes: '',
    breakMinutes: 0,
    isOvertimeAllowed: false,
  }]);
  const [isCreatingMultipleShifts, setIsCreatingMultipleShifts] = useState(false);
  const [multipleShiftsError, setMultipleShiftsError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [allShiftsRaw, setAllShiftsRaw] = useState<PlannedShiftRow[]>([]); // All shifts including cancelled for counting
  const [sitesById, setSitesById] = useState<Record<string, string>>({});
  const [workRuleTypeByWorkerId, setWorkRuleTypeByWorkerId] = useState<Record<string, string>>({});
  const [fixedScheduleIdByWorkerId, setFixedScheduleIdByWorkerId] = useState<Record<string, string>>({});
  const [workRuleDateRangeByWorkerId, setWorkRuleDateRangeByWorkerId] = useState<Record<string, { start_date: string | null; end_date: string | null }>>({});
  const [fixedSchedules, setFixedSchedules] = useState<FixedScheduleRow[]>([]);
  
  // Multi-select filter states
  const [selectedWorkerType, setSelectedWorkerType] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string[]>([]);
  const [selectedWorkRule, setSelectedWorkRule] = useState<string[]>([]);
  
  // Dropdown visibility states
  const [showWorkerTypeDropdown, setShowWorkerTypeDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [showWorkRuleDropdown, setShowWorkRuleDropdown] = useState(false);
  
  // Search terms within dropdowns
  const [workerTypeSearchTerm, setWorkerTypeSearchTerm] = useState('');
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [jobTitleSearchTerm, setJobTitleSearchTerm] = useState('');
  const [workRuleSearchTerm, setWorkRuleSearchTerm] = useState('');
  
  // Action buttons states
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // Refs for dropdown containers to detect outside clicks
  const workerTypeDropdownRef = useRef<HTMLDivElement>(null);
  const departmentDropdownRef = useRef<HTMLDivElement>(null);
  const jobTitleDropdownRef = useRef<HTMLDivElement>(null);
  const workRuleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workerTypeDropdownRef.current && !workerTypeDropdownRef.current.contains(event.target as Node)) {
        setShowWorkerTypeDropdown(false);
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target as Node)) {
        setShowDepartmentDropdown(false);
      }
      if (jobTitleDropdownRef.current && !jobTitleDropdownRef.current.contains(event.target as Node)) {
        setShowJobTitleDropdown(false);
      }
      if (workRuleDropdownRef.current && !workRuleDropdownRef.current.contains(event.target as Node)) {
        setShowWorkRuleDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Sorting states
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'role'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    // Register submodule tabs for Schedule
      registerSubmodules('Schedule', [
        { id: 'schedule', label: 'Schedule', href: '/schedule/schedule', icon: Calendar },
        { id: 'time-off', label: 'Time Off', href: '/schedule/time-off', icon: Calendar },
    ]);
  }, [registerSubmodules]);

  const weekRange = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start, Sunday end
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      startISO: start.toISOString().slice(0, 10),
      endISO: end.toISOString().slice(0, 10),
    };
  }, [currentDate]);

  // Extract load function to be reusable
  const loadScheduleData = useCallback(async () => {
    if (!currentCompany?.id) {
      setEmployees([]);
      setShifts([]);
      setAllShiftsRaw([]);
      setSitesById({});
      setWorkRuleTypeByWorkerId({});
      setLoadError(null);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setLoadError(null);

    try {
      const [workersRes, sitesRes, rulesRes, fixedSchedulesRes, shiftsRes] = await Promise.all([
        supabase
          .from('workers')
          .select('id, first_name, last_name, is_active, archived, worker_type, job_title:job_titles(name)')
          .eq('company_id', currentCompany.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('sites')
          .select('id, site_name')
          .eq('company_id', currentCompany.id)
          .eq('is_deleted', false)
          .eq('archived', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('worker_work_rules')
          .select('worker_id, rule_type, fixed_schedule_id, start_date, end_date')
          .eq('company_id', currentCompany.id)
          .order('start_date', { ascending: false }),
        supabase
          .from('fixed_schedules')
          .select(`
            id,
            company_id,
            name,
            fixed_schedule_days (
              id,
              fixed_schedule_id,
              day_of_week,
              is_working,
              start_time,
              end_time,
              break_minutes
            )
          `)
          .eq('company_id', currentCompany.id),
        supabase
          .from('planned_shifts')
          .select('id, company_id, worker_id, site_id, shift_date, start_time, end_time, shift_type, status, published_at, created_at, break_minutes, is_overtime_allowed, notes, is_delete, edited_published_shift_id')
          .eq('company_id', currentCompany.id)
          .gte('shift_date', weekRange.startISO)
          .lte('shift_date', weekRange.endISO)
          .order('shift_date', { ascending: true })
          .order('start_time', { ascending: true }),
      ]);

      if (workersRes.error) throw workersRes.error;
      if (sitesRes.error) throw sitesRes.error;
      if (rulesRes.error) throw rulesRes.error;
      if (fixedSchedulesRes.error) throw fixedSchedulesRes.error;
      if (shiftsRes.error) throw shiftsRes.error;

      const siteMap: Record<string, string> = {};
      for (const s of (sitesRes.data || []) as SiteRow[]) {
        if (s?.id && s?.site_name) siteMap[s.id] = s.site_name;
      }
      setSitesById(siteMap);

      // Pick the latest rule per worker (rules are ordered by start_date DESC).
      const ruleMap: Record<string, string> = {};
      const fixedScheduleMap: Record<string, string> = {};
      const dateRangeMap: Record<string, { start_date: string | null; end_date: string | null }> = {};
      for (const r of (rulesRes.data || []) as WorkerWorkRuleRow[]) {
        if (!r?.worker_id) continue;
        if (ruleMap[r.worker_id]) continue;
        if (r.rule_type) {
          // Normalize rule_type: ensure it's one of the valid enum values
          let normalizedRuleType = r.rule_type;
          // Fix any incorrect values (e.g., "fixed_schedule" -> "fixed")
          if (normalizedRuleType === 'fixed_schedule' || normalizedRuleType === 'fixedSchedule') {
            normalizedRuleType = 'fixed';
          }
          // Only set if it's a valid enum value
          if (normalizedRuleType === 'fixed' || normalizedRuleType === 'planned' || normalizedRuleType === 'open') {
            ruleMap[r.worker_id] = normalizedRuleType;
            dateRangeMap[r.worker_id] = { start_date: r.start_date ?? null, end_date: r.end_date ?? null };
          } else {
            console.warn(`Invalid rule_type value for worker ${r.worker_id}: ${r.rule_type}, skipping`);
          }
        }
        if (r.fixed_schedule_id) fixedScheduleMap[r.worker_id] = r.fixed_schedule_id;
      }
      setWorkRuleTypeByWorkerId(ruleMap);
      setFixedScheduleIdByWorkerId(fixedScheduleMap);
      setWorkRuleDateRangeByWorkerId(dateRangeMap);

      const mappedEmployees: Employee[] = ((workersRes.data || []) as WorkerRow[])
        .filter(w => Boolean(w?.id))
        .filter(w => (w.is_active ?? false) && !(w.archived ?? false))
        .map(w => {
          const first = (w.first_name || '').trim();
          const last = (w.last_name || '').trim();
          const fullName = `${first} ${last}`.trim();
          const jobTitleObj = w.job_title as any;
          const jobTitle = Array.isArray(jobTitleObj) 
            ? (jobTitleObj[0]?.name || '')
            : (jobTitleObj?.name || '');

          return {
            id: w.id,
            name: fullName || 'Unnamed worker',
            role: jobTitle,
            department: '',
            workerType: w.worker_type || 'employee',
            status: 'absent',
            current_status: 'out',
            availability: {
              monday: [],
              tuesday: [],
              wednesday: [],
              thursday: [],
              friday: [],
              saturday: [],
              sunday: [],
            },
            qualifications: [],
            hourlyRate: 0,
            maxHoursPerWeek: 0,
          };
        });
      setEmployees(mappedEmployees);

      // Store fixed schedules
      setFixedSchedules((fixedSchedulesRes.data || []) as unknown as FixedScheduleRow[]);

      // Filter shifts by role: admin/supervisor see drafts+published, employee only published
      const userRole = currentCompanyUser?.role;
      const canSeeDrafts = userRole === 'super_admin' || userRole === 'admin' || userRole === 'supervisor';
      
      const allShifts = (shiftsRes.data || []) as PlannedShiftRow[];
      setAllShiftsRaw(allShifts); // Store all shifts for counting
      
      // For calendar display: show published and drafts
      // Published shifts with is_delete = true are shown as delete intents (red)
      // Draft delete intents (legacy) are also shown
      // Hide published shifts that have a draft linked to them (being edited)
      const publishedShiftIdsWithDrafts = new Set(
        allShifts
          .filter(s => s.status === 'draft' && s.edited_published_shift_id)
          .map(s => s.edited_published_shift_id)
          .filter((id): id is string => id !== null && id !== undefined)
      );
      
      const shiftsForCalendar = canSeeDrafts
        ? allShifts.filter(s => {
            // Hide published shifts that have a draft linked to them
            if (s.status === 'published' && publishedShiftIdsWithDrafts.has(s.id)) {
              return false;
            }
            return true;
          })
        : allShifts.filter(s => s.status === 'published' && !s.is_delete && !publishedShiftIdsWithDrafts.has(s.id)); // Employee: only published, no delete intents, no hidden by drafts
      
      // Map shifts and identify delete intents
      // Delete intents can be:
      // 1. Published shifts with is_delete = true (marked for deletion)
      // 2. Draft shifts with is_delete = true (legacy, should be cleaned up)
      const mappedShifts: Shift[] = shiftsForCalendar.map((s) => {
        const siteName = (s.site_id && siteMap[s.site_id]) || 'Unassigned site';
        const isDeleteIntent = s.is_delete === true; // Can be published or draft
        
        return {
          id: s.id,
          workerId: s.worker_id,
          date: s.shift_date,
          startTime: normalizeTime(s.start_time),
          endTime: normalizeTime(s.end_time),
          role: siteName,
          location: siteName,
          status: s.status || 'draft',
          notes: s.notes || undefined,
          breakMinutes: s.break_minutes || 0,
          isOvertimeAllowed: s.is_overtime_allowed || false,
          isDelete: isDeleteIntent,
          originalPublishedId: s.edited_published_shift_id || undefined,
        };
      });
      setShifts(mappedShifts);
    } catch (err: any) {
      logger.error('Error loading schedule data', err);
      setLoadError(err?.message || 'Error loading schedule data');
      setEmployees([]);
      setShifts([]);
      setAllShiftsRaw([]);
      setSitesById({});
      setWorkRuleTypeByWorkerId({});
    } finally {
      setIsLoadingData(false);
    }
  }, [currentCompany?.id, currentCompanyUser?.role, weekRange.startISO, weekRange.endISO]);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowActionsDropdown(false);
        setShowAddDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle Publish: drafts → published, delete published shifts with delete intents, remove delete intents (only for filtered workers)
  const handlePublish = async () => {
    if (!currentCompany?.id || pendingChangesCount === 0) return;

    try {
      setIsLoadingData(true);
      
      // Get IDs of filtered workers (only those displayed in the table)
      const filteredWorkerIdsSet = new Set(filteredEmployees.map(emp => emp.id));
      
      // Separate regular drafts from delete intents (legacy draft delete intents) - only for filtered workers
      const allDrafts = allShiftsRaw.filter(s => 
        s.status === 'draft' &&
        filteredWorkerIdsSet.has(s.worker_id) &&
        s.shift_date >= weekRange.startISO && 
        s.shift_date <= weekRange.endISO
      );
      const legacyDeleteIntents = allDrafts.filter(s => s.is_delete === true);
      const regularDrafts = allDrafts.filter(s => !s.is_delete);
      
      // Get published shifts marked for deletion (is_delete = true) - only for filtered workers
      const publishedShiftsMarkedForDeletion = allShiftsRaw
        .filter(s => 
          s.status === 'published' && 
          s.is_delete === true &&
          filteredWorkerIdsSet.has(s.worker_id) &&
          s.shift_date >= weekRange.startISO && 
          s.shift_date <= weekRange.endISO
        )
        .map(s => s.id);

      // Update regular drafts to published FIRST (before deleting originals)
      // This ensures the new published shifts are not accidentally deleted
      // Also clear edited_published_shift_id since the original published shift will be deleted
      const regularDraftIds = regularDrafts.map(s => s.id);
      if (regularDraftIds.length > 0) {
        const { error } = await supabase
          .from('planned_shifts')
          .update({ 
            status: 'published',
            published_at: new Date().toISOString(),
            is_delete: false, // Ensure new published shifts don't have is_delete
            edited_published_shift_id: null // Clear the reference since original will be deleted
          })
          .in('id', regularDraftIds);
        
        if (error) throw error;
      }

      // Delete published shifts that are being replaced by drafts with edited_published_shift_id
      // Simply get the IDs from edited_published_shift_id of the drafts we just published
      const publishedShiftsToDelete = regularDrafts
        .filter(d => d.edited_published_shift_id)
        .map(d => d.edited_published_shift_id)
        .filter((id): id is string => id !== null && id !== undefined);

      // Delete published shifts that are being replaced or marked for deletion
      // IMPORTANT: Only delete the ORIGINAL published shifts, not the newly published drafts
      // Exclude any IDs that are in regularDraftIds (the drafts we just published)
      const allPublishedToDelete = [...new Set([...publishedShiftsToDelete, ...publishedShiftsMarkedForDeletion])]
        .filter(id => !regularDraftIds.includes(id)); // Exclude drafts we just published
      
      if (allPublishedToDelete.length > 0) {
        const { error } = await supabase
          .from('planned_shifts')
          .delete()
          .in('id', allPublishedToDelete);
        
        if (error) throw error;
      }

      // Delete legacy draft delete intents (they've served their purpose)
      const legacyDeleteIntentIds = legacyDeleteIntents.map(s => s.id);
      if (legacyDeleteIntentIds.length > 0) {
        const { error } = await supabase
          .from('planned_shifts')
          .delete()
          .in('id', legacyDeleteIntentIds);
        
        if (error) throw error;
      }

      // Reload data using the shared function
      await loadScheduleData();
    } catch (err: any) {
      logger.error('Error publishing shifts', err);
      setLoadError(err?.message || 'Error publishing shifts');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handle Unpublish Week: delete all published shifts of the week (only for filtered workers)
  const handleUnpublishWeek = async () => {
    if (!currentCompany?.id) return;

    try {
      setIsUnpublishing(true);
      
      // Get IDs of filtered workers (only those displayed in the table)
      const filteredWorkerIds = new Set(filteredEmployees.map(emp => emp.id));
      
      // Get all published shifts for the current week, but only for filtered workers
      const publishedShifts = allShiftsRaw.filter(
        s => s.status === 'published' && 
        !s.is_delete &&
        s.shift_date >= weekRange.startISO && 
        s.shift_date <= weekRange.endISO &&
        filteredWorkerIds.has(s.worker_id)
      );

      if (publishedShifts.length === 0) {
        setLoadError('No published shifts found for the filtered workers in this week');
        setShowUnpublishConfirm(false);
        return;
      }

      // Delete all published shifts
      const shiftIds = publishedShifts.map(s => s.id);
      const { error } = await supabase
        .from('planned_shifts')
        .delete()
        .in('id', shiftIds);

      if (error) throw error;

      // Reload data
      await loadScheduleData();
      setShowUnpublishConfirm(false);
    } catch (err: any) {
      logger.error('Error unpublishing week', err);
      setLoadError(err?.message || 'Error unpublishing week');
    } finally {
      setIsUnpublishing(false);
    }
  };

  // Handle Erase Drafts: delete all drafts and restore published shifts marked for deletion (with confirmation)
  const handleEraseDrafts = async () => {
    if (!currentCompany?.id || pendingChangesCount === 0) return;

    try {
      setIsErasingDrafts(true);
      await handleCancel();
      setShowEraseDraftsConfirm(false);
    } catch (err: any) {
      logger.error('Error erasing drafts', err);
      setLoadError(err?.message || 'Error erasing drafts');
    } finally {
      setIsErasingDrafts(false);
    }
  };

  // Handle Cancel: delete all drafts and restore published shifts marked for deletion (only for filtered workers)
  const handleCancel = async () => {
    if (!currentCompany?.id || pendingChangesCount === 0) return;

    try {
      setIsLoadingData(true);
      
      // Get IDs of filtered workers (only those displayed in the table)
      const filteredWorkerIdsSet = new Set(filteredEmployees.map(emp => emp.id));
      
      // Delete all drafts (both regular drafts and legacy delete intents) - only for filtered workers
      const draftShifts = allShiftsRaw.filter(s => 
        s.status === 'draft' &&
        filteredWorkerIdsSet.has(s.worker_id) &&
        s.shift_date >= weekRange.startISO && 
        s.shift_date <= weekRange.endISO
      );
      const draftIds = draftShifts.map(s => s.id);
      
      if (draftIds.length > 0) {
        const { error } = await supabase
          .from('planned_shifts')
          .delete()
          .in('id', draftIds);

        if (error) throw error;
      }

      // Restore published shifts marked for deletion (set is_delete = false) - only for filtered workers
      const publishedShiftsMarkedForDeletion = allShiftsRaw
        .filter(s => 
          s.status === 'published' && 
          s.is_delete === true &&
          filteredWorkerIdsSet.has(s.worker_id) &&
          s.shift_date >= weekRange.startISO && 
          s.shift_date <= weekRange.endISO
        )
        .map(s => s.id);

      if (publishedShiftsMarkedForDeletion.length > 0) {
        const { error } = await supabase
          .from('planned_shifts')
          .update({ is_delete: false })
          .in('id', publishedShiftsMarkedForDeletion);

        if (error) throw error;
      }

      // Reload data using the shared function
      await loadScheduleData();
    } catch (err: any) {
      logger.error('Error cancelling drafts', err);
      setLoadError(err?.message || 'Error cancelling drafts');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Helper function to map status to current_status
  const mapStatusToCurrentStatus = (status: string): 'out' | 'in' | 'on_break' | 'on_transfer' => {
    switch (status) {
      case 'present':
        return 'in';
      case 'on-break':
        return 'on_break';
      case 'on-transfer':
        return 'on_transfer';
      default:
        return 'out';
    }
  };

  const canPlanShiftsForWorker = (workerId: string) => {
    const ruleType = workRuleTypeByWorkerId[workerId];
    // Backwards/forwards compat: codebase currently uses "planned"; user spec says "planner".
    return ruleType === 'planned' || ruleType === 'planner';
  };

  const hasFixedSchedule = (workerId: string) => {
    const ruleType = workRuleTypeByWorkerId[workerId];
    return ruleType === 'fixed';
  };

  const hasFlexibleSchedule = (workerId: string) => {
    const ruleType = workRuleTypeByWorkerId[workerId];
    return ruleType === 'flexible' || ruleType === 'open';
  };

  const hasNoWorkRule = (workerId: string) => {
    const ruleType = workRuleTypeByWorkerId[workerId];
    return !ruleType || ruleType === null || ruleType === undefined;
  };

  const isDateWithinWorkRuleRange = (workerId: string, dateISO: string): boolean => {
    const range = workRuleDateRangeByWorkerId[workerId];
    if (!range) return false;
    const start = range.start_date;
    const end = range.end_date;
    // Dates are YYYY-MM-DD, string compare works lexicographically.
    if (start && dateISO < start) return false;
    if (end && dateISO > end) return false;
    return true;
  };

  const getActiveWorkRuleTypeForDate = (workerId: string, dateISO: string): string | undefined => {
    const ruleType = workRuleTypeByWorkerId[workerId];
    if (!ruleType) return undefined;
    if (!isDateWithinWorkRuleRange(workerId, dateISO)) return undefined;
    return ruleType;
  };

  const getActiveFixedScheduleIdForDate = (workerId: string, dateISO: string): string | undefined => {
    const ruleType = getActiveWorkRuleTypeForDate(workerId, dateISO);
    if (ruleType !== 'fixed') return undefined;
    const fixedScheduleId = fixedScheduleIdByWorkerId[workerId];
    return fixedScheduleId || undefined;
  };

  // Get employees that can have shifts planned
  const employeesWithPlannedRule = useMemo(() => {
    return employees.filter(emp => canPlanShiftsForWorker(emp.id));
  }, [employees, workRuleTypeByWorkerId]);

  // Get sites list for dropdown
  const sitesList = useMemo(() => {
    return Object.entries(sitesById).map(([id, name]) => ({ id, name }));
  }, [sitesById]);

  // Open shift for editing
  const handleEditShift = (shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    // Extract notes/title from notes field if available
    const notes = shift.notes || '';
    const shiftTitle = notes.split('\n')[0] || '';
    const notesOnly = notes.includes('\n') ? notes.split('\n').slice(1).join('\n') : '';

    setShiftForm({
      workerId: shift.workerId,
      shiftDate: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      siteId: Object.keys(sitesById).find(id => sitesById[id] === shift.location) || '',
      shiftTitle: shiftTitle,
      notes: notesOnly || notes, // Use remaining notes or full notes if no title
      breakMinutes: shift.breakMinutes || 0,
      isOvertimeAllowed: shift.isOvertimeAllowed || false,
      isRepeating: false,
      repeatFrequency: 'weekly',
      repeatEndDate: '',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setEditingShiftId(shiftId);
    setShowCreateShift(true);
  };

  // Handle update shift
  const handleUpdateShift = async () => {
    if (!currentCompany?.id || !editingShiftId) return;

    // Validation (same as create)
    if (!shiftForm.workerId) {
      setShiftFormError('Please select a worker');
      return;
    }
    if (!shiftForm.shiftDate) {
      setShiftFormError('Please select a date');
      return;
    }
    if (!shiftForm.startTime) {
      setShiftFormError('Please specify start time');
      return;
    }
    if (!shiftForm.endTime) {
      setShiftFormError('Please specify end time');
      return;
    }
    if (!shiftForm.siteId) {
      setShiftFormError('Please select a site');
      return;
    }

    if (shiftForm.startTime >= shiftForm.endTime) {
      setShiftFormError('End time must be after start time');
      return;
    }

    try {
      setIsCreatingShift(true);
      setShiftFormError(null);

      // Format time to HH:MM:SS for Supabase
      const startTimeFormatted = `${shiftForm.startTime}:00`;
      const endTimeFormatted = `${shiftForm.endTime}:00`;

      // Get the original shift to check if it was published or a delete intent
      const originalShift = shifts.find(s => s.id === editingShiftId);
      const wasPublished = originalShift?.status === 'published';
      const wasDeleteIntent = originalShift?.isDelete === true;

      // If it was published with is_delete = true, restore it and update
      if (wasPublished && wasDeleteIntent) {
        // Restore the published shift (remove delete mark) and update it
        const { error } = await supabase
          .from('planned_shifts')
          .update({
            worker_id: shiftForm.workerId,
            site_id: shiftForm.siteId,
            shift_type: 'work',
            shift_date: shiftForm.shiftDate,
            start_time: startTimeFormatted,
            end_time: endTimeFormatted,
            is_delete: false, // Restore from delete intent
            break_minutes: shiftForm.breakMinutes || 0,
            is_overtime_allowed: true, // Overtime is always allowed
            notes: shiftForm.notes || shiftForm.shiftTitle || null,
          })
          .eq('id', editingShiftId);

        if (error) throw error;
      } else if (wasPublished && !wasDeleteIntent) {
        // If it was published (not marked for deletion), create a new draft instead of updating
        // Link the draft to the original published shift so we can hide the original
        const { error } = await supabase
          .from('planned_shifts')
          .insert({
            company_id: currentCompany.id,
            worker_id: shiftForm.workerId,
            site_id: shiftForm.siteId,
            shift_type: 'work',
            shift_date: shiftForm.shiftDate,
            start_time: startTimeFormatted,
            end_time: endTimeFormatted,
            status: 'draft',
            is_delete: false, // Explicitly set to false
            break_minutes: shiftForm.breakMinutes || 0,
            is_overtime_allowed: true, // Overtime is always allowed
            notes: shiftForm.notes || shiftForm.shiftTitle || null,
            edited_published_shift_id: editingShiftId, // Link to the original published shift
          });

        if (error) throw error;
        // Original published shift will be hidden because there's now a draft linked to it
      } else if (wasDeleteIntent && !wasPublished) {
        // If editing a draft delete intent (legacy), convert it to a regular draft
        const { error } = await supabase
          .from('planned_shifts')
          .update({
            worker_id: shiftForm.workerId,
            site_id: shiftForm.siteId,
            shift_type: 'work',
            shift_date: shiftForm.shiftDate,
            start_time: startTimeFormatted,
            end_time: endTimeFormatted,
            is_delete: false, // Convert from delete intent to regular draft
            break_minutes: shiftForm.breakMinutes || 0,
            is_overtime_allowed: true, // Overtime is always allowed
            notes: shiftForm.notes || shiftForm.shiftTitle || null,
          })
          .eq('id', editingShiftId);

        if (error) throw error;
      } else {
        // If it was already a regular draft, just update it
        const { error } = await supabase
          .from('planned_shifts')
          .update({
            worker_id: shiftForm.workerId,
            site_id: shiftForm.siteId,
            shift_type: 'work',
            shift_date: shiftForm.shiftDate,
            start_time: startTimeFormatted,
            end_time: endTimeFormatted,
            break_minutes: shiftForm.breakMinutes || 0,
            is_overtime_allowed: true, // Overtime is always allowed
            notes: shiftForm.notes || shiftForm.shiftTitle || null,
          })
          .eq('id', editingShiftId);

        if (error) throw error;
      }

      // Reset form and close modal
      setShiftForm({
        workerId: '',
        shiftDate: '',
        startTime: '',
        endTime: '',
        siteId: '',
        shiftTitle: '',
        notes: '',
        breakMinutes: 0,
        isOvertimeAllowed: false,
        isRepeating: false,
        repeatFrequency: 'weekly',
        repeatEndDate: '',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setEditingShiftId(null);
      setShowCreateShift(false);

      // Reload data
      await loadScheduleData();
    } catch (err: any) {
      logger.error('Error updating shift', err);
      setShiftFormError(err?.message || 'Error updating shift');
    } finally {
      setIsCreatingShift(false);
    }
  };

  // Handle delete shift - show confirmation modal for both published and draft shifts
  const handleDeleteShiftClick = () => {
    if (!editingShiftId) return;

    const shiftToDelete = shifts.find(s => s.id === editingShiftId);
    if (!shiftToDelete) return;

    // Hide shift modal and show confirmation modal for both published and draft shifts
    setShowCreateShift(false); // Hide shift modal
    setShowDeleteConfirm(true); // Show confirmation modal
  };

  // Handle delete shift (delete directly)
  const handleDeleteShift = async () => {
    if (!currentCompany?.id || !editingShiftId) return;

    try {
      setIsDeletingShift(true);
      setShiftFormError(null);

      // Get the shift being deleted
      const shiftToDelete = shifts.find(s => s.id === editingShiftId);
      if (!shiftToDelete) {
        setShiftFormError('Shift not found');
        return;
      }

      // Delete directly (both published and draft)
      const { error } = await supabase
        .from('planned_shifts')
        .delete()
        .eq('id', editingShiftId);

      if (error) throw error;

      // Close confirmation modal if open
      setShowDeleteConfirm(false);

      // Reset form and close modal
      setShiftForm({
        workerId: '',
        shiftDate: '',
        startTime: '',
        endTime: '',
        siteId: '',
        shiftTitle: '',
        notes: '',
        breakMinutes: 0,
        isOvertimeAllowed: false,
        isRepeating: false,
        repeatFrequency: 'weekly',
        repeatEndDate: '',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setEditingShiftId(null);
      setShowCreateShift(false);

      // Reload data
      await loadScheduleData();
    } catch (err: any) {
      logger.error('Error deleting shift', err);
      setShiftFormError(err?.message || 'Error deleting shift');
    } finally {
      setIsDeletingShift(false);
    }
  };

  // Handle create shift (single or repeating)
  const handleCreateShift = async () => {
    if (!currentCompany?.id) return;

    // Validation
    if (!shiftForm.workerId) {
      setShiftFormError('Please select a worker');
      return;
    }
    if (!shiftForm.shiftDate) {
      setShiftFormError('Please select a date');
      return;
    }
    if (!shiftForm.startTime) {
      setShiftFormError('Please specify start time');
      return;
    }
    if (!shiftForm.endTime) {
      setShiftFormError('Please specify end time');
      return;
    }
    if (!shiftForm.siteId) {
      setShiftFormError('Please select a site');
      return;
    }

    // Validate time format and logic
    if (shiftForm.startTime >= shiftForm.endTime) {
      setShiftFormError('End time must be after start time');
      return;
    }

    // Validate repeating shift
    if (shiftForm.isRepeating && !shiftForm.repeatEndDate) {
      setShiftFormError('Please select an end date for repeating shift');
      return;
    }

    try {
      setIsCreatingShift(true);
      setShiftFormError(null);

      // Format time to HH:MM:SS for Supabase
      const startTimeFormatted = `${shiftForm.startTime}:00`;
      const endTimeFormatted = `${shiftForm.endTime}:00`;

      // Prepare base shift data
      const baseShiftData = {
        company_id: currentCompany.id,
        worker_id: shiftForm.workerId,
        site_id: shiftForm.siteId,
        shift_type: 'work' as const,
        start_time: startTimeFormatted,
        end_time: endTimeFormatted,
        status: 'draft' as const,
        break_minutes: shiftForm.breakMinutes || 0,
        is_overtime_allowed: true, // Overtime is always allowed
        notes: shiftForm.notes || shiftForm.shiftTitle || null,
      };

      // Generate dates for repeating shifts
      const datesToCreate: string[] = [];
      if (shiftForm.isRepeating) {
        const startDate = new Date(shiftForm.shiftDate);
        const endDate = new Date(shiftForm.repeatEndDate);
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
          datesToCreate.push(currentDate.toISOString().slice(0, 10));
          
          // Increment based on frequency
          if (shiftForm.repeatFrequency === 'daily') {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (shiftForm.repeatFrequency === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (shiftForm.repeatFrequency === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
      } else {
        datesToCreate.push(shiftForm.shiftDate);
      }

      // Insert all shifts
      const shiftsToInsert = datesToCreate.map(date => ({
        ...baseShiftData,
        shift_date: date,
      }));

      const { error } = await supabase
        .from('planned_shifts')
        .insert(shiftsToInsert);

      if (error) throw error;

      // Reset form and close modal
      setShiftForm({
        workerId: '',
        shiftDate: '',
        startTime: '',
        endTime: '',
        siteId: '',
        shiftTitle: '',
        notes: '',
        breakMinutes: 0,
        isOvertimeAllowed: false,
        isRepeating: false,
        repeatFrequency: 'weekly',
        repeatEndDate: '',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setShowCreateShift(false);

      // Reload data using the shared function
      await loadScheduleData();
    } catch (err: any) {
      logger.error('Error creating shift', err);
      // Extract error message from Supabase/Postgres error
      let errorMessage = 'Error creating shift';
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error?.message) {
        errorMessage = err.error.message;
      } else if (err?.details) {
        errorMessage = err.details;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setShiftFormError(errorMessage);
    } finally {
      setIsCreatingShift(false);
    }
  };

  // Handle create multiple shifts
  const handleCreateMultipleShifts = async () => {
    if (!currentCompany?.id) return;

    // Validate all rows
    const validRows = multipleShifts.filter(row => 
      row.workerId && row.shiftDate && row.startTime && row.endTime && row.siteId
    );

    if (validRows.length === 0) {
      setMultipleShiftsError('Please fill at least one complete shift row');
      return;
    }

    // Validate times for each row
    for (const row of validRows) {
      if (row.startTime >= row.endTime) {
        setMultipleShiftsError(`Row with date ${row.shiftDate}: End time must be after start time`);
        return;
      }
    }

    try {
      setIsCreatingMultipleShifts(true);
      setMultipleShiftsError(null);

      const shiftsToInsert = validRows.map(row => ({
        company_id: currentCompany.id,
        worker_id: row.workerId,
        site_id: row.siteId,
        shift_type: 'work' as const,
        shift_date: row.shiftDate,
        start_time: `${row.startTime}:00`,
        end_time: `${row.endTime}:00`,
        status: 'draft' as const,
        break_minutes: row.breakMinutes || 0,
        is_overtime_allowed: true, // Overtime is always allowed
        notes: row.notes || row.shiftTitle || null,
      }));

      const { error } = await supabase
        .from('planned_shifts')
        .insert(shiftsToInsert);

      if (error) {
        // Extract error message from Supabase/Postgres error
        let errorMessage = 'Error creating shifts';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        } else if (error.hint) {
          errorMessage = error.hint;
        }
        throw new Error(errorMessage);
      }

      // Reset form and close modal
      setMultipleShifts([{
        id: `row-${Date.now()}`,
        workerId: '',
        shiftDate: '',
        startTime: '',
        endTime: '',
        siteId: '',
        shiftTitle: '',
        notes: '',
        breakMinutes: 0,
        isOvertimeAllowed: false,
      }]);
      setShowMultipleShifts(false);

      // Reload data
      await loadScheduleData();
    } catch (err: any) {
      logger.error('Error creating multiple shifts', err);
      // Extract error message from Supabase/Postgres error
      let errorMessage = 'Error creating multiple shifts';
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error?.message) {
        errorMessage = err.error.message;
      } else if (err?.details) {
        errorMessage = err.details;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setMultipleShiftsError(errorMessage);
    } finally {
      setIsCreatingMultipleShifts(false);
    }
  };

  // Handle close single shift modal
  const handleCloseCreateShiftModal = () => {
    setShowCreateShift(false);
    setEditingShiftId(null);
    setShiftForm({
      workerId: '',
      shiftDate: '',
      startTime: '',
      endTime: '',
      siteId: '',
      shiftTitle: '',
      notes: '',
      breakMinutes: 0,
      isOvertimeAllowed: false,
      isRepeating: false,
      repeatFrequency: 'weekly',
      repeatEndDate: '',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setShiftFormError(null);
  };

  // Handle close multiple shifts modal
  const handleCloseMultipleShiftsModal = () => {
    setShowMultipleShifts(false);
    setMultipleShifts([{
      id: `row-${Date.now()}`,
      workerId: '',
      shiftDate: '',
      startTime: '',
      endTime: '',
      siteId: '',
      shiftTitle: '',
      notes: '',
      breakMinutes: 0,
      isOvertimeAllowed: false,
    }]);
    setMultipleShiftsError(null);
  };

  // Add row to multiple shifts table
  const addMultipleShiftRow = () => {
    setMultipleShifts([...multipleShifts, {
      id: `row-${Date.now()}-${Math.random()}`,
      workerId: '',
      shiftDate: '',
      startTime: '',
      endTime: '',
      siteId: '',
      shiftTitle: '',
      notes: '',
      breakMinutes: 0,
      isOvertimeAllowed: false,
    }]);
  };

  // Remove row from multiple shifts table
  const removeMultipleShiftRow = (id: string) => {
    if (multipleShifts.length > 1) {
      setMultipleShifts(multipleShifts.filter(row => row.id !== id));
    }
  };

  // Update multiple shift row
  const updateMultipleShiftRow = (id: string, field: string, value: any) => {
    setMultipleShifts(multipleShifts.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const getWorkRuleTypeLabel = (ruleType: string | undefined): string => {
    if (!ruleType) return 'No work rule';
    switch (ruleType) {
      case 'fixed':
        return 'Fixed schedule';
      case 'planned':
      case 'planner':
        return 'Planner-based';
      case 'open':
        return 'Flexible / No expected hours';
      default:
        return ruleType.charAt(0).toUpperCase() + ruleType.slice(1);
    }
  };

  const getWorkRuleBorderColor = (ruleType: string | undefined): string => {
    if (!ruleType) return 'border-l-gray-400';
    switch (ruleType) {
      case 'fixed':
        return 'border-l-[#059669]'; // primary green
      case 'planned':
      case 'planner':
        return 'border-l-blue-500';
      case 'flexible':
      case 'open':
        return 'border-l-orange-500';
      default:
        return 'border-l-gray-400';
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedWorkerType([]);
    setSelectedDepartment([]);
    setSelectedJobTitle([]);
    setSelectedWorkRule([]);
    setSearchTerm('');
    setWorkerTypeSearchTerm('');
    setDepartmentSearchTerm('');
    setJobTitleSearchTerm('');
    setWorkRuleSearchTerm('');
    setCurrentPage(1); // Reset to first page when clearing filters
  };

  // Handle sorting
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Select All functions for each filter
  const handleWorkerTypeSelectAll = () => {
    const allWorkerTypes = getFilteredWorkerTypeOptions();
    setSelectedWorkerType(allWorkerTypes);
  };

  const handleDepartmentSelectAll = () => {
    const allDepartments = getFilteredDepartmentOptions();
    setSelectedDepartment(allDepartments);
  };

  const handleJobTitleSelectAll = () => {
    const allJobTitles = getFilteredJobTitleOptions();
    setSelectedJobTitle(allJobTitles);
  };

  const handleWorkRuleSelectAll = () => {
    const allWorkRules = getFilteredWorkRuleOptions();
    setSelectedWorkRule(allWorkRules);
  };

  // Helper functions for multi-select
  const handleWorkerTypeToggle = (workerType: string) => {
    setSelectedWorkerType(prev => 
      prev.includes(workerType) 
        ? prev.filter(wt => wt !== workerType)
        : [...prev, workerType]
    );
  };

  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartment(prev => 
      prev.includes(department) 
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleJobTitleToggle = (jobTitle: string) => {
    setSelectedJobTitle(prev => 
      prev.includes(jobTitle) 
        ? prev.filter(jt => jt !== jobTitle)
        : [...prev, jobTitle]
    );
  };

  const handleWorkRuleToggle = (workRule: string) => {
    setSelectedWorkRule(prev => 
      prev.includes(workRule) 
        ? prev.filter(wr => wr !== workRule)
        : [...prev, workRule]
    );
  };

  // Filter options based on search terms
  const getFilteredWorkerTypeOptions = () => {
    const workerTypes = ['employee', 'contractor'];
    return workerTypes.filter(wt => 
      wt.toLowerCase().includes(workerTypeSearchTerm.toLowerCase())
    );
  };

  const getFilteredDepartmentOptions = () => {
    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
    return departments.filter(dept => dept.toLowerCase().includes(departmentSearchTerm.toLowerCase()));
  };

  const getFilteredJobTitleOptions = () => {
    const jobTitles = [...new Set(employees.map(e => e.role).filter(Boolean))];
    return jobTitles.filter(jt => jt.toLowerCase().includes(jobTitleSearchTerm.toLowerCase()));
  };

  const getFilteredWorkRuleOptions = () => {
    const workRules = ['Fixed', 'Planned', 'Flexible'];
    return workRules.filter(wr => 
      wr.toLowerCase().includes(workRuleSearchTerm.toLowerCase())
    );
  };

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(employee => {
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesWorkerType = selectedWorkerType.length === 0 || (employee.workerType && selectedWorkerType.includes(employee.workerType));
      const matchesDepartment = selectedDepartment.length === 0 || selectedDepartment.includes(employee.department);
      const matchesJobTitle = selectedJobTitle.length === 0 || selectedJobTitle.includes(employee.role);
      
      // Get work rule for employee
      const workRuleType = workRuleTypeByWorkerId[employee.id];
      let workRuleLabel = '';
      if (workRuleType === 'fixed') {
        workRuleLabel = 'Fixed';
      } else if (workRuleType === 'planned' || workRuleType === 'planner') {
        workRuleLabel = 'Planned';
      } else if (workRuleType === 'flexible' || workRuleType === 'open') {
        workRuleLabel = 'Flexible';
      }
      const matchesWorkRule = selectedWorkRule.length === 0 || (workRuleLabel && selectedWorkRule.includes(workRuleLabel));
      
      return matchesSearch && matchesWorkerType && matchesDepartment && matchesJobTitle && matchesWorkRule;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'department':
          aValue = a.department.toLowerCase();
          bValue = b.department.toLowerCase();
          break;
        case 'role':
          aValue = a.role.toLowerCase();
          bValue = b.role.toLowerCase();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [employees, searchTerm, selectedWorkerType, selectedDepartment, selectedJobTitle, selectedWorkRule, workRuleTypeByWorkerId, sortBy, sortOrder]);

  // Calculate counts for stats cards
  const allWorkersCount = useMemo(() => {
    return filteredEmployees.length;
  }, [filteredEmployees]);

  const fixedScheduleCount = useMemo(() => {
    return filteredEmployees.filter(emp => {
      const ruleType = workRuleTypeByWorkerId[emp.id];
      return ruleType === 'fixed';
    }).length;
  }, [filteredEmployees, workRuleTypeByWorkerId]);

  const plannedScheduleCount = useMemo(() => {
    return filteredEmployees.filter(emp => {
      const ruleType = workRuleTypeByWorkerId[emp.id];
      return ruleType === 'planned' || ruleType === 'planner';
    }).length;
  }, [filteredEmployees, workRuleTypeByWorkerId]);

  const flexibleScheduleCount = useMemo(() => {
    return filteredEmployees.filter(emp => {
      const ruleType = workRuleTypeByWorkerId[emp.id];
      return ruleType === 'flexible' || ruleType === 'open';
    }).length;
  }, [filteredEmployees, workRuleTypeByWorkerId]);

  // Preset filter functions
  const applyAllWorkersPreset = () => {
    setSelectedWorkRule([]);
    setSelectedWorkerType([]);
    setSelectedDepartment([]);
    setSelectedJobTitle([]);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyFixedSchedulePreset = () => {
    setSelectedWorkRule(['Fixed']);
    setSelectedWorkerType([]);
    setSelectedDepartment([]);
    setSelectedJobTitle([]);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyPlannedSchedulePreset = () => {
    setSelectedWorkRule(['Planned']);
    setSelectedWorkerType([]);
    setSelectedDepartment([]);
    setSelectedJobTitle([]);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyFlexibleSchedulePreset = () => {
    setSelectedWorkRule(['Flexible']);
    setSelectedWorkerType([]);
    setSelectedDepartment([]);
    setSelectedJobTitle([]);
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Determine which preset is active
  const activePreset = useMemo(() => {
    const hasOtherFilters = selectedWorkerType.length > 0 || selectedDepartment.length > 0 || selectedJobTitle.length > 0;
    
    if (selectedWorkRule.length === 0 && !hasOtherFilters) {
      return 'all';
    } else if (selectedWorkRule.length === 1 && selectedWorkRule[0] === 'Fixed' && !hasOtherFilters) {
      return 'fixed';
    } else if (selectedWorkRule.length === 1 && selectedWorkRule[0] === 'Planned' && !hasOtherFilters) {
      return 'planned';
    } else if (selectedWorkRule.length === 1 && selectedWorkRule[0] === 'Flexible' && !hasOtherFilters) {
      return 'flexible';
    }
    return null;
  }, [selectedWorkRule, selectedWorkerType, selectedDepartment, selectedJobTitle]);

  // Pagination calculations
  const totalItems = filteredEmployees.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    start.setDate(diff);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDates = getWeekDates(currentDate);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  const getWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    if (!start || !end) return '';
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(shift => shift.date === dateStr);
  };

  // Generate virtual fixed schedule shifts for a worker on a specific date
  const getFixedScheduleShiftsForDate = (workerId: string, date: Date): Shift[] => {
    const dateStr = date.toISOString().split('T')[0];
    if (!dateStr) return [];

    const fixedScheduleId = getActiveFixedScheduleIdForDate(workerId, dateStr);
    if (!fixedScheduleId) return [];

    const fixedSchedule = fixedSchedules.find(fs => fs.id === fixedScheduleId);
    if (!fixedSchedule || !fixedSchedule.fixed_schedule_days) return [];

    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = date.getDay();
    
    // Find the schedule day for this day of week
    const scheduleDay = fixedSchedule.fixed_schedule_days.find(
      day => day.day_of_week === dayOfWeek && day.is_working && day.start_time && day.end_time
    );

    if (!scheduleDay) return [];

    // Create virtual shift
    const startTime = scheduleDay.start_time ? normalizeTime(scheduleDay.start_time) : '';
    const endTime = scheduleDay.end_time ? normalizeTime(scheduleDay.end_time) : '';
    
    if (!startTime || !endTime) return [];

    return [{
      id: `fixed-${workerId}-${dateStr}`, // Virtual ID
      workerId,
      date: dateStr,
      startTime,
      endTime,
      role: (fixedSchedule.name || 'Fixed Schedule'),
      location: 'Fixed Schedule',
      status: 'published' as const, // Virtual status for rendering
    }];
  };

  // Status to style mapping
  const getStatusStyle = (status: 'draft' | 'published', isDelete?: boolean) => {
    if (isDelete) {
      // Delete intent styling: faded, strikethrough appearance
      return {
        bgColor: 'bg-red-50',
        textColor: 'text-red-400',
        borderColorHex: '#EF4444', // red-500
        borderStyle: 'dashed',
        opacity: 'opacity-50',
      };
    }
    
    switch (status) {
      case 'draft':
        return {
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-700',
          borderColorHex: '#FACC15', // yellow-400
          borderStyle: 'dashed',
          opacity: '',
        };
      case 'published':
        return {
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColorHex: '#3B82F6', // blue-500
          borderStyle: 'solid',
          opacity: '',
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          borderColorHex: '#9CA3AF', // gray-400
          borderStyle: 'solid',
          opacity: '',
        };
    }
  };

  const getStatusColor = (status: string, isDelete?: boolean) => {
    const style = getStatusStyle(status as 'draft' | 'published', isDelete);
    return `${style.bgColor} ${style.textColor} ${style.opacity}`;
  };

  // Count drafts and published shifts marked for deletion for Publish button
  // Get IDs of filtered workers (only those displayed in the table)
  const filteredWorkerIds = useMemo(() => {
    return new Set(filteredEmployees.map(emp => emp.id));
  }, [filteredEmployees]);

  // Calculate pending changes count only for filtered workers
  const draftCount = useMemo(() => {
    return allShiftsRaw.filter(s => 
      s.status === 'draft' && 
      !s.is_delete &&
      filteredWorkerIds.has(s.worker_id) &&
      s.shift_date >= weekRange.startISO && 
      s.shift_date <= weekRange.endISO
    ).length;
  }, [allShiftsRaw, filteredWorkerIds, weekRange.startISO, weekRange.endISO]);

  const publishedDeleteCount = useMemo(() => {
    return allShiftsRaw.filter(s => 
      s.status === 'published' && 
      s.is_delete === true &&
      filteredWorkerIds.has(s.worker_id) &&
      s.shift_date >= weekRange.startISO && 
      s.shift_date <= weekRange.endISO
    ).length;
  }, [allShiftsRaw, filteredWorkerIds, weekRange.startISO, weekRange.endISO]);

  const legacyDeleteIntentCount = useMemo(() => {
    return allShiftsRaw.filter(s => 
      s.status === 'draft' && 
      s.is_delete === true &&
      filteredWorkerIds.has(s.worker_id) &&
      s.shift_date >= weekRange.startISO && 
      s.shift_date <= weekRange.endISO
    ).length;
  }, [allShiftsRaw, filteredWorkerIds, weekRange.startISO, weekRange.endISO]);

  const pendingChangesCount = draftCount + publishedDeleteCount + legacyDeleteIntentCount; // Total changes pending publish
  
  // Check if there are any published shifts visible in the current view
  const hasPublishedShiftsInView = useMemo(() => {
    const filteredWorkerIdsSet = new Set(filteredEmployees.map(emp => emp.id));
    return allShiftsRaw.some(s => 
      s.status === 'published' && 
      !s.is_delete &&
      filteredWorkerIdsSet.has(s.worker_id) &&
      s.shift_date >= weekRange.startISO && 
      s.shift_date <= weekRange.endISO
    );
  }, [allShiftsRaw, filteredEmployees, weekRange.startISO, weekRange.endISO]);
  
  const canPublish = useMemo(() => {
    const hasRole = currentCompanyUser?.role === 'super_admin' || 
                    currentCompanyUser?.role === 'admin' || 
                    currentCompanyUser?.role === 'supervisor';
    const hasChanges = pendingChangesCount > 0;
    
    if (import.meta.env.DEV) {
      console.log('canPublish debug:', {
        role: currentCompanyUser?.role,
        hasRole,
        pendingChangesCount,
        draftCount,
        publishedDeleteCount,
        legacyDeleteIntentCount,
        hasChanges,
        canPublish: hasRole && hasChanges
      });
    }
    
    return hasRole && hasChanges;
  }, [currentCompanyUser?.role, pendingChangesCount, draftCount, publishedDeleteCount, legacyDeleteIntentCount]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">Schedule</h1>
          <p className="text-xs text-muted-foreground">Schedule and manage workers shifts efficiently</p>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {loadError}
        </div>
      )}

      {/* Stats Cards - Filter Presets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div 
          className={`bg-white border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            activePreset === 'all' 
              ? 'border-gray-500 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={applyAllWorkersPreset}
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-600" />
            <div className="text-2xl font-bold text-gray-900">{isLoadingData ? '—' : allWorkersCount}</div>
            <div className="text-sm text-muted-foreground">All Workers</div>
          </div>
        </div>
        <div 
          className={`bg-white border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            activePreset === 'fixed' 
              ? 'border-[#059669] shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={applyFixedSchedulePreset}
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-[#059669]" />
            <div className="text-2xl font-bold text-gray-900">{isLoadingData ? '—' : fixedScheduleCount}</div>
            <div className="text-sm text-muted-foreground">Fixed Schedule</div>
          </div>
        </div>
        <div 
          className={`bg-white border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            activePreset === 'planned' 
              ? 'border-blue-500 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={applyPlannedSchedulePreset}
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <div className="text-2xl font-bold text-gray-900">{isLoadingData ? '—' : plannedScheduleCount}</div>
            <div className="text-sm text-muted-foreground">Planned Schedule</div>
              </div>
          </div>
        <div 
          className={`bg-white border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
            activePreset === 'flexible' 
              ? 'border-orange-500 shadow-md' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={applyFlexibleSchedulePreset}
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-orange-600" />
            <div className="text-2xl font-bold text-gray-900">{isLoadingData ? '—' : flexibleScheduleCount}</div>
            <div className="text-sm text-muted-foreground">Flexible Schedule</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4">
        <div className={`bg-white border border-gray-200 py-6 px-6 ${
          showFilters ? 'rounded-t-lg' : 'rounded-lg'
        }`}>
          <div className="flex items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees by name, email, job title, or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Search employees"
                id="employee-search"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Clear Filters Button - Only show when filters are active */}
              {(selectedWorkerType.length > 0 || selectedDepartment.length > 0 || selectedJobTitle.length > 0 || selectedWorkRule.length > 0) && (
              <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded transition-colors text-sm bg-white text-gray-700 hover:bg-gray-50"
                  title="Clear all active filters"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              )}

              {/* Filters Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-2 py-1 border border-gray-300 rounded transition-colors text-sm ${
                  showFilters ? 'bg-gray-300 text-black' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter style={{ width: '14px', height: '14px' }} />
                Filters
              </button>

            </div>
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg py-6 px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* Worker Type Multi-Select */}
              <div className="relative dropdown-container" ref={workerTypeDropdownRef}>
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowWorkerTypeDropdown(!showWorkerTypeDropdown)}>
                  <span className="text-gray-700">
                    {selectedWorkerType.length === 0 ? 'All Worker Types' : 
                     selectedWorkerType.length === 1 ? (selectedWorkerType[0]?.charAt(0).toUpperCase() || '') + (selectedWorkerType[0]?.slice(1) || '') :
                     `${selectedWorkerType.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showWorkerTypeDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search worker types..."
                          value={workerTypeSearchTerm}
                          onChange={(e) => setWorkerTypeSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWorkerTypeSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedWorkerType.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkerType([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedWorkerType.length})
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      {getFilteredWorkerTypeOptions().map((workerType) => (
                        <label key={workerType} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedWorkerType.includes(workerType)}
                            onChange={() => handleWorkerTypeToggle(workerType)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700 capitalize">{workerType}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Department Multi-Select */}
              <div className="relative dropdown-container" ref={departmentDropdownRef}>
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}>
                  <span className="text-gray-700">
                    {selectedDepartment.length === 0 ? 'All Departments' : 
                     selectedDepartment.length === 1 ? selectedDepartment[0] :
                     `${selectedDepartment.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
              </div>
                {showDepartmentDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search departments..."
                          value={departmentSearchTerm}
                          onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDepartmentSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedDepartment.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDepartment([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedDepartment.length})
                          </button>
                        )}
              </div>
              </div>
                    <div className="py-1">
                      {getFilteredDepartmentOptions().map((department) => (
                        <label key={department} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedDepartment.includes(department)}
                            onChange={() => handleDepartmentToggle(department)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700">{department}</span>
                        </label>
                      ))}
            </div>
          </div>
        )}
      </div>

              {/* Job Title Multi-Select */}
              <div className="relative dropdown-container" ref={jobTitleDropdownRef}>
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowJobTitleDropdown(!showJobTitleDropdown)}>
                  <span className="text-gray-700">
                    {selectedJobTitle.length === 0 ? 'All Job Titles' : 
                     selectedJobTitle.length === 1 ? selectedJobTitle[0] :
                     `${selectedJobTitle.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showJobTitleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search job titles..."
                          value={jobTitleSearchTerm}
                          onChange={(e) => setJobTitleSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJobTitleSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedJobTitle.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJobTitle([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedJobTitle.length})
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      {getFilteredJobTitleOptions().map((jobTitle) => (
                        <label key={jobTitle} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedJobTitle.includes(jobTitle)}
                            onChange={() => handleJobTitleToggle(jobTitle)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700">{jobTitle}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Work Rule Multi-Select */}
              <div className="relative dropdown-container" ref={workRuleDropdownRef}>
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowWorkRuleDropdown(!showWorkRuleDropdown)}>
                  <span className="text-gray-700">
                    {selectedWorkRule.length === 0 ? 'All Work Rules' : 
                     selectedWorkRule.length === 1 ? selectedWorkRule[0] :
                     `${selectedWorkRule.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showWorkRuleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search work rules..."
                          value={workRuleSearchTerm}
                          onChange={(e) => setWorkRuleSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWorkRuleSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedWorkRule.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkRule([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedWorkRule.length})
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      {getFilteredWorkRuleOptions().map((workRule) => (
                        <label key={workRule} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedWorkRule.includes(workRule)}
                            onChange={() => handleWorkRuleToggle(workRule)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700">{workRule}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={clearAllFilters}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all filters
              </button>
              <div className="flex gap-3 items-center">
                <span className="text-xs text-gray-500">Sort by:</span>
                <button 
                  onClick={() => handleSort('name')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'name' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Name
                  {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button 
                  onClick={() => handleSort('department')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'department' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Department
                  {sortBy === 'department' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button 
                  onClick={() => handleSort('role')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'role' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Role
                  {sortBy === 'role' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Week Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={goToCurrentWeek}
              className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              aria-label="Go to current week"
            >
              This Week
            </button>
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">{getWeekRange()}</h3>
              <p className="text-sm text-gray-500">Week of {weekDates[0]?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || ''}</p>
            </div>
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-5 h-5" />
          </button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pr-2">
            {/* Actions Dropdown */}
            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  setShowActionsDropdown(!showActionsDropdown);
                  setShowAddDropdown(false); // Close Add dropdown when opening Actions
                }}
                className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Actions
                <ChevronDown className="w-4 h-4" />
              </button>
              {showActionsDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-10">
                  <div className="py-1">
                    {/* Week actions */}
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Week actions
                    </div>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Copy previous week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      Auto assign week
                    </button>
                    <button 
                      onClick={() => {
                        setShowActionsDropdown(false);
                        setShowEraseDraftsConfirm(true);
                      }}
                      disabled={pendingChangesCount === 0}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                        pendingChangesCount === 0
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Eraser className="w-4 h-4" />
                      Erase Drafts
                    </button>
                    <button 
                      onClick={() => {
                        setShowActionsDropdown(false);
                        setShowUnpublishConfirm(true);
                      }}
                      disabled={!hasPublishedShiftsInView}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                        !hasPublishedShiftsInView
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Published
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Export week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Printer className="w-4 h-4" />
                      Print week
                    </button>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Templates */}
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Templates
                    </div>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Save week as template
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Load week template
                    </button>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Shareable links */}
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Shareable links
                    </div>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Share2 className="w-4 h-4" />
                      Share schedule
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Menu className="w-4 h-4" />
                      Manage shared links
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Add Dropdown */}
            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  setShowAddDropdown(!showAddDropdown);
                  setShowActionsDropdown(false); // Close Actions dropdown when opening Add
                }}
                className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Add
                <ChevronDown className="w-4 h-4" />
              </button>
              {showAddDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-10">
                  <div className="py-1">
                    {/* Shifts section */}
                    <button 
                      onClick={() => {
                        setShiftForm(prev => ({ ...prev, workerId: '' })); // Reset worker selection
                        setShowCreateShift(true);
                        setShowAddDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add single shift
                    </button>
                    <button 
                      onClick={() => {
                        setShowMultipleShifts(true);
                        setShowAddDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add multiple shifts
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Add from templates
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Import from excel
                    </button>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Time off section */}
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CalendarX className="w-4 h-4" />
                      Add time off
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CalendarX className="w-4 h-4" />
                      Add unavailability
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Publish Button */}
            <button
                onClick={handlePublish}
                disabled={!canPublish || isLoadingData}
                className={`flex items-center gap-2 px-2 py-1 rounded text-sm text-white transition-colors ${
                  canPublish && !isLoadingData
                    ? 'hover:opacity-90'
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={{ backgroundColor: canPublish && !isLoadingData ? 'var(--primary-brand-hex)' : '#9CA3AF' }}
              >
                <span>Publish ({pendingChangesCount})</span>
              <div className="w-px h-4 bg-white/30"></div>
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>

      {/* Calendar */}
      <div className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
        {/* Week View */}
        {viewMode === 'week' && (
          <div>
            {/* Header Row */}
            <div className="flex border-b border-gray-200">
            {/* Worker Column Header */}
              <div className="w-64 py-2 px-3 pl-4 border-r border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8"></div>
              <span className="text-sm font-medium text-gray-700">Worker</span>
                </div>
            </div>
            
            {/* Day Headers */}
            {weekDates.map((date, index) => (
                <div key={index} className={`flex-1 py-2 px-2 bg-gray-50 flex items-center justify-center ${index < weekDates.length - 1 ? 'border-r border-gray-200' : ''}`}>
                  <div className="flex items-center justify-center gap-1">
                <div className="text-sm font-medium text-gray-700">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                    <div className="text-sm text-gray-500">
                  {date.getDate()}
                    </div>
                </div>
              </div>
            ))}
            </div>
            
            {/* Employee Rows */}
            {paginatedEmployees.map((employee, employeeIndex) => (
              <div key={employee.id} className="flex">
                {/* Employee Info */}
                <div className={`w-64 py-2 px-3 pl-4 border-r border-gray-200 border-l-4 ${getWorkRuleBorderColor(workRuleTypeByWorkerId[employee.id])} flex items-center gap-2 ${employeeIndex < paginatedEmployees.length - 1 ? 'border-b border-gray-200' : ''}`}>
                  <div className="relative">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {generateAvatarInitials(employee.name.split(' ')[0] || '', employee.name.split(' ')[1] || '')}
                    </div>
                    <div 
                      className={`absolute -bottom-0.5 -right-0.5 ${getDotSize('sm')} rounded-full border border-white`}
                      style={{ backgroundColor: getCurrentStatusDotColor(employee.current_status || mapStatusToCurrentStatus(employee.status)) }}>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {employee.name}
                    </div>
                    {employee.role && (
                    <div className="text-xs text-gray-500 truncate">
                      {employee.role}
                    </div>
                    )}
                  </div>
                </div>
                
                {/* Day Cells */}
                {weekDates.map((date, dayIndex) => {
                  const dayShifts = getShiftsForDate(date).filter(shift => shift.workerId === employee.id);
                  const fixedScheduleShifts = getFixedScheduleShiftsForDate(employee.id, date);
                  const dateStr = date.toISOString().split('T')[0] || '';
                  const activeRuleType = dateStr ? getActiveWorkRuleTypeForDate(employee.id, dateStr) : undefined;
                  const isFixedScheduleForDate = activeRuleType === 'fixed';
                  const noWorkRuleForDate = !activeRuleType;
                  // Combine and sort all shifts by start time so they display in chronological order
                  const allShiftsForDay = [...dayShifts, ...fixedScheduleShifts].sort((a, b) => {
                    // Compare start times (HH:MM format)
                    if (a.startTime < b.startTime) return -1;
                    if (a.startTime > b.startTime) return 1;
                    return 0;
                  });
                  const shiftCount = allShiftsForDay.length;
                  const cellHeight = shiftCount > 0 ? 40 * shiftCount : 40; // 40px per shift
                  // Apply gray background ONLY when cell is completely empty (no planned shifts AND no fixed schedule shifts)
                  // If there's any content (planned or fixed schedule), use white background
                  const shouldShowGrayBackground = ((isFixedScheduleForDate || noWorkRuleForDate) && allShiftsForDay.length === 0);
                  
                  return (
                      <div 
                        key={dayIndex} 
                        className={`group flex-1 relative ${dayIndex < weekDates.length - 1 ? 'border-r border-gray-200' : ''} ${employeeIndex < paginatedEmployees.length - 1 ? 'border-b border-gray-200' : ''} ${shouldShowGrayBackground ? 'bg-gray-50' : ''}`}
                        style={{ minHeight: `${cellHeight}px` }}
                      >
                      {allShiftsForDay.length > 0 ? (
                        <>
                          {allShiftsForDay.map((shift, shiftIndex) => {
                            const isFixedScheduleShift = shift.id.startsWith('fixed-');
                            const style = isFixedScheduleShift 
                              ? {
                                  bgColor: 'bg-green-50',
                                  textColor: 'text-green-700',
                                  borderColorHex: '#059669', // primary green
                                  borderStyle: 'solid',
                                  opacity: '',
                                }
                              : getStatusStyle(shift.status, shift.isDelete);
                            
                            // Calculate position: each shift gets equal height
                            const shiftHeightPercent = 100 / shiftCount;
                            const topPercent = (shiftIndex * 100) / shiftCount;
                            
                            return (
                              <div
                                key={shift.id}
                                className={`absolute text-xs flex flex-col justify-center ${style.bgColor} ${style.textColor} ${style.opacity} left-0 right-0 transition-all duration-200 group-hover:left-6 ${
                                  shiftIndex < shiftCount - 1 ? 'border-b border-gray-300' : ''
                                } ${isFixedScheduleShift ? 'pointer-events-none' : 'cursor-pointer'}`}
                                onClick={() => {
                                  if (!isFixedScheduleShift) {
                                    handleEditShift(shift.id);
                                  }
                                }}
                                title={isFixedScheduleShift ? 'Fixed schedule - managed from Worker Settings' : shift.isDelete ? 'To be deleted on publish' : undefined}
                              style={{ 
                                  borderLeft: `3px ${style.borderStyle}`,
                                  borderLeftColor: style.borderColorHex,
                                  top: `${topPercent}%`,
                                  height: `${shiftHeightPercent}%`,
                                  zIndex: 1, // Same z-index for all shifts so they stack properly
                              }}
                            >
                              <div className="px-1.5 py-0.5">
                                  <div className="flex items-center gap-1 mb-0">
                                    <div className={`font-medium text-xs leading-tight truncate flex-1 ${shift.isDelete ? 'line-through' : ''}`}>
                                      {shift.role}
                                    </div>
                                    {!isFixedScheduleShift && shift.isDelete && (
                                      <Trash2 className="w-3 h-3 text-red-500 flex-shrink-0" />
                                    )}
                                  </div>
                                <div className={`text-xs leading-tight flex items-center gap-1 ${shift.isDelete ? 'opacity-50' : 'opacity-75'}`}>
                                  <Clock className="w-2.5 h-2.5" />
                                  <span className={shift.isDelete ? 'line-through' : ''}>
                                  {shift.startTime} – {shift.endTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                          {/* Add button that appears on hover - available for all workers */}
                          <button 
                              title={`Add shift for ${employee.name}`}
                            className="absolute top-1/2 left-1 transform -translate-y-1/2 w-4 h-4 border border-gray-200 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white z-20"
                            style={{ backgroundColor: 'white', zIndex: 20 }}
                            onClick={() => {
                                setSelectedEmployee(employee.id);
                                // Preselect the employee and date in the form
                                const dateStr = date.toISOString().slice(0, 10);
                                setShiftForm(prev => ({ 
                                  ...prev, 
                                  workerId: employee.id,
                                  shiftDate: dateStr
                                }));
                                setShowCreateShift(true);
                            }}
                            aria-label={`Add shift for ${employee.name}`}
                          >
                            <Plus className="w-2.5 h-2.5 text-gray-400" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {/* Add button that appears on hover - available for all workers */}
                          <button 
                              title={`Add shift for ${employee.name}`}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 bg-white border border-gray-200 rounded flex items-center justify-center transition-opacity duration-200 hover:bg-white"
                            onClick={() => {
                                  setSelectedEmployee(employee.id);
                                  // Preselect the employee and date in the form
                                  const dateStr = date.toISOString().slice(0, 10);
                                  setShiftForm(prev => ({ 
                                    ...prev, 
                                    workerId: employee.id,
                                    shiftDate: dateStr
                                  }));
                                  setShowCreateShift(true);
                            }}
                            aria-label={`Add shift for ${employee.name}`}
                          >
                            <Plus className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="bg-white border border-gray-200 rounded-lg py-6 px-6">
              <div className="flex items-center justify-between">
          {/* Items Per Page Selector */}
                <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">Show:</span>
            <select 
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
              aria-label="Items per page"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
            </span>
                  </div>
          
          {/* Page Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              {/* Previous Button */}
                  <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === 1
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
                  </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                  <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-6 h-6 text-xs rounded transition-colors flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-gray-300 text-black'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      aria-label={`Go to page ${pageNum}`}
                    >
                      {pageNum}
                  </button>
                  );
                })}
              </div>

              {/* Next Button */}
                  <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === totalPages
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                aria-label="Go to next page"
              >
                Next
                <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
          )}
              </div>
            </div>

      {/* Create Single Shift Modal */}
      {showCreateShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingShiftId ? 'Edit Shift' : 'Add Single Shift'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {editingShiftId 
                      ? 'Edit this shift (changes will create a draft)' 
                      : 'Create a new shift (will be created as draft)'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseCreateShiftModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
                disabled={isCreatingShift}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {shiftFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {shiftFormError}
                </div>
              )}

              {/* Worker Selection */}
              <div>
                <label htmlFor="worker-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Users <span className="text-red-500">*</span>
                </label>
                <select
                  id="worker-select"
                  value={shiftForm.workerId}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, workerId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreatingShift}
                  >
                    <option value="">Select a worker</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.role ? `- ${emp.role}` : ''}
                      </option>
                    ))}
                  </select>
              </div>

              {/* Date Selection */}
              <div>
                <label htmlFor="shift-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="shift-date"
                  value={shiftForm.shiftDate}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, shiftDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreatingShift}
                />
              </div>

              {/* Time Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="start-time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreatingShift}
                  />
                </div>
                <div>
                  <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-2">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="end-time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreatingShift}
                  />
                </div>
              </div>

              {/* Repeating Shift - Only available when creating, not editing */}
              {!editingShiftId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-repeating"
                    checked={shiftForm.isRepeating}
                    onChange={(e) => setShiftForm(prev => ({ ...prev, isRepeating: e.target.checked }))}
                    className="rounded border-gray-300 text-primary focus:ring-primary/20"
                    disabled={isCreatingShift}
                  />
                  <label htmlFor="is-repeating" className="text-sm font-medium text-gray-700">
                    Set it as a repeating shift
                  </label>
                </div>
              )}

              {shiftForm.isRepeating && (
                <div className="pl-6 space-y-4 border-l-2 border-gray-200">
                  <div>
                    <label htmlFor="repeat-frequency" className="block text-sm font-medium text-gray-700 mb-2">
                      Repeat Frequency
                    </label>
                    <select
                      id="repeat-frequency"
                      value={shiftForm.repeatFrequency}
                      onChange={(e) => setShiftForm(prev => ({ ...prev, repeatFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                      disabled={isCreatingShift}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="repeat-end-date" className="block text-sm font-medium text-gray-700 mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="repeat-end-date"
                      value={shiftForm.repeatEndDate}
                      onChange={(e) => setShiftForm(prev => ({ ...prev, repeatEndDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                      disabled={isCreatingShift}
                      min={shiftForm.shiftDate}
                    />
                  </div>
                </div>
              )}

              {/* Site Selection */}
              <div>
                <label htmlFor="site-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <select
                  id="site-select"
                  value={shiftForm.siteId}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, siteId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreatingShift}
                >
                  <option value="">Select a site</option>
                  {sitesList.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Title */}
              <div>
                <label htmlFor="shift-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Shift Title
                </label>
                <input
                  type="text"
                  id="shift-title"
                  value={shiftForm.shiftTitle}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, shiftTitle: e.target.value }))}
                  placeholder="e.g., Morning Shift, Client Name, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreatingShift}
                />
              </div>

              {/* Break Minutes */}
              <div>
                <label htmlFor="break-minutes" className="block text-sm font-medium text-gray-700 mb-2">
                  Break Minutes
                </label>
                <input
                  type="number"
                  id="break-minutes"
                  value={shiftForm.breakMinutes}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, breakMinutes: parseInt(e.target.value) || 0 }))}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreatingShift}
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Note
                </label>
                <textarea
                  id="notes"
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any important information for this shift..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreatingShift}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 sticky bottom-0 bg-white">
              {/* Delete button - only show when editing */}
              {editingShiftId && (
                <button
                  onClick={handleDeleteShiftClick}
                  disabled={isCreatingShift || isDeletingShift}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingShift ? 'Deleting...' : 'Delete'}
                </button>
              )}
              
              {/* Right side buttons */}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={handleCloseCreateShiftModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isCreatingShift}
                >
                  Cancel
                </button>
                <button
                  onClick={editingShiftId ? handleUpdateShift : handleCreateShift}
                  disabled={isCreatingShift}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                  style={{ 
                    backgroundColor: isCreatingShift ? '#9CA3AF' : 'var(--primary-brand-hex)',
                    cursor: isCreatingShift ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCreatingShift 
                    ? (editingShiftId ? 'Updating...' : 'Creating...') 
                    : (editingShiftId ? 'Save Changes' : 'Add Shift')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Multiple Shifts Modal */}
      {showMultipleShifts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Add Multiple Shifts</h3>
                  <p className="text-sm text-gray-500">Create multiple shifts at once (will be created as drafts)</p>
                </div>
              </div>
              <button
                onClick={handleCloseMultipleShiftsModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
                disabled={isCreatingMultipleShifts}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6">
              {multipleShiftsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                  {multipleShiftsError}
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Worker *</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Date *</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Start Time *</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">End Time *</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Location *</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Shift Title</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Break (min)</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Notes</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {multipleShifts.map((row, index) => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <select
                            value={row.workerId}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'workerId', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          >
                            <option value="">Select...</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.shiftDate}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'shiftDate', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="time"
                            value={row.startTime}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'startTime', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="time"
                            value={row.endTime}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'endTime', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.siteId}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'siteId', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          >
                            <option value="">Select...</option>
                            {sitesList.map(site => (
                              <option key={site.id} value={site.id}>
                                {site.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.shiftTitle}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'shiftTitle', e.target.value)}
                            placeholder="Optional"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={row.breakMinutes}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'breakMinutes', parseInt(e.target.value) || 0)}
                            min="0"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => updateMultipleShiftRow(row.id, 'notes', e.target.value)}
                            placeholder="Optional"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            disabled={isCreatingMultipleShifts}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {multipleShifts.length > 1 && (
                            <button
                              onClick={() => removeMultipleShiftRow(row.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              disabled={isCreatingMultipleShifts}
                              aria-label="Remove row"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <div className="mt-4">
                <button
                  onClick={addMultipleShiftRow}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isCreatingMultipleShifts}
                >
                  <Plus className="w-4 h-4" />
                  Add Row
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={handleCloseMultipleShiftsModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isCreatingMultipleShifts}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMultipleShifts}
                disabled={isCreatingMultipleShifts}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isCreatingMultipleShifts ? '#9CA3AF' : 'var(--primary-brand-hex)',
                  cursor: isCreatingMultipleShifts ? 'not-allowed' : 'pointer'
                }}
              >
                {isCreatingMultipleShifts ? 'Creating...' : `Add ${multipleShifts.filter(r => r.workerId && r.shiftDate && r.startTime && r.endTime && r.siteId).length} Shifts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erase Drafts Confirmation Modal */}
      {showEraseDraftsConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Erase Drafts
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEraseDraftsConfirm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
                disabled={isErasingDrafts}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to erase all drafts? 
                All draft shifts will be permanently deleted and any published shifts marked for deletion will be restored. This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowEraseDraftsConfirm(false)}
                disabled={isErasingDrafts}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleEraseDrafts}
                disabled={isErasingDrafts}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isErasingDrafts ? '#9CA3AF' : '#EF4444', // red-500
                }}
              >
                {isErasingDrafts ? 'Erasing...' : 'Confirm Erase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shift Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Shift
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setShowCreateShift(true); // Restore shift modal
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
                disabled={isDeletingShift}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to delete this shift? 
                This shift will be permanently deleted. This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setShowCreateShift(true); // Restore shift modal
                }}
                disabled={isDeletingShift}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteShift}
                disabled={isDeletingShift}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: isDeletingShift ? '#9CA3AF' : '#EF4444', // red-500
                }}
              >
                {isDeletingShift ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Published Shifts Confirmation Modal */}
      {showUnpublishConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Published
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnpublishConfirm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
                disabled={isUnpublishing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to delete all published shifts for the currently filtered workers in this week? 
                All published shifts for the displayed workers will be permanently deleted. This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowUnpublishConfirm(false)}
                disabled={isUnpublishing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleUnpublishWeek}
                disabled={isUnpublishing}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isUnpublishing ? '#9CA3AF' : '#EF4444', // red-500
                }}
              >
                {isUnpublishing ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
