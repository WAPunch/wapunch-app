import { useEffect, useRef, useState } from 'react';
import { useSubmoduleNav } from '../../../hooks/useSubmoduleNav';
import { useCompany } from '../../../hooks/useCompany';
import { supabase } from '../../../lib/supabase';
import { logger } from '../../../lib/logger';
import { router } from '../../../lib/router';
import { 
  Building2,
  MapPin,
  Save,
  X,
  AlertCircle,
} from 'lucide-react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import { useGoogleMapsLoader } from '../../../lib/google-maps';

// Extend Window interface for lastAutocompleteUpdate
declare global {
  interface Window {
    lastAutocompleteUpdate?: number;
  }
}

// Google Maps libraries are centralized in `useGoogleMapsLoader`

// Default site data
const defaultSite = {
  id: '',
  siteName: '',
  address: '',
  latitude: 0,
  longitude: 0,
  type: 'company_branch' as 'company_branch' | 'customer_site',
  customSiteId: '',
  country: '',
};

interface SiteData {
  id: string;
  siteName: string;
  address: string;
  latitude: number;
  longitude: number;
  type: 'company_branch' | 'customer_site';
  customSiteId: string;
  country?: string;
}

// Helper function to extract country from Google Maps address_components
const extractCountryFromAddressComponents = (addressComponents: google.maps.GeocoderAddressComponent[]): string => {
  if (!addressComponents || addressComponents.length === 0) return '';
  
  // Find the component with type "country"
  const countryComponent = addressComponents.find(component => 
    component.types && component.types.includes('country')
  );
  
  if (countryComponent) {
    // Use long_name for the full country name (e.g., "Panama" instead of "Provincia de Panama")
    return countryComponent.long_name || '';
  }
  
  return '';
}

