/**
 * RakshaPulse Geolocation & Reverse Geocoding Utility
 * Supports Browser GPS + Automatic Network/IP Geolocation Fallback
 * (Essential for mobile browsers accessing over local HTTP IP where GPS permission is restricted)
 */

const STORAGE_KEY = 'raksha_cached_location';

const FALLBACK_COORDS = {
  lat: 28.6139,
  lng: 77.2090,
  accuracy: 100,
  address: 'Connaught Place, New Delhi, DL 110001'
};

// Retrieve cached location if available
export function getStoredLocation() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.debug('Failed to load cached location:', e);
  }
  return FALLBACK_COORDS;
}

// 1. IP-based Geolocation fallback (works on any mobile browser without HTTPS restrictions)
export async function getIPLocation() {
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.latitude && data.longitude) {
        const lat = data.latitude;
        const lng = data.longitude;
        const address = await reverseGeocode(lat, lng) || `${data.city || 'Delhi'}, ${data.region || ''}, ${data.country || 'India'}`;
        const loc = {
          lat,
          lng,
          accuracy: 50,
          address,
          source: 'IP_NETWORK'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
        return loc;
      }
    }
  } catch (err) {
    console.debug('ipwho.is lookup failed, trying backup geojs:', err);
  }

  // Backup IP Geolocation Provider
  try {
    const res2 = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (res2.ok) {
      const data2 = await res2.json();
      const lat = parseFloat(data2.latitude);
      const lng = parseFloat(data2.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const address = await reverseGeocode(lat, lng) || `${data2.city || 'Delhi'}, ${data2.region || ''}`;
        const loc = {
          lat,
          lng,
          accuracy: 100,
          address,
          source: 'IP_NETWORK'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
        return loc;
      }
    }
  } catch (err2) {
    console.debug('Backup IP geolocation failed:', err2);
  }

  return getStoredLocation();
}

// 2. Main GPS / Location resolver
export async function getCurrentGPSLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      const stored = getStoredLocation();
      if (stored && (stored.source === 'DEVICE_GPS' || stored.source === 'MAP_PICK' || stored.source === 'USER_MANUAL')) {
        resolve(stored);
        return;
      }
      getIPLocation().then(resolve);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);

        const address = await reverseGeocode(lat, lng);
        const loc = {
          lat,
          lng,
          accuracy,
          address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${accuracy}m)`,
          source: 'DEVICE_GPS'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
        resolve(loc);
      },
      async (err) => {
        console.warn('GPS denied/failed, checking cached location:', err.message);
        const stored = getStoredLocation();
        // NEVER overwrite a high-accuracy saved location with low-accuracy IP
        if (stored && (stored.source === 'DEVICE_GPS' || stored.source === 'MAP_PICK' || stored.source === 'USER_MANUAL')) {
          resolve(stored);
          return;
        }
        const fallback = await getIPLocation();
        resolve(fallback);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0   // Always get fresh GPS, never use cached stale position
      }
    );
  });
}

// 3. Reverse Geocoder (Google Maps Geocoder primary + OpenStreetMap Nominatim fallback)
export async function reverseGeocode(lat, lng) {
  // Try Google Geocoder if available
  try {
    if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response && response.results && response.results[0]) {
        return response.results[0].formatted_address;
      }
    }
  } catch (err) {
    console.debug('Google Geocoder failed, using Nominatim:', err);
  }

  // Fallback to OpenStreetMap Nominatim
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const road = addr.road || addr.neighbourhood || addr.suburb || '';
        const city = addr.city || addr.town || addr.county || '';
        const state = addr.state || '';
        const postcode = addr.postcode || '';

        const parts = [road, city, state, postcode].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
      }
    }
  } catch (err) {
    console.debug('Reverse geocode failed:', err);
  }
  return null;
}

// 4. Forward Geocode for manual user location entry (Google Maps primary + Nominatim fallback)
export async function searchAddress(query) {
  if (!query || query.trim().length < 2) return [];

  // Try Google Geocoder first
  try {
    if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({
        address: query,
        componentRestrictions: { country: 'IN' }
      });
      if (response && response.results && response.results.length > 0) {
        return response.results.slice(0, 5).map(item => ({
          display: item.formatted_address,
          lat: item.geometry.location.lat(),
          lng: item.geometry.location.lng()
        }));
      }
    }
  } catch (err) {
    console.debug('Google geocoder search failed, using Nominatim:', err);
  }

  // Fallback to Nominatim
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (res.ok) {
      const list = await res.json();
      return list.map(item => ({
        display: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
    }
  } catch (e) {
    console.debug('Address search failed:', e);
  }
  return [];
}

export function formatGoogleMapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
