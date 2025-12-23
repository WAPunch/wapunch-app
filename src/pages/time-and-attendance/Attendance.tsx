import { useEffect, useState, useMemo } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useAttendance, WorkerAttendanceData } from '../../hooks/useAttendance';
import { getCurrentStatusDotColor } from '../../hooks/useWorkers';
import { 
  Users, 
  Calendar, 
  Clock,
  Flag,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  SortAsc,
  SortDesc,
  Eye,
  MoreVertical,
  AlertCircle,
  ChevronDown,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  workerId: string;
  employeeName: string;
  role: string;
  department: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breaks: Array<{ id: string; startTime: string; endTime: string | null; duration: number }>;
  transfers: Array<{ id: string; startTime: string; endTime: string | null; duration: number }>;
  totalHours: number;
  totalBreakTime: number; // in minutes
  totalTransferTime: number; // in minutes
  status: 'present' | 'absent' | 'late' | 'partial' | 'on-break' | 'on-leave' | 'on-transfer';
  location: string;
  currentStatus: 'out' | 'in' | 'on_break' | 'on_transfer';
}

export default function Attendance() {
  const { registerSubmodules } = useSubmoduleNav();
  const getISODate = (d: Date = new Date()) => d.toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(() => getISODate());
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'employeeName' | 'department' | 'clockIn' | 'totalHours' | 'location'>('employeeName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [activeFloatingMenu, setActiveFloatingMenu] = useState<string | null>(null);

  const { workers, isLoading, error, refetch } = useAttendance(selectedDate);

  useEffect(() => {
    // Register submodule tabs for time and attendance
    registerSubmodules('Time & Attendance', [
      { id: 'whos-working', label: "Who's Working", href: '/time-and-attendance/whos-working', icon: Users },
      // { id: 'schedule', label: 'Schedule', href: '/time-and-attendance/schedule', icon: Calendar }, // Hidden for future use
      { id: 'attendance', label: 'Attendance', href: '/time-and-attendance/attendance', icon: Clock },
      { id: 'attendance-flags', label: 'Attendance Flags', href: '/time-and-attendance/attendance-flags', icon: Flag }
    ]);
  }, [registerSubmodules]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowStatusDropdown(false);
        setShowDepartmentDropdown(false);
        setShowLocationDropdown(false);
        setStatusSearchTerm('');
        setDepartmentSearchTerm('');
        setLocationSearchTerm('');
      }
      if (!target.closest('[data-menu-id]')) {
        setActiveFloatingMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Date navigation
  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(getISODate(date));
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(getISODate(date));
  };

  // Format time helper
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Convert worker data to AttendanceRecord format
  const attendanceRecords: AttendanceRecord[] = useMemo(() => {
    return workers.map(worker => {
      // Determine status based on current status and attendance
      let status: AttendanceRecord['status'] = 'absent';
      if (worker.firstClockIn) {
        if (worker.currentStatus === 'in') {
          status = 'present';
        } else if (worker.currentStatus === 'on_break') {
          status = 'on-break';
        } else if (worker.currentStatus === 'on_transfer') {
          status = 'on-transfer';
        } else if (worker.lastClockOut) {
          status = 'partial';
        } else {
          status = 'present';
        }
      }

      // Map breaks from summary
      const breaks = worker.summarySessions
        .filter(s => s.sessionType === 'break')
        .map(s => ({
          id: s.id,
          startTime: formatTime(s.startTime),
          endTime: s.endTime ? formatTime(s.endTime) : null,
          duration: (s.durationSeconds || 0) / 60
        }));

      // Map transfers from summary
      const transfers = worker.summarySessions
        .filter(s => s.sessionType === 'transfer')
        .map(s => ({
          id: s.id,
          startTime: formatTime(s.startTime),
          endTime: s.endTime ? formatTime(s.endTime) : null,
          duration: (s.durationSeconds || 0) / 60
        }));

      return {
        id: worker.workerId,
        workerId: worker.workerId,
        employeeName: worker.workerName,
        role: worker.jobTitle,
        department: worker.department,
        date: selectedDate,
        clockIn: worker.firstClockIn ? formatTime(worker.firstClockIn) : null,
        clockOut: worker.lastClockOut ? formatTime(worker.lastClockOut) : null,
        breaks,
        transfers,
        totalHours: worker.totalWorkHours,
        totalBreakTime: worker.totalBreakMinutes,
        totalTransferTime: worker.totalTransferMinutes,
        status,
        location: worker.primaryLocation,
        currentStatus: worker.currentStatus
      };
    });
  }, [workers, selectedDate]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter(record => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        record.employeeName.toLowerCase().includes(searchLower) ||
        record.role.toLowerCase().includes(searchLower) ||
        record.department.toLowerCase().includes(searchLower) ||
        record.location.toLowerCase().includes(searchLower)
      );

      // Department filter
      const matchesDepartment = selectedDepartment.length === 0 || selectedDepartment.includes(record.department);

      // Status filter
      const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(record.status);

      // Location filter
      const matchesLocation = selectedLocation.length === 0 || selectedLocation.includes(record.location);

      return matchesSearch && matchesDepartment && matchesStatus && matchesLocation;
    });
  }, [attendanceRecords, searchTerm, selectedDepartment, selectedStatus, selectedLocation]);

  // Sort records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'employeeName':
          comparison = a.employeeName.localeCompare(b.employeeName);
          break;
        case 'department':
          comparison = a.department.localeCompare(b.department);
          break;
        case 'clockIn':
          const aTime = a.clockIn || '99:99';
          const bTime = b.clockIn || '99:99';
          comparison = aTime.localeCompare(bTime);
          break;
        case 'totalHours':
          comparison = a.totalHours - b.totalHours;
          break;
        case 'location':
          comparison = a.location.localeCompare(b.location);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredRecords, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = sortedRecords.slice(startIndex, startIndex + itemsPerPage);

  // Calculate stats
  const totalWorkers = attendanceRecords.length;
  const presentWorkers = attendanceRecords.filter(r => r.status === 'present').length;
  const absentWorkers = attendanceRecords.filter(r => r.status === 'absent').length;
  const onBreakWorkers = attendanceRecords.filter(r => r.status === 'on-break').length;
  const workersWithOvertime = attendanceRecords.filter(r => r.totalHours > 8).length;

  // Filter helpers
  const clearFilters = () => {
    setSelectedDepartment([]);
    setSelectedStatus([]);
    setSelectedLocation([]);
    setSearchTerm('');
  };

  const getFilteredStatusOptions = () => {
    const statuses = ['present', 'absent', 'late', 'partial', 'on-break', 'on-leave', 'on-transfer'];
    if (!statusSearchTerm) return statuses;
    return statuses.filter(s => s.toLowerCase().includes(statusSearchTerm.toLowerCase()));
  };

  const getFilteredDepartmentOptions = () => {
    const departments = Array.from(new Set(attendanceRecords.map(r => r.department).filter(Boolean))).sort();
    if (!departmentSearchTerm) return departments;
    return departments.filter(d => d.toLowerCase().includes(departmentSearchTerm.toLowerCase()));
  };

  const getFilteredLocationOptions = () => {
    const locations = Array.from(new Set(attendanceRecords.map(r => r.location).filter(Boolean))).sort();
    if (!locationSearchTerm) return locations;
    return locations.filter(l => l.toLowerCase().includes(locationSearchTerm.toLowerCase()));
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const handleDepartmentToggle = (dept: string) => {
    setSelectedDepartment(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  };

  const handleLocationToggle = (loc: string) => {
    setSelectedLocation(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  };

  const handleStatusSelectAll = () => {
    setSelectedStatus(getFilteredStatusOptions());
  };

  const handleDepartmentSelectAll = () => {
    setSelectedDepartment(getFilteredDepartmentOptions());
  };

  const handleLocationSelectAll = () => {
    setSelectedLocation(getFilteredLocationOptions());
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleRecordSelect = (recordId: string) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const handleRecordExpansion = (recordId: string) => {
    setExpandedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const toggleFloatingMenu = (menuId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveFloatingMenu(activeFloatingMenu === menuId ? null : menuId);
  };

  const getWorkSessionsCount = (record: AttendanceRecord) => {
    // Count work sessions from summary (work type sessions)
    const worker = workers.find(w => w.workerId === record.workerId);
    if (!worker) return 1;
    return worker.summarySessions.filter(s => s.sessionType === 'work').length || 1;
  };

  const generateWorkSessions = (record: AttendanceRecord) => {
    const worker = workers.find(w => w.workerId === record.workerId);
    if (!worker) return [];
    
    return worker.summarySessions
      .filter(s => s.sessionType === 'work')
      .map((s, index) => ({
        id: s.id,
        sessionNumber: index + 1,
        location: s.siteName,
        startTime: formatTime(s.startTime),
        endTime: s.endTime ? formatTime(s.endTime) : null,
        totalWorkHours: (s.durationSeconds || 0) / 3600
      }));
  };

  const getStatusDotColor = (record: AttendanceRecord) => {
    return getCurrentStatusDotColor(record.currentStatus);
  };

  const generateAvatarInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const generateAvatarColor = () => {
    return 'var(--primary-brand-hex)';
  };

  const getOvertimeHours = (totalHours: number) => {
    return Math.max(0, totalHours - 8);
  };

  const getDotSize = () => 'w-2.5 h-2.5';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-1">Attendance</h1>
            <p className="text-xs text-muted-foreground">Track and manage workers attendance records</p>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
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
              aria-label="Select date"
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

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <div className="text-sm font-medium text-red-800">Error loading attendance data</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
            <button
              onClick={() => refetch()}
              className="ml-auto px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-green" />
            <div className="text-2xl font-bold text-gray-900">{totalWorkers}</div>
            <div className="text-sm text-muted-foreground">Total Workers</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-green" />
            <div className="text-2xl font-bold text-gray-900">{presentWorkers}</div>
            <div className="text-sm text-muted-foreground">Present</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-green" />
            <div className="text-2xl font-bold text-gray-900">{absentWorkers}</div>
            <div className="text-sm text-muted-foreground">Absent</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-green" />
            <div className="text-2xl font-bold text-gray-900">{onBreakWorkers}</div>
            <div className="text-sm text-muted-foreground">On Break</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-status-green" />
            <div className="text-2xl font-bold text-gray-900">{workersWithOvertime}</div>
            <div className="text-sm text-muted-foreground">Overtime</div>
          </div>
        </div>
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
              {/* Clear Filters Button */}
              {(selectedStatus.length > 0 || selectedDepartment.length > 0 || selectedLocation.length > 0) && (
                <button
                  onClick={clearFilters}
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
                    </div>
                    {getFilteredStatusOptions().map((status) => (
                      <div key={status} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleStatusToggle(status)}>
                        <input type="checkbox" checked={selectedStatus.includes(status)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">
                          {status === 'present' ? 'Present' :
                           status === 'absent' ? 'Absent' :
                           status === 'late' ? 'Late' :
                           status === 'partial' ? 'Partial' :
                           status === 'on-break' ? 'On Break' :
                           status === 'on-leave' ? 'On Leave' :
                           status === 'on-transfer' ? 'On Transfer' :
                           status}
                        </span>
                      </div>
                    ))}
                    {getFilteredStatusOptions().length === 0 && (
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
                    </div>
                    {getFilteredDepartmentOptions().map((dept) => (
                      <div key={dept} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleDepartmentToggle(dept)}>
                        <input type="checkbox" checked={selectedDepartment.includes(dept)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{dept}</span>
                      </div>
                    ))}
                    {getFilteredDepartmentOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No departments found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Location Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowLocationDropdown(!showLocationDropdown)}>
                  <span className="text-gray-700">
                    {selectedLocation.length === 0 ? 'All Locations' : 
                     selectedLocation.length === 1 ? selectedLocation[0] :
                     `${selectedLocation.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showLocationDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search locations..."
                          value={locationSearchTerm}
                          onChange={(e) => setLocationSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLocationSelectAll();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Select All
                          </button>
                          {selectedLocation.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLocation([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                            >
                              Clear ({selectedLocation.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {getFilteredLocationOptions().map((loc) => (
                      <div key={loc} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleLocationToggle(loc)}>
                        <input type="checkbox" checked={selectedLocation.includes(loc)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{loc}</span>
                      </div>
                    ))}
                    {getFilteredLocationOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No locations found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attendance Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading attendance data...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-16">
                    <input
                      type="checkbox"
                      checked={selectedRecords.size === paginatedRecords.length && paginatedRecords.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecords(new Set(paginatedRecords.map(r => r.id)));
                        } else {
                          setSelectedRecords(new Set());
                        }
                      }}
                      className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-56">
                    <button
                      onClick={() => handleSort('employeeName')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Employee
                      {sortBy === 'employeeName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                    <button
                      onClick={() => handleSort('location')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Location
                      {sortBy === 'location' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs">
                    <button
                      onClick={() => handleSort('clockIn')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Clock In
                      {sortBy === 'clockIn' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs">Clock Out</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs">Breaks</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs">Transfers</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs">
                    <button
                      onClick={() => handleSort('totalHours')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Total Hours
                      {sortBy === 'totalHours' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
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
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">No attendance records found</p>
                      <p className="text-sm text-gray-500">
                        {attendanceRecords.length === 0 
                          ? 'No workers found for this date'
                          : 'Try adjusting your search or filter criteria'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record) => {
                    const workSessionsCount = getWorkSessionsCount(record);
                    const hasMultipleSessions = workSessionsCount > 1;
                    const isExpanded = expandedRecords.has(record.id);
                    const workSessions = hasMultipleSessions ? generateWorkSessions(record) : [];
                    
                    return (
                      <>
                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-2 w-16">
                            <div className="flex items-center justify-center h-full">
                              {hasMultipleSessions ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleRecordExpansion(record.id)}
                                    className="w-3.5 h-3.5 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
                                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} work sessions for ${record.employeeName}`}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRightIcon className="w-3 h-3" />
                                    )}
                                  </button>
                                  <span className="text-xs text-gray-500 font-medium">
                                    {workSessionsCount}
                                  </span>
                                </div>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={selectedRecords.has(record.id)}
                                  onChange={() => handleRecordSelect(record.id)}
                                  className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                                  aria-label={`Select ${record.employeeName}`}
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-2 pl-1 pr-6 w-56">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div 
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                  style={{ backgroundColor: generateAvatarColor() }}
                                >
                                  {generateAvatarInitials(
                                    record.employeeName.split(' ')[0] || '', 
                                    record.employeeName.split(' ')[1] || ''
                                  )}
                                </div>
                                <div 
                                  className={`absolute -bottom-0.5 -right-0.5 ${getDotSize()} rounded-full border border-white`}
                                  style={{ backgroundColor: getStatusDotColor(record) }}
                                />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{record.employeeName}</div>
                                <div className="text-xs" style={{ color: 'var(--gray-500)' }}>{record.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <span className="text-sm text-gray-900">{record.location}</span>
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-sm text-gray-900">{record.clockIn || '--'}</span>
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-sm text-gray-900">{record.clockOut || '--'}</span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              {record.breaks.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-gray-900">{record.breaks.length}</span>
                                  <span className="text-xs text-gray-500">
                                    ({(record.totalBreakTime / 60).toFixed(2)}h)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">--</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              {record.transfers.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-gray-900">{record.transfers.length}</span>
                                  <span className="text-xs text-gray-500">
                                    ({(record.totalTransferTime / 60).toFixed(2)}h)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">--</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-sm text-gray-900">{record.totalHours.toFixed(2)}h</span>
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-sm text-gray-900">
                              {getOvertimeHours(record.totalHours) > 0 ? `${getOvertimeHours(record.totalHours).toFixed(2)}h` : '--'}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-start">
                              {/* Modified icon placeholder */}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-start">
                              {/* Flag icon placeholder */}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center">
                              <button
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                aria-label={`View ${record.employeeName} attendance details`}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <div className="relative" data-menu-id={record.id}>
                                <button
                                  onClick={(e) => toggleFloatingMenu(record.id, e)}
                                  className={`p-1 hover:bg-gray-100 rounded transition-colors border ${
                                    activeFloatingMenu === record.id ? 'border-gray-300 bg-gray-50' : 'border-transparent'
                                  }`}
                                  aria-label={`More options for ${record.employeeName}`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {activeFloatingMenu === record.id && (
                                  <div className="absolute right-0 top-0 mr-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 min-w-48">
                                    <button className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 transition-colors">
                                      View Details
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Work Sessions */}
                        {hasMultipleSessions && isExpanded && workSessions.map((session: any) => (
                          <tr key={session.id} className="bg-gray-25 hover:bg-gray-50 transition-colors border-l-2 border-l-primary/20">
                            <td className="py-2 px-2 w-16">
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRecords.has(session.id)}
                                  onChange={() => handleRecordSelect(session.id)}
                                  className="w-3.5 h-3.5 text-primary focus:ring-primary/20 border-gray-300 rounded"
                                />
                              </div>
                            </td>
                            <td className="py-2 pl-1 pr-6 w-56">
                              <div className="flex items-center gap-3 pl-8">
                                <div className="text-xs text-gray-500">Session {session.sessionNumber}</div>
                              </div>
                            </td>
                            <td className="py-2 px-4">
                              <span className="text-sm text-gray-900">{session.location}</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-sm text-gray-900">{session.startTime}</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-sm text-gray-900">{session.endTime || '--'}</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-sm text-gray-500">--</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-sm text-gray-500">--</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-sm text-gray-900">{session.totalWorkHours.toFixed(2)}h</span>
                            </td>
                            <td className="py-2 px-2">
                              <span className="text-sm text-gray-500">--</span>
                            </td>
                            <td className="py-2 px-2"></td>
                            <td className="py-2 px-2"></td>
                            <td className="py-2 px-2"></td>
                          </tr>
                        ))}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && sortedRecords.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs text-gray-600">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedRecords.length)} of {sortedRecords.length}
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
      )}
    </div>
  );
}
