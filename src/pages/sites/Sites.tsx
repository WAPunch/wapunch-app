import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '../../lib/router';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useSites } from '../../hooks/useSites';
import { useCompany } from '../../hooks/useCompany';
import { getDefaultMapCenter } from '../../lib/countries';
import ImportSitesWizard from '../../components/ImportSitesWizard';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { useGoogleMapsLoader } from '../../lib/google-maps';
import { 
  Search, 
  Filter,
  List,
  Map,
  SortAsc,
  SortDesc,
  MapPin,
  Building2,
  Eye,
  MoreVertical,
  Plus,
  Upload,
  Power,
  PowerOff,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';

interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  type?: string;
  custom_site_id?: string;
  is_active?: boolean;
}

export default function Sites() {
  const { registerSubmodules } = useSubmoduleNav();
  const { sites: sitesData, isLoading: sitesLoading, error: sitesError, refetch } = useSites();
  const { currentCompany } = useCompany();
  const { isLoaded: isGoogleMapsLoaded, loadError: googleMapsLoadError } = useGoogleMapsLoader();
  const [googleMapInstance, setGoogleMapInstance] = useState<google.maps.Map | null>(null);
  const lastSelectionSourceRef = useRef<'list' | 'map' | 'none'>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'custom_id' | 'country'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSiteType, setSelectedSiteType] = useState<string[]>([]);
  const [selectedCustomId, setSelectedCustomId] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string[]>([]);
  const [showSiteTypeDropdown, setShowSiteTypeDropdown] = useState(false);
  const [showCustomIdDropdown, setShowCustomIdDropdown] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [siteTypeSearchTerm, setSiteTypeSearchTerm] = useState('');
  const [customIdSearchTerm, setCustomIdSearchTerm] = useState('');
  const [countrySearchTerm, setCountrySearchTerm] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);

  useEffect(() => {
    // Register submodule tabs for sites section
    registerSubmodules('Sites', [
      { id: 'sites', label: 'Sites', href: '/sites', icon: Building2 }
    ]);
  }, [registerSubmodules]);

  // Use sites from Supabase hook
  const sites = sitesData;

  const toFiniteNumber = (value: unknown): number | null => {
    const num =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN;
    return Number.isFinite(num) ? num : null;
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowSiteTypeDropdown(false);
        setShowCustomIdDropdown(false);
        setShowCountryDropdown(false);
        // Clear search terms when closing dropdowns
        setSiteTypeSearchTerm('');
        setCustomIdSearchTerm('');
        setCountrySearchTerm('');
      }
      // Close action menu when clicking outside
      if (!target.closest('[data-menu-id]')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const filteredSites = useMemo(() => {
    const filtered = sitesData.filter(site => {
      // Exclude "manual entry" site by type (internal use only)
      // Each company has only one site with this type
      if (site.type === 'manual_entry' || site.type === 'manual-entry' || site.type === 'manual') {
        return false;
      }

      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        site.name.toLowerCase().includes(searchLower) ||
        site.address.toLowerCase().includes(searchLower) ||
        site.city.toLowerCase().includes(searchLower) ||
        site.state.toLowerCase().includes(searchLower) ||
        (site.custom_site_id && site.custom_site_id.toLowerCase().includes(searchLower)) ||
        `${site.address}, ${site.city}, ${site.state} ${site.zipCode}`.toLowerCase().includes(searchLower)
      );

      // Site Type filter
      const matchesSiteType = selectedSiteType.length === 0 || selectedSiteType.includes(site.type || '');

      // Custom ID filter
      const matchesCustomId = selectedCustomId.length === 0 || (site.custom_site_id && selectedCustomId.includes(site.custom_site_id));

      // Country filter
      const matchesCountry = selectedCountry.length === 0 || selectedCountry.includes(site.country || '');

      return matchesSearch && matchesSiteType && matchesCustomId && matchesCountry;
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
        case 'custom_id':
          aValue = (a.custom_site_id || '').toLowerCase();
          bValue = (b.custom_site_id || '').toLowerCase();
          break;
        case 'country':
          aValue = (a.country || '').toLowerCase();
          bValue = (b.country || '').toLowerCase();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchTerm, sites, sortBy, sortOrder, selectedSiteType, selectedCustomId, selectedCountry]);

  const sitesWithCoords = useMemo(() => {
    return filteredSites.flatMap((s) => {
      const lat = toFiniteNumber(s.latitude);
      const lng = toFiniteNumber(s.longitude);

      if (lat == null || lng == null) return [];
      if (lat === 0 || lng === 0) return [];

      // Ensure latitude/longitude are always numbers for map operations
      return [{ ...s, latitude: lat, longitude: lng }];
    });
  }, [filteredSites]);

  // Calculate map center based on all sites with coordinates
  const mapCenter = useMemo(() => {
    if (sitesWithCoords.length === 0) {
      // Use company country center if available, otherwise default to US
      return getDefaultMapCenter(currentCompany?.country || undefined);
    }
    
    const avgLat = sitesWithCoords.reduce((sum, s) => sum + (s.latitude || 0), 0) / sitesWithCoords.length;
    const avgLng = sitesWithCoords.reduce((sum, s) => sum + (s.longitude || 0), 0) / sitesWithCoords.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [sitesWithCoords, currentCompany?.country]);

  // Clear site selection when search term or filters change
  useEffect(() => {
    setSelectedSiteId(null);
  }, [searchTerm, selectedSiteType, selectedCustomId, selectedCountry]);

  // Keep Google Map viewport in sync with selected site / all sites
  useEffect(() => {
    if (!googleMapInstance) return;
    if (!isGoogleMapsLoaded) return;
    if (sitesWithCoords.length === 0) return;

    // Selected site: standard behavior
    // - If selection came from the list, center instantly (no animation, no zoom changes)
    // - If selection came from clicking a marker, don't force recenter
    if (selectedSiteId) {
      if (lastSelectionSourceRef.current !== 'list') return;
      const site = sitesWithCoords.find((s) => s.id === selectedSiteId);
      if (site?.latitude != null && site?.longitude != null) {
        googleMapInstance.setCenter({ lat: site.latitude, lng: site.longitude });
      }
      return;
    }

    // All sites: fit bounds
    const bounds = new google.maps.LatLngBounds();
    sitesWithCoords.forEach((s) => {
      if (s.latitude != null && s.longitude != null) {
        bounds.extend({ lat: s.latitude, lng: s.longitude });
      }
    });
    googleMapInstance.fitBounds(bounds);
  }, [googleMapInstance, isGoogleMapsLoaded, selectedSiteId, sitesWithCoords]);

  // Handle site click in list to center map on that site
  const handleSiteClick = (site: Site) => {
    const lat = toFiniteNumber(site.latitude);
    const lng = toFiniteNumber(site.longitude);
    if (lat != null && lng != null && lat !== 0 && lng !== 0) {
      lastSelectionSourceRef.current = 'list';
      setSelectedSiteId(site.id);
    }
  };

  // Handle "View All" button to show all sites
  const handleViewAll = () => {
    lastSelectionSourceRef.current = 'none';
    setSelectedSiteId(null);
  };

  // Toggle action menu
  const toggleMenu = (siteId: string) => {
    setOpenMenuId(openMenuId === siteId ? null : siteId);
  };

  // Handle activate/deactivate site
  const handleToggleActive = async (site: Site) => {
    try {
      const newIsActive = !site.is_active;
      
      const { error } = await supabase
        .from('sites')
        .update({ is_active: newIsActive, updated_at: new Date().toISOString() })
        .eq('id', site.id);

      if (error) {
        throw error;
      }

      logger.info('Site status updated', { siteId: site.id, is_active: newIsActive });
      setOpenMenuId(null);
      await refetch();
    } catch (err: any) {
      logger.error('Error updating site status', err instanceof Error ? err : new Error(String(err)));
      alert(`Failed to ${site.is_active ? 'deactivate' : 'activate'} site: ${err?.message || 'Unknown error'}`);
    }
  };

  // Handle delete site - show confirmation modal
  const handleDeleteSite = (site: Site) => {
    setOpenMenuId(null);
    setSiteToDelete(site);
  };

  // Confirm and execute delete
  const confirmDeleteSite = async () => {
    if (!siteToDelete) return;

    try {
      const { error } = await supabase
        .from('sites')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', siteToDelete.id);

      if (error) {
        throw error;
      }

      logger.info('Site deleted', { siteId: siteToDelete.id });
      setSiteToDelete(null);
      await refetch();
    } catch (err: any) {
      logger.error('Error deleting site', err instanceof Error ? err : new Error(String(err)));
      alert(`Failed to delete site: ${err?.message || 'Unknown error'}`);
    }
  };

  // Cancel delete
  const cancelDeleteSite = () => {
    setSiteToDelete(null);
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSites = filteredSites.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle sorting
  const handleSort = (field: 'name' | 'custom_id' | 'country') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedSiteType([]);
    setSelectedCustomId([]);
    setSelectedCountry([]);
    setSearchTerm('');
    setSiteTypeSearchTerm('');
    setCustomIdSearchTerm('');
    setCountrySearchTerm('');
    // Clear site selection to show all sites
    setSelectedSiteId(null);
  };

  // Helper functions for multi-select
  const handleSiteTypeToggle = (type: string) => {
    setSelectedSiteType(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleCustomIdToggle = (customId: string) => {
    setSelectedCustomId(prev => 
      prev.includes(customId) 
        ? prev.filter(c => c !== customId)
        : [...prev, customId]
    );
  };

  const handleCountryToggle = (country: string) => {
    setSelectedCountry(prev => 
      prev.includes(country) 
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };

  // Select All functions for each filter
  const handleSiteTypeSelectAll = () => {
    const allTypes = getFilteredSiteTypeOptions();
    setSelectedSiteType(allTypes);
  };

  const handleCustomIdSelectAll = () => {
    const allCustomIds = getFilteredCustomIdOptions();
    setSelectedCustomId(allCustomIds);
  };

  const handleCountrySelectAll = () => {
    const allCountries = getFilteredCountryOptions();
    setSelectedCountry(allCountries);
  };

  // Filter options based on search terms
  const getFilteredSiteTypeOptions = () => {
    // Exclude manual entry types (always hidden)
    const typeOptions = Array.from(new Set(sitesData
      .map(s => s.type)
      .filter(Boolean)
      .filter(type => type !== 'manual' && type !== 'manual_entry' && type !== 'manual-entry')
    )).sort();
    if (!siteTypeSearchTerm) return typeOptions;
    return typeOptions.filter(type => 
      type.toLowerCase().includes(siteTypeSearchTerm.toLowerCase())
    );
  };

  const getFilteredCustomIdOptions = (): string[] => {
    const customIdOptions = Array.from(new Set(sitesData.map(s => s.custom_site_id).filter((id): id is string => Boolean(id)))).sort();
    if (!customIdSearchTerm) return customIdOptions;
    return customIdOptions.filter(customId => 
      customId.toLowerCase().includes(customIdSearchTerm.toLowerCase())
    );
  };

  const getFilteredCountryOptions = () => {
    const countryOptions = Array.from(new Set(sitesData.map(s => s.country).filter(Boolean))).sort();
    if (!countrySearchTerm) return countryOptions;
    return countryOptions.filter(country => 
      country.toLowerCase().includes(countrySearchTerm.toLowerCase())
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-1">Sites</h1>
            <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
              {`View and manage all company sites${filteredSites.length > itemsPerPage ? ` (Page ${currentPage} of ${totalPages})` : ''}`}
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
              onClick={() => {
                sessionStorage.removeItem('selectedSite');
                router.navigate('/sites/site-info');
              }}
              className="flex items-center gap-2 px-2 py-1 rounded text-white transition-colors text-sm" 
              style={{ backgroundColor: 'var(--primary-brand-hex)' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              Add Site
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {sitesError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <div>
              <div className="text-sm font-medium text-red-800">Error loading sites</div>
              <div className="text-sm text-red-700">{sitesError}</div>
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

      {/* Search and Filters */}
      {!sitesError && !sitesLoading && (
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
                placeholder="Search sites by name, address, city, or state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1 border border-gray-200 rounded text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                aria-label="Search sites"
                id="site-search"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Clear Filters Button - Only show when filters are active */}
              {(selectedSiteType.length > 0 || selectedCustomId.length > 0 || selectedCountry.length > 0 || searchTerm) && (
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
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 transition-colors ${
                    viewMode === 'list'
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
              {/* Site Type Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowSiteTypeDropdown(!showSiteTypeDropdown)}>
                  <span className="text-gray-700">
                    {selectedSiteType.length === 0 ? 'All Site Types' : 
                     selectedSiteType.length === 1 ? selectedSiteType[0] :
                     `${selectedSiteType.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showSiteTypeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search site types..."
                          value={siteTypeSearchTerm}
                          onChange={(e) => setSiteTypeSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSiteTypeSelectAll();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Select All
                          </button>
                          {selectedSiteType.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSiteType([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                            >
                              Clear ({selectedSiteType.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {getFilteredSiteTypeOptions().map((type) => (
                      <div key={type} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleSiteTypeToggle(type)}>
                        <input type="checkbox" checked={selectedSiteType.includes(type)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{type === 'company_branch' ? 'Company Branch' : type === 'customer_site' ? 'Customer Site' : type}</span>
                      </div>
                    ))}
                    {getFilteredSiteTypeOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No site types found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Custom ID Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowCustomIdDropdown(!showCustomIdDropdown)}>
                  <span className="text-gray-700">
                    {selectedCustomId.length === 0 ? 'All Custom IDs' : 
                     selectedCustomId.length === 1 ? selectedCustomId[0] :
                     `${selectedCustomId.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showCustomIdDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search custom IDs..."
                          value={customIdSearchTerm}
                          onChange={(e) => setCustomIdSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCustomIdSelectAll();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Select All
                          </button>
                          {selectedCustomId.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomId([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                            >
                              Clear ({selectedCustomId.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {getFilteredCustomIdOptions().map((customId) => (
                      <div key={customId} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleCustomIdToggle(customId)}>
                        <input type="checkbox" checked={selectedCustomId.includes(customId)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{customId}</span>
                      </div>
                    ))}
                    {getFilteredCustomIdOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No custom IDs found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Country Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowCountryDropdown(!showCountryDropdown)}>
                  <span className="text-gray-700">
                    {selectedCountry.length === 0 ? 'All Countries' : 
                     selectedCountry.length === 1 ? selectedCountry[0] :
                     `${selectedCountry.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showCountryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search countries..."
                          value={countrySearchTerm}
                          onChange={(e) => setCountrySearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCountrySelectAll();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Select All
                          </button>
                          {selectedCountry.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCountry([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                            >
                              Clear ({selectedCountry.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {getFilteredCountryOptions().map((country) => (
                      <div key={country} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleCountryToggle(country)}>
                        <input type="checkbox" checked={selectedCountry.includes(country)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{country}</span>
                      </div>
                    ))}
                    {getFilteredCountryOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No countries found
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
                  onClick={() => handleSort('name')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'name' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Name
                  {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
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
                  onClick={() => handleSort('country')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'country' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Country
                  {sortBy === 'country' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* List View */}
      {!sitesError && !sitesLoading && viewMode === 'list' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-48">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Site Name
                      {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-36">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-32">
                    <button
                      onClick={() => handleSort('custom_id')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Custom ID
                      {sortBy === 'custom_id' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs w-28">
                    <button
                      onClick={() => handleSort('country')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Country
                      {sortBy === 'country' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">Address</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">No sites found</p>
                      <p className="text-sm text-gray-500">
                        {sitesData.length === 0 
                          ? 'Start by adding sites to your company'
                          : 'Try adjusting your search criteria'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedSites.map((site) => (
                  <tr key={site.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 w-48">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-primary shrink-0" style={{ backgroundColor: 'var(--primary-brand-hex)' }}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="font-medium text-gray-900 text-sm truncate">
                          {site.name}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 w-36">
                      {site.type ? (
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          site.type === 'company_branch' 
                            ? 'bg-blue-50 text-blue-700' 
                            : site.type === 'customer_site'
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}>
                          {site.type === 'company_branch' ? 'Company Branch' : site.type === 'customer_site' ? 'Customer Site' : site.type}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 w-32">
                      <span className="text-sm text-gray-700 truncate">
                        {site.custom_site_id || '—'}
                      </span>
                    </td>
                    <td className="py-4 px-4 w-28">
                      <span className="text-sm text-gray-700">
                        {site.country || '—'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-2 text-gray-600 text-sm">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <span>{site.address}, {site.city}, {site.state} {site.zipCode}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 w-24">
                      <div className="flex items-center">
                        <button 
                          onClick={() => {
                            // Save site data to sessionStorage for SiteInfo to load
                            sessionStorage.setItem('selectedSite', JSON.stringify({
                              id: site.id,
                              siteName: site.name,
                              name: site.name,
                              address: site.address,
                              site_address: site.address,
                              latitude: site.latitude || 0,
                              longitude: site.longitude || 0,
                              type: site.type,
                              custom_site_id: site.custom_site_id,
                            }));
                            router.navigate('/sites/site-info');
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`View ${site.name}`}
                          title={`View ${site.name}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <div className="relative" data-menu-id={site.id}>
                        <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMenu(site.id);
                            }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`More options for ${site.name}`}
                          title={`More options for ${site.name}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === site.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-[100]">
                              <div className="py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleActive(site);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {site.is_active ? (
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
                                    handleDeleteSite(site);
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

      {/* Map View */}
      {!sitesError && !sitesLoading && viewMode === 'map' && (
        <div className="flex gap-4 mb-4">
          {/* Site List - 30% width */}
          <div className="w-[30%] bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Sites ({filteredSites.length})</h3>
              {selectedSiteId && (
                <button
                  onClick={handleViewAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View All
                </button>
              )}
            </div>
            <div className="h-[432px] overflow-y-auto">
              {paginatedSites.map((site) => (
                <div
                  key={site.id}
                  onClick={() => handleSiteClick(site)}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors p-3 cursor-pointer ${
                    selectedSiteId === site.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: 'var(--primary-brand-hex)' }}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {site.name}
                      </div>
                      <div className="text-xs text-gray-500 flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 shrink-0 mt-[1px]" />
                        <span className="whitespace-normal break-words">{site.address}, {site.city}, {site.state}</span>
                      </div>
                      {!site.latitude || !site.longitude ? (
                        <div className="text-xs text-amber-600 mt-1">⚠️ No coordinates</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Map - 70% width */}
          <div className="w-[70%] bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-900">
                {selectedSiteId 
                  ? (() => {
                      const selectedSite = filteredSites.find(s => s.id === selectedSiteId);
                      return selectedSite ? selectedSite.name : `Site Locations (${sitesWithCoords.length} with coordinates)`;
                    })()
                  : `Site Locations (${sitesWithCoords.length} with coordinates)`
                }
              </h3>
            </div>
            <div className="h-[432px] relative">
              {sitesWithCoords.length > 0 ? (
                <div className="h-[432px] w-full">
                  {googleMapsLoadError ? (
                    <div className="h-full bg-gray-100 flex items-center justify-center">
                      <div className="text-center max-w-sm px-6">
                        <Map className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 font-medium">Google Maps failed to load</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Please verify your `VITE_GOOGLE_MAPS_API_KEY` and allowed domains.
                        </p>
                      </div>
                    </div>
                  ) : !isGoogleMapsLoaded ? (
                    <div className="h-full bg-gray-100 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                        <p className="text-sm text-gray-600">Loading map…</p>
                      </div>
                    </div>
                  ) : (
                    <GoogleMap
                      mapContainerStyle={{ height: '100%', width: '100%' }}
                      center={mapCenter}
                      zoom={sitesWithCoords.length > 1 ? 10 : 15}
                      onLoad={(map) => setGoogleMapInstance(map)}
                      onUnmount={() => setGoogleMapInstance(null)}
                      options={{
                        fullscreenControl: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                      }}
                    >
                      {sitesWithCoords
                        .filter((site) => !selectedSiteId || site.id === selectedSiteId)
                        .map((site) => (
                          <MarkerF
                            key={`site-marker-${site.id}`}
                            position={{ lat: site.latitude!, lng: site.longitude! }}
                            onClick={() => {
                              lastSelectionSourceRef.current = 'map';
                              setSelectedSiteId(site.id);
                            }}
                          >
                          </MarkerF>
                        ))}
                    </GoogleMap>
                  )}
                </div>
              ) : (
            <div className="h-[432px] bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <Map className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">No sites with coordinates to display</p>
              </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!sitesLoading && (
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
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSites.length)} of {filteredSites.length}
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
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
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
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Import Sites Wizard */}
      {showImportWizard && (
        <ImportSitesWizard
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => {
            refetch();
            setShowImportWizard(false);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {siteToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Site</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={cancelDeleteSite}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{siteToDelete.name}</span>? 
                This will permanently remove the site from your directory.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={cancelDeleteSite}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSite}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

