/**
 * Google Maps JavaScript API SDK Loader
 * Safe, promise-based loader with deduplication and error handling.
 */

export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBzVSf_uBCDTT6IZOELD7I97I37e7Oq8ns';

let loadPromise = null;

export function loadGoogleMapsSDK(apiKey = GOOGLE_MAPS_API_KEY) {
  // If already loaded and ready on window
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  // If already in-flight, reuse existing promise
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Maps SDK can only be loaded in a browser environment'));
      return;
    }

    // Check if an existing script tag is already in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps SDK loaded but window.google.maps is undefined'));
        }
      });
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps SDK failed to initialize window.google.maps'));
      }
    };

    script.onerror = (err) => {
      loadPromise = null; // allow retry
      reject(new Error('Failed to load Google Maps SDK script: ' + (err?.message || 'Network error')));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
