import { useEffect, useState, useMemo } from 'react';
import { router } from '../../lib/router';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useWorkers, getCurrentStatusDotColor } from '../../hooks/useWorkers';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import ImportWorkersWizard from '../../components/ImportWorkersWizard';
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
  Grid3X3,
  SortAsc,
  SortDesc,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Power,
  PowerOff,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';

interface Worker {
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
  worker_type?: 'employee' | 'contractor';
  custom_worker_id?: string;
  current_status?: 'out' | 'in' | 'on_break' | 'on_transfer';
  is_active?: boolean;
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
  const { workers: workersData, isLoading: workersLoading, error: workersError, refetch } = useWorkers();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'firstName' | 'custom_id' | 'jobTitle' | 'department'>('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedWorkerType, setSelectedWorkerType] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [showWorkerTypeDropdown, setShowWorkerTypeDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [workerTypeSearchTerm, setWorkerTypeSearchTerm] = useState('');
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [jobTitleSearchTerm, setJobTitleSearchTerm] = useState('');
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);

  useEffect(() => {
    // Register submodule tabs for management workers section
    registerSubmodules('Worker Directory', [
      { id: 'directory', label: 'Directory', href: '/workers/directory', icon: Users }
    ]);
  }, [registerSubmodules]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
            setShowWorkerTypeDropdown(false);
        setShowDepartmentDropdown(false);
            setShowJobTitleDropdown(false);
        setShowStatusDropdown(false);
        // Clear search terms when closing dropdowns
            setWorkerTypeSearchTerm('');
        setDepartmentSearchTerm('');
            setJobTitleSearchTerm('');
        setStatusSearchTerm('');
          }
          // Close action menu when clicking outside
          if (!target.closest('[data-menu-id]')) {
            setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Use workers from Supabase instead of mock data
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
        worker.department.toLowerCase().includes(searchLower) ||
        (worker.custom_worker_id && worker.custom_worker_id.toLowerCase().includes(searchLower))
      );

      // Worker Type filter
      const matchesWorkerType = selectedWorkerType.length === 0 || selectedWorkerType.includes(worker.worker_type || 'employee');

      // Department filter
      const matchesDepartment = selectedDepartment.length === 0 || selectedDepartment.includes(worker.department);

      // Job Title filter
      const matchesJobTitle = selectedJobTitle.length === 0 || selectedJobTitle.includes(worker.jobTitle);

      // Status filter (active/inactive based on is_active)
      const workerStatus = worker.is_active ? 'Active' : 'Inactive';
      const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(workerStatus);

