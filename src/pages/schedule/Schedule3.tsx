import { useEffect, useMemo, useState } from 'react';
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
  Minus,
  EyeOff,
  UserX,
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
  Eye,
  Flag,
  SortAsc,
  SortDesc
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
  role: string;
  department: string;
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
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

type PlannedShiftRow = {
  id: string;
  company_id: string;
  worker_id: string;
  site_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
  archived: boolean | null;
  job_title?: { name: string } | { name: string }[] | null;
};

type SiteRow = { id: string; site_name: string | null };

type WorkerWorkRuleRow = {
  worker_id: string;
  rule_type: string | null;
  start_date: string | null;
};

function normalizeTime(value: string): string {
  // Supabase time columns often come back as "HH:MM:SS". UI expects "HH:MM".
  if (!value) return '';
  if (value.length >= 5 && value[2] === ':') return value.slice(0, 5);
  return value;
}

export default function Schedule3() {
  const { registerSubmodules } = useSubmoduleNav();
  const { currentCompany } = useCompany();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sitesById, setSitesById] = useState<Record<string, string>>({});
  const [workRuleTypeByWorkerId, setWorkRuleTypeByWorkerId] = useState<Record<string, string>>({});
  
  // Multi-select filter states
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  
  // Dropdown visibility states
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  
  // Search terms within dropdowns
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  
  // Action buttons states
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  
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
      { id: 'schedule3', label: 'Schedule 3', href: '/schedule/schedule3', icon: Calendar },
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

  useEffect(() => {
    const loadScheduleData = async () => {
      if (!currentCompany?.id) {
        setEmployees([]);
        setShifts([]);
        setSitesById({});
        setWorkRuleTypeByWorkerId({});
        setLoadError(null);
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      setLoadError(null);

      try {
        const [workersRes, sitesRes, rulesRes, shiftsRes] = await Promise.all([
          supabase
            .from('workers')
            .select('id, first_name, last_name, is_active, archived, job_title:job_titles(name)')
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
            .select('worker_id, rule_type, start_date')
            .eq('company_id', currentCompany.id)
            .order('start_date', { ascending: false }),
          supabase
            .from('planned_shifts')
            .select('id, company_id, worker_id, site_id, shift_date, start_time, end_time, created_at')
            .eq('company_id', currentCompany.id)
            .gte('shift_date', weekRange.startISO)
            .lte('shift_date', weekRange.endISO)
            .order('shift_date', { ascending: true })
            .order('start_time', { ascending: true }),
        ]);

        if (workersRes.error) throw workersRes.error;
        if (sitesRes.error) throw sitesRes.error;
        if (rulesRes.error) throw rulesRes.error;
        if (shiftsRes.error) throw shiftsRes.error;

        const siteMap: Record<string, string> = {};
        for (const s of (sitesRes.data || []) as SiteRow[]) {
          if (s?.id && s?.site_name) siteMap[s.id] = s.site_name;
        }
        setSitesById(siteMap);

        // Pick the latest rule per worker (rules are ordered by start_date DESC).
        const ruleMap: Record<string, string> = {};
        for (const r of (rulesRes.data || []) as WorkerWorkRuleRow[]) {
          if (!r?.worker_id) continue;
          if (ruleMap[r.worker_id]) continue;
          if (r.rule_type) ruleMap[r.worker_id] = r.rule_type;
        }
        setWorkRuleTypeByWorkerId(ruleMap);

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

        const mappedShifts: Shift[] = ((shiftsRes.data || []) as PlannedShiftRow[]).map((s) => {
          const siteName = (s.site_id && siteMap[s.site_id]) || 'Unassigned site';
          return {
            id: s.id,
            workerId: s.worker_id,
            date: s.shift_date,
            startTime: normalizeTime(s.start_time),
            endTime: normalizeTime(s.end_time),
            role: siteName,
            location: siteName,
            status: 'scheduled',
          };
        });
        setShifts(mappedShifts);
      } catch (err: any) {
        logger.error('Error loading schedule data', err);
        setLoadError(err?.message || 'Error loading schedule data');
        setEmployees([]);
        setShifts([]);
        setSitesById({});
        setWorkRuleTypeByWorkerId({});
      } finally {
        setIsLoadingData(false);
      }
    };

    loadScheduleData();
  }, [currentCompany?.id, weekRange.startISO, weekRange.endISO]);

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
        return 'border-l-blue-500';
      case 'planned':
      case 'planner':
        return 'border-l-green-500';
      case 'open':
        return 'border-l-yellow-500';
      default:
        return 'border-l-gray-400';
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedDepartment([]);
    setSelectedRole([]);
    setSelectedStatus([]);
    setSearchTerm('');
    setDepartmentSearchTerm('');
    setRoleSearchTerm('');
    setStatusSearchTerm('');
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
  const handleDepartmentSelectAll = () => {
    const allDepartments = getFilteredDepartmentOptions();
    setSelectedDepartment(allDepartments);
  };

  const handleRoleSelectAll = () => {
    const allRoles = getFilteredRoleOptions();
    setSelectedRole(allRoles);
  };

  const handleStatusSelectAll = () => {
    const allStatuses = getFilteredStatusOptions();
    setSelectedStatus(allStatuses);
  };

  // Helper functions for multi-select
  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartment(prev => 
      prev.includes(department) 
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleRoleToggle = (role: string) => {
    setSelectedRole(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Filter options based on search terms
  const getFilteredDepartmentOptions = () => {
    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
    return departments.filter(dept => dept.toLowerCase().includes(departmentSearchTerm.toLowerCase()));
  };

  const getFilteredRoleOptions = () => {
    const roles = [...new Set(employees.map(e => e.role).filter(Boolean))];
    return roles.filter(role => role.toLowerCase().includes(roleSearchTerm.toLowerCase()));
  };

  const getFilteredStatusOptions = () => {
    const statuses = ['confirmed', 'pending', 'cancelled'];
    return statuses.filter(status => 
      status.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  };

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(employee => {
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employee.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = selectedDepartment.length === 0 || selectedDepartment.includes(employee.department);
      const matchesRole = selectedRole.length === 0 || selectedRole.includes(employee.role);
      
      return matchesSearch && matchesDepartment && matchesRole;
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
  }, [employees, searchTerm, selectedDepartment, selectedRole, sortBy, sortOrder]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-50 text-status-blue';
      case 'confirmed': return 'bg-green-50 text-status-green';
      case 'completed': return 'bg-green-50 text-status-green';
      case 'cancelled': return 'bg-red-50 text-status-red';
      default: return 'bg-gray-50 text-status-gray';
    }
  };

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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-teal-600" />
            <div className="text-2xl font-bold text-gray-900">{isLoadingData ? '—' : employees.length}</div>
              <div className="text-sm text-muted-foreground">Total Employees</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div className="text-2xl font-bold text-gray-900">{isLoadingData ? '—' : shifts.length}</div>
              <div className="text-sm text-muted-foreground">Scheduled Shifts</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="text-2xl font-bold text-gray-900">
                {shifts.filter(s => s.status === 'confirmed').length}
              </div>
              <div className="text-sm text-muted-foreground">Confirmed</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-muted-foreground">Conflicts</div>
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
              {(selectedDepartment.length > 0 || selectedRole.length > 0 || selectedStatus.length > 0) && (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {/* Department Multi-Select */}
              <div className="relative dropdown-container">
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

              {/* Role Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowRoleDropdown(!showRoleDropdown)}>
                  <span className="text-gray-700">
                    {selectedRole.length === 0 ? 'All Roles' : 
                     selectedRole.length === 1 ? selectedRole[0] :
                     `${selectedRole.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showRoleDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search roles..."
                          value={roleSearchTerm}
                          onChange={(e) => setRoleSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRoleSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedRole.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRole([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedRole.length})
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      {getFilteredRoleOptions().map((role) => (
                        <label key={role} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedRole.includes(role)}
                            onChange={() => handleRoleToggle(role)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowStatusDropdown(!showStatusDropdown)}>
                  <span className="text-gray-700">
                    {selectedStatus.length === 0 ? 'All Statuses' : 
                     selectedStatus.length === 1 ? (selectedStatus[0] || '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) :
                     `${selectedStatus.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showStatusDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search statuses..."
                          value={statusSearchTerm}
                          onChange={(e) => setStatusSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusSelectAll();
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        {selectedStatus.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStatus([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedStatus.length})
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      {getFilteredStatusOptions().map((status) => (
                        <label key={status} className="flex items-center px-3 py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStatus.includes(status)}
                            onChange={() => handleStatusToggle(status)}
                            className="mr-2 rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <span className="text-sm text-gray-700 capitalize">{status}</span>
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
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Minus className="w-4 h-4" />
                      Clear week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <EyeOff className="w-4 h-4" />
                      Unpublish week
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <UserX className="w-4 h-4" />
                      Unassign week
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
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add single shift
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add multiple shifts
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Import shifts from Excel
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Copy className="w-4 h-4" />
                      Add from shift templates
                    </button>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Time off section */}
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CalendarX className="w-4 h-4" />
                      Add unavailability
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <CalendarX className="w-4 h-4" />
                      Add time off
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Publish Button */}
            <button
              className="flex items-center gap-2 px-2 py-1 rounded text-sm text-white transition-colors"
              style={{ backgroundColor: 'var(--primary-brand-hex)' }}
            >
              <span>Publish (4)</span>
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
              <div className="w-64 p-3 pl-6 border-r border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8"></div>
              <span className="text-sm font-medium text-gray-700">Worker</span>
                </div>
            </div>
            
            {/* Day Headers */}
            {weekDates.map((date, index) => (
                <div key={index} className={`flex-1 p-3 bg-gray-50 flex items-center justify-center ${index < weekDates.length - 1 ? 'border-r border-gray-200' : ''}`}>
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
                <div className={`w-64 p-3 pl-6 border-r border-gray-200 border-l-4 ${getWorkRuleBorderColor(workRuleTypeByWorkerId[employee.id])} flex items-center gap-3 ${employeeIndex < paginatedEmployees.length - 1 ? 'border-b border-gray-200' : ''}`}>
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
                  return (
                      <div key={dayIndex} className={`group flex-1 min-h-[60px] relative ${dayIndex < weekDates.length - 1 ? 'border-r border-gray-200' : ''} ${employeeIndex < paginatedEmployees.length - 1 ? 'border-b border-gray-200' : ''}`}>
                      {dayShifts.length > 0 ? (
                        <>
                          {dayShifts.map((shift, shiftIndex) => (
                              <div
                                key={shift.id}
                                className={`absolute text-xs cursor-pointer transition-all duration-200 flex flex-col justify-center group-hover:left-6 ${getStatusColor(shift.status)} ${
                                  dayShifts.length > 1 
                                    ? shiftIndex === 0 
                                      ? 'top-0 bottom-1/2 border-b border-gray-300 left-0 right-0' 
                                      : 'top-1/2 bottom-0 left-0 right-0'
                                    : 'inset-0'
                                }`}
                                onClick={() => setSelectedEmployee(employee.id)}
                              style={{ 
                                borderLeft: '3px solid',
                                borderLeftColor: shift.status === 'scheduled' ? 'var(--status-blue)' : 
                                                shift.status === 'confirmed' ? 'var(--status-green)' : 
                                                shift.status === 'completed' ? 'var(--status-green)' : 
                                                shift.status === 'cancelled' ? 'var(--status-red)' : 'var(--status-gray)'
                              }}
                            >
                              <div className="px-2">
                                <div className="font-medium text-xs leading-tight truncate">{shift.role}</div>
                                <div className="text-xs opacity-75 leading-tight flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {shift.startTime} – {shift.endTime}
                                </div>
                              </div>
                            </div>
                          ))}
                          {/* Add button that appears on hover */}
                          <button 
                            disabled={!canPlanShiftsForWorker(employee.id)}
                            title={
                              canPlanShiftsForWorker(employee.id)
                                ? `Add shift for ${employee.name}`
                                : 'This worker is not configured for planner-based scheduling'
                            }
                            className={`absolute top-1/2 left-1 transform -translate-y-1/2 w-4 h-4 bg-white border border-gray-200 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                              canPlanShiftsForWorker(employee.id)
                                ? 'hover:bg-gray-50'
                                : 'cursor-not-allowed opacity-0 group-hover:opacity-30'
                            }`}
                            onClick={() => {
                              if (!canPlanShiftsForWorker(employee.id)) return;
                              setSelectedEmployee(employee.id);
                              setShowCreateShift(true);
                            }}
                            aria-label={`Add shift for ${employee.name}`}
                          >
                            <Plus className="w-2.5 h-2.5 text-gray-400" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <button 
                            disabled={!canPlanShiftsForWorker(employee.id)}
                            title={
                              canPlanShiftsForWorker(employee.id)
                                ? `Add shift for ${employee.name}`
                                : 'This worker is not configured for planner-based scheduling'
                            }
                            className={`opacity-0 group-hover:opacity-100 w-6 h-6 border border-gray-200 rounded flex items-center justify-center transition-all duration-200 ${
                              canPlanShiftsForWorker(employee.id)
                                ? 'hover:bg-gray-50'
                                : 'cursor-not-allowed opacity-0 group-hover:opacity-30'
                            }`}
                            onClick={() => {
                              if (!canPlanShiftsForWorker(employee.id)) return;
                              setSelectedEmployee(employee.id);
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

    </div>
  );
}