export default function SiteInfo() {
  const { setBreadcrumbs, clearSubmoduleNav } = useSubmoduleNav();
  const { currentCompany } = useCompany();
  const [site, setSite] = useState<SiteData>(defaultSite);
  const [originalSite, setOriginalSite] = useState<SiteData>(defaultSite);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const autocompleteRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const addressEditedRef = useRef(false);
  const isApplyingCoordinatesRef = useRef(false);

  // Load Google Maps (must be called with identical options app-wide)
  const { isLoaded, loadError } = useGoogleMapsLoader();

  useEffect(() => {
    // Clear any existing submodule navigation and set breadcrumbs
    clearSubmoduleNav();
    
    // Create slug from site name for breadcrumb URLs
    const slug = site.siteName 
      ? site.siteName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      : 'new-site';
    
    setBreadcrumbs([
      { label: 'Sites', href: '/directory/sites' },
      { label: site.siteName || (site.id ? 'Edit Site' : 'New Site') }
    ]);

    // Clear breadcrumbs when component unmounts
    return () => clearSubmoduleNav();
  }, [setBreadcrumbs, clearSubmoduleNav, site.id, site.siteName]);

  // Mark that we're on SiteInfo page when component mounts
  useEffect(() => {
    sessionStorage.removeItem('navigatingToSiteInfo');
    // Set flag to indicate we're currently on SiteInfo page
    sessionStorage.setItem('isOnSiteInfoPage', 'true');
    
    return () => {
      // When unmounting, check if we're navigating back to Sites
      // This will be checked in Sites component
    };
  }, []);

  // Load site data from sessionStorage or database
  useEffect(() => {
    const loadSiteData = async () => {
      setIsLoading(true);
      const selectedSiteData = sessionStorage.getItem('selectedSite');
      if (selectedSiteData) {
        try {
          const parsedSite = JSON.parse(selectedSiteData);
          
          if (parsedSite.id && currentCompany?.id) {
            try {
              const { data: siteData, error: fetchError } = await supabase
                .from('sites')
                .select('*')
                .eq('id', parsedSite.id)
                .eq('company_id', currentCompany.id)
                .eq('is_deleted', false)
                .single();

              if (!fetchError && siteData) {
                const mappedSite = {
                  id: siteData.id,
                  siteName: siteData.site_name || '',
                  address: siteData.site_address || '',
                  latitude: siteData.latitude ? Number(siteData.latitude) : 0,
                  longitude: siteData.longitude ? Number(siteData.longitude) : 0,
                  type: (siteData.type === 'customer_site' ? 'customer_site' : 'company_branch') as 'company_branch' | 'customer_site',
                  customSiteId: siteData.custom_site_id || '',
                  country: siteData.country || '',
                };
                setSite(mappedSite);
                setOriginalSite(mappedSite);
                setIsLoading(false);
                return;
              }
            } catch (dbError) {
              logger.error('Error fetching site from database', dbError instanceof Error ? dbError : new Error(String(dbError)));
            }
          }
          
          // Fallback to sessionStorage data
          const mappedSite = {
            id: parsedSite.id || '',
            siteName: parsedSite.siteName || parsedSite.name || '',
            address: parsedSite.address || parsedSite.site_address || '',
            latitude: parsedSite.latitude ? Number(parsedSite.latitude) : 0,
            longitude: parsedSite.longitude ? Number(parsedSite.longitude) : 0,
            type: (parsedSite.type === 'customer_site' ? 'customer_site' : 'company_branch') as 'company_branch' | 'customer_site',
            customSiteId: parsedSite.customSiteId || parsedSite.custom_site_id || '',
            country: parsedSite.country || '',
          };
          setSite(mappedSite);
          setOriginalSite(mappedSite);
        } catch (error) {
          logger.error('Error parsing site data', error instanceof Error ? error : new Error(String(error)));
          setSite(defaultSite);
          setOriginalSite(defaultSite);
        }
      }
      
      setIsLoading(false);
    };
    loadSiteData();
  }, [currentCompany?.id]);

  // Track changes
  useEffect(() => {
    const hasChanged = JSON.stringify(site) !== JSON.stringify(originalSite);
    setHasChanges(hasChanged);
  }, [site, originalSite]);

  // Initialize Autocomplete - simplified and more reliable
  useEffect(() => {
    if (!isLoaded || !autocompleteRef.current || autocomplete) return;

      const autocompleteInstance = new google.maps.places.Autocomplete(autocompleteRef.current, {
      fields: ['formatted_address', 'geometry', 'name', 'address_components'],
      });

    const handlePlaceSelect = () => {
        const place = autocompleteInstance.getPlace();
      
      if (!place || !place.geometry || !place.geometry.location) {
        return;
      }

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
      const address = place.formatted_address || place.name || '';
      
      // Extract country from address_components
      const country = place.address_components 
        ? extractCountryFromAddressComponents(place.address_components)
        : '';

      // Mark timestamp to prevent geocoding conflict
      if (!window.lastAutocompleteUpdate) {
        window.lastAutocompleteUpdate = 0;
      }
      window.lastAutocompleteUpdate = Date.now();

      // Update state
      addressEditedRef.current = false;
          setSite(prev => ({
            ...prev,
            address,
            latitude: lat,
            longitude: lng,
        country: country || prev.country,
          }));

      // Update map immediately
          if (map) {
            map.setCenter({ lat, lng });
            map.setZoom(15);
          }
    };

    autocompleteInstance.addListener('place_changed', handlePlaceSelect);
      setAutocomplete(autocompleteInstance);

  }, [isLoaded, autocompleteRef.current, autocomplete, map]);

  // Update map center when coordinates change (for marker drag and map click)
  useEffect(() => {
    if (!map || site.latitude === 0 || site.longitude === 0) return;
    
    const currentCenter = map.getCenter();
    if (!currentCenter) return;
    
    const centerLat = currentCenter.lat();
    const centerLng = currentCenter.lng();
    
    // Only update if significantly different (avoid fighting with user panning)
    const threshold = 0.001;
    if (Math.abs(centerLat - site.latitude) > threshold || 
        Math.abs(centerLng - site.longitude) > threshold) {
      map.panTo({ lat: site.latitude, lng: site.longitude });
      
      const currentZoom = map.getZoom();
      if (currentZoom !== undefined && currentZoom < 10) {
        map.setZoom(15);
      }
    }
  }, [map, site.latitude, site.longitude]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'address') {
      addressEditedRef.current = true;
    }
    setSite(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Geocode address when user types manually and presses Enter or loses focus
  const handleAddressGeocode = async () => {
    if (!isLoaded || !site.address.trim() || !map) return;

    // Only geocode on blur if the user manually edited the address.
    // If the user picked from Google Autocomplete, we already have authoritative geometry.
    if (!addressEditedRef.current) return;
    
    // Prevent geocoding if we just selected from autocomplete
    const recentUpdate = Date.now();
    if (window.lastAutocompleteUpdate && recentUpdate - window.lastAutocompleteUpdate < 1000) {
      return;
    }
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: site.address }, (results, status) => {
      if (status === 'OK' && results && results.length > 0 && results[0]?.geometry) {
        const result = results[0];
        if (!result) return;
        const location = result.geometry?.location;
        if (!location) return;
        let lat: number = 0;
        let lng: number = 0;
        try {
          const latValue = location.lat();
          lat = typeof latValue === 'number' ? latValue : 0;
        } catch {
          lat = 0;
        }
        try {
          const lngValue = location.lng();
          lng = typeof lngValue === 'number' ? lngValue : 0;
        } catch {
          lng = 0;
        }
        const formattedAddress = result.formatted_address || site.address;
        
        // Extract country from address_components
        const country = result.address_components 
          ? extractCountryFromAddressComponents(result.address_components)
          : '';

        setSite(prev => ({
          ...prev,
          address: formattedAddress,
          latitude: lat,
          longitude: lng,
          country: country || prev.country,
        }));
        addressEditedRef.current = false;

        map.setCenter({ lat, lng });
        map.setZoom(15);
      }
    });
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddressGeocode();
    }
  };

  const isValidLatLng = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    // Keep existing convention: 0,0 means "unset"
    if (lat === 0 && lng === 0) return false;
    return true;
  };

  const applyCoordinates = (lat: number, lng: number, opts?: { reverseGeocode?: boolean }) => {
    if (!isLoaded) return;
    if (!isValidLatLng(lat, lng)) return;

    isApplyingCoordinatesRef.current = true;
    addressEditedRef.current = false;

    setSite((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));

    // Clear coordinates error once valid coordinates are applied
    if (errors.coordinates) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.coordinates;
        return next;
      });
    }

    if (map) {
      map.setCenter({ lat, lng });
      map.setZoom(15);
    }

    if (opts?.reverseGeocode) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results.length > 0 && results[0]) {
          const result = results[0];
          const formattedAddress = result.formatted_address;
          const country = result.address_components
            ? extractCountryFromAddressComponents(result.address_components)
            : '';

          if (formattedAddress) {
            setSite((prev) => ({
              ...prev,
              address: formattedAddress,
              country: country || prev.country,
            }));
          }
        }
        isApplyingCoordinatesRef.current = false;
      });
    } else {
      isApplyingCoordinatesRef.current = false;
    }
  };

  const commitCoordinatesFromInputs = () => {
    // Don't fight with ongoing reverse-geocode / map updates
    if (isApplyingCoordinatesRef.current) return;
    const lat = site.latitude;
    const lng = site.longitude;

    // If user hasn't entered both, don't show an error yet
    if (lat === 0 || lng === 0) return;

    if (!isValidLatLng(lat, lng)) {
      setErrors((prev) => ({
        ...prev,
        coordinates: 'Coordinates must be valid (lat -90..90, lng -180..180).',
      }));
      return;
    }

    applyCoordinates(lat, lng, { reverseGeocode: true });
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const latLng = e.latLng;
      let latNum = 0;
      let lngNum = 0;
      
      try {
        const latValue = latLng.lat();
        latNum = typeof latValue === 'number' ? latValue : 0;
      } catch {
        latNum = 0;
      }
      
      try {
        const lngValue = latLng.lng();
        lngNum = typeof lngValue === 'number' ? lngValue : 0;
      } catch {
        lngNum = 0;
      }

      applyCoordinates(latNum, lngNum, { reverseGeocode: true });
    }
  };

  const handleSave = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!site.siteName.trim()) {
      newErrors.siteName = 'Site name is required';
    }

    if (!site.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!site.type || (site.type !== 'company_branch' && site.type !== 'customer_site')) {
      newErrors.type = 'Site type is required and must be either company_branch or customer_site';
    }

    if (site.latitude === 0 || site.longitude === 0) {
      newErrors.coordinates = 'Please select a location on the map or search for an address';
    }

    if (!currentCompany?.id) {
      newErrors.general = 'No company selected';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    setIsSaving(true);
    try {
      // Use country from site state (extracted from Google Maps address_components)
      // If not available, fallback to company country or default
      const country = site.country || currentCompany?.country || 'United States';

      // Prepare site data for database
      const siteData: any = {
        site_name: site.siteName.trim(),
        site_address: site.address.trim(),
        latitude: site.latitude,
        longitude: site.longitude,
        country: country,
        type: site.type,
        custom_site_id: site.customSiteId.trim() || null,
        is_active: true,
      };

      let savedSite;
      if (site.id) {
        // Update existing site
        const { data, error: updateError } = await supabase
          .from('sites')
          .update({
            ...siteData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', site.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        savedSite = data;
        logger.info('Site updated', { siteId: site.id });
      } else {
        // Create new site
        if (!currentCompany?.id) {
          throw new Error('No company selected');
        }
        
        const { data, error: insertError } = await supabase
          .from('sites')
          .insert({
            ...siteData,
            company_id: currentCompany.id,
            is_deleted: false,
            archived: false,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        savedSite = data;
        logger.info('Site created', { siteId: savedSite.id });
      }

      // Update site state with saved data
      const updatedSite = {
        id: savedSite.id,
        siteName: savedSite.site_name || site.siteName,
        address: savedSite.site_address || site.address,
        latitude: savedSite.latitude ? Number(savedSite.latitude) : site.latitude,
        longitude: savedSite.longitude ? Number(savedSite.longitude) : site.longitude,
        type: (savedSite.type === 'customer_site' ? 'customer_site' : 'company_branch') as 'company_branch' | 'customer_site',
        customSiteId: savedSite.custom_site_id || '',
      };

      setSite(updatedSite);
      setOriginalSite(updatedSite);
      setHasChanges(false);
      setErrors({});
      
      return true;
    } catch (err: any) {
      logger.error('Error saving site', err instanceof Error ? err : new Error(String(err)));
      setErrors({ general: err?.message || 'Failed to save site. Please try again.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndFinish = async () => {
    const success = await handleSave();
    if (success) {
      // Set flag to indicate we're coming FROM SiteInfo back to Sites
      sessionStorage.setItem('comingFromSiteInfo', 'true');
      sessionStorage.removeItem('navigatingToSiteInfo');
      
      // Navigate back to Sites page (state will be restored automatically)
      router.navigate('/directory/sites');
    }
  };

  const handleCancel = () => {
    setSite(originalSite);
    setErrors({});
    
    // Set flag to indicate we're coming FROM SiteInfo back to Sites
    sessionStorage.setItem('comingFromSiteInfo', 'true');
    sessionStorage.removeItem('navigatingToSiteInfo');
    
    // Navigate back to Sites page (state will be restored automatically)
    router.navigate('/directory/sites');
  };

  const mapContainerStyle = {
    width: '100%',
    height: '400px',
  };

  const defaultCenter = {
    lat: site.latitude !== 0 ? site.latitude : 40.7128, // Default to NYC if no coordinates
    lng: site.longitude !== 0 ? site.longitude : -74.0060,
  };

  // Create red pin icon for marker (similar to lucide-react MapPin style)
  const getMarkerIcon = () => {
    if (!isLoaded || typeof google === 'undefined') return undefined;
    
    // Red pin icon SVG - inspired by lucide-react MapPin style
    const svgIcon = `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C7.58172 0 4 3.58172 4 8C4 14 12 32 12 32C12 32 20 14 20 8C20 3.58172 16.4183 0 12 0Z" fill="#ef4444"/>
      <circle cx="12" cy="8" r="3" fill="white"/>
    </svg>`;
    
    try {
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


  if (loadError) {
    console.error('Google Maps load error:', loadError);
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error loading Google Maps</span>
          </div>
          <p className="text-sm text-red-700 mt-2">
            {import.meta.env.VITE_GOOGLE_MAPS_API_KEY 
              ? `Failed to load Google Maps. Error: ${loadError?.message || 'Unknown error'}. Please check your API key has the following APIs enabled: Maps JavaScript API, Places API, and Geocoding API.`
              : 'Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your environment variables.'}
          </p>
          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
            <div className="mt-3 text-xs text-red-600">
              <p className="font-medium">Troubleshooting steps:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Go to Google Cloud Console → APIs & Services → Library</li>
                <li>Enable "Maps JavaScript API"</li>
                <li>Enable "Places API"</li>
                <li>Enable "Geocoding API"</li>
                <li>Check API key restrictions in APIs & Services → Credentials</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">
            {site.id ? 'Edit Site' : 'New Site'}
          </h1>
          <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
            {isLoading 
              ? 'Loading...'
              : site.siteName 
                ? `Edit ${site.siteName}'s information`
                : site.id ? 'Update site information and location' : 'Create a new site for your company'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-2 px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 text-sm transition-colors"
          >
            <X style={{ width: '14px', height: '14px' }} />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
              hasChanges && !isSaving
                ? 'text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            style={hasChanges && !isSaving
              ? { backgroundColor: 'var(--primary-brand-hex)' }
              : {}
            }
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save style={{ width: '14px', height: '14px' }} />
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleSaveAndFinish}
            disabled={!hasChanges || isSaving}
            className={`flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
              hasChanges && !isSaving
                ? 'text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            style={hasChanges && !isSaving
              ? { backgroundColor: 'var(--primary-brand-hover)' }
              : {}
            }
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save style={{ width: '14px', height: '14px' }} />
            )}
            {isSaving ? 'Saving...' : 'Save & Finish'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errors.general && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{errors.general}</span>
          </div>
        </div>
      )}

      {/* Form */}
      {!isLoading && (
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="space-y-6">
          {/* Site Name */}
          <div>
            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-2">
              Site Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="siteName"
              name="siteName"
              value={site.siteName}
              onChange={handleInputChange}
              className={`w-full px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 ${
                errors.siteName ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter site name"
            />
            {errors.siteName && (
              <p className="mt-1 text-sm text-red-600">{errors.siteName}</p>
            )}
          </div>

          {/* Address Search with Autocomplete */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={autocompleteRef}
                type="text"
                id="address"
                name="address"
                value={site.address}
                onChange={handleInputChange}
                onKeyDown={handleAddressKeyDown}
                onBlur={handleAddressGeocode}
                className={`w-full pl-10 pr-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 ${
                  errors.address ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Search for an address or click on the map"
              />
            </div>
            {errors.address && (
              <p className="mt-1 text-sm text-red-600">{errors.address}</p>
            )}
          </div>

          {/* Site Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
              Site Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              name="type"
              value={site.type}
              onChange={handleInputChange}
              className={`w-full px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 appearance-none ${
                errors.type ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="company_branch">Company Branch</option>
              <option value="customer_site">Customer Site</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type}</p>
            )}
          </div>

          {/* Custom Site ID */}
          <div>
            <label htmlFor="customSiteId" className="block text-sm font-medium text-gray-700 mb-2">
              Custom Site ID
            </label>
            <input
              type="text"
              id="customSiteId"
              name="customSiteId"
              value={site.customSiteId}
              onChange={handleInputChange}
              className={`w-full px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 ${
                errors.customSiteId ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Optional - for client integration"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use this field to store your own site identifier for integration with other platforms
            </p>
            {errors.customSiteId && (
              <p className="mt-1 text-sm text-red-600">{errors.customSiteId}</p>
            )}
          </div>

          {/* Coordinates Display */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                value={site.latitude !== 0 ? site.latitude.toFixed(6) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = v === '' ? 0 : Number(v);
                  setSite((prev) => ({ ...prev, latitude: Number.isFinite(next) ? next : prev.latitude }));
                }}
                onBlur={commitCoordinatesFromInputs}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitCoordinatesFromInputs();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={`w-full px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 ${
                  errors.coordinates ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0.000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                value={site.longitude !== 0 ? site.longitude.toFixed(6) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = v === '' ? 0 : Number(v);
                  setSite((prev) => ({ ...prev, longitude: Number.isFinite(next) ? next : prev.longitude }));
                }}
                onBlur={commitCoordinatesFromInputs}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitCoordinatesFromInputs();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={`w-full px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 ${
                  errors.coordinates ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0.000000"
              />
            </div>
          </div>
          {errors.coordinates && (
            <p className="text-sm text-red-600">{errors.coordinates}</p>
          )}

          {/* Google Map */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location on Map <span className="text-red-500">*</span>
            </label>
            {isLoaded ? (
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={defaultCenter}
                  zoom={site.latitude !== 0 && site.longitude !== 0 ? 15 : 10}
                  onLoad={(map) => setMap(map)}
                  onClick={handleMapClick}
                  options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                  }}
                >
                  {isLoaded && site.latitude !== 0 && site.longitude !== 0 && (
                    <MarkerF
                      key={`marker-${site.id || 'new'}-${site.latitude}-${site.longitude}`}
                      position={{ lat: site.latitude, lng: site.longitude }}
                      draggable={true}
                      onDragEnd={(e) => {
                        if (e.latLng) {
                          const latLng = e.latLng;
                          if (latLng) {
                            let latNum = 0;
                            let lngNum = 0;
                            
                            try {
                              const latValue = latLng.lat();
                              latNum = typeof latValue === 'number' ? latValue : 0;
                            } catch {
                              latNum = 0;
                            }
                            
                            try {
                              const lngValue = latLng.lng();
                              lngNum = typeof lngValue === 'number' ? lngValue : 0;
                            } catch {
                              lngNum = 0;
                            }
                            
                            applyCoordinates(latNum, lngNum, { reverseGeocode: true });
                          }
                        }
                      }}
                    />
                  )}
                </GoogleMap>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-md h-[400px] bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Loading map...</p>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Click on the map to set the location, or search for an address above
            </p>
          </div>
        </div>
      </div>
      )}

    </div>
  );
}

