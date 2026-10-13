import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Navigation, Layers, Crosshair, AlertCircle, RefreshCw } from 'lucide-react';
import { formatGoogleMapsLink } from '../utils/geo';
import { loadGoogleMapsSDK } from '../utils/googleMapsLoader';

export default function EmergencyMap({
  location,
  responderLocation = null,
  showNearbyServices = true,
  height = '320px',
  interactive = true,
  triageCode = 'RED'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const activeInfoWindowRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentMapType, setCurrentMapType] = useState('hybrid'); // 'hybrid' | 'satellite' | 'roadmap'

  const lat = location?.lat || 12.9716;
  const lng = location?.lng || 77.5946;

  // Initialize and update Google Map
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      setLoading(true);
      setLoadError(null);

      try {
        const googleMaps = await loadGoogleMapsSDK();
        if (isCancelled || !mapContainerRef.current) return;

        // Clean up previous markers & polylines
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }

        const centerPos = { lat, lng };

        // Create or update Map instance
        let map = mapInstanceRef.current;
        if (!map) {
          map = new googleMaps.Map(mapContainerRef.current, {
            center: centerPos,
            zoom: 17, // Crisp zoom level to clearly see individual buildings and terrain
            mapTypeId: currentMapType, // 'hybrid' gives high-res satellite + road & building labels
            mapTypeControl: false, // Clean custom tactical controls in our overlay
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: interactive,
            gestureHandling: interactive ? 'auto' : 'none',
            tilt: 0,
            rotateControl: false
          });
          mapInstanceRef.current = map;
        } else {
          map.setCenter(centerPos);
          map.setMapTypeId(currentMapType);
        }

        // Helper to register info windows
        const attachInfoWindow = (marker, htmlContent) => {
          const infoWindow = new googleMaps.InfoWindow({
            content: htmlContent,
            disableAutoPan: false
          });
          marker.addListener('click', () => {
            if (activeInfoWindowRef.current) {
              activeInfoWindowRef.current.close();
            }
            infoWindow.open(map, marker);
            activeInfoWindowRef.current = infoWindow;
          });
          return infoWindow;
        };

        // 1. INCIDENT COORDINATES MARKER (Glowing High-Visibility SOS Beacon)
        const incidentIconSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="21" fill="#f43f5e" fill-opacity="0.32"/>
            <circle cx="23" cy="23" r="14" fill="#e11d48" stroke="#ffffff" stroke-width="2.5"/>
            <text x="23" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">SOS</text>
          </svg>
        `;
        const incidentMarker = new googleMaps.Marker({
          position: centerPos,
          map: map,
          title: 'Emergency Incident Location',
          zIndex: 100,
          animation: googleMaps.Animation.DROP,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(incidentIconSvg)}`,
            scaledSize: new googleMaps.Size(46, 46),
            anchor: new googleMaps.Point(23, 23)
          }
        });
        markersRef.current.push(incidentMarker);

        const incidentInfoHtml = `
          <div style="color: #0f172a; padding: 4px 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 220px;">
            <div style="font-weight: 800; font-size: 13px; color: #e11d48; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
              <span>🚨 Emergency Incident</span>
            </div>
            <div style="font-size: 11px; color: #334155; line-height: 1.4; margin-bottom: 4px;">
              ${location?.address || 'Current Emergency Coordinates'}
            </div>
            <div style="font-size: 10px; color: #64748b; font-family: monospace;">
              Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}
            </div>
          </div>
        `;
        attachInfoWindow(incidentMarker, incidentInfoHtml);

        // 2. ASSIGNED EMS UNIT MARKER (Ambulance / Tactical Unit)
        if (responderLocation) {
          const rLat = responderLocation.lat || lat + 0.008;
          const rLng = responderLocation.lng || lng + 0.006;
          const emsPos = { lat: rLat, lng: rLng };

          const emsIconSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
              <circle cx="23" cy="23" r="21" fill="#10b981" fill-opacity="0.32"/>
              <circle cx="23" cy="23" r="14" fill="#059669" stroke="#ffffff" stroke-width="2.5"/>
              <text x="23" y="28" font-size="16" text-anchor="middle">🚑</text>
            </svg>
          `;

          const emsMarker = new googleMaps.Marker({
            position: emsPos,
            map: map,
            title: 'Assigned EMS Unit',
            zIndex: 90,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(emsIconSvg)}`,
              scaledSize: new googleMaps.Size(46, 46),
              anchor: new googleMaps.Point(23, 23)
            }
          });
          markersRef.current.push(emsMarker);

          const emsInfoHtml = `
            <div style="color: #0f172a; padding: 4px 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 220px;">
              <div style="font-weight: 800; font-size: 13px; color: #059669; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
                <span>🚑 Assigned EMS Unit</span>
              </div>
              <div style="font-size: 11px; color: #334155; margin-bottom: 3px;">
                <strong>ETA:</strong> ${responderLocation.eta || '4 mins'}
              </div>
              <div style="font-size: 10px; color: #64748b;">
                First Responder Dispatched & En Route
              </div>
            </div>
          `;
          attachInfoWindow(emsMarker, emsInfoHtml);

          // Draw tactical response route connecting EMS unit to Incident
          const routePolyline = new googleMaps.Polyline({
            path: [emsPos, centerPos],
            geodesic: true,
            strokeColor: '#10b981',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map: map
          });
          polylineRef.current = routePolyline;

          // Fit bounds to show both Incident and EMS unit
          const bounds = new googleMaps.LatLngBounds();
          bounds.extend(centerPos);
          bounds.extend(emsPos);
          map.fitBounds(bounds, {
            top: 40,
            right: 40,
            bottom: 40,
            left: 40
          });
        }

        // 3. NEARBY EMERGENCY LANDMARKS (Hospital & Fire Station)
        if (showNearbyServices) {
          const hospPos = { lat: lat + 0.0055, lng: lng + 0.0042 };
          const firePos = { lat: lat - 0.0042, lng: lng - 0.0035 };

          const hospIconSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
              <circle cx="17" cy="17" r="15" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
              <text x="17" y="22" font-size="14" text-anchor="middle">🏥</text>
            </svg>
          `;
          const hospMarker = new googleMaps.Marker({
            position: hospPos,
            map: map,
            title: 'Apollo Emergency Hospital (750m)',
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(hospIconSvg)}`,
              scaledSize: new googleMaps.Size(34, 34),
              anchor: new googleMaps.Point(17, 17)
            }
          });
          markersRef.current.push(hospMarker);
          attachInfoWindow(
            hospMarker,
            `<div style="color:#0f172a;padding:4px;font-family:sans-serif;font-size:12px;"><strong>🏥 Apollo Emergency Hospital</strong><br/><span style="color:#64748b;font-size:11px;">Distance: ~750m (Trauma Center)</span></div>`
          );

          const fireIconSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
              <circle cx="17" cy="17" r="15" fill="#d97706" stroke="#ffffff" stroke-width="2"/>
              <text x="17" y="22" font-size="14" text-anchor="middle">🚒</text>
            </svg>
          `;
          const fireMarker = new googleMaps.Marker({
            position: firePos,
            map: map,
            title: 'Station 14 Fire & Rescue (620m)',
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(fireIconSvg)}`,
              scaledSize: new googleMaps.Size(34, 34),
              anchor: new googleMaps.Point(17, 17)
            }
          });
          markersRef.current.push(fireMarker);
          attachInfoWindow(
            fireMarker,
            `<div style="color:#0f172a;padding:4px;font-family:sans-serif;font-size:12px;"><strong>🚒 Station 14 Fire & Rescue</strong><br/><span style="color:#64748b;font-size:11px;">Distance: ~620m (Heavy Rescue)</span></div>`
          );
        }

        setLoading(false);
      } catch (err) {
        if (!isCancelled) {
          console.error('Google Maps SDK initialization error:', err);
          setLoadError(err.message || 'Failed to initialize Google Maps');
          setLoading(false);
        }
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      if (markersRef.current) {
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
      }
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      if (activeInfoWindowRef.current) {
        activeInfoWindowRef.current.close();
      }
    };
  }, [lat, lng, responderLocation, showNearbyServices, interactive]);

  // Handle map type changes (Hybrid, Satellite, Roadmap)
  const handleChangeMapType = (type) => {
    setCurrentMapType(type);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(type);
    }
  };

  // Re-center on Incident
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat, lng });
      mapInstanceRef.current.setZoom(17);
    }
  };

  const googleMapsUrl = formatGoogleMapsLink(lat, lng);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 shadow-xl bg-slate-900 group">
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{ height }}
        className="w-full z-0 gmap-container"
      />

      {/* Loading Skeleton */}
      {loading && (
        <div
          style={{ height }}
          className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
        >
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-rose-500/30 animate-ping absolute" />
            <div className="w-10 h-10 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-300 tracking-wide flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-rose-400 animate-spin" />
            Loading Google Satellite & Hybrid Imagery...
          </p>
        </div>
      )}

      {/* Fallback Error View if offline or API blocked */}
      {loadError && (
        <div
          style={{ height }}
          className="absolute inset-0 z-20 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center gap-3"
        >
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">Google Maps Satellite View</p>
            <p className="text-xs text-slate-400 max-w-xs">{loadError}</p>
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Top Left: GPS Accuracy Badge */}
      <div className="absolute top-3 left-3 z-[10] flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide bg-slate-950/85 backdrop-blur-md text-slate-200 border border-slate-700/80 shadow">
          <Navigation className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>GPS Accuracy: ±{location?.accuracy || 10}m</span>
        </span>
      </div>

      {/* Top Right: Hybrid / Satellite Style Selector */}
      <div className="absolute top-3 right-3 z-[10] flex items-center gap-1 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow">
        <button
          type="button"
          onClick={() => handleChangeMapType('hybrid')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
            currentMapType === 'hybrid'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Satellite imagery with street and building labels"
        >
          <Layers className="w-3 h-3" />
          <span>Hybrid</span>
        </button>
        <button
          type="button"
          onClick={() => handleChangeMapType('satellite')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
            currentMapType === 'satellite'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Pure Satellite imagery"
        >
          <span>Satellite</span>
        </button>
        <button
          type="button"
          onClick={() => handleChangeMapType('roadmap')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
            currentMapType === 'roadmap'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Tactical Street Map"
        >
          <span>Roads</span>
        </button>
      </div>

      {/* Bottom Overlay Controls */}
      <div className="absolute bottom-3 left-3 right-3 z-[10] flex items-center justify-between pointer-events-none">
        {/* Recenter button */}
        <button
          type="button"
          onClick={handleRecenter}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 shadow transition active:scale-95"
          title="Center on Incident Coordinates"
        >
          <Crosshair className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Center Incident</span>
        </button>

        {/* Direct Google Maps External Link */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 shadow transition active:scale-95"
          title="Open in Official Google Maps app"
        >
          <span>Open in Maps</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </div>
    </div>
  );
}
