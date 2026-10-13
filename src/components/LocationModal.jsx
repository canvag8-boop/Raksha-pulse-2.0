import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, X, Globe, Crosshair, CheckCircle2, Edit3, Compass } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { getIPLocation, reverseGeocode, searchAddress } from '../utils/geo';
import { loadGoogleMapsSDK } from '../utils/googleMapsLoader';
import { playTactileClick } from '../utils/audio';

const QUICK_CITIES = [
  { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { name: 'Noida', lat: 28.5355, lng: 77.3910 },
  { name: 'Gurugram', lat: 28.4595, lng: 77.0266 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
];

export default function LocationModal({ isOpen, onClose }) {
  const { currentLocation, setCurrentLocation, isLocating } = useEmergency();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'info' | 'success' | 'error'
  const [pickedLocation, setPickedLocation] = useState(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [manualAddressText, setManualAddressText] = useState('');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const searchDebounceRef = useRef(null);

  // Initialize location and map when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Immediately initialize to current location so confirm button is never dead
    setPickedLocation(currentLocation);
    setManualAddressText(currentLocation.address || '');
    setStatusMsg(`📍 Current: ${currentLocation.address || 'Pin your location'}`);
    setStatusType('info');
    setIsEditingAddress(false);

    let cancelled = false;
    setMapLoading(true);

    const initMap = async () => {
      try {
        const googleMaps = await loadGoogleMapsSDK();
        if (cancelled || !mapContainerRef.current) return;

        const center = {
          lat: Number(currentLocation.lat) || 28.6139,
          lng: Number(currentLocation.lng) || 77.2090
        };

        const map = new googleMaps.Map(mapContainerRef.current, {
          center,
          zoom: 16,
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: 'greedy',
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#e2e8f0' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f2744' }] },
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          ]
        });

        // Drop a marker at current location
        const marker = new googleMaps.Marker({
          position: center,
          map,
          draggable: true,
          animation: googleMaps.Animation.DROP,
          icon: {
            path: googleMaps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#e11d48',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3
          },
          title: 'Drag to set emergency location'
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setMapLoading(false);

        // Tap on map → move marker
        map.addListener('click', async (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          marker.setPosition({ lat, lng });
          await updatePickedLocation(lat, lng);
        });

        // Drag marker end
        marker.addListener('dragend', async (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          await updatePickedLocation(lat, lng);
        });

      } catch (err) {
        if (!cancelled) {
          setMapLoading(false);
          setStatusMsg('Map preview unavailable. Use address search or quick cities below.');
          setStatusType('info');
        }
      }
    };

    const timer = setTimeout(initMap, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Live Debounced Search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAddress(searchQuery.trim());
        setSearchResults(results);
        if (results.length === 0) {
          setStatusMsg('No exact match. Try city or main landmark.');
          setStatusType('error');
        }
      } catch {
        setStatusMsg('Search failed. Check your network.');
        setStatusType('error');
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const updatePickedLocation = async (lat, lng, forcedAddress = null) => {
    setStatusMsg('Resolving address for selected point...');
    setStatusType('info');
    
    let address = forcedAddress;
    if (!address) {
      address = await reverseGeocode(lat, lng);
    }
    
    const finalAddress = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const loc = {
      lat,
      lng,
      accuracy: 10,
      address: finalAddress,
      source: 'MAP_PICK'
    };
    
    setPickedLocation(loc);
    setManualAddressText(finalAddress);
    setStatusMsg(`📍 ${finalAddress}`);
    setStatusType('success');
  };

  const handleConfirmPicked = () => {
    const locToSave = isEditingAddress && manualAddressText.trim()
      ? {
          ...(pickedLocation || currentLocation),
          address: manualAddressText.trim(),
          source: 'USER_MANUAL',
          accuracy: 5
        }
      : (pickedLocation || currentLocation);

    playTactileClick();
    setCurrentLocation(locToSave);
    localStorage.setItem('raksha_cached_location', JSON.stringify(locToSave));
    onClose();
  };

  const handleSelectResult = async (item) => {
    playTactileClick();
    setSearchResults([]);
    setSearchQuery('');

    if (mapInstanceRef.current && markerRef.current) {
      const pos = { lat: item.lat, lng: item.lng };
      mapInstanceRef.current.setCenter(pos);
      mapInstanceRef.current.setZoom(17);
      markerRef.current.setPosition(pos);
    }

    await updatePickedLocation(item.lat, item.lng, item.display);
  };

  const handleQuickCity = async (city) => {
    playTactileClick();
    if (mapInstanceRef.current && markerRef.current) {
      const pos = { lat: city.lat, lng: city.lng };
      mapInstanceRef.current.setCenter(pos);
      mapInstanceRef.current.setZoom(15);
      markerRef.current.setPosition(pos);
    }
    await updatePickedLocation(city.lat, city.lng);
  };

  const handleDeviceGPS = () => {
    playTactileClick();
    setStatusMsg('Requesting live satellite GPS...');
    setStatusType('info');

    if (!navigator.geolocation) {
      setStatusMsg('Geolocation not supported by this browser.');
      setStatusType('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);

        if (mapInstanceRef.current && markerRef.current) {
          const p = { lat, lng };
          mapInstanceRef.current.setCenter(p);
          mapInstanceRef.current.setZoom(18);
          markerRef.current.setPosition(p);
        }

        const address = await reverseGeocode(lat, lng);
        const loc = {
          lat,
          lng,
          accuracy,
          address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${accuracy}m)`,
          source: 'DEVICE_GPS'
        };
        setPickedLocation(loc);
        setManualAddressText(loc.address);
        setStatusMsg(`🛰️ Live GPS locked! (±${accuracy}m accuracy)`);
        setStatusType('success');
      },
      async (err) => {
        console.warn('GPS error:', err);
        setStatusMsg('GPS blocked on local HTTP. Tap your spot on the map or type address.');
        setStatusType('error');
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  };

  const handleAutoDetectIP = async () => {
    playTactileClick();
    setStatusMsg('Detecting approximate network region...');
    setStatusType('info');
    try {
      const loc = await getIPLocation();
      if (mapInstanceRef.current && markerRef.current) {
        const pos = { lat: loc.lat, lng: loc.lng };
        mapInstanceRef.current.setCenter(pos);
        mapInstanceRef.current.setZoom(14);
        markerRef.current.setPosition(pos);
      }
      setPickedLocation(loc);
      setManualAddressText(loc.address);
      setStatusMsg(`🌐 Region detected: ${loc.address}. Fine-tune pin on map.`);
      setStatusType('success');
    } catch {
      setStatusMsg('Network detection failed. Please search below.');
      setStatusType('error');
    }
  };

  if (!isOpen) return null;

  const currentDisplay = isEditingAddress
    ? manualAddressText
    : (pickedLocation?.address || currentLocation.address || 'Select on map');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/85 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '94vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">Set Accurate Location</h3>
              <p className="text-[11px] text-slate-400">Tap map · Drag pin · Search · Or type address</p>
            </div>
          </div>
          <button
            onClick={() => { playTactileClick(); onClose(); }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Tools */}
        <div className="flex gap-2 px-4 pt-3 pb-2 flex-shrink-0">
          <button
            onClick={handleDeviceGPS}
            className="flex-1 py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Live GPS</span>
          </button>
          <button
            onClick={handleAutoDetectIP}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Network Region</span>
          </button>
          <button
            onClick={() => { playTactileClick(); setIsEditingAddress(!isEditingAddress); }}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              isEditingAddress
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingAddress ? 'Map Mode' : 'Type Text'}</span>
          </button>
        </div>

        {/* Search Bar with live autocomplete */}
        <div className="px-4 pb-2 flex-shrink-0 relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search colony, sector, landmark, city..."
              className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
            />
            <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
              <Search className={`w-4 h-4 ${isSearching ? 'animate-spin text-rose-400' : ''}`} />
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-12 z-20 max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-800/70">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectResult(item)}
                  className="p-2.5 cursor-pointer hover:bg-rose-950/30 transition text-xs text-slate-200 flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                  <span className="line-clamp-1">{item.display}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick City Presets */}
        <div className="px-4 pb-2 flex-shrink-0 flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {QUICK_CITIES.map((c) => (
            <button
              key={c.name}
              onClick={() => handleQuickCity(c)}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 whitespace-nowrap border border-slate-750 transition"
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Map / Direct Address Editor Area */}
        <div className="relative flex-1 min-h-0 mx-4 mb-3 rounded-2xl overflow-hidden border border-slate-800" style={{ height: '220px', minHeight: '180px' }}>
          {isEditingAddress ? (
            <div className="w-full h-full p-4 bg-slate-950 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  Type Your Exact Home / Emergency Address:
                </label>
                <textarea
                  value={manualAddressText}
                  onChange={(e) => setManualAddressText(e.target.value)}
                  rows={4}
                  placeholder="e.g. Flat 301, Tower B, Green Valley Apartments, Sector 62, Noida"
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition resize-none"
                />
              </div>
              <div className="text-[11px] text-slate-400">
                This exact text address will be broadcast in family SOS alerts & responder dispatch.
              </div>
            </div>
          ) : (
            <>
              {mapLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10 gap-2">
                  <Navigation className="w-6 h-6 text-rose-400 animate-pulse" />
                  <span className="text-xs text-slate-400">Loading interactive map...</span>
                </div>
              )}
              <div ref={mapContainerRef} className="w-full h-full" />
              {!mapLoading && (
                <div className="absolute top-2 left-2 text-[10px] bg-slate-950/85 backdrop-blur-xs text-slate-300 px-2 py-1 rounded-lg pointer-events-none font-medium border border-slate-800 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-rose-400" />
                  <span>Tap anywhere or drag 🔴 pin</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Selected Address Card */}
        <div className="mx-4 mb-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2 flex-shrink-0">
          <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Target Emergency Location</div>
            <div className="text-xs font-bold text-white truncate" title={currentDisplay}>
              {currentDisplay}
            </div>
          </div>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`mx-4 mb-3 px-3 py-1.5 rounded-xl text-[11px] font-medium truncate flex-shrink-0 ${
            statusType === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : statusType === 'error'
              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}>
            {statusMsg}
          </div>
        )}

        {/* Confirm Button */}
        <div className="px-4 pb-5 flex-shrink-0">
          <button
            onClick={handleConfirmPicked}
            className="w-full py-3.5 rounded-2xl font-black text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4.5 h-4.5" />
            <span>CONFIRM & LOCK EMERGENCY LOCATION</span>
          </button>
        </div>

      </div>
    </div>
  );
}
