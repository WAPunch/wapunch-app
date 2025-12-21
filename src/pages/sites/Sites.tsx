import { useEffect, useState, useMemo } from 'react';
import { router } from '../../lib/router';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useSites } from '../../hooks/useSites';
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
  Upload
} from 'lucide-react';

// Google Maps libraries are centralized in `useGoogleMapsLoader`

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
}

export default function Sites() {
  const { registerSubmodules } = useSubmoduleNav();
  const { sites: sitesData, isLoading: sitesLoading, error: sitesError, refetch } = useSites();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'address'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedState, setSelectedState] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string[]>([]);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Load Google Maps (must be called with identical options app-wide)
  const { isLoaded, loadError } = useGoogleMapsLoader();

  useEffect(() => {
    // Register submodule tabs for sites section
    registerSubmodules('Sites', [
      { id: 'sites', label: 'Sites', href: '/sites', icon: Building2 }
    ]);
  }, [registerSubmodules]);

  // Use sites from Supabase hook
  const sites = sitesData;

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowStateDropdown(false);
        setShowCityDropdown(false);
        // Clear search terms when closing dropdowns
        setStateSearchTerm('');
        setCitySearchTerm('');
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
        `${site.address}, ${site.city}, ${site.state} ${site.zipCode}`.toLowerCase().includes(searchLower)
      );

      // State filter
      const matchesState = selectedState.length === 0 || selectedState.includes(site.state);

      // City filter
      const matchesCity = selectedCity.length === 0 || selectedCity.includes(site.city);

      return matchesSearch && matchesState && matchesCity;
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
        case 'address':
          aValue = `${a.address}, ${a.city}, ${a.state}`.toLowerCase();
          bValue = `${b.address}, ${b.city}, ${b.state}`.toLowerCase();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [searchTerm, sites, sortBy, sortOrder, selectedState, selectedCity]);

  const sitesWithCoords = useMemo(
    () =>
      filteredSites.filter(
        (s) =>
          typeof s.latitude === 'number' &&
          typeof s.longitude === 'number' &&
          s.latitude !== 0 &&
          s.longitude !== 0
      ),
    [filteredSites]
  );

  // Create red pin icon for markers (same as SiteInfo)
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

  // Calculate map center based on all sites with coordinates
  const mapCenter = useMemo(() => {
    if (sitesWithCoords.length === 0) {
      return { lat: 40.7128, lng: -74.0060 }; // Default to NYC
    }
    
    const avgLat = sitesWithCoords.reduce((sum, s) => sum + (s.latitude || 0), 0) / sitesWithCoords.length;
    const avgLng = sitesWithCoords.reduce((sum, s) => sum + (s.longitude || 0), 0) / sitesWithCoords.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [sitesWithCoords]);

  // Clear site selection when search term or filters change
  useEffect(() => {
    setSelectedSiteId(null);
  }, [searchTerm, selectedState, selectedCity]);

  // Fit map bounds to all sites with coordinates (unless user has selected a specific site)
  useEffect(() => {
    if (!map || !isLoaded) return;
    if (sitesWithCoords.length === 0) return;

    // If a site is selected, we let selection handler control centering/zoom.
    if (selectedSiteId) return;

    try {
      const bounds = new google.maps.LatLngBounds();
      sitesWithCoords.forEach((s) => bounds.extend({ lat: s.latitude!, lng: s.longitude! }));
      map.fitBounds(bounds);
    } catch (e) {
      // noop - map can still render
    }
  }, [map, isLoaded, sitesWithCoords, selectedSiteId]);

  // Handle site click in list to center map on that site
  const handleSiteClick = (site: Site) => {
    if (site.latitude && site.longitude && map) {
      setSelectedSiteId(site.id);
      map.panTo({ lat: site.latitude, lng: site.longitude });
      map.setZoom(15);
    }
  };

  // Handle "View All" button to show all sites
  const handleViewAll = () => {
    setSelectedSiteId(null);
    if (map) {
      const sitesWithCoords = filteredSites.filter(s => s.latitude && s.longitude && s.latitude !== 0 && s.longitude !== 0);
      if (sitesWithCoords.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        sitesWithCoords.forEach(site => {
          bounds.extend({ lat: site.latitude!, lng: site.longitude! });
        });
        map.fitBounds(bounds);
      }
    }
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
    setSelectedState([]);
    setSelectedCity([]);
    setSearchTerm('');
    setStateSearchTerm('');
    setCitySearchTerm('');
    // Clear site selection to show all sites
    setSelectedSiteId(null);
  };

  // Helper functions for multi-select
  const handleStateToggle = (state: string) => {
    setSelectedState(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const handleCityToggle = (city: string) => {
    setSelectedCity(prev => 
      prev.includes(city) 
        ? prev.filter(c => c !== city)
        : [...prev, city]
    );
  };

  // Select All functions for each filter
  const handleStateSelectAll = () => {
    const allStates = getFilteredStateOptions();
    setSelectedState(allStates);
  };

  const handleCitySelectAll = () => {
    const allCities = getFilteredCityOptions();
    setSelectedCity(allCities);
  };

  // Filter options based on search terms
  const getFilteredStateOptions = () => {
    const stateOptions = Array.from(new Set(sitesData.map(s => s.state))).sort();
    if (!stateSearchTerm) return stateOptions;
    return stateOptions.filter(state => 
      state.toLowerCase().includes(stateSearchTerm.toLowerCase())
    );
  };

  const getFilteredCityOptions = () => {
    const cityOptions = Array.from(new Set(sitesData.map(s => s.city))).sort();
    if (!citySearchTerm) return cityOptions;
    return cityOptions.filter(city => 
      city.toLowerCase().includes(citySearchTerm.toLowerCase())
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
              onClick={() => {
                // TODO: Implement import functionality
              }}
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
              {(selectedState.length > 0 || selectedCity.length > 0 || searchTerm) && (
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
              {/* State Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowStateDropdown(!showStateDropdown)}>
                  <span className="text-gray-700">
                    {selectedState.length === 0 ? 'All States' : 
                     selectedState.length === 1 ? selectedState[0] :
                     `${selectedState.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showStateDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search states..."
                          value={stateSearchTerm}
                          onChange={(e) => setStateSearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStateSelectAll();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Select All
                          </button>
                          {selectedState.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedState([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                            >
                              Clear ({selectedState.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {getFilteredStateOptions().map((state) => (
                      <div key={state} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleStateToggle(state)}>
                        <input type="checkbox" checked={selectedState.includes(state)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{state}</span>
                      </div>
                    ))}
                    {getFilteredStateOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No states found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* City Multi-Select */}
              <div className="relative dropdown-container">
                <div className="px-3 py-1 border border-gray-200 rounded text-sm bg-white min-h-[32px] flex items-center justify-between cursor-pointer hover:bg-gray-50" 
                     onClick={() => setShowCityDropdown(!showCityDropdown)}>
                  <span className="text-gray-700">
                    {selectedCity.length === 0 ? 'All Cities' : 
                     selectedCity.length === 1 ? selectedCity[0] :
                     `${selectedCity.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showCityDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search cities..."
                          value={citySearchTerm}
                          onChange={(e) => setCitySearchTerm(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCitySelectAll();
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          >
                            Select All
                          </button>
                          {selectedCity.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCity([]);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                            >
                              Clear ({selectedCity.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {getFilteredCityOptions().map((city) => (
                      <div key={city} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                           onClick={() => handleCityToggle(city)}>
                        <input type="checkbox" checked={selectedCity.includes(city)} readOnly className="w-4 h-4" />
                        <span className="text-sm text-gray-700">{city}</span>
                      </div>
                    ))}
                    {getFilteredCityOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        No cities found
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
                  onClick={() => handleSort('address')}
                  className={`text-xs hover:text-gray-900 flex items-center gap-1 ${
                    sortBy === 'address' ? 'text-gray-900 font-medium' : 'text-gray-600'
                  }`}
                >
                  Address
                  {sortBy === 'address' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
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
                  <th className="text-left py-3 px-6 font-medium text-gray-900 text-xs w-1/3 min-w-[200px]">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Site Name
                      {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900 text-xs">
                    <button
                      onClick={() => handleSort('address')}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Address
                      {sortBy === 'address' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                    </button>
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-gray-900 text-xs w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
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
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-primary" style={{ backgroundColor: 'var(--primary-brand-hex)' }}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="font-medium text-gray-900 text-sm">
                          {site.name}
                        </div>
                      </div>
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
                            }));
                            router.navigate('/sites/site-info');
                          }}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`View ${site.name}`}
                          title={`View ${site.name}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`More options for ${site.name}`}
                          title={`More options for ${site.name}`}
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
                Site Locations ({sitesWithCoords.length} with coordinates)
              </h3>
            </div>
            {isLoaded ? (
              <div className="h-[432px]">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={sitesWithCoords.length > 1 ? 10 : 15}
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
                    sitesWithCoords
                      .filter(site => !selectedSiteId || site.id === selectedSiteId)
                      .map((site) => (
                        <MarkerF
                          key={`site-marker-${site.id}`}
                          position={{ lat: site.latitude!, lng: site.longitude! }}
                          icon={getMarkerIcon()}
                          onClick={() => {
                            setSelectedSiteId(site.id);
                            if (map) {
                              map.panTo({ lat: site.latitude!, lng: site.longitude! });
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

    </div>
  );
}

