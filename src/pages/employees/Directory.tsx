import { useEffect, useState, useMemo } from 'react';
import { router } from '../../lib/router';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useEmployees } from '../../hooks/useEmployees';
import { 
  Users, 
  GitBranch, 
  Search, 
  Filter,
  Plus,
  Upload,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  List,
  Grid3X3,
  SortAsc,
  SortDesc,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit
} from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  status: 'Active' | 'Suspended' | 'Onboarding' | 'On Leave';
  location: string;
  startDate: string;
  avatar?: string;
  phone?: string;
}

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

export default function Directory() {
  const { registerSubmodules } = useSubmoduleNav();
  const { employees: employeesData, isLoading: employeesLoading, error: employeesError, refetch } = useEmployees();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'firstName' | 'jobTitle' | 'department' | 'startDate'>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showEmploymentTypeDropdown, setShowEmploymentTypeDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [employmentTypeSearchTerm, setEmploymentTypeSearchTerm] = useState('');
  const [locationSearchTerm, setLocationSearchTerm] = useState('');

  useEffect(() => {
    // Register submodule tabs for management employees section
    registerSubmodules('Employee Directory', [
      { id: 'directory', label: 'Directory', href: '/employees/directory', icon: Users },
      { id: 'org-chart', label: 'Organizational Chart', href: '/employees/organizational-chart', icon: GitBranch }
    ]);
  }, [registerSubmodules]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowDepartmentDropdown(false);
        setShowStatusDropdown(false);
        setShowEmploymentTypeDropdown(false);
        setShowLocationDropdown(false);
        // Clear search terms when closing dropdowns
        setDepartmentSearchTerm('');
        setStatusSearchTerm('');
        setEmploymentTypeSearchTerm('');
        setLocationSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Use employees from Supabase instead of mock data
  const employees: Employee[] = employeesData;

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(employee => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        employee.firstName.toLowerCase().includes(searchLower) ||
        employee.lastName.toLowerCase().includes(searchLower) ||
        employee.email.toLowerCase().includes(searchLower) ||
        employee.jobTitle.toLowerCase().includes(searchLower) ||
        employee.department.toLowerCase().includes(searchLower)
      );

      // Department filter
      const matchesDepartment = selectedDepartment.length === 0 || selectedDepartment.includes(employee.department);

      // Status filter
      const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(employee.status);

      // Employment type filter (assuming all employees are full-time for now)
      const matchesEmploymentType = selectedEmploymentType.length === 0 || selectedEmploymentType.includes('Full-time');

      // Location filter
      const matchesLocation = selectedLocation.length === 0 || selectedLocation.includes(employee.location);

      return matchesSearch && matchesDepartment && matchesStatus && matchesEmploymentType && matchesLocation;
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
        case 'department':
          aValue = a.department.toLowerCase();
          bValue = b.department.toLowerCase();
          break;
        case 'startDate':
          aValue = new Date(a.startDate);
          bValue = new Date(b.startDate);
          break;
        default:
          aValue = a.firstName.toLowerCase();
          bValue = b.firstName.toLowerCase();
      }

      if (sortBy === 'startDate') {
        const dateA = aValue as Date;
        const dateB = bValue as Date;
        return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      } else {
        const strA = aValue as string;
        const strB = bValue as string;
        if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
        if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }
    });
  }, [searchTerm, employees, sortBy, sortOrder, selectedDepartment, selectedStatus, selectedEmploymentType, selectedLocation]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + itemsPerPage);

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
    setSelectedEmploymentType([]);
    setSelectedLocation([]);
    setSearchTerm('');
    setDepartmentSearchTerm('');
    setStatusSearchTerm('');
    setEmploymentTypeSearchTerm('');
    setLocationSearchTerm('');
  };

  // Helper functions for multi-select
  const handleDepartmentToggle = (department: string) => {
    setSelectedDepartment(prev => 
      prev.includes(department) 
        ? prev.filter(d => d !== department)
        : [...prev, department]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleEmploymentTypeToggle = (employmentType: string) => {
    setSelectedEmploymentType(prev => 
      prev.includes(employmentType) 
        ? prev.filter(e => e !== employmentType)
        : [...prev, employmentType]
    );
  };

  const handleLocationToggle = (location: string) => {
    setSelectedLocation(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  // Filter options based on search terms
  const getFilteredDepartmentOptions = () => {
    const departmentOptions = ['Executive', 'Engineering', 'Human Resources', 'Product', 'Marketing', 'Sales'];
    if (!departmentSearchTerm) return departmentOptions;
    return departmentOptions.filter(dept => 
      dept.toLowerCase().includes(departmentSearchTerm.toLowerCase())
    );
  };

  const getFilteredStatusOptions = () => {
    const statusOptions = ['Active', 'Onboarding', 'On Leave', 'Suspended'];
    if (!statusSearchTerm) return statusOptions;
    return statusOptions.filter(status => 
      status.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  };

  const getFilteredEmploymentTypeOptions = () => {
    const employmentTypeOptions = ['Full-time', 'Part-time', 'Contract', 'Intern'];
    if (!employmentTypeSearchTerm) return employmentTypeOptions;
    return employmentTypeOptions.filter(type => 
      type.toLowerCase().includes(employmentTypeSearchTerm.toLowerCase())
    );
  };

  const getFilteredLocationOptions = () => {
    const locationOptions = ['San Francisco, CA', 'Seattle, WA', 'Portland, OR', 'Austin, TX', 'New York, NY'];
    if (!locationSearchTerm) return locationOptions;
    return locationOptions.filter(location => 
      location.toLowerCase().includes(locationSearchTerm.toLowerCase())
    );
  };

  // Navigate to employee info page
  const handleEditEmployee = (employee: Employee) => {
    // Store employee data in sessionStorage for the Employee Info page
    sessionStorage.setItem('selectedEmployee', JSON.stringify(employee));
    
    // Create slug from employee name
    const slug = `${employee.firstName.toLowerCase()}-${employee.lastName.toLowerCase()}`;
    
    router.navigate(`/employees/employee-info/${slug}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-status-green">
            Active
          </span>
        );
      case 'Suspended':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-status-red">
            Suspended
          </span>
        );
      case 'Onboarding':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-status-blue">
            Onboarding
          </span>
        );
      case 'On Leave':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-status-purple">
            On Leave
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

  const _getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">Employee Directory</h1>
          <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
            {`Manage your team of ${filteredEmployees.length} employees${filteredEmployees.length > itemsPerPage ? ` (Page ${currentPage} of ${totalPages})` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm">
            <Upload style={{ width: '14px', height: '14px' }} />
            Import
          </button>
          <button className="flex items-center gap-2 px-2 py-1 rounded text-white transition-colors text-sm" style={{ backgroundColor: 'var(--primary-brand-hex)' }}>
            <Plus style={{ width: '14px', height: '14px' }} />
            Add Person
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      {!employeesLoading && (
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
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-gray-300 text-black'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  aria-label="Switch to grid view"
                  title="Switch to grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg py-6 px-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
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

              {/* Status Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowStatusDropdown(!showStatusDropdown)}>
                  <span className="text-gray-700">
                    {selectedStatus.length === 0 ? 'All Statuses' : 
                     selectedStatus.length === 1 ? selectedStatus[0] :
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
                    {getFilteredStatusOptions().map((status) => (
                      <div key={status} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleStatusToggle(status)}>
                        <input type="checkbox" checked={selectedStatus.includes(status)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{status}</span>
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

              {/* Employment Type Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowEmploymentTypeDropdown(!showEmploymentTypeDropdown)}>
                  <span className="text-gray-700">
                    {selectedEmploymentType.length === 0 ? 'All Employment Types' : 
                     selectedEmploymentType.length === 1 ? selectedEmploymentType[0] :
                     `${selectedEmploymentType.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showEmploymentTypeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search employment types..."
                          value={employmentTypeSearchTerm}
                          onChange={(e) => setEmploymentTypeSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {selectedEmploymentType.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmploymentType([]);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                          >
                            Clear ({selectedEmploymentType.length})
                          </button>
                        )}
                      </div>
                    </div>
                    {getFilteredEmploymentTypeOptions().map((employmentType) => (
                      <div key={employmentType} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleEmploymentTypeToggle(employmentType)}>
                        <input type="checkbox" checked={selectedEmploymentType.includes(employmentType)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{employmentType}</span>
                      </div>
                    ))}
                    {getFilteredEmploymentTypeOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No employment types found
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
                  onClick={() => handleSort('department')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'department' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Department
                  {sortBy === 'department' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
                <button 
                  onClick={() => handleSort('startDate')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'startDate' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Start Date
                  {sortBy === 'startDate' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Error Message */}
      {employeesError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <div>
              <div className="text-sm font-medium text-red-800">Error loading employees</div>
              <div className="text-sm text-red-700">{employeesError}</div>
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

      {/* Table View */}
      {!employeesError && !employeesLoading && viewMode === 'table' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('firstName')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Employee
                    {sortBy === 'firstName' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('jobTitle')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Job Title
                    {sortBy === 'jobTitle' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('department')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Department
                    {sortBy === 'department' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">Location</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('startDate')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Start Date
                    {sortBy === 'startDate' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">No employees found</p>
                    <p className="text-sm text-gray-500">
                      {employeesData.length === 0 
                        ? 'Start by adding employees to your company'
                        : 'Try adjusting your search criteria'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((employee, _index) => (
                <tr key={employee.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" 
                          style={{ backgroundColor: generateAvatarColor(employee.firstName, employee.lastName) }}
                        >
                          {generateAvatarInitials(employee.firstName, employee.lastName)}
                        </div>
                        <div 
                          className={`absolute -bottom-0.5 -right-0.5 ${getDotSize('sm')} rounded-full border border-white`}
                          style={{
                            backgroundColor: 
                              employee.status === 'Active' ? 'var(--avatar-status-green)' :
                              employee.status === 'On Leave' ? 'var(--avatar-status-orange)' :
                              employee.status === 'Onboarding' ? 'var(--avatar-status-blue)' :
                              employee.status === 'Suspended' ? 'var(--avatar-status-red)' :
                              'var(--avatar-status-gray)'
                          }}>
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--gray-500)' }}>{employee.email}</div>
                      </div>
                  </div>
                  </td>
                  <td className="py-4 px-4 text-gray-900 text-sm">{employee.jobTitle}</td>
                  <td className="py-4 px-4 text-gray-900 text-sm">{employee.department}</td>
                  <td className="py-4 px-4">{getStatusBadge(employee.status)}</td>
                  <td className="py-4 px-4 text-gray-600 text-sm">{employee.location}</td>
                  <td className="py-4 px-4 text-gray-600 text-sm">{employee.startDate}</td>
                  <td className="py-2 px-2 w-24">
                    <div className="flex items-center">
                      <button 
                        onClick={() => handleEditEmployee(employee)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label={`View ${employee.firstName} ${employee.lastName}`}
                        title={`View ${employee.firstName} ${employee.lastName}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label={`More options for ${employee.firstName} ${employee.lastName}`}
                        title={`More options for ${employee.firstName} ${employee.lastName}`}
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

      {/* Grid View */}
      {!employeesError && !employeesLoading && viewMode === 'grid' && (
        <>
          {filteredEmployees.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center mb-4">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No employees found</p>
              <p className="text-sm text-gray-500">
                {employeesData.length === 0 
                  ? 'Start by adding employees to your company'
                  : 'Try adjusting your search criteria'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-4">
              {paginatedEmployees.map((employee) => (
            <div
              key={employee.id}
              className="bg-white border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-primary/20 group rounded-lg p-6"
            >
              {/* Employee Avatar and Basic Info */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-base" 
                    style={{ backgroundColor: generateAvatarColor(employee.firstName, employee.lastName) }}
                  >
                    {generateAvatarInitials(employee.firstName, employee.lastName)}
                  </div>
                  <div 
                    className={`absolute -bottom-1 -right-1 ${getDotSize('lg')} rounded-full border-2 border-white`}
                    style={{
                      backgroundColor: 
                        employee.status === 'Active' ? 'var(--avatar-status-green)' :
                        employee.status === 'On Leave' ? 'var(--avatar-status-orange)' :
                        employee.status === 'Onboarding' ? 'var(--avatar-status-blue)' :
                        employee.status === 'Suspended' ? 'var(--avatar-status-red)' :
                        'var(--avatar-status-gray)'
                    }}>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
                    {employee.firstName} {employee.lastName}
                  </h3>
                  <p className="text-xs text-gray-600 truncate">{employee.jobTitle}</p>
                  <div className="mt-1">
                    {getStatusBadge(employee.status)}
                  </div>
                </div>
                <button 
                  onClick={() => handleEditEmployee(employee)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary"
                  aria-label={`Edit ${employee.firstName} ${employee.lastName}`}
                  title={`Edit ${employee.firstName} ${employee.lastName}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{employee.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{employee.phone || '+1 (555) 000-0000'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{employee.location}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>Started {new Date(employee.startDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Department and Manager */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-900">{employee.department}</span>
                  <span className="text-xs text-gray-500">Reports to Manager</span>
                </div>
              </div>
            </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {!employeesLoading && (
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
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length}
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