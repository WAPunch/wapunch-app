import { useEffect, useState, useMemo } from 'react';
import { router } from '../../lib/router';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useWhosWorking, WhosWorkingEmployee } from '../../hooks/useWhosWorking';
import { getCurrentStatusDotColor } from '../../hooks/useWorkers';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { useGoogleMapsLoader } from '../../lib/google-maps';
import { 
  Users, 
  Search, 
  Filter,
  Plus,
  Upload,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  List,
  Map,
  SortAsc,
  SortDesc,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CalendarCheck,
  Clock as ClockIcon,
  MapPin as MapPinIcon,
  Flag
} from 'lucide-react';

// Using WhosWorkingEmployee from hook
type Worker = WhosWorkingEmployee;

// Function to generate avatar initials (100% reliable, works everywhere)
const generateAvatarInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Function to generate a consistent background color based on name
// Using primary brand color for all avatars for consistency
const generateAvatarColor = (firstName: string, lastName: string) => {
  return 'var(--primary-brand-hex)'; // Primary brand color
};

// Function to get proportional dot size based on avatar size
const getDotSize = (avatarSize: 'sm' | 'md' | 'lg') => {
  switch (avatarSize) {
    case 'sm': // w-8 h-8 (32px)
      return 'w-2.5 h-2.5'; // 10px
    case 'md': // w-10 h-10 (40px)
      return 'w-3.5 h-3.5'; // 14px
    case 'lg': // w-12 h-12 (48px)
      return 'w-4 h-4'; // 16px
    default:
      return 'w-2.5 h-2.5';
  }
};


