import { useEffect, useMemo, useState } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useCompany } from '../../hooks/useCompany';
import { supabase } from '../../lib/supabase';
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
  X,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Power,
  PowerOff,
  AlertTriangle
} from 'lucide-react';

interface WorkerUnavailabilityRule {
  id: string;
  company_id: string;
  worker_id: string;
  worker_first_name: string;
  worker_last_name: string;
  start_date: string;
  end_date: string | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Function to generate avatar initials
const generateAvatarInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Function to generate a consistent background color based on name
const generateAvatarColor = (firstName: string, lastName: string) => {
  return 'var(--primary-brand-hex)'; // Primary brand color
};

// Get day name from day_of_week (0=Sunday, 6=Saturday)
const getDayName = (dayOfWeek: number | null) => {
  if (dayOfWeek === null) return null;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
};

// Format time (HH:MM:SS to HH:MM)
const formatTime = (time: string) => {
  return time.substring(0, 5);
};

export default function Unavailabilities() {
  const { registerSubmodules } = useSubmoduleNav();
  const { currentCompany } = useCompany();
  const [unavailabilityRules, setUnavailabilityRules] = useState<WorkerUnavailabilityRule[]>([]);
  const [workers, setWorkers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'worker_name' | 'start_date' | 'day_of_week'>('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<WorkerUnavailabilityRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<WorkerUnavailabilityRule | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Add/Edit Form State
  const [form, setForm] = useState({
    workerId: '',
    startDate: '',
    endDate: '',
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    reason: '',
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
        setShowStatusDropdown(false);
        setStatusSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Fetch unavailability rules
  const fetchUnavailabilityRules = async () => {
    if (!currentCompany?.id) {
      setUnavailabilityRules([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('worker_unavailability_rules')
        .select(`
          id,
          company_id,
          worker_id,
          start_date,
          end_date,
          day_of_week,
          start_time,
          end_time,
          reason,
          is_active,
          created_at,
          updated_at,
          workers!inner (
            first_name,
            last_name
          )
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to match WorkerUnavailabilityRule interface
      const rules: WorkerUnavailabilityRule[] = (data || []).map((record: any) => ({
        id: record.id,
        company_id: record.company_id,
        worker_id: record.worker_id,
        worker_first_name: record.workers?.first_name || '',
        worker_last_name: record.workers?.last_name || '',
        start_date: record.start_date,
        end_date: record.end_date,
        day_of_week: record.day_of_week,
        start_time: record.start_time,
        end_time: record.end_time,
        reason: record.reason,
        is_active: record.is_active,
        created_at: record.created_at,
        updated_at: record.updated_at,
      }));

      setUnavailabilityRules(rules);
    } catch (err: any) {
      logger.error('Error fetching unavailability rules:', err);
      setError(err.message || 'Failed to load unavailability rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [currentCompany?.id]);

  useEffect(() => {
    fetchUnavailabilityRules();
  }, [currentCompany?.id]);

  // Filter and sort rules
  const filteredRules = useMemo(() => {
    const filtered = unavailabilityRules.filter(rule => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        rule.worker_first_name.toLowerCase().includes(searchLower) ||
        rule.worker_last_name.toLowerCase().includes(searchLower) ||
        (rule.reason && rule.reason.toLowerCase().includes(searchLower))
      );

      // Status filter
      const status = rule.is_active ? 'active' : 'inactive';
      const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(status);

      return matchesSearch && matchesStatus;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'worker_name':
          aValue = `${a.worker_first_name} ${a.worker_last_name}`.toLowerCase();
          bValue = `${b.worker_first_name} ${b.worker_last_name}`.toLowerCase();
          break;
        case 'start_date':
          aValue = a.start_date;
          bValue = b.start_date;
          break;
        case 'day_of_week':
          aValue = a.day_of_week ?? 999;
          bValue = b.day_of_week ?? 999;
          break;
        default:
          aValue = a.start_date;
          bValue = b.start_date;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      } else {
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [searchTerm, unavailabilityRules, sortBy, sortOrder, selectedStatus]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRules = filteredRules.slice(startIndex, startIndex + itemsPerPage);

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
    setSelectedStatus([]);
    setSearchTerm('');
    setSearchInputValue('');
    setStatusSearchTerm('');
  };

  // Summary card calculations
  const totalCount = unavailabilityRules.length;
  const activeCount = unavailabilityRules.filter(r => r.is_active).length;
  const inactiveCount = unavailabilityRules.filter(r => !r.is_active).length;

  // Handle summary card clicks
  const handleSummaryCardClick = (status: string) => {
    const isCurrentlyActive = isSummaryCardActive(status);
    
    if (isCurrentlyActive) {
      setSelectedStatus([]);
    } else {
      setSelectedStatus([status]);
    }
  };

  // Check if a summary card should be active
  const isSummaryCardActive = (status: string) => {
    return selectedStatus.length === 1 && selectedStatus[0] === status;
  };

  // Helper functions for multi-select
  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const getFilteredStatusOptions = () => {
    const statusOptions = ['active', 'inactive'];
    if (!statusSearchTerm) return statusOptions;
    return statusOptions.filter(status => 
      status.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  };

  // Get status badge
  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
          Active
        </span>
      );
    } else {
      return (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600">
          Inactive
        </span>
      );
    }
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Toggle menu
  const toggleMenu = (ruleId: string) => {
    setOpenMenuId(openMenuId === ruleId ? null : ruleId);
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

  // Handle view rule
  const handleViewRule = (rule: WorkerUnavailabilityRule) => {
    setOpenMenuId(null);
    setSelectedRule(rule);
    setShowViewModal(true);
  };

  // Handle edit rule
  const handleEditRule = (rule: WorkerUnavailabilityRule) => {
    setOpenMenuId(null);
    setSelectedRule(rule);
    setForm({
      workerId: rule.worker_id,
      startDate: rule.start_date,
      endDate: rule.end_date || '',
      dayOfWeek: rule.day_of_week !== null ? rule.day_of_week.toString() : '',
      startTime: formatTime(rule.start_time),
      endTime: formatTime(rule.end_time),
      reason: rule.reason || '',
    });
    setShowEditModal(true);
  };

  // Handle toggle active
  const handleToggleActive = async (rule: WorkerUnavailabilityRule) => {
    if (!currentCompany?.id) return;

    try {
      const { error: updateError } = await supabase
        .from('worker_unavailability_rules')
        .update({ 
          is_active: !rule.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', rule.id);

      if (updateError) throw updateError;

      logger.info('Unavailability rule status updated', { 
        ruleId: rule.id,
        isActive: !rule.is_active 
      });
      
      setOpenMenuId(null);
      await fetchUnavailabilityRules();
      
      alert(`Unavailability rule ${!rule.is_active ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: any) {
      logger.error('Error updating rule status:', err);
      alert('Failed to update rule status: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle delete rule
  const handleDeleteRule = (rule: WorkerUnavailabilityRule) => {
    setOpenMenuId(null);
    setRuleToDelete(rule);
  };

  // Confirm and execute delete
  const confirmDeleteRule = async () => {
    if (!ruleToDelete || !currentCompany?.id) return;

    try {
      const { error: deleteError } = await supabase
        .from('worker_unavailability_rules')
        .delete()
        .eq('id', ruleToDelete.id);

      if (deleteError) throw deleteError;

      logger.info('Unavailability rule deleted', { ruleId: ruleToDelete.id });
      setRuleToDelete(null);
      await fetchUnavailabilityRules();
      
      alert('Unavailability rule deleted successfully.');
    } catch (err: any) {
      logger.error('Error deleting rule:', err);
      alert('Failed to delete rule: ' + (err.message || 'Unknown error'));
    }
  };

  // Cancel delete
  const cancelDeleteRule = () => {
    setRuleToDelete(null);
  };

  // Handle create unavailability rule
  const handleCreateRule = async () => {
    if (!currentCompany?.id) return;

    // Validation
    if (!form.workerId) {
      setCreateError('Please select a worker');
      return;
    }
    if (!form.startDate) {
      setCreateError('Please select a start date');
      return;
    }
    if (!form.startTime) {
      setCreateError('Please select a start time');
      return;
    }
    if (!form.endTime) {
      setCreateError('Please select an end time');
      return;
    }

    // Validate date range
    if (form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      setCreateError('End date must be after or equal to start date');
      return;
    }

    // Validate time range
    if (form.startTime >= form.endTime) {
      setCreateError('End time must be after start time');
      return;
    }

    // Validate end_date for non-recurring rules
    const dayOfWeekValue = form.dayOfWeek ? parseInt(form.dayOfWeek) : null;
    const isRecurring = dayOfWeekValue !== null;
    
    if (!isRecurring && !form.endDate) {
      setCreateError('End date is required when "All Days" is selected. For recurring unavailability, please select a specific day of week.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      
      const { error: insertError } = await supabase
        .from('worker_unavailability_rules')
        .insert({
          company_id: currentCompany.id,
          worker_id: form.workerId,
          start_date: form.startDate,
          end_date: form.endDate || null,
          day_of_week: dayOfWeekValue,
          start_time: form.startTime,
          end_time: form.endTime,
          reason: form.reason || null,
          is_active: true,
          is_recurring: isRecurring, // Set based on day_of_week
        });

      if (insertError) throw insertError;

      // Reset form and close modal
      setForm({
        workerId: '',
        startDate: '',
        endDate: '',
        dayOfWeek: '',
        startTime: '',
        endTime: '',
        reason: '',
      });
      setShowAddModal(false);

      // Reload data
      await fetchUnavailabilityRules();
      
      logger.info('Successfully created unavailability rule', {
        workerId: form.workerId,
        startDate: form.startDate,
        endDate: form.endDate,
        dayOfWeek: form.dayOfWeek
      });
      
      alert('Unavailability rule created successfully!');
    } catch (err: any) {
      logger.error('Error creating unavailability rule:', err);
      setCreateError(err.message || 'Failed to create unavailability rule');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle update unavailability rule
  const handleUpdateRule = async () => {
    if (!selectedRule || !currentCompany?.id) return;

    // Validation
    if (!form.workerId) {
      setCreateError('Please select a worker');
      return;
    }
    if (!form.startDate) {
      setCreateError('Please select a start date');
      return;
    }
    if (!form.startTime) {
      setCreateError('Please select a start time');
      return;
    }
    if (!form.endTime) {
      setCreateError('Please select an end time');
      return;
    }

    // Validate date range
    if (form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      setCreateError('End date must be after or equal to start date');
      return;
    }

    // Validate time range
    if (form.startTime >= form.endTime) {
      setCreateError('End time must be after start time');
      return;
    }

    // Validate end_date for non-recurring rules
    const dayOfWeekValue = form.dayOfWeek ? parseInt(form.dayOfWeek) : null;
    const isRecurring = dayOfWeekValue !== null;
    
    if (!isRecurring && !form.endDate) {
      setCreateError('End date is required when "All Days" is selected. For recurring unavailability, please select a specific day of week.');
      return;
    }

    setIsUpdating(true);
    setCreateError(null);

    try {
      
      const { error: updateError } = await supabase
        .from('worker_unavailability_rules')
        .update({
          worker_id: form.workerId,
          start_date: form.startDate,
          end_date: form.endDate || null,
          day_of_week: dayOfWeekValue,
          start_time: form.startTime,
          end_time: form.endTime,
          reason: form.reason || null,
          is_recurring: isRecurring, // Set based on day_of_week
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRule.id);

      if (updateError) throw updateError;

      // Reset form and close modal
      setForm({
        workerId: '',
        startDate: '',
        endDate: '',
        dayOfWeek: '',
        startTime: '',
        endTime: '',
        reason: '',
      });
      setShowEditModal(false);
      setSelectedRule(null);

      // Reload data
      await fetchUnavailabilityRules();
      
      logger.info('Successfully updated unavailability rule', {
        ruleId: selectedRule.id
      });
      
      alert('Unavailability rule updated successfully!');
    } catch (err: any) {
      logger.error('Error updating unavailability rule:', err);
      setCreateError(err.message || 'Failed to update unavailability rule');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">Unavailabilities</h1>
          <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
            {isLoading 
              ? 'Loading unavailability rules...' 
              : `Manage worker unavailability rules${filteredRules.length > itemsPerPage ? ` (Page ${currentPage} of ${totalPages})` : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm"
            title="Import unavailability rules"
          >
            <Upload style={{ width: '14px', height: '14px' }} />
            Import
          </button>
          <button 
            onClick={() => {
              setForm({
                workerId: '',
                startDate: '',
                endDate: '',
                dayOfWeek: '',
                startTime: '',
                endTime: '',
                reason: '',
              });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-2 py-1 rounded text-white transition-colors text-sm" 
            style={{ backgroundColor: 'var(--primary-brand-hex)' }}
            title="Add new unavailability rule"
          >
            <Plus style={{ width: '14px', height: '14px' }} />
            Add Unavailability
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <div>
              <div className="text-sm font-medium text-red-800">Error loading unavailability rules</div>
              <div className="text-sm text-red-700">{error}</div>
            </div>
            <button
              onClick={() => fetchUnavailabilityRules()}
              className="ml-auto px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
          <button 
            onClick={() => handleSummaryCardClick('active')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('active') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by Active status"
          >
            <div className="flex items-center gap-3">
              <Power className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
          </button>
          <button 
            onClick={() => handleSummaryCardClick('inactive')}
            className={`bg-white border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
              isSummaryCardActive('inactive') 
                ? 'border-primary shadow-md' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            title="Filter by Inactive status"
          >
            <div className="flex items-center gap-3">
              <PowerOff className="h-5 w-5 text-gray-500" />
              <div className="text-2xl font-bold text-gray-900">{inactiveCount}</div>
              <div className="text-sm text-muted-foreground">Inactive</div>
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
                  placeholder="Search by employee name or reason..."
                  value={searchInputValue}
                  onChange={(e) => setSearchInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearchTerm(searchInputValue);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  aria-label="Search unavailability rules"
                />
              </div>
              
              <div className="flex items-center gap-2">
                {/* Clear Filters Button */}
                {(selectedStatus.length > 0 || searchTerm) && (
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
                {/* Status Multi-Select */}
                <div className="relative dropdown-container">
                  <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                       onClick={() => setShowStatusDropdown(!showStatusDropdown)}>
                    <span className="text-gray-700">
                      {selectedStatus.length === 0 ? 'All Statuses' : 
                       selectedStatus.length === 1 ? selectedStatus[0].charAt(0).toUpperCase() + selectedStatus[0].slice(1) :
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStatus(['active', 'inactive']);
                          }}
                          className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 text-left px-2 py-1"
                        >
                          Select All
                        </button>
                      </div>
                      {getFilteredStatusOptions().map((status) => (
                        <div key={status} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                             onClick={() => handleStatusToggle(status)}>
                          <input type="checkbox" checked={selectedStatus.includes(status)} readOnly className="w-4 h-4" />
                          <span className="text-sm text-gray-700 capitalize">{status}</span>
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
                    onClick={() => handleSort('start_date')}
                    className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                      sortBy === 'start_date' ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    Start Date
                    {sortBy === 'start_date' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                  </button>
                  <button 
                    onClick={() => handleSort('day_of_week')}
                    className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                      sortBy === 'day_of_week' ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}
                  >
                    Day of Week
                    {sortBy === 'day_of_week' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
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
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => handleSort('day_of_week')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
                    >
                      Day of Week
                      {sortBy === 'day_of_week' && (
                        sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Time Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                      No unavailability rules found
                    </td>
                  </tr>
                ) : (
                  paginatedRules.map((rule, index) => (
                    <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                            style={{ backgroundColor: generateAvatarColor(rule.worker_first_name, rule.worker_last_name) }}
                          >
                            {generateAvatarInitials(rule.worker_first_name, rule.worker_last_name)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {rule.worker_first_name} {rule.worker_last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(rule.start_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {rule.end_date ? formatDate(rule.end_date) : 'Indefinite'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {rule.day_of_week !== null ? getDayName(rule.day_of_week) : 'All Days'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(rule.is_active)}
                      </td>
                      <td className="py-2 px-2 w-24">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleViewRule(rule)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label={`View unavailability rule`}
                            title={`View unavailability rule`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <div className="relative" data-menu-id={rule.id}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMenu(rule.id);
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              aria-label={`More options for unavailability rule`}
                              title={`More options for unavailability rule`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openMenuId === rule.id && (
                              <div className={`absolute right-0 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-[100] ${
                                index === paginatedRules.length - 1 ? 'bottom-full mb-1' : 'top-full mt-1'
                              }`}>
                                <div className="py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditRule(rule);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleActive(rule);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    {rule.is_active ? (
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
                                      handleDeleteRule(rule);
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
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredRules.length)} of {filteredRules.length}
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

      {/* Add Unavailability Rule Modal */}
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
                  <h3 className="text-lg font-semibold text-gray-900">Add Unavailability Rule</h3>
                  <p className="text-sm text-gray-500">Create a new unavailability rule</p>
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
                  value={form.workerId}
                  onChange={(e) => setForm(prev => ({ ...prev, workerId: e.target.value }))}
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

              {/* Start Date and End Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={form.startDate}
                    onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={form.endDate}
                    onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreating}
                    min={form.startDate}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Required if "All Days" is selected. Leave empty for indefinite if specific day is selected.
                  </p>
                </div>
              </div>

              {/* Day of Week */}
              <div>
                <label htmlFor="day-of-week" className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Week <span className="text-gray-500">(optional)</span>
                </label>
                <select
                  id="day-of-week"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreating}
                >
                  <option value="">All Days</option>
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a specific day for recurring unavailability, or "All Days" for date range only.
                </p>
              </div>

              {/* Start Time and End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="start-time"
                    value={form.startTime}
                    onChange={(e) => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-2">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="end-time"
                    value={form.endTime}
                    onChange={(e) => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isCreating}
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="reason"
                  value={form.reason}
                  onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Add a reason for this unavailability..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isCreating}
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                This rule will block planned shifts from being created during the specified time period.
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
                onClick={handleCreateRule}
                disabled={isCreating}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isCreating ? '#9CA3AF' : 'var(--primary-brand-hex)',
                  cursor: isCreating ? 'not-allowed' : 'pointer'
                }}
              >
                {isCreating ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Unavailability Rule Modal */}
      {showEditModal && selectedRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Edit className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Edit Unavailability Rule</h3>
                  <p className="text-sm text-gray-500">Update unavailability rule</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRule(null);
                  setCreateError(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isUpdating}
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
                <label htmlFor="edit-worker-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-worker-select"
                  value={form.workerId}
                  onChange={(e) => setForm(prev => ({ ...prev, workerId: e.target.value }))}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isUpdating}
                >
                  <option value="">Select an employee</option>
                  {workers.map(worker => (
                    <option key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date and End Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-start-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="edit-start-date"
                    value={form.startDate}
                    onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isUpdating}
                  />
                </div>
                <div>
                  <label htmlFor="edit-end-date" className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="date"
                    id="edit-end-date"
                    value={form.endDate}
                    onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isUpdating}
                    min={form.startDate}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Required if "All Days" is selected. Leave empty for indefinite if specific day is selected.
                  </p>
                </div>
              </div>

              {/* Day of Week */}
              <div>
                <label htmlFor="edit-day-of-week" className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Week <span className="text-gray-500">(optional)</span>
                </label>
                <select
                  id="edit-day-of-week"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isUpdating}
                >
                  <option value="">All Days</option>
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a specific day for recurring unavailability, or "All Days" for date range only.
                </p>
              </div>

              {/* Start Time and End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-start-time" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="edit-start-time"
                    value={form.startTime}
                    onChange={(e) => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isUpdating}
                  />
                </div>
                <div>
                  <label htmlFor="edit-end-time" className="block text-sm font-medium text-gray-700 mb-2">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    id="edit-end-time"
                    value={form.endTime}
                    onChange={(e) => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                    disabled={isUpdating}
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label htmlFor="edit-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  id="edit-reason"
                  value={form.reason}
                  onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Add a reason for this unavailability..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  disabled={isUpdating}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRule(null);
                  setCreateError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRule}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isUpdating ? '#9CA3AF' : 'var(--primary-brand-hex)',
                  cursor: isUpdating ? 'not-allowed' : 'pointer'
                }}
              >
                {isUpdating ? 'Updating...' : 'Update Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Rule Modal */}
      {showViewModal && selectedRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Unavailability Rule Details</h3>
                  <p className="text-sm text-gray-500">Rule ID: {selectedRule.id.slice(0, 8)}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRule(null);
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
                      style={{ backgroundColor: generateAvatarColor(selectedRule.worker_first_name, selectedRule.worker_last_name) }}
                    >
                      {generateAvatarInitials(selectedRule.worker_first_name, selectedRule.worker_last_name)}
                    </div>
                    <span className="text-sm text-gray-900">{selectedRule.worker_first_name} {selectedRule.worker_last_name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div>{getStatusBadge(selectedRule.is_active)}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedRule.start_date)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <p className="text-sm text-gray-900">{selectedRule.end_date ? formatDate(selectedRule.end_date) : 'Indefinite'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                  <p className="text-sm text-gray-900">{selectedRule.day_of_week !== null ? getDayName(selectedRule.day_of_week) : 'All Days'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
                  <p className="text-sm text-gray-900">{formatTime(selectedRule.start_time)} - {formatTime(selectedRule.end_time)}</p>
                </div>
              </div>

              {selectedRule.reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedRule.reason}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditRule(selectedRule);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRule(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--primary-brand-hex)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {ruleToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[201] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Unavailability Rule</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={cancelDeleteRule}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete this unavailability rule for <span className="font-semibold text-gray-900">{ruleToDelete.worker_first_name} {ruleToDelete.worker_last_name}</span>? 
                This will permanently remove the rule and allow shifts to be scheduled during this time period.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={cancelDeleteRule}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRule}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