      return matchesSearch && matchesWorkerType && matchesDepartment && matchesJobTitle && matchesStatus;
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
        case 'custom_id':
          aValue = (a.custom_worker_id || '').toLowerCase();
          bValue = (b.custom_worker_id || '').toLowerCase();
          break;
        case 'jobTitle':
          aValue = a.jobTitle.toLowerCase();
          bValue = b.jobTitle.toLowerCase();
          break;
        case 'department':
          aValue = a.department.toLowerCase();
          bValue = b.department.toLowerCase();
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
  }, [searchTerm, workers, sortBy, sortOrder, selectedWorkerType, selectedDepartment, selectedJobTitle, selectedStatus]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedWorkers = filteredWorkers.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle sorting
  const handleSort = (field: 'firstName' | 'custom_id' | 'jobTitle' | 'department') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedWorkerType([]);
    setSelectedDepartment([]);
    setSelectedJobTitle([]);
    setSelectedStatus([]);
    setSearchTerm('');
    setWorkerTypeSearchTerm('');
    setDepartmentSearchTerm('');
    setJobTitleSearchTerm('');
    setStatusSearchTerm('');
  };

  // Helper functions for multi-select
  const handleWorkerTypeToggle = (workerType: string) => {
    setSelectedWorkerType(prev => 
      prev.includes(workerType) 
        ? prev.filter(w => w !== workerType)
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
        ? prev.filter(j => j !== jobTitle)
        : [...prev, jobTitle]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Filter options based on search terms - get unique values from workers
  const getFilteredWorkerTypeOptions = () => {
    const workerTypeOptions = Array.from(new Set(workers.map(w => w.worker_type || 'employee')))
      .map(type => type === 'contractor' ? 'Contractor' : 'Employee')
      .sort();
    if (!workerTypeSearchTerm) return workerTypeOptions;
    return workerTypeOptions.filter(type => 
      type.toLowerCase().includes(workerTypeSearchTerm.toLowerCase())
    );
  };

  const getFilteredDepartmentOptions = () => {
    const departmentOptions = Array.from(new Set(workers.map(w => w.department).filter(Boolean))).sort();
    if (!departmentSearchTerm) return departmentOptions;
    return departmentOptions.filter(dept => 
      dept.toLowerCase().includes(departmentSearchTerm.toLowerCase())
    );
  };

  const getFilteredJobTitleOptions = () => {
    const jobTitleOptions = Array.from(new Set(workers.map(w => w.jobTitle).filter(Boolean))).sort();
    if (!jobTitleSearchTerm) return jobTitleOptions;
    return jobTitleOptions.filter(title => 
      title.toLowerCase().includes(jobTitleSearchTerm.toLowerCase())
    );
  };

  const getFilteredStatusOptions = () => {
    const statusOptions = ['Active', 'Inactive'];
    if (!statusSearchTerm) return statusOptions;
    return statusOptions.filter(status => 
      status.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  };

  // Navigate to worker info page
  const handleEditWorker = (worker: Worker) => {
    // Store worker data in sessionStorage for the Worker Info page
    sessionStorage.setItem('selectedWorker', JSON.stringify(worker));
    
    // Create slug from worker name
    const slug = `${worker.firstName.toLowerCase()}-${worker.lastName.toLowerCase()}`;
    
    router.navigate(`/workers/worker-info/${slug}`);
  };

  // Navigate to add new worker page
  const handleAddWorker = () => {
    // Clear any previously selected worker
    sessionStorage.removeItem('selectedWorker');
    // Navigate to worker info page without a slug to create a new worker
    router.navigate('/workers/worker-info');
  };

  // Toggle action menu
  const toggleMenu = (workerId: string) => {
    setOpenMenuId(openMenuId === workerId ? null : workerId);
  };

  // Handle activate/inactivate worker
  const handleToggleActive = async (worker: Worker) => {
    try {
      const newIsActive = !worker.is_active;
      
      const { error } = await supabase
        .from('workers')
        .update({ is_active: newIsActive, updated_at: new Date().toISOString() })
        .eq('id', worker.id);

      if (error) {
        throw error;
      }

      logger.info('Worker status updated', { workerId: worker.id, is_active: newIsActive });
      setOpenMenuId(null);
      await refetch();
    } catch (err: any) {
      logger.error('Error updating worker status', err instanceof Error ? err : new Error(String(err)));
      alert(`Failed to ${worker.is_active ? 'deactivate' : 'activate'} worker: ${err?.message || 'Unknown error'}`);
    }
  };

  // Handle delete worker - show confirmation modal
  const handleDeleteWorker = (worker: Worker) => {
    setOpenMenuId(null);
    setWorkerToDelete(worker);
  };

  // Confirm and execute delete
  const confirmDeleteWorker = async () => {
    if (!workerToDelete) return;

    try {
      const { error } = await supabase
        .from('workers')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', workerToDelete.id);

      if (error) {
        throw error;
      }

      logger.info('Worker deleted', { workerId: workerToDelete.id });
      setWorkerToDelete(null);
      await refetch();
    } catch (err: any) {
      logger.error('Error deleting worker', err instanceof Error ? err : new Error(String(err)));
      alert(`Failed to delete worker: ${err?.message || 'Unknown error'}`);
    }
  };

  // Cancel delete
  const cancelDeleteWorker = () => {
    setWorkerToDelete(null);
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
          <h1 className="text-xl font-semibold text-foreground mb-1">Worker Directory</h1>
          <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
            {`Manage your team of ${filteredWorkers.length} workers${filteredWorkers.length > itemsPerPage ? ` (Page ${currentPage} of ${totalPages})` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowImportWizard(true)}
            className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm"
          >
            <Upload style={{ width: '14px', height: '14px' }} />
            Import
          </button>
          <button 
            onClick={handleAddWorker}
            className="flex items-center gap-2 px-2 py-1 rounded text-white transition-colors text-sm" 
            style={{ backgroundColor: 'var(--primary-brand-hex)' }}
          >
            <Plus style={{ width: '14px', height: '14px' }} />
            Add Worker
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      {!workersLoading && (
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
              {/* Worker Type Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowWorkerTypeDropdown(!showWorkerTypeDropdown)}>
                  <span className="text-gray-700">
                    {selectedWorkerType.length === 0 ? 'All Worker Types' : 
                     selectedWorkerType.length === 1 ? selectedWorkerType[0] :
                     `${selectedWorkerType.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showWorkerTypeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
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
                    {getFilteredWorkerTypeOptions().map((workerType) => (
                      <div key={workerType} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleWorkerTypeToggle(workerType === 'Contractor' ? 'contractor' : 'employee')}>
                        <input type="checkbox" checked={selectedWorkerType.includes(workerType === 'Contractor' ? 'contractor' : 'employee')} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{workerType}</span>
                      </div>
                    ))}
                    {getFilteredWorkerTypeOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No worker types found
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

              {/* Job Title Multi-Select */}
              <div className="relative dropdown-container">
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
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
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
                    {getFilteredJobTitleOptions().map((jobTitle) => (
                      <div key={jobTitle} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleJobTitleToggle(jobTitle)}>
                        <input type="checkbox" checked={selectedJobTitle.includes(jobTitle)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{jobTitle}</span>
                      </div>
                    ))}
                    {getFilteredJobTitleOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No job titles found
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
                  onClick={() => handleSort('custom_id')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'custom_id' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Custom ID
                  {sortBy === 'custom_id' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
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
                  onClick={() => handleSort('jobTitle')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'jobTitle' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Job Title
                  {sortBy === 'jobTitle' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Error Message */}
      {workersError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <div>
              <div className="text-sm font-medium text-red-800">Error loading workers</div>
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

      {/* Table View */}
      {!workersError && !workersLoading && viewMode === 'table' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-y-visible mb-4">
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
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-32">
                  Type
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-32">
                  <button
                    onClick={() => handleSort('custom_id')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Custom ID
                    {sortBy === 'custom_id' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
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
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                  <button
                    onClick={() => handleSort('jobTitle')}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Job Title
                    {sortBy === 'jobTitle' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-32">Status</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">No workers found</p>
                    <p className="text-sm text-gray-500">
                      {workersData.length === 0 
                        ? 'Start by adding workers to your company'
                        : 'Try adjusting your search criteria'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedWorkers.map((worker, index) => (
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
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">
                          {worker.firstName} {worker.lastName}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--gray-500)' }}>{worker.email}</div>
                      </div>
                  </div>
                  </td>
                  <td className="py-4 px-4 w-32">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      worker.worker_type === 'contractor' 
                        ? 'bg-purple-50 text-purple-700' 
                        : 'bg-blue-50 text-blue-700'
                    }`}>
                      {worker.worker_type === 'contractor' ? 'Contractor' : 'Employee'}
                    </span>
                  </td>
                  <td className="py-4 px-4 w-32">
                    <span className="text-sm text-gray-700 truncate">
                      {worker.custom_worker_id || '—'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-900 text-sm">{worker.department}</td>
                  <td className="py-4 px-4 text-gray-900 text-sm">{worker.jobTitle}</td>
                  <td className="py-4 px-4 w-32">{getStatusBadge(worker.status)}</td>
                  <td className="py-2 px-2 w-24">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleEditWorker(worker)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label={`View ${worker.firstName} ${worker.lastName}`}
                        title={`View ${worker.firstName} ${worker.lastName}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <div className="relative" data-menu-id={worker.id}>
                      <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMenu(worker.id);
                          }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`More options for ${worker.firstName} ${worker.lastName}`}
                          title={`More options for ${worker.firstName} ${worker.lastName}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === worker.id && (
                          <div className={`absolute right-0 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-[100] ${
                            index === paginatedWorkers.length - 1 ? 'bottom-full mb-1' : 'top-full mt-1'
                          }`}>
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(worker);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                {worker.is_active ? (
                                  <>
                                    <PowerOff className="w-4 h-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-4 h-4" />
                                    Activate
                                  </>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWorker(worker);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                      </button>
                            </div>
                          </div>
                        )}
                      </div>
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
      {!workersError && !workersLoading && viewMode === 'grid' && (
        <>
          {filteredWorkers.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center mb-4">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No workers found</p>
              <p className="text-sm text-gray-500">
                {workersData.length === 0 
                  ? 'Start by adding workers to your company'
                  : 'Try adjusting your search criteria'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-4">
              {paginatedWorkers.map((worker) => (
            <div
              key={worker.id}
              className="bg-white border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-primary/20 group rounded-lg p-6"
            >
              {/* Worker Avatar and Basic Info */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-base" 
                    style={{ backgroundColor: generateAvatarColor(worker.firstName, worker.lastName) }}
                  >
                    {generateAvatarInitials(worker.firstName, worker.lastName)}
                  </div>
                  <div 
                    className={`absolute -bottom-1 -right-1 ${getDotSize('lg')} rounded-full border-2 border-white`}
                    style={{ backgroundColor: getCurrentStatusDotColor(worker.current_status) }}>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
                    {worker.firstName} {worker.lastName}
                  </h3>
                  <p className="text-xs text-gray-600 truncate">{worker.jobTitle}</p>
                  <div className="mt-1">
                    {getStatusBadge(worker.status)}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => handleEditWorker(worker)}
                    className="text-gray-400 hover:text-primary"
                    aria-label={`View ${worker.firstName} ${worker.lastName}`}
                    title={`View ${worker.firstName} ${worker.lastName}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <div className="relative" data-menu-id={worker.id}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMenu(worker.id);
                      }}
                      className="text-gray-400 hover:text-primary"
                      aria-label={`More options for ${worker.firstName} ${worker.lastName}`}
                      title={`More options for ${worker.firstName} ${worker.lastName}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === worker.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                        <div className="py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(worker);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            {worker.is_active ? (
                              <>
                                <PowerOff className="w-4 h-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="w-4 h-4" />
                                Activate
                              </>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorker(worker);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{worker.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{worker.phone || '+1 (555) 000-0000'}</span>
                </div>
              </div>

              {/* Department and Job Title */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-900">{worker.department}</span>
                  <span className="text-xs text-gray-500">{worker.jobTitle}</span>
                </div>
              </div>
            </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {!workersLoading && (
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

      {/* Import Workers Wizard */}
      <ImportWorkersWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onSuccess={() => {
          refetch();
          setShowImportWizard(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      {workerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Worker</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={cancelDeleteWorker}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{workerToDelete.firstName} {workerToDelete.lastName}</span>? 
                This will permanently remove the worker from your directory.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={cancelDeleteWorker}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWorker}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Worker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}