export default function WhosWorking() {
  const { registerSubmodules } = useSubmoduleNav();
  const { workers: workersData, isLoading: workersLoading, error: workersError, refetch } = useWhosWorking();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [sortBy, setSortBy] = useState<'firstName' | 'jobTitle' | 'lastActivityTime'>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['present', 'on-break', 'on-transfer']); // Default to "Active" filter
  const [selectedLocation, setSelectedLocation] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Load Google Maps (must be called with identical options app-wide)
  const { isLoaded, loadError } = useGoogleMapsLoader();

  useEffect(() => {
    // Register submodule tabs for time and attendance section
    registerSubmodules('Time & Attendance', [
      { id: 'whos-working', label: "Who's Working", href: '/time-and-attendance/whos-working', icon: Users },
      { id: 'schedule', label: 'Schedule', href: '/time-and-attendance/schedule', icon: Calendar },
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
        // Clear search terms when closing dropdowns
        setStatusSearchTerm('');
        setDepartmentSearchTerm('');
        setLocationSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Use workers from Supabase hook instead of mock data
  const workers: Worker[] = workersData;

  const filteredWorkers = useMemo(() => {
    const filtered = workers.filter(worker => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        worker.firstName.toLowerCase().includes(searchLower) ||
        worker.lastName.toLowerCase().includes(searchLower) ||
        worker.email.toLowerCase().includes(searchLower) ||
        worker.jobTitle.toLowerCase().includes(searchLower) ||
        worker.department.toLowerCase().includes(searchLower)
      );

      // Department filter
      const matchesDepartment = selectedDepartment.length === 0 || selectedDepartment.includes(worker.department);

      // Status filter
      const matchesStatus = selectedStatus.length === 0 || 
        selectedStatus.some(status => {
          if (status === 'out') {
            return worker.status === 'absent' || worker.status === 'on-leave';
          }
          return worker.status === status;
        });

      // Location filter
      const matchesLocation = selectedLocation.length === 0 || selectedLocation.includes(worker.location);

      return matchesSearch && matchesDepartment && matchesStatus && matchesLocation;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;

      switch (sortBy) {
        case 'firstName':
          aValue = a.firstName.toLowerCase();
          bValue = b.firstName.toLowerCase();
          break;
        case 'jobTitle':
          aValue = a.jobTitle.toLowerCase();
          bValue = b.jobTitle.toLowerCase();
          break;
        case 'lastActivityTime':
          aValue = a.lastActivityTime.toLowerCase();
          bValue = b.lastActivityTime.toLowerCase();
          break;
        default:
          aValue = a.firstName.toLowerCase();
          bValue = b.firstName.toLowerCase();
      }

      const strA = aValue as string;
      const strB = bValue as string;
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchTerm, workers, sortBy, sortOrder, selectedDepartment, selectedStatus, selectedLocation]);

  // Filter workers with coordinates (exclude workers who are "Out")
  const workersWithCoords = useMemo(
    () =>
      filteredWorkers.filter(
        (w) =>
          // Must have valid coordinates
          typeof w.latitude === 'number' &&
          typeof w.longitude === 'number' &&
          w.latitude !== 0 &&
          w.longitude !== 0 &&
          // Exclude workers who are "Out" (absent or on-leave)
          w.status !== 'absent' &&
          w.status !== 'on-leave'
      ),
    [filteredWorkers]
  );

  // Create red pin icon for markers (same as Sites)
  const getMarkerIcon = () => {
    if (!isLoaded || typeof google === 'undefined' || !google.maps) return undefined;
    
    try {
      const svgIcon = `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C7.58172 0 4 3.58172 4 8C4 14 12 32 12 32C12 32 20 14 20 8C20 3.58172 16.4183 0 12 0Z" fill="#ef4444"/>
        <circle cx="12" cy="8" r="3" fill="white"/>
      </svg>`;
      
      return {
        url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgIcon))),
        scaledSize: new google.maps.Size(32, 42),
        anchor: new google.maps.Point(16, 42),
      };
    } catch (error) {
      console.error('Error creating marker icon:', error);
      return undefined;
    }
  };

  // Calculate map center based on all workers with coordinates
  const mapCenter = useMemo(() => {
    if (workersWithCoords.length === 0) {
      return { lat: 40.7128, lng: -74.0060 }; // Default to NYC
    }
    
    const avgLat = workersWithCoords.reduce((sum, w) => sum + (w.latitude || 0), 0) / workersWithCoords.length;
    const avgLng = workersWithCoords.reduce((sum, w) => sum + (w.longitude || 0), 0) / workersWithCoords.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [workersWithCoords]);

  // Clear worker selection when search term or filters change
  useEffect(() => {
    setSelectedWorkerId(null);
  }, [searchTerm, selectedDepartment, selectedStatus, selectedLocation]);

  // Fit map bounds to all workers with coordinates (unless user has selected a specific worker)
  useEffect(() => {
    if (!map || !isLoaded) return;
    if (workersWithCoords.length === 0) return;

    // If a worker is selected, we let selection handler control centering/zoom.
    if (selectedWorkerId) return;

    try {
      const bounds = new google.maps.LatLngBounds();
      workersWithCoords.forEach((w) => bounds.extend({ lat: w.latitude!, lng: w.longitude! }));
      map.fitBounds(bounds);
    } catch (error) {
      console.error('Error fitting bounds:', error);
    }
  }, [map, isLoaded, workersWithCoords, selectedWorkerId]);

  // Handle worker click in list to center map on that worker
  const handleWorkerClick = (worker: WhosWorkingEmployee) => {
    if (worker.latitude && worker.longitude && map) {
      setSelectedWorkerId(worker.id);
      map.panTo({ lat: worker.latitude, lng: worker.longitude });
      map.setZoom(15);
    }
  };

  // Handle "View All" button to show all workers
  const handleViewAll = () => {
    setSelectedWorkerId(null);
    if (map) {
      // Use the same filter as workersWithCoords (exclude "Out" workers)
      const workersToShow = filteredWorkers.filter(w => 
        w.latitude && w.longitude && w.latitude !== 0 && w.longitude !== 0 &&
        w.status !== 'absent' && w.status !== 'on-leave'
      );
      if (workersToShow.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        workersToShow.forEach(worker => {
          bounds.extend({ lat: worker.latitude!, lng: worker.longitude! });
        });
        map.fitBounds(bounds);
      }
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedWorkers = filteredWorkers.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle sorting
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedDepartment([]);
    setSelectedStatus([]);
    setSelectedLocation([]);
    setSearchTerm('');
    setStatusSearchTerm('');
    setDepartmentSearchTerm('');
    setLocationSearchTerm('');
    setSelectedWorkerId(null);
  };

  // Handle summary card clicks for quick filters
  const handleSummaryCardClick = (status: string) => {
    // Special case for "active" - selects all non-out statuses
    if (status === 'active') {
      const isCurrentlyActive = isSummaryCardActive('active');
      if (isCurrentlyActive) {
        // If active, clear all filters (toggle off)
        setSelectedStatus([]);
        setSelectedDepartment([]);
        setSelectedLocation([]);
        setStatusSearchTerm('');
        setDepartmentSearchTerm('');
        setLocationSearchTerm('');
      } else {
        // Set all active statuses
        setSelectedStatus(['present', 'on-break', 'on-transfer']);
        setSelectedDepartment([]);
        setSelectedLocation([]);
        setStatusSearchTerm('');
        setDepartmentSearchTerm('');
        setLocationSearchTerm('');
      }
      return;
    }
    
    // Check if this card is currently active
    const isCurrentlyActive = isSummaryCardActive(status);
    
    if (isCurrentlyActive) {
      // If active, clear all filters (toggle off)
      setSelectedStatus([]);
      setSelectedDepartment([]);
      setSelectedLocation([]);
      setStatusSearchTerm('');
      setDepartmentSearchTerm('');
      setLocationSearchTerm('');
    } else {
      // If not active, clear other filters and set only this status
      setSelectedStatus([status]);
      setSelectedDepartment([]);
      setSelectedLocation([]);
      setStatusSearchTerm('');
      setDepartmentSearchTerm('');
      setLocationSearchTerm('');
    }
  };

  // Check if a summary card should be active
  const isSummaryCardActive = (status: string) => {
    if (status === 'active') {
      // Active card is active when all three active statuses are selected
      return selectedStatus.length === 3 && 
             selectedStatus.includes('present') &&
             selectedStatus.includes('on-break') &&
             selectedStatus.includes('on-transfer') &&
             selectedDepartment.length === 0 && 
             selectedLocation.length === 0;
    }
    return selectedStatus.length === 1 && selectedStatus[0] === status && 
           selectedDepartment.length === 0 && selectedLocation.length === 0;
  };

  // Helper functions for multi-select
  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartment(prev => 
      prev.includes(department) 
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleLocationToggle = (location: string) => {
    setSelectedLocation(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  // Select All functions for each filter
  const handleStatusSelectAll = () => {
    const allStatuses = getFilteredStatusOptions();
    setSelectedStatus(allStatuses);
  };

  const handleDepartmentSelectAll = () => {
    const allDepartments = getFilteredDepartmentOptions();
    setSelectedDepartment(allDepartments);
  };

  const handleLocationSelectAll = () => {
    const allLocations = getFilteredLocationOptions();
    setSelectedLocation(allLocations);
  };

  // Filter options based on search terms
  const getFilteredStatusOptions = () => {
    const statusOptions = ['present', 'on-break', 'on-transfer', 'out'];
    if (!statusSearchTerm) return statusOptions;
    return statusOptions.filter(status => 
      status.replace('-', ' ').toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  };

  const getFilteredDepartmentOptions = () => {
    const departmentOptions = ['Executive', 'Engineering', 'Human Resources', 'Product', 'Design', 'Marketing', 'Sales', 'Analytics'];
    if (!departmentSearchTerm) return departmentOptions;
    return departmentOptions.filter(dept => 
      dept.toLowerCase().includes(departmentSearchTerm.toLowerCase())
    );
  };

  const getFilteredLocationOptions = () => {
    const locationOptions = ['San Francisco, CA', 'Seattle, WA', 'Portland, OR', 'Austin, TX', 'New York, NY', 'Miami, FL', 'Boston, MA'];
    if (!locationSearchTerm) return locationOptions;
    return locationOptions.filter(location => 
      location.toLowerCase().includes(locationSearchTerm.toLowerCase())
    );
  };

  // Function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-status-green" />;
      case 'on-break':
        return <ClockIcon className="w-4 h-4 text-status-yellow" />;
      case 'on-transfer':
        return <MapPinIcon className="w-4 h-4 text-status-blue" />;
      case 'on-leave':
      case 'absent':
        return <XCircle className="w-4 h-4 text-status-gray" />;
      default:
        return <Activity className="w-4 h-4 text-status-gray" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-status-green">
            In
          </span>
        );
      case 'on-break':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-status-yellow">
            On Break
          </span>
        );
      case 'on-transfer':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-status-blue">
            On Transfer
          </span>
        );
      case 'on-leave':
      case 'absent':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-status-gray">
            Out
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--neutral-gray) 10%, transparent)', color: 'var(--neutral-gray)' }}>
            {status}
          </span>
        );
    }
  };

  const getActivityBadge = (activity: string) => {
    switch (activity) {
      case 'clock-in':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Clock In
          </span>
        );
      case 'break-start':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            Break Start
          </span>
        );
      case 'transfer-start':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            Transfer Start
          </span>
        );
      case 'clock-out':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            Clock Out
          </span>
        );
      case 'break-end':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Break End
          </span>
        );
      case 'transfer-end':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Transfer End
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {activity}
          </span>
        );
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-1">Who's Working</h1>
          <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
            {workersLoading 
              ? 'Loading worker status...' 
              : `Track your workers' current status and location${filteredWorkers.length > itemsPerPage ? ` (Page ${currentPage} of ${totalPages})` : ''}`
            }
          </p>
        </div>
      </div>

      {/* Error Message */}
      {workersError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <div>
              <div className="text-sm font-medium text-red-800">Error loading worker status</div>
              <div className="text-sm text-red-700">{workersError}</div>
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
      {!workersLoading && !workersError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <button 
            onClick={() => handleSummaryCardClick('active')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('active') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by Active workers (In, On Break, On Transfer)"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold text-gray-900">
                {workers.filter(e => e.status === 'present' || e.status === 'on-break' || e.status === 'on-transfer').length}
              </div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
          </button>
          <button 
            onClick={() => handleSummaryCardClick('present')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('present') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by In status"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-status-green" />
              <div className="text-2xl font-bold text-gray-900">
                {workers.filter(e => e.status === 'present').length}
              </div>
              <div className="text-sm text-muted-foreground">In</div>
            </div>
          </button>
          <button 
            onClick={() => handleSummaryCardClick('on-break')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('on-break') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by On Break status"
          >
            <div className="flex items-center gap-3">
              <ClockIcon className="h-5 w-5 text-status-yellow" />
              <div className="text-2xl font-bold text-gray-900">
                {workers.filter(e => e.status === 'on-break').length}
              </div>
              <div className="text-sm text-muted-foreground">On Break</div>
            </div>
          </button>
          <button 
            onClick={() => handleSummaryCardClick('on-transfer')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('on-transfer') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by On Transfer status"
          >
            <div className="flex items-center gap-3">
              <MapPinIcon className="h-5 w-5 text-status-blue" />
              <div className="text-2xl font-bold text-gray-900">
                {workers.filter(e => e.status === 'on-transfer').length}
              </div>
              <div className="text-sm text-muted-foreground">On Transfer</div>
            </div>
          </button>
          <button 
            onClick={() => handleSummaryCardClick('out')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('out') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by Out status"
          >
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-status-gray" />
              <div className="text-2xl font-bold text-gray-900">
                {workers.filter(e => e.status === 'absent' || e.status === 'on-leave').length}
              </div>
              <div className="text-sm text-muted-foreground">Out</div>
            </div>
          </button>
        </div>
        )}

      {/* Search and Filters */}
      {!workersLoading && !workersError && (
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
                placeholder="Search workers by name, email, job title, or worker ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Search workers"
                id="worker-search"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Clear Filters Button - Only show when filters are active */}
              {(selectedStatus.length > 0 || selectedDepartment.length > 0 || selectedLocation.length > 0) && (
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

              {/* View Mode Toggle */}
              <div className="flex border border-gray-200 rounded overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 transition-colors ${
                    viewMode === 'table'
                      ? 'bg-gray-300 text-black'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  aria-label="Switch to list view"
                  title="Switch to list view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`p-1.5 transition-colors ${
                    viewMode === 'map'
                      ? 'bg-gray-300 text-black'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  aria-label="Switch to map view"
                  title="Switch to map view"
                >
                  <Map className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg py-6 px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
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
                          {status === 'present' ? 'In' :
                           status === 'on-break' ? 'On Break' :
                           status === 'on-transfer' ? 'On Transfer' :
                           'Out'}
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
                    {getFilteredDepartmentOptions().map((department) => (
                      <div key={department} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleDepartmentToggle(department)}>
                        <input type="checkbox" checked={selectedDepartment.includes(department)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{department}</span>
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
                    {getFilteredLocationOptions().map((location) => (
                      <div key={location} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleLocationToggle(location)}>
                        <input type="checkbox" checked={selectedLocation.includes(location)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{location}</span>
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
                  onClick={() => handleSort('firstName')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'firstName' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Name
                  {sortBy === 'firstName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button 
                  onClick={() => handleSort('jobTitle')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'jobTitle' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Job Title
                  {sortBy === 'jobTitle' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button 
                  onClick={() => handleSort('lastActivityTime')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'lastActivityTime' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Last Activity
                  {sortBy === 'lastActivityTime' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Table View */}
      {!workersLoading && !workersError && viewMode === 'table' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900 text-xs w-64">
                    <button
                      onClick={() => handleSort('firstName')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Worker
                      {sortBy === 'firstName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-48">
                    <button
                      onClick={() => handleSort('jobTitle')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Job Title
                      {sortBy === 'jobTitle' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-32">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-48">
                    <button
                      onClick={() => handleSort('lastActivityTime')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Last Activity
                      {sortBy === 'lastActivityTime' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">Location</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Users className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {(() => {
                          // Determine message based on active filters
                          if (selectedStatus.length === 3 && 
                              selectedStatus.includes('present') && 
                              selectedStatus.includes('on-break') && 
                              selectedStatus.includes('on-transfer')) {
                            return 'No active employees';
                          } else if (selectedStatus.length === 1) {
                            if (selectedStatus[0] === 'present') {
                              return 'No employees in';
                            } else if (selectedStatus[0] === 'on-break') {
                              return 'No employees on break';
                            } else if (selectedStatus[0] === 'on-transfer') {
                              return 'No employees on transfer';
                            } else if (selectedStatus[0] === 'out') {
                              return 'No employees out';
                            }
                          }
                          return 'No workers found';
                        })()}
                      </h3>
                      <p className="text-xs text-gray-600">Try adjusting your search criteria.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedWorkers.map((worker, _index) => (
                    <tr key={worker.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 w-64">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" 
                            style={{ backgroundColor: generateAvatarColor(worker.firstName, worker.lastName) }}
                          >
                            {generateAvatarInitials(worker.firstName, worker.lastName)}
                          </div>
                          <div 
                            className={`absolute -bottom-0.5 -right-0.5 ${getDotSize('sm')} rounded-full border border-white`}
                            style={{ backgroundColor: getCurrentStatusDotColor(worker.current_status) }}>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {worker.firstName} {worker.lastName}
                          </div>
                          {worker.department && (
                            <div className="text-xs truncate" style={{ color: 'var(--gray-500)' }}>
                              {worker.department}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 w-48 text-gray-900 text-sm">
                      <span className="truncate block">{worker.jobTitle || '—'}</span>
                    </td>
                    <td className="py-4 px-4 w-32">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(worker.status)}
                        {getStatusBadge(worker.status)}
                      </div>
                    </td>
                    <td className="py-4 px-4 w-48">
                      {worker.lastActivityTime && worker.lastActivityTime !== 'N/A|' ? (
                        (() => {
                          const [action, dateTime] = worker.lastActivityTime.split('|');
                          return (
                            <div className="min-w-0">
                              <div className="text-gray-900 text-sm font-medium truncate">
                                {action}
                              </div>
                              {dateTime && (
                                <div className="text-xs truncate" style={{ color: 'var(--gray-500)' }}>
                                  {dateTime}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-gray-600 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-sm">
                      {worker.location}
                    </td>
                    <td className="py-2 px-2 w-24">
                      <div className="flex items-center">
                        <button 
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`View ${worker.firstName} ${worker.lastName}`}
                          title={`View ${worker.firstName} ${worker.lastName}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`More options for ${worker.firstName} ${worker.lastName}`}
                          title={`More options for ${worker.firstName} ${worker.lastName}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Map View */}
      {!workersLoading && !workersError && viewMode === 'map' && (
        <div className="flex gap-4 mb-4">
          {/* Worker List - 30% width */}
          <div className="w-[30%] bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                Active Workers ({paginatedWorkers.filter(worker => worker.status !== 'absent' && worker.status !== 'on-leave').length})
              </h3>
              {selectedWorkerId && (
                <button
                  onClick={handleViewAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All
                </button>
              )}
            </div>
            <div className="h-[432px] overflow-y-auto">
              {paginatedWorkers.filter(worker => worker.status !== 'absent' && worker.status !== 'on-leave').length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <Users className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-900 mb-1">No active employees</p>
                  <p className="text-xs text-gray-500">There are no active employees at the moment</p>
                </div>
              ) : (
                paginatedWorkers
                  .filter(worker => worker.status !== 'absent' && worker.status !== 'on-leave')
                  .map((worker) => (
                    <div
                      key={worker.id}
                      onClick={() => handleWorkerClick(worker)}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors p-3 cursor-pointer ${
                        selectedWorkerId === worker.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" 
                        style={{ backgroundColor: generateAvatarColor(worker.firstName, worker.lastName) }}
                      >
                        {generateAvatarInitials(worker.firstName, worker.lastName)}
                      </div>
                      <div 
                        className={`absolute -bottom-0.5 -right-0.5 ${getDotSize('sm')} rounded-full border border-white`}
                        style={{ backgroundColor: getCurrentStatusDotColor(worker.current_status) }}>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {worker.firstName} {worker.lastName}
                      </div>
                      {worker.department && (
                        <div className="text-xs truncate" style={{ color: 'var(--gray-500)' }}>
                          {worker.department}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 shrink-0 mt-[1px]" />
                        <span className="whitespace-normal break-words">{worker.location}</span>
                      </div>
                    </div>
                  </div>
                </div>
                  ))
              )}
            </div>
          </div>

          {/* Map - 70% width */}
          <div className="w-[70%] bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-900">
                {selectedWorkerId 
                  ? (() => {
                      const selectedWorker = filteredWorkers.find(w => w.id === selectedWorkerId);
                      return selectedWorker ? `${selectedWorker.firstName} ${selectedWorker.lastName}` : `Worker Locations (${workersWithCoords.length} with coordinates)`;
                    })()
                  : `Worker Locations (${workersWithCoords.length} with coordinates)`
                }
              </h3>
            </div>
            {isLoaded ? (
              <div className="h-[432px]">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={workersWithCoords.length > 1 ? 10 : 15}
                  onLoad={(map) => setMap(map)}
                  options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                  }}
                >
                  {isLoaded &&
                    workersWithCoords
                      .filter(worker => !selectedWorkerId || worker.id === selectedWorkerId)
                      .map((worker) => (
                        <MarkerF
                          key={`worker-marker-${worker.id}`}
                          position={{ lat: worker.latitude!, lng: worker.longitude! }}
                          icon={getMarkerIcon()}
                          onClick={() => {
                            setSelectedWorkerId(worker.id);
                            if (map) {
                              map.panTo({ lat: worker.latitude!, lng: worker.longitude! });
                              map.setZoom(15);
                            }
                          }}
                        />
                      ))}
                </GoogleMap>
              </div>
            ) : loadError ? (
            <div className="h-[432px] bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <Map className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-red-600">Error loading Google Maps</p>
              </div>
            </div>
            ) : (
              <div className="h-[432px] bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <Map className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm text-gray-600">Loading map...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!workersLoading && !workersError && (
      <div className="bg-white border border-gray-200 rounded-lg py-6 px-6">
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
              aria-label="Items per page"
              id="items-per-page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-gray-600">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredWorkers.length)} of {filteredWorkers.length}
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

