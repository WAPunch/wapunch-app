import { useEffect, useState, useRef } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useCompany } from '../../hooks/useCompany';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { router } from '../../lib/router';
import { 
  Building2,
  MapPin,
  Save,
  X,
  AlertCircle,
} from 'lucide-react';
import { GoogleMap, LoadScript, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Autocomplete } from '@react-google-maps/api';

// Google Maps libraries
const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ['places'];

// Default site data
const defaultSite = {
  id: '',
  siteName: '',
  address: '',
  latitude: 0,
  longitude: 0,
};

interface SiteData {
  id: string;
  siteName: string;
  address: string;
  latitude: number;
  longitude: number;
}

export default function SiteInfo() {
  const { setBreadcrumbs, clearSubmoduleNav } = useSubmoduleNav();
  const { currentCompany } = useCompany();
  const [site, setSite] = useState<SiteData>(defaultSite);
  const [originalSite, setOriginalSite] = useState<SiteData>(defaultSite);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const autocompleteRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Google Maps API Key - should be in environment variables
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Debug logging
  useEffect(() => {
    console.log('🗺️ Google Maps API Key check:', {
      hasKey: !!googleMapsApiKey,
      keyLength: googleMapsApiKey?.length || 0,
      keyPreview: googleMapsApiKey ? `${googleMapsApiKey.substring(0, 20)}...` : 'MISSING',
    });
  }, [googleMapsApiKey]);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: libraries,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Sites', href: '/sites' },
      { label: site.id ? 'Edit Site' : 'New Site', href: '#' },
    ]);

    return () => {
      clearSubmoduleNav();
    };
  }, [site.id, setBreadcrumbs, clearSubmoduleNav]);

  // Load site data from sessionStorage or database
  useEffect(() => {
    const loadSiteData = async () => {
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
                };
                setSite(mappedSite);
                setOriginalSite(mappedSite);
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
          };
          setSite(mappedSite);
          setOriginalSite(mappedSite);
        } catch (error) {
          logger.error('Error parsing site data', error instanceof Error ? error : new Error(String(error)));
          setSite(defaultSite);
          setOriginalSite(defaultSite);
        }
      }
    };
    loadSiteData();
  }, [currentCompany?.id]);

  // Track changes
  useEffect(() => {
    const hasChanged = JSON.stringify(site) !== JSON.stringify(originalSite);
    setHasChanges(hasChanged);
  }, [site, originalSite]);

  // Initialize Autocomplete
  useEffect(() => {
    if (isLoaded && autocompleteRef.current && !autocomplete) {
      // Create Autocomplete with no types restriction for maximum results like Google Maps
      const autocompleteInstance = new google.maps.places.Autocomplete(autocompleteRef.current, {
        fields: ['formatted_address', 'geometry', 'address_components', 'name', 'place_id', 'types'],
      });

      autocompleteInstance.addListener('place_changed', () => {
        const place = autocompleteInstance.getPlace();
        if (place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          // Use formatted_address if available, otherwise use name
          const address = place.formatted_address || place.name || '';

          setSite(prev => ({
            ...prev,
            address,
            latitude: lat,
            longitude: lng,
          }));

          // Update map center and marker
          if (map) {
            map.setCenter({ lat, lng });
            map.setZoom(15);
          }
        }
      });

      setAutocomplete(autocompleteInstance);

      // Cleanup function to remove listeners when component unmounts
      return () => {
        if (autocompleteInstance) {
          google.maps.event.clearInstanceListeners(autocompleteInstance);
        }
      };
    }
  }, [isLoaded, autocomplete, map]);

  // Update map when site coordinates change
  useEffect(() => {
    if (map && site.latitude !== 0 && site.longitude !== 0) {
      map.setCenter({ lat: site.latitude, lng: site.longitude });
      if (map.getZoom() === 0 || map.getZoom() === undefined) {
        map.setZoom(15);
      }
    }
  }, [map, site.latitude, site.longitude]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
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
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: site.address }, (results, status) => {
      if (status === 'OK' && results && results.length > 0 && results[0].geometry) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        const formattedAddress = results[0].formatted_address || site.address;

        setSite(prev => ({
          ...prev,
          address: formattedAddress,
          latitude: lat,
          longitude: lng,
        }));

        // Update map center and marker
        map.setCenter({ lat, lng });
        map.setZoom(15);
      } else {
        console.warn('Geocoding failed:', status);
      }
    });
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddressGeocode();
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const latLng = e.latLng;
      let latNum = 0;
      let lngNum = 0;
      
      try {
        if (typeof latLng.lat === 'function') {
          latNum = Number(latLng.lat());
        } else if (typeof latLng.lat === 'number') {
          latNum = latLng.lat;
        }
      } catch {
        latNum = 0;
      }
      
      try {
        if (typeof latLng.lng === 'function') {
          lngNum = Number(latLng.lng());
        } else if (typeof latLng.lng === 'number') {
          lngNum = latLng.lng;
        }
      } catch {
        lngNum = 0;
      }

      if (latNum !== 0 && lngNum !== 0) {
        setSite(prev => ({
          ...prev,
          latitude: latNum,
          longitude: lngNum,
        }));

        // Reverse geocode to get address
        if (isLoaded) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latNum, lng: lngNum } }, (results, status) => {
            if (status === 'OK' && results && results.length > 0 && results[0]) {
              const formattedAddress = results[0].formatted_address;
              if (formattedAddress) {
                setSite(prev => ({
                  ...prev,
                  address: formattedAddress,
                }));
              }
            }
          });
        }
      }
    }
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!site.siteName.trim()) {
      newErrors.siteName = 'Site name is required';
    }

    if (!site.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (site.latitude === 0 || site.longitude === 0) {
      newErrors.coordinates = 'Please select a location on the map or search for an address';
    }

    if (!currentCompany?.id) {
      newErrors.general = 'No company selected';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Parse address to extract components if needed
      const addressParts = site.address.split(',').map(s => s.trim());
      let city = '';
      let state = '';
      let zipCode = '';
      let country = '';

      if (addressParts.length >= 2) {
        city = addressParts[1] || '';
        if (addressParts.length >= 3) {
          const stateZip = addressParts[2]?.split(' ') || [];
          state = stateZip[0] || '';
          zipCode = stateZip.slice(1).join(' ') || '';
        }
        if (addressParts.length >= 4) {
          country = addressParts[3] || '';
        }
      }

      // Prepare site data for database
      const siteData: any = {
        site_name: site.siteName.trim(),
        site_address: site.address.trim(),
        latitude: site.latitude,
        longitude: site.longitude,
        country: country || currentCompany?.country || 'USA',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        type: 'branch',
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
      };

      setSite(updatedSite);
      setOriginalSite(updatedSite);
      setHasChanges(false);
      setErrors({});

      // Navigate back to sites list
      router.navigate('/sites');
    } catch (err: any) {
      logger.error('Error saving site', err instanceof Error ? err : new Error(String(err)));
      setErrors({ general: err?.message || 'Failed to save site. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSite(originalSite);
    setErrors({});
    router.navigate('/sites');
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
            {googleMapsApiKey 
              ? `Failed to load Google Maps. Error: ${loadError?.message || 'Unknown error'}. Please check your API key has the following APIs enabled: Maps JavaScript API, Places API, and Geocoding API.`
              : 'Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your environment variables.'}
          </p>
          {googleMapsApiKey && (
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground mb-1">
          {site.id ? 'Edit Site' : 'New Site'}
        </h1>
        <p className="text-xs" style={{ color: 'var(--gray-500)' }}>
          {site.id ? 'Update site information and location' : 'Create a new site for your company'}
        </p>
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
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 ${
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
                className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 ${
                  errors.address ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Search for an address or click on the map"
              />
            </div>
            {errors.address && (
              <p className="mt-1 text-sm text-red-600">{errors.address}</p>
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
                value={site.latitude !== 0 ? site.latitude.toFixed(6) : ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                placeholder="0.000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude
              </label>
              <input
                type="number"
                value={site.longitude !== 0 ? site.longitude.toFixed(6) : ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
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
                    fullscreenControl: true,
                  }}
                >
                  {isLoaded && site.latitude !== 0 && site.longitude !== 0 && (
                    <Marker
                      key={`marker-${site.id || 'new'}`}
                      position={{ lat: site.latitude, lng: site.longitude }}
                      icon={getMarkerIcon()}
                      draggable={true}
                      onDragEnd={(e) => {
                        if (e.latLng) {
                          const latLng = e.latLng;
                          if (latLng) {
                            let latNum = 0;
                            let lngNum = 0;
                            
                            try {
                              if (typeof latLng.lat === 'function') {
                                latNum = Number(latLng.lat());
                              } else if (typeof latLng.lat === 'number') {
                                latNum = latLng.lat;
                              }
                            } catch {
                              latNum = 0;
                            }
                            
                            try {
                              if (typeof latLng.lng === 'function') {
                                lngNum = Number(latLng.lng());
                              } else if (typeof latLng.lng === 'number') {
                                lngNum = latLng.lng;
                              }
                            } catch {
                              lngNum = 0;
                            }
                            
                            if (latNum !== 0 && lngNum !== 0) {
                              setSite(prev => ({
                                ...prev,
                                latitude: latNum,
                                longitude: lngNum,
                              }));

                              // Reverse geocode
                              const geocoder = new google.maps.Geocoder();
                              geocoder.geocode({ location: { lat: latNum, lng: lngNum } }, (results, status) => {
                                if (status === 'OK' && results && results.length > 0 && results[0] && results[0].formatted_address) {
                                  setSite(prev => ({
                                    ...prev,
                                    address: results[0].formatted_address,
                                  }));
                                }
                              });
                            }
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

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--primary-brand-hex)' }}
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

