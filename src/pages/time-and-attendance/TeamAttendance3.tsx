import { useEffect, useState, useMemo } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useAttendanceDailySummary } from '../../hooks/useAttendanceDailySummary';
import { getCurrentStatusDotColor } from '../../hooks/useWorkers';
import { useCompanySitesById } from '../../hooks/useCompanySitesById';
import { supabase } from '../../lib/supabase';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Users,
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MoreVertical,
  SortAsc,
  SortDesc,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Flag,
  Coffee,
  Timer,
  Eye
} from 'lucide-react';

// Helper functions
const generateAvatarInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

const generateAvatarColor = () => {
  return 'var(--primary-brand-hex)';
};

const getDotSize = (avatarSize: 'sm' | 'md' | 'lg') => {
  switch (avatarSize) {
    case 'sm': return 'w-2.5 h-2.5';
    case 'md': return 'w-3.5 h-3.5';
    case 'lg': return 'w-4 h-4';
    default: return 'w-2.5 h-2.5';
  }
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export default function TeamAttendance3() {
  const { registerSubmodules } = useSubmoduleNav();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showFlagsDropdown, setShowFlagsDropdown] = useState(false);
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [flagsSearchTerm, setFlagsSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Sorting
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'worked' | 'expected'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch data from database
  const { records: dailySummaryRecords, isLoading, error } = useAttendanceDailySummary(selectedDate);
  const { sitesById } = useCompanySitesById();
  
  // Store expanded sessions
  const [sessionsCache, setSessionsCache] = useState<Record<string, any[]>>({});

  // Clear caches when the date changes
  useEffect(() => {
    setSessionsCache({});
    setExpandedRecords(new Set());
    setSelectedRecords(new Set());
    setCurrentPage(1);
  }, [selectedDate]);

  const resolveSiteName = (siteId?: string | null) => {
    if (!siteId) return 'N/A';
    return sitesById[siteId] || 'N/A';
  };

  const getSessionLocation = (session: any) => {
    const startName = resolveSiteName(session.start_site_id);
    const endName = resolveSiteName(session.end_site_id);
    const idsDiffer =
      session.start_site_id &&
      session.end_site_id &&
      session.start_site_id !== session.end_site_id;

    const isInconsistent = Boolean(session.location_inconsistent) || Boolean(idsDiffer);

    if (session.session_type === 'work' && isInconsistent) {
      const text = `${startName} \u2192 ${endName}`;
      const tooltip =
        session.inconsistency_reason ||
        `Work session started at ${startName} and ended at ${endName} without a transfer.`;
      return { text, isInconsistent: true, tooltip };
    }

    return { text: startName, isInconsistent: false, tooltip: '' };
  };

  const getParentLocationText = (attendanceDayId: string) => {
    const sessions = sessionsCache[attendanceDayId] || [];
    const workSessions = sessions.filter((s: any) => s.session_type === 'work');
    const locSet = new Set<string>();

    for (const s of workSessions) {
      const loc = getSessionLocation(s).text;
      if (loc && loc !== 'N/A') locSet.add(loc);
    }

    if (locSet.size === 0) return 'N/A';
    if (locSet.size === 1) return Array.from(locSet)[0] || 'N/A';
    return 'Multiple Locations';
  };

  // Register submodules
  useEffect(() => {
    registerSubmodules('Time & Attendance', [
      { id: 'whos-working', label: "Who's Working", href: '/time-and-attendance/whos-working', icon: Users },
      { id: 'schedule', label: 'Schedule', href: '/time-and-attendance/schedule', icon: Calendar },
      { id: 'team-attendance', label: 'Team Attendance', href: '/time-and-attendance/team-attendance', icon: Clock },
      { id: 'team-attendance3', label: 'Team Attendance 3', href: '/time-and-attendance/team-attendance3', icon: Clock },
      { id: 'attendance-flags', label: 'Attendance Flags', href: '/time-and-attendance/attendance-flags', icon: Flag }
    ]);
  }, [registerSubmodules]);

  // Date navigation
  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  // Get unique values for filters
  const departments = useMemo(() => {
    const unique = new Set(dailySummaryRecords.map(r => r.department_name).filter(Boolean));
    return Array.from(unique) as string[];
  }, [dailySummaryRecords]);

  const statuses = ['ok', 'exception', 'missing'];
  const flags = ['Late', 'Early Leave', 'Overtime', 'Modified', 'Time Off'];

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let filtered = dailySummaryRecords;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        `${r.worker_first_name} ${r.worker_last_name}`.toLowerCase().includes(search) ||
        r.department_name?.toLowerCase().includes(search) ||
        r.worker_code?.toLowerCase().includes(search)
      );
    }

    // Department filter
    if (selectedDepartment.length > 0) {
      filtered = filtered.filter(r => 
        r.department_name && selectedDepartment.includes(r.department_name)
      );
    }

    // Status filter (based on worked vs expected)
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(r => {
        let status = 'ok';
        if (r.worked_minutes === 0 && (r.expected_minutes || 0) > 0) {
          status = 'missing';
        } else if (r.has_late || r.has_early_leave || r.has_overtime) {
          status = 'exception';
        }
        return selectedStatus.includes(status);
      });
    }

    // Flags filter
    if (selectedFlags.length > 0) {
      filtered = filtered.filter(r => {
        if (selectedFlags.includes('Late') && !r.has_late) return false;
        if (selectedFlags.includes('Early Leave') && !r.has_early_leave) return false;
        if (selectedFlags.includes('Overtime') && !r.has_overtime) return false;
        if (selectedFlags.includes('Modified') && !r.is_modified) return false;
        if (selectedFlags.includes('Time Off') && !r.is_time_off) return false;
        return true;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'name':
          compareValue = `${a.worker_first_name} ${a.worker_last_name}`.localeCompare(
            `${b.worker_first_name} ${b.worker_last_name}`
          );
          break;
        case 'department':
          compareValue = (a.department_name || '').localeCompare(b.department_name || '');
          break;
        case 'worked':
          compareValue = a.worked_minutes - b.worked_minutes;
          break;
        case 'expected':
          compareValue = (a.expected_minutes || 0) - (b.expected_minutes || 0);
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [dailySummaryRecords, searchTerm, selectedDepartment, selectedStatus, selectedFlags, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // Prefetch sessions for the current page so Location + session counts are available without expanding.
  useEffect(() => {
    const attendanceDayIds = paginatedRecords
      .map(r => r.attendance_day_id)
      .filter(Boolean) as string[];
    const missing = attendanceDayIds.filter(id => !sessionsCache[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('attendance_sessions')
        .select(
          'id, attendance_day_id, session_type, start_time, end_time, duration_minutes, is_modified, crosses_midnight, start_site_id, end_site_id, location_inconsistent, inconsistency_reason'
        )
        .in('attendance_day_id', missing)
        .order('start_time');

      if (cancelled) return;
      if (fetchError) return;
      if (!data) return;

      const grouped: Record<string, any[]> = {};
      for (const s of data as any[]) {
        if (!s?.attendance_day_id) continue;
        if (!grouped[s.attendance_day_id]) grouped[s.attendance_day_id] = [];
        grouped[s.attendance_day_id]?.push(s);
      }

      setSessionsCache(prev => ({ ...prev, ...grouped }));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedRecords]);

  // Stats for cards
  const stats = useMemo(() => {
    const totalWorked = dailySummaryRecords.reduce((sum, r) => sum + r.worked_minutes, 0);
    const lateCount = dailySummaryRecords.filter(r => r.has_late).length;
    const earlyLeaveCount = dailySummaryRecords.filter(r => r.has_early_leave).length;
    const overtimeCount = dailySummaryRecords.filter(r => r.has_overtime).length;
    const timeOffCount = dailySummaryRecords.filter(r => r.is_time_off).length;
    
    return {
      totalHours: Math.round(totalWorked / 60 * 10) / 10,
      late: lateCount,
      earlyLeave: earlyLeaveCount,
      overtime: overtimeCount,
      timeOff: timeOffCount
    };
  }, [dailySummaryRecords]);

  // Handle row expansion
  const toggleExpanded = async (recordId: string, attendanceDayId: string) => {
    const newExpanded = new Set(expandedRecords);
    
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
      
      // Fetch sessions if not cached
      if (!sessionsCache[attendanceDayId]) {
        const { data } = await supabase
          .from('attendance_sessions')
          .select(
            'id, attendance_day_id, session_type, start_time, end_time, duration_minutes, is_modified, crosses_midnight, start_site_id, end_site_id, location_inconsistent, inconsistency_reason'
          )
          .eq('attendance_day_id', attendanceDayId)
          .order('start_time');
        
        if (data) {
          setSessionsCache(prev => ({ ...prev, [attendanceDayId]: data }));
        }
      }
    }
    
    setExpandedRecords(newExpanded);
  };

  // Get status for display
  const getStatus = (record: typeof dailySummaryRecords[0]) => {
    if (record.is_time_off) return 'on-leave';
    if (record.worked_minutes === 0 && (record.expected_minutes || 0) > 0) return 'absent';
    if (record.has_late) return 'late';
    if (record.worked_minutes > 0) return 'present';
    return 'absent';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Present</span>;
      case 'absent':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Absent</span>;
      case 'late':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Late</span>;
      case 'on-leave':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">On Leave</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowDepartmentDropdown(false);
        setShowStatusDropdown(false);
        setShowFlagsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading attendance data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-2">Error loading attendance data</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-1">Team Attendance</h1>
            <p className="text-xs text-muted-foreground">Track and manage worker attendance records</p>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors border border-gray-200"
            >
              Today
            </button>
            
            <button
              onClick={goToPreviousDay}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40 px-3 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
            />
            
            <button
              onClick={goToNextDay}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <button 
          className="bg-white border border-gray-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
          title="Filter by Time Related flags"
        >
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-red" />
            <div className="text-2xl font-bold text-gray-900">
              {stats.late}
            </div>
            <div className="text-sm text-muted-foreground">Time Related</div>
          </div>
        </button>
        
        <button 
          className="bg-white border border-gray-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
          title="Filter by Event Integrity flags"
        >
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-red" />
            <div className="text-2xl font-bold text-gray-900">
              0
            </div>
            <div className="text-sm text-muted-foreground">Event Integrity</div>
          </div>
        </button>
        
        <button 
          className="bg-white border border-gray-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
          title="Filter by Schedule Deviation flags"
        >
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-red" />
            <div className="text-2xl font-bold text-gray-900">
              0
            </div>
            <div className="text-sm text-muted-foreground">Schedule Deviation</div>
          </div>
        </button>
        
        <button 
          className="bg-white border border-gray-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
          title="Filter by Break Related flags"
        >
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-red" />
            <div className="text-2xl font-bold text-gray-900">
              0
            </div>
            <div className="text-sm text-muted-foreground">Break Related</div>
          </div>
        </button>
        
        <button 
          className="bg-white border border-gray-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer"
          title="Filter by Overtime flags"
        >
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-red" />
            <div className="text-2xl font-bold text-gray-900">
              {stats.overtime}
            </div>
            <div className="text-sm text-muted-foreground">Overtime</div>
          </div>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-4">
        <div className={`bg-white border border-gray-200 py-6 px-6 ${
          showFilters ? 'rounded-t-lg' : 'rounded-lg'
        }`}>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees, roles, or departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Search attendance records"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Clear Filters Button - Only show when filters are active */}
              {(selectedStatus.length > 0 || selectedDepartment.length > 0 || selectedFlags.length > 0) && (
                <button
                  onClick={() => {
                    setSelectedStatus([]);
                    setSelectedDepartment([]);
                    setSelectedFlags([]);
                  }}
                  className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded transition-colors text-sm bg-white text-gray-700 hover:bg-gray-50"
                  title="Clear all active filters"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              )}

              <button
                className={`px-3 py-1 border rounded text-sm transition-colors ${
                  showFilters
                    ? 'bg-gray-300 text-black border-gray-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Toggle filters"
              >
                <Filter className="w-4 h-4 inline mr-1" />
                Filters
              </button>
            </div>
          </div>
        </div>
        
        {showFilters && (
          <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg py-6 px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {/* Status Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowStatusDropdown(!showStatusDropdown)}>
                  <span className="text-gray-700">
                    {selectedStatus.length === 0 ? 'All Statuses' : 
                     selectedStatus.length === 1 ? selectedStatus[0]?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) :
                     `${selectedStatus.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStatus(statuses);
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
                    </div>
                    {statuses.filter(s => s.toLowerCase().includes(statusSearchTerm.toLowerCase())).map((status) => (
                      <div key={status} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => {
                             setSelectedStatus(prev =>
                               prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                             );
                           }}>
                        <input type="checkbox" checked={selectedStatus.includes(status)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">
                          {status === 'ok' ? 'Ok' :
                           status === 'exception' ? 'Exception' :
                           status === 'missing' ? 'Missing' :
                           status}
                        </span>
                      </div>
                    ))}
                    {statuses.filter(s => s.toLowerCase().includes(statusSearchTerm.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No statuses found
                      </div>
                    )}
                  </div>
                )}
              </div>

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
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDepartment(departments);
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
                    </div>
                    {departments.filter(d => d?.toLowerCase().includes(departmentSearchTerm.toLowerCase())).map((department) => (
                      <div key={department} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => {
                             setSelectedDepartment(prev =>
                               prev.includes(department) ? prev.filter(d => d !== department) : [...prev, department]
                             );
                           }}>
                        <input type="checkbox" checked={selectedDepartment.includes(department)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{department}</span>
                      </div>
                    ))}
                    {departments.filter(d => d?.toLowerCase().includes(departmentSearchTerm.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No departments found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Flags Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowFlagsDropdown(!showFlagsDropdown)}>
                  <span className="text-gray-700">
                    {selectedFlags.length === 0 ? 'All Records' : 
                     selectedFlags.length === 1 ? selectedFlags[0] :
                     `${selectedFlags.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showFlagsDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search flags..."
                          value={flagsSearchTerm}
                          onChange={(e) => setFlagsSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFlags(flags);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Select All
                          </button>
                          {selectedFlags.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFlags([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                            >
                              Clear ({selectedFlags.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {flags.filter(f => f.toLowerCase().includes(flagsSearchTerm.toLowerCase())).map((flag) => (
                      <div key={flag} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => {
                             setSelectedFlags(prev =>
                               prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
                             );
                           }}>
                        <input type="checkbox" checked={selectedFlags.includes(flag)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{flag}</span>
                      </div>
                    ))}
                    {flags.filter(f => f.toLowerCase().includes(flagsSearchTerm.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No flags found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={() => {
                  setSelectedStatus([]);
                  setSelectedDepartment([]);
                  setSelectedFlags([]);
                }}
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
                  onClick={() => handleSort('worked')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'worked' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Hours
                  {sortBy === 'worked' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-center py-3 px-2 font-medium text-gray-900 text-xs w-16">
                  <div className="flex items-center justify-center h-full">
                    <input
                      type="checkbox"
                      checked={selectedRecords.size === paginatedRecords.length && paginatedRecords.length > 0}
                      onChange={() => {
                        if (selectedRecords.size === paginatedRecords.length) {
                          setSelectedRecords(new Set());
                        } else {
                          setSelectedRecords(new Set(paginatedRecords.map(r => r.id)));
                        }
                      }}
                      className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                      aria-label="Select all records"
                    />
                  </div>
                </th>
                <th className="text-left py-3 pl-1 pr-6 font-medium text-gray-900 text-xs w-56">
                  <div className="flex items-center gap-3">
                    <div className="w-6"></div>
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-gray-700 pl-1.5"
                    >
                      Worker
                      {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  Location
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">
                  Start
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">End</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">
                  Breaks
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">
                  Transfers
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">
                  <button
                    onClick={() => handleSort('worked')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Total Hours
                    {sortBy === 'worked' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">
                  Overtime
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-12">
                  <div className="w-4 h-4 rounded-full border border-gray-900 flex items-center justify-center">
                    <span className="text-[10px] font-medium text-gray-900">M</span>
                  </div>
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-12">
                  <Flag className="w-4 h-4 inline text-gray-900" />
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
            {paginatedRecords.map((record, index) => {
              const isExpanded = expandedRecords.has(record.id);
              const sessions = sessionsCache[record.attendance_day_id] || [];
              
              return (
                <>
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-2 w-16">
                      <div className="flex items-center justify-center h-full">
                        <input
                          type="checkbox"
                          checked={selectedRecords.has(record.id)}
                          onChange={() => {
                            const newSelected = new Set(selectedRecords);
                            if (newSelected.has(record.id)) {
                              newSelected.delete(record.id);
                            } else {
                              newSelected.add(record.id);
                            }
                            setSelectedRecords(newSelected);
                          }}
                          className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                          aria-label={`Select ${record.worker_first_name} ${record.worker_last_name}`}
                        />
                      </div>
                    </td>
                    <td className="py-2 pl-1 pr-6 w-56">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleExpanded(record.id, record.attendance_day_id)}
                          className="w-3.5 h-3.5 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} sessions for ${record.worker_first_name} ${record.worker_last_name}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRightIcon className="w-3 h-3" />
                          )}
                        </button>
                        <div className="relative">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                            style={{ backgroundColor: generateAvatarColor() }}
                          >
                            {generateAvatarInitials(record.worker_first_name, record.worker_last_name)}
                          </div>
                          <div 
                            className={`absolute -bottom-0.5 -right-0.5 ${getDotSize('sm')} rounded-full border border-white`}
                            style={{ backgroundColor: 'var(--avatar-status-gray)' }}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {record.worker_first_name} {record.worker_last_name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--gray-500)' }}>{record.job_title_name || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <span className="text-sm text-gray-900">{getParentLocationText(record.attendance_day_id)}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-sm text-gray-900">--</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-sm text-gray-900">--</span>
                    </td>
                      <td className="py-2 px-2">
                        {record.break_minutes > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-900">
                              {formatDuration(record.break_minutes)}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({sessions.filter(s => s.session_type === 'break').length})
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">--</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {record.transfer_minutes > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-900">
                              {formatDuration(record.transfer_minutes)}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({sessions.filter(s => s.session_type === 'transfer').length})
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">--</span>
                        )}
                      </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDuration(record.worked_minutes)}
                        </span>
                        {sessions.filter(s => s.session_type === 'work').length > 0 && (
                          <span className="text-xs text-gray-500">
                            ({sessions.filter(s => s.session_type === 'work').length})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-sm text-gray-900">
                        {record.overtime_minutes > 0 ? formatDuration(record.overtime_minutes) : '--'}
                      </span>
                    </td>
                    <td className="py-2 px-2 w-12">
                      {record.is_modified && (
                        <div className="flex items-center justify-start">
                          <div className="w-4 h-4 rounded-full bg-status-blue flex items-center justify-center">
                            <span className="text-[10px] font-medium text-white">M</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 w-12">
                      <div className="flex items-center justify-start">
                        {(record.has_late || record.has_early_leave || record.has_overtime) && (
                          <Flag className="w-4 h-4 text-status-red" />
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 w-24">
                      <div className="flex items-center">
                        <div className="relative">
                          <button
                            className="p-1 hover:bg-gray-100 rounded transition-colors border border-transparent"
                            aria-label={`More options for ${record.worker_first_name} ${record.worker_last_name}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                    {/* Expanded Work Sessions */}
                    {isExpanded && sessions.filter(s => s.session_type === 'work').map((session, sessionIndex) => (
                      <tr key={session.id} className="bg-gray-25 hover:bg-gray-50 transition-colors border-l-2 border-l-primary/20">
                        <td className="py-2 px-2 w-16">
                          {/* Empty space to align with checkbox column */}
                        </td>
                        <td className="py-2 pl-1 pr-6 w-56">
                          <div className="flex items-center gap-3">
                            <div className="w-8 flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedRecords.has(session.id)}
                                onChange={() => {
                                  const newSelected = new Set(selectedRecords);
                                  if (newSelected.has(session.id)) {
                                    newSelected.delete(session.id);
                                  } else {
                                    newSelected.add(session.id);
                                  }
                                  setSelectedRecords(newSelected);
                                }}
                                className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                                aria-label={`Select Work Session ${sessionIndex + 1}`}
                              />
                            </div>
                            <span className="text-sm text-gray-600 font-medium">
                              Work Session {sessionIndex + 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          {(() => {
                            const loc = getSessionLocation(session);
                            return (
                              <div className="flex items-center gap-2">
                                {loc.isInconsistent && (
                                  <span title={loc.tooltip} className="inline-flex items-center text-orange-600">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </span>
                                )}
                                <span className="text-sm text-gray-900">{loc.text}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{formatTime(session.start_time)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{session.end_time ? formatTime(session.end_time) : '--'}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Breaks column - empty for individual sessions */}
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Transfers column - empty for individual sessions */}
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{formatDuration(session.duration_minutes)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Overtime - empty for individual sessions */}
                        </td>
                        <td className="py-2 px-2 w-12">
                          {session.is_modified && (
                            <div className="flex items-center justify-start">
                              <div className="w-4 h-4 rounded-full bg-status-blue flex items-center justify-center">
                                <span className="text-[10px] font-medium text-white">M</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 w-12">
                          <div className="flex items-center justify-start">
                            {session.crosses_midnight && (
                              <span className="text-xs text-blue-600 font-medium">(+1)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <div className="flex items-center">
                            <button
                              className="p-1 rounded transition-colors invisible"
                              aria-hidden="true"
                              disabled
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <div className="relative">
                              <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors border border-transparent"
                                aria-label={`More options for Work Session ${sessionIndex + 1}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Expanded Break Sessions */}
                    {isExpanded && sessions.filter(s => s.session_type === 'break').map((session, sessionIndex) => (
                      <tr key={session.id} className="bg-gray-25 hover:bg-gray-50 transition-colors border-l-2 border-l-primary/20">
                        <td className="py-2 px-2 w-16">
                          {/* Empty space to align with checkbox column */}
                        </td>
                        <td className="py-2 pl-1 pr-6 w-56">
                          <div className="flex items-center gap-3">
                            <div className="w-8 flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedRecords.has(session.id)}
                                onChange={() => {
                                  const newSelected = new Set(selectedRecords);
                                  if (newSelected.has(session.id)) {
                                    newSelected.delete(session.id);
                                  } else {
                                    newSelected.add(session.id);
                                  }
                                  setSelectedRecords(newSelected);
                                }}
                                className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                                aria-label={`Select Break ${sessionIndex + 1}`}
                              />
                            </div>
                            <span className="text-sm text-gray-600 font-medium">
                              Break {sessionIndex + 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-sm text-gray-900">{resolveSiteName(session.start_site_id)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{formatTime(session.start_time)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{session.end_time ? formatTime(session.end_time) : '--'}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{formatDuration(session.duration_minutes)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Transfers column - empty for break sessions */}
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Total Hours - empty for individual sessions */}
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Overtime - empty for individual sessions */}
                        </td>
                        <td className="py-2 px-2 w-12">
                          {session.is_modified && (
                            <div className="flex items-center justify-start">
                              <div className="w-4 h-4 rounded-full bg-status-blue flex items-center justify-center">
                                <span className="text-[10px] font-medium text-white">M</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 w-12">
                          <div className="flex items-center justify-start">
                            {session.crosses_midnight && (
                              <span className="text-xs text-blue-600 font-medium">(+1)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <div className="flex items-center">
                            <button
                              className="p-1 rounded transition-colors invisible"
                              aria-hidden="true"
                              disabled
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <div className="relative">
                              <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors border border-transparent"
                                aria-label={`More options for Break ${sessionIndex + 1}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Expanded Transfer Sessions */}
                    {isExpanded && sessions.filter(s => s.session_type === 'transfer').map((session, sessionIndex) => (
                      <tr key={session.id} className="bg-gray-25 hover:bg-gray-50 transition-colors border-l-2 border-l-primary/20">
                        <td className="py-2 px-2 w-16">
                          {/* Empty space to align with checkbox column */}
                        </td>
                        <td className="py-2 pl-1 pr-6 w-56">
                          <div className="flex items-center gap-3">
                            <div className="w-8 flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedRecords.has(session.id)}
                                onChange={() => {
                                  const newSelected = new Set(selectedRecords);
                                  if (newSelected.has(session.id)) {
                                    newSelected.delete(session.id);
                                  } else {
                                    newSelected.add(session.id);
                                  }
                                  setSelectedRecords(newSelected);
                                }}
                                className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                                aria-label={`Select Transfer ${sessionIndex + 1}`}
                              />
                            </div>
                            <span className="text-sm text-gray-600 font-medium">
                              Transfer {sessionIndex + 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-sm text-gray-900">{resolveSiteName(session.start_site_id)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{formatTime(session.start_time)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{session.end_time ? formatTime(session.end_time) : '--'}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Breaks column - empty for transfer sessions */}
                        </td>
                        <td className="py-2 px-2 w-24">
                          <span className="text-sm text-gray-900">{formatDuration(session.duration_minutes)}</span>
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Total Hours - empty for individual sessions */}
                        </td>
                        <td className="py-2 px-2 w-24">
                          {/* Overtime - empty for individual sessions */}
                        </td>
                        <td className="py-2 px-2 w-12">
                          {session.is_modified && (
                            <div className="flex items-center justify-start">
                              <div className="w-4 h-4 rounded-full bg-status-blue flex items-center justify-center">
                                <span className="text-[10px] font-medium text-white">M</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 w-12">
                          <div className="flex items-center justify-start">
                            {session.crosses_midnight && (
                              <span className="text-xs text-blue-600 font-medium">(+1)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 w-24">
                          <div className="flex items-center">
                            <button
                              className="p-1 rounded transition-colors invisible"
                              aria-hidden="true"
                              disabled
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <div className="relative">
                              <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors border border-transparent"
                                aria-label={`More options for Transfer ${sessionIndex + 1}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-white border border-gray-200 rounded-lg py-6 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">Show:</span>
            <select 
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset to first page when changing items per page
              }}
              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length}
            </span>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === 1
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
              </button>
              
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
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1 px-2 py-1 border rounded text-xs transition-colors ${
                  currentPage === totalPages
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
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

