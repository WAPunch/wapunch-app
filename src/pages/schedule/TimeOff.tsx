import { useEffect, useMemo, useState } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useCompany } from '../../hooks/useCompany';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { 
  Calendar, 
  Search, 
  Filter,
  Plus,
  Upload,
  ChevronLeft,
  ChevronRight,
  SortAsc,
  SortDesc,
  CheckCircle,
  Clock,
  XCircle,
  X,
  Eye,
  Check,
  AlertTriangle,
  MoreVertical,
  Trash2
} from 'lucide-react';

interface TimeOffCategory {
  id: string;
  company_id: string;
  name: string;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

interface TimeOffRequest {
  id: string;
  company_id: string;
  worker_id: string;
  worker_first_name: string;
  worker_last_name: string;
  time_off_category_id: string;
  time_off_category_name: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  notes: string | null;
  created_at: string;
}

// Function to generate avatar initials
const generateAvatarInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Function to generate a consistent background color based on name
const generateAvatarColor = (firstName: string, lastName: string) => {
  return 'var(--primary-brand-hex)'; // Primary brand color
};

export default function TimeOff() {
  const { registerSubmodules } = useSubmoduleNav();
  const { currentCompany } = useCompany();
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [categories, setCategories] = useState<TimeOffCategory[]>([]);
  const [workers, setWorkers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'worker_name' | 'start_date' | 'category_name'>('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Add Time Off Form State
  const [addForm, setAddForm] = useState({
    workerId: '',
    categoryId: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  useEffect(() => {
    registerSubmodules('Schedule', [
      { id: 'schedule', label: 'Schedule', href: '/schedule/schedule', icon: Calendar },
      { id: 'time-off', label: 'Time Off', href: '/schedule/time-off', icon: Calendar },
      { id: 'unavailabilities', label: 'Unavailabilities', href: '/schedule/unavailabilities', icon: Calendar },
    ]);
  }, [registerSubmodules]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowCategoryDropdown(false);
        setShowStatusDropdown(false);
        setCategorySearchTerm('');
        setStatusSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch time off categories
  const fetchCategories = async () => {
    if (!currentCompany?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('time_off_categories')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err: any) {
      logger.error('Error fetching time off categories:', err);
    }
  };

  // Fetch workers
  const fetchWorkers = async () => {
    if (!currentCompany?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('workers')
        .select('id, first_name, last_name')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('first_name');

      if (fetchError) throw fetchError;
      setWorkers(data || []);
    } catch (err: any) {
      logger.error('Error fetching workers:', err);
    }
  };

  // Fetch time off requests
  const fetchTimeOffRequests = async () => {
    if (!currentCompany?.id) {
      setTimeOffRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('time_off_requests')
        .select(`
          id,
          company_id,
          worker_id,
          time_off_category_id,
          start_date,
          end_date,
          status,
          approved_by,
          notes,
          created_at,
          workers!inner (
            first_name,
            last_name
          ),
          time_off_categories!inner (
            name
          )
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to match TimeOffRequest interface
      const requests: TimeOffRequest[] = (data || []).map((record: any) => ({
        id: record.id,
        company_id: record.company_id,
        worker_id: record.worker_id,
        worker_first_name: record.workers?.first_name || '',
        worker_last_name: record.workers?.last_name || '',
        time_off_category_id: record.time_off_category_id,
        time_off_category_name: record.time_off_categories?.name || '',
        start_date: record.start_date,
        end_date: record.end_date,
        status: record.status,
        approved_by: record.approved_by,
        notes: record.notes,
        created_at: record.created_at,
      }));

      setTimeOffRequests(requests);
    } catch (err: any) {
      logger.error('Error fetching time off requests:', err);
      setError(err.message || 'Failed to load time off requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchWorkers();
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchTimeOffRequests();
  }, [currentCompany?.id]);

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    const filtered = timeOffRequests.filter(request => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        request.worker_first_name.toLowerCase().includes(searchLower) ||
        request.worker_last_name.toLowerCase().includes(searchLower) ||
        request.time_off_category_name.toLowerCase().includes(searchLower)
      );

      // Category filter
      const matchesCategory = selectedCategory.length === 0 || selectedCategory.includes(request.time_off_category_id);

      // Status filter
      const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(request.status);

      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string;
      let bValue: string;

      switch (sortBy) {
        case 'worker_name':
          aValue = `${a.worker_first_name} ${a.worker_last_name}`.toLowerCase();
          bValue = `${b.worker_first_name} ${b.worker_last_name}`.toLowerCase();
          break;
        case 'start_date':
          aValue = a.start_date;
          bValue = b.start_date;
          break;
        case 'category_name':
          aValue = a.time_off_category_name.toLowerCase();
          bValue = b.time_off_category_name.toLowerCase();
          break;
        default:
          aValue = a.start_date;
          bValue = b.start_date;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchTerm, timeOffRequests, sortBy, sortOrder, selectedCategory, selectedStatus]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + itemsPerPage);

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
    setSelectedCategory([]);
    setSelectedStatus([]);
    setSearchTerm('');
    setSearchInputValue('');
    setCategorySearchTerm('');
    setStatusSearchTerm('');
  };

  // Summary card calculations
  const totalCount = timeOffRequests.length;
  const approvedCount = timeOffRequests.filter(r => r.status === 'approved').length;
  const pendingCount = timeOffRequests.filter(r => r.status === 'pending').length;
  const rejectedCount = timeOffRequests.filter(r => r.status === 'rejected').length;

  // Handle summary card clicks
  const handleSummaryCardClick = (status: string) => {
    const isCurrentlyActive = isSummaryCardActive(status);
    
    if (isCurrentlyActive) {
      // If active, clear all filters (toggle off)
      setSelectedStatus([]);
      setSelectedCategory([]);
    } else {
      // If not active, clear other filters and set only this status
      setSelectedStatus([status]);
      setSelectedCategory([]);
    }
  };

  // Check if a summary card should be active
  const isSummaryCardActive = (status: string) => {
    return selectedStatus.length === 1 && selectedStatus[0] === status && selectedCategory.length === 0;
  };

  // Helper functions for multi-select
  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategory(prev => 
      prev.includes(categoryId) 
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
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
  const getFilteredCategoryOptions = () => {
    if (!categorySearchTerm) return categories;
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase())
    );
  };

  const getFilteredStatusOptions = () => {
    const statusOptions = ['pending', 'approved', 'rejected'];
    if (!statusSearchTerm) return statusOptions;
    return statusOptions.filter(status => 
      status.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-status-green">
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-status-yellow">
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600">
            {status}
          </span>
        );
    }
  };

  // Get category badge
  const getCategoryBadge = (categoryName: string) => {
    return (
      <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        {categoryName}
      </span>
    );
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Calculate days
  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  // Toggle menu
  const toggleMenu = (requestId: string) => {
    setOpenMenuId(openMenuId === requestId ? null : requestId);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const menuElement = document.querySelector(`[data-menu-id="${openMenuId}"]`);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Handle view request
  const handleViewRequest = (request: TimeOffRequest) => {
    setOpenMenuId(null);
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  // Handle approve request
  const handleApproveRequest = async () => {
    if (!selectedRequest || !currentCompany?.id) return;

    setIsProcessing(true);
    try {
      // Get current user for approved_by
      const currentUser = await getCurrentUser();
      const approvedById = currentUser?.id || null;

      const { error: updateError } = await supabase
        .from('time_off_requests')
        .update({ 
          status: 'approved',
          approved_by: approvedById
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      logger.info('Time off request approved', { 
        requestId: selectedRequest.id,
        approvedBy: approvedById 
      });
      
      setShowApproveModal(false);
      setShowViewModal(false);
      setSelectedRequest(null);
      await fetchTimeOffRequests();
      
      // Show success message
      alert(`Time off request approved successfully! ${calculateDays(selectedRequest.start_date, selectedRequest.end_date)} shift(s) have been created on the calendar.`);
    } catch (err: any) {
      logger.error('Error approving request:', err);
      alert('Failed to approve request: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle reject request
  const handleRejectRequest = async () => {
    if (!selectedRequest || !currentCompany?.id) return;

    setIsProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('time_off_requests')
        .update({ status: 'rejected' })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      logger.info('Time off request rejected', { requestId: selectedRequest.id });
      setShowRejectModal(false);
      setShowViewModal(false);
      setSelectedRequest(null);
      await fetchTimeOffRequests();
      
      // Show success message
      alert('Time off request rejected successfully.');
    } catch (err: any) {
      logger.error('Error rejecting request:', err);
      alert('Failed to reject request: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle create time off request
  const handleCreateTimeOffRequest = async () => {
    if (!currentCompany?.id) return;

    // Validation
    if (!addForm.workerId) {
      setCreateError('Please select a worker');
      return;
    }
    if (!addForm.categoryId) {
      setCreateError('Please select a category');
      return;
    }
    if (!addForm.startDate) {
      setCreateError('Please select a start date');
      return;
    }
    if (!addForm.endDate) {
      setCreateError('Please select an end date');
      return;
    }

    // Validate date range
    if (new Date(addForm.startDate) > new Date(addForm.endDate)) {
      setCreateError('End date must be after or equal to start date');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const { error: insertError } = await supabase
        .from('time_off_requests')
        .insert({
          company_id: currentCompany.id,
          worker_id: addForm.workerId,
          time_off_category_id: addForm.categoryId,
          start_date: addForm.startDate,
          end_date: addForm.endDate,
          status: 'pending',
          notes: addForm.notes || null,
        });

      if (insertError) throw insertError;

      // Reset form and close modal
      setAddForm({
        workerId: '',
        categoryId: '',
        startDate: '',
        endDate: '',
        notes: '',
      });
      setShowAddModal(false);

      // Reload data
      await fetchTimeOffRequests();
      
      logger.info('Successfully created time off request', {
        workerId: addForm.workerId,
        categoryId: addForm.categoryId,
        startDate: addForm.startDate,
        endDate: addForm.endDate
      });
      
      // Show success message
      alert('Time off request created successfully! It is now pending approval.');
    } catch (err: any) {
      logger.error('Error creating time off request:', err);
      setCreateError(err.message || 'Failed to create time off request');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">Time Off</h1>
          <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
            {isLoading 
              ? 'Loading time off requests...' 
              : `Manage employee time off requests${filteredRequests.length > itemsPerPage ? ` (Page ${currentPage} of ${totalPages})` : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm"
            title="Import time off requests"
          >
            <Upload style={{ width: '14px', height: '14px' }} />
            Import
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-2 py-1 rounded text-white transition-colors text-sm" 
            style={{ backgroundColor: 'var(--primary-brand-hex)' }}
            title="Add new time off request"
          >
            <Plus style={{ width: '14px', height: '14px' }} />
            Add Time Off
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <div>
              <div className="text-sm font-medium text-red-800">Error loading time off requests</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
            <button
              onClick={() => fetchTimeOffRequests()}
              className="ml-auto px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
          <button 
            onClick={() => handleSummaryCardClick('approved')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('approved') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by Approved status"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-status-green" />
              <div className="text-2xl font-bold text-gray-900">{approvedCount}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
          </button>
          <button 
            onClick={() => handleSummaryCardClick('pending')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('pending') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by Pending status"
          >
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-status-yellow" />
              <div className="text-2xl font-bold text-gray-900">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </button>
          <button 
            onClick={() => handleSummaryCardClick('rejected')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('rejected') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by Rejected status"
          >
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div className="text-2xl font-bold text-gray-900">{rejectedCount}</div>
              <div className="text-sm text-muted-foreground">Rejected</div>
            </div>
          </button>
        </div>
      )}

      {/* Search and Filters */}
      {!isLoading && !error && (
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
                  placeholder="Search by employee name or category..."
                  value={searchInputValue}
                  onChange={(e) => setSearchInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearchTerm(searchInputValue);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  aria-label="Search time off requests"
                />
              </div>
              
              <div className="flex items-center gap-2">
                {/* Clear Filters Button */}
                {(selectedCategory.length > 0 || selectedStatus.length > 0 || searchTerm) && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {/* Category Multi-Select */}
                <div className="relative dropdown-container">
                  <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                       onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}>
                    <span className="text-gray-700">
                      {selectedCategory.length === 0 ? 'All Categories' : 
                       selectedCategory.length === 1 ? categories.find(c => c.id === selectedCategory[0])?.name :
                       `${selectedCategory.length} selected`}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Search categories..."
                            value={categorySearchTerm}
                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const allCategories = getFilteredCategoryOptions().map(c => c.id);
                                setSelectedCategory(allCategories);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                            >
                              Select All
                            </button>
                            {selectedCategory.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCategory([]);
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                              >
                                Clear ({selectedCategory.length})
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {getFilteredCategoryOptions().map((category) => (
                        <div key={category.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                             onClick={() => handleCategoryToggle(category.id)}>
                          <input type="checkbox" checked={selectedCategory.includes(category.id)} readOnly className="w-4 h-4" />
                          <span className="text-sm text-gray-700">{category.name}</span>
                        </div>
                      ))}
                      {getFilteredCategoryOptions().length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                          No categories found
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
                       selectedStatus.length === 1 ? (selectedStatus[0] ? (selectedStatus[0].charAt(0).toUpperCase() + selectedStatus[0].slice(1)) : 'All Statuses') :
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
                                const allStatuses = getFilteredStatusOptions();
                                setSelectedStatus(allStatuses);
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
                          <span className="text-sm text-gray-700 capitalize">
                            {status}
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
                    onClick={() => handleSort('worker_name')}
                    className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                      sortBy === 'worker_name' ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    Employee
                    {sortBy === 'worker_name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                  <button 
                    onClick={() => handleSort('category_name')}
                    className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                      sortBy === 'category_name' ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    Category
                    {sortBy === 'category_name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                  <button 
                    onClick={() => handleSort('start_date')}
                    className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                      sortBy === 'start_date' ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    Start Date
                    {sortBy === 'start_date' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('worker_name')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                    >
                      Employee
                      {sortBy === 'worker_name' && (
                        sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('category_name')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                    >
                      Category
                      {sortBy === 'category_name' && (
                        sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('start_date')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                    >
                      Start Date
                      {sortBy === 'start_date' && (
                        sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    End Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Days
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                      No time off requests found
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((request, index) => (
                    <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                            style={{ backgroundColor: generateAvatarColor(request.worker_first_name, request.worker_last_name) }}
                          >
                            {generateAvatarInitials(request.worker_first_name, request.worker_last_name)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {request.worker_first_name} {request.worker_last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getCategoryBadge(request.time_off_category_name)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(request.start_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(request.end_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {calculateDays(request.start_date, request.end_date)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="py-2 px-2 w-24">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleViewRequest(request)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label={`View time off request`}
                            title={`View time off request`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {request.status === 'pending' && (
                            <div className="relative" data-menu-id={request.id}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMenu(request.id);
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                                aria-label={`More options for time off request`}
                                title={`More options for time off request`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {openMenuId === request.id && (
                                <div className={`absolute right-0 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-[100] ${
                                  index === paginatedRequests.length - 1 ? 'bottom-full mb-1' : 'top-full mt-1'
                                }`}>
                                  <div className="py-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        setSelectedRequest(request);
                                        setShowApproveModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                    >
                                      <Check className="w-4 h-4" />
                                      Approve
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        setSelectedRequest(request);
                                        setShowRejectModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <X className="w-4 h-4" />
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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

      {/* Pagination */}
      {!isLoading && (
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
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredRequests.length)} of {filteredRequests.length}
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

      {/* Add Time Off Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Request Time Off</h3>
                  <p className="text-sm text-gray-500">Create a new time off request</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setCreateError(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isCreating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {createError}
                </div>
              )}

              {/* Worker Selection */}
              <div>
                <label htmlFor="worker-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  id="worker-select"
                  value={addForm.workerId}
                  onChange={(e) => setAddForm(prev => ({ ...prev, workerId: e.target.value }))}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreating}
                >
                  <option value="">Select an employee</option>
                  {workers.map(worker => (
                    <option key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selection */}
              <div>
                <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category-select"
                  value={addForm.categoryId}
                  onChange={(e) => setAddForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreating}
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date and End Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={addForm.startDate}
                    onChange={(e) => setAddForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={addForm.endDate}
                    onChange={(e) => setAddForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreating}
                    min={addForm.startDate}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={addForm.notes}
                  onChange={(e) => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreating}
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                This will create a time off request with status <strong>Pending</strong>. It will need to be approved before appearing on the calendar.
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setCreateError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTimeOffRequest}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isCreating ? '#9CA3AF' : 'var(--primary-brand-hex)',
                  cursor: isCreating ? 'not-allowed' : 'pointer'
                }}
              >
                {isCreating ? 'Creating...' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Request Modal */}
      {showViewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Time Off Request Details</h3>
                  <p className="text-sm text-gray-500">Request ID: {selectedRequest.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRequest(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: generateAvatarColor(selectedRequest.worker_first_name, selectedRequest.worker_last_name) }}
                    >
                      {generateAvatarInitials(selectedRequest.worker_first_name, selectedRequest.worker_last_name)}
                    </div>
                    <span className="text-sm text-gray-900">{selectedRequest.worker_first_name} {selectedRequest.worker_last_name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div>{getCategoryBadge(selectedRequest.time_off_category_name)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedRequest.start_date)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedRequest.end_date)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
                  <p className="text-sm text-gray-900">{calculateDays(selectedRequest.start_date, selectedRequest.end_date)} day(s)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedRequest.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setShowRejectModal(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      setShowApproveModal(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--primary-brand-hex)' }}
                  >
                    Approve
                  </button>
                </>
              )}
              {selectedRequest.status !== 'pending' && (
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedRequest(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[201] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Approve Time Off</h3>
                  <p className="text-sm text-gray-500">This will create calendar events</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setShowViewModal(true);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isProcessing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to approve this time off request for <span className="font-semibold">{selectedRequest.worker_first_name} {selectedRequest.worker_last_name}</span>?
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>Note:</strong> Approving this request will automatically create {calculateDays(selectedRequest.start_date, selectedRequest.end_date)} time off shift(s) on the calendar.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setShowViewModal(true);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleApproveRequest}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isProcessing ? '#9CA3AF' : '#10B981',
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? 'Approving...' : 'Approve Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[201] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Reject Time Off</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setShowViewModal(true);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isProcessing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to reject this time off request for <span className="font-semibold">{selectedRequest.worker_first_name} {selectedRequest.worker_last_name}</span>?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setShowViewModal(true);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectRequest}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isProcessing ? '#9CA3AF' : '#EF4444',
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessing ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
