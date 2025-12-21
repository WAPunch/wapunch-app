import { useJsApiLoader } from '@react-google-maps/api';

// Keep these options IDENTICAL everywhere in the app.
// @react-google-maps/api uses a singleton loader and will throw if called again with different options.
const GOOGLE_MAPS_LOADER_ID = 'google-maps-script';
const LIBRARIES: ('places' | 'drawing' | 'geometry' | 'visualization')[] = ['places'];

export function useGoogleMapsLoader() {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  return useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey,
    libraries: LIBRARIES,
  });
}


