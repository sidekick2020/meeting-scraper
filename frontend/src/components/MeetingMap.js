import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const STATE_ZOOM_THRESHOLD = 6;   // Below this, show state-level bubbles
const DETAIL_ZOOM_THRESHOLD = 13; // Above this, show individual meetings

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon for individual meetings
const createCustomIcon = (color = '#2f5dff') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid ${color};
      box-shadow: 0 3px 8px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    "><div style="
      background: ${color};
      width: 12px;
      height: 12px;
      border-radius: 50%;
    "></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Cluster marker icon with count
const createClusterIcon = (count) => {
  const size = count > 100 ? 50 : count > 50 ? 44 : count > 20 ? 38 : count > 10 ? 32 : 26;
  const fontSize = count > 100 ? 14 : count > 50 ? 13 : 12;

  return L.divIcon({
    className: 'cluster-marker',
    html: `<div class="cluster-marker-inner" style="
      width: ${size}px;
      height: ${size}px;
      font-size: ${fontSize}px;
    ">${count > 999 ? '999+' : count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// State marker icon with count (larger, shows state abbreviation)
const createStateIcon = (stateCode, count) => {
  // Size based on count - larger states get bigger bubbles
  const minSize = 40;
  const maxSize = 70;
  const scaleFactor = Math.min(Math.log10(count + 1) / 4, 1); // Log scale, capped at 1
  const size = Math.round(minSize + (maxSize - minSize) * scaleFactor);
  const fontSize = size > 55 ? 11 : 10;
  const countFontSize = size > 55 ? 14 : 12;

  return L.divIcon({
    className: 'state-marker',
    html: `<div class="state-marker-inner" style="
      width: ${size}px;
      height: ${size}px;
    ">
      <span class="state-code" style="font-size: ${fontSize}px;">${stateCode}</span>
      <span class="state-count" style="font-size: ${countFontSize}px;">${count > 9999 ? Math.round(count / 1000) + 'k' : count}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Heatmap layer component using cluster data
function HeatmapLayer({ clusters }) {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!clusters || clusters.length === 0) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    // Dynamically import leaflet.heat
    import('leaflet.heat').then(() => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }

      // Convert clusters to heatmap points with intensity based on count
      const maxCount = Math.max(...clusters.map(c => c.count), 1);
      const points = clusters.map(c => [
        c.lat,
        c.lng,
        Math.min(c.count / maxCount, 1) // Normalized intensity
      ]);

      if (points.length > 0) {
        heatLayerRef.current = L.heatLayer(points, {
          radius: 30,
          blur: 20,
          maxZoom: 12,
          gradient: {
            0.0: '#667eea',
            0.3: '#764ba2',
            0.6: '#f59e0b',
            1.0: '#ef4444'
          }
        }).addTo(map);
      }
    });

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, clusters]);

  return null;
}

// Component to handle map movement events and fetch data
function MapDataLoader({ onDataLoaded, onStateDataLoaded, onZoomChange, onLoadingChange, filters, onBoundsChange }) {
  const map = useMap();
  const fetchTimeoutRef = useRef(null);
  const lastFetchRef = useRef(null);
  const stateDataFetchedRef = useRef(false);
  const filtersRef = useRef(filters);

  // Fetch state-level data (cached, very fast)
  const fetchStateData = useCallback(async () => {
    if (stateDataFetchedRef.current) return; // Only fetch once
    stateDataFetchedRef.current = true;

    try {
      onLoadingChange?.(true);
      const response = await fetch(`${BACKEND_URL}/api/meetings/by-state`);
      if (response.ok) {
        const data = await response.json();
        onStateDataLoaded(data);
      }
    } catch (error) {
      console.error('Error fetching state data:', error);
    } finally {
      onLoadingChange?.(false);
    }
  }, [onStateDataLoaded, onLoadingChange]);

  // Keep filtersRef updated
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchHeatmapData = useCallback(async (forceRefresh = false) => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const center = map.getCenter();

    // At very low zoom, we use pre-fetched state data, no need to fetch clusters
    if (zoom < STATE_ZOOM_THRESHOLD) {
      return;
    }

    // Build filter string for cache key
    const currentFilters = filtersRef.current || {};
    const filterStr = JSON.stringify({
      day: currentFilters.day,
      type: currentFilters.type,
      state: currentFilters.state,
      city: currentFilters.city,
      online: currentFilters.online,
      hybrid: currentFilters.hybrid
    });

    // Create a cache key to avoid duplicate fetches (include center for prioritization)
    const cacheKey = `${zoom}-${bounds.getNorth().toFixed(2)}-${bounds.getSouth().toFixed(2)}-${bounds.getEast().toFixed(2)}-${bounds.getWest().toFixed(2)}-${center.lat.toFixed(3)}-${center.lng.toFixed(3)}-${filterStr}`;
    if (!forceRefresh && lastFetchRef.current === cacheKey) return;
    lastFetchRef.current = cacheKey;

    try {
      onLoadingChange?.(true);
      let url = `${BACKEND_URL}/api/meetings/heatmap?zoom=${zoom}&north=${bounds.getNorth()}&south=${bounds.getSouth()}&east=${bounds.getEast()}&west=${bounds.getWest()}&center_lat=${center.lat}&center_lng=${center.lng}`;

      // Add filter parameters
      if (currentFilters.day !== undefined && currentFilters.day !== null) {
        url += `&day=${currentFilters.day}`;
      }
      if (currentFilters.type) {
        url += `&type=${encodeURIComponent(currentFilters.type)}`;
      }
      if (currentFilters.state) {
        url += `&state=${encodeURIComponent(currentFilters.state)}`;
      }
      if (currentFilters.city) {
        url += `&city=${encodeURIComponent(currentFilters.city)}`;
      }
      if (currentFilters.online) {
        url += `&online=true`;
      }
      if (currentFilters.hybrid) {
        url += `&hybrid=true`;
      }
      if (currentFilters.format) {
        url += `&format=${encodeURIComponent(currentFilters.format)}`;
      }

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        onDataLoaded(data);
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
    } finally {
      onLoadingChange?.(false);
    }
  }, [map, onDataLoaded, onLoadingChange]);

  useEffect(() => {
    const handleMoveEnd = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      const center = map.getCenter();
      onZoomChange(zoom);

      // Notify parent of bounds change for meeting list sync (include center for prioritization)
      if (onBoundsChange) {
        onBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
          zoom: zoom,
          center_lat: center.lat,
          center_lng: center.lng
        });
      }

      // Debounce the fetch
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(() => fetchHeatmapData(false), 300);
    };

    // Fetch state data immediately (cached)
    fetchStateData();

    // Initial fetch for clusters/meetings
    fetchHeatmapData(false);

    // Don't call onBoundsChange on initial mount - wait for user interaction or programmatic pan

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [map, fetchHeatmapData, fetchStateData, onZoomChange, onBoundsChange]);

  // Refetch when filters change
  useEffect(() => {
    if (filters) {
      // Force refresh when filters change
      lastFetchRef.current = null;
      fetchHeatmapData(true);
    }
  }, [filters, fetchHeatmapData]);

  return null;
}

// State marker component
function StateMarker({ stateData, onStateClick }) {
  const map = useMap();

  const handleClick = useCallback(() => {
    // Zoom in to this state
    map.setView([stateData.lat, stateData.lng], 7);
    // Notify parent to load meetings for this state
    if (onStateClick) {
      onStateClick(stateData);
    }
  }, [map, stateData, onStateClick]);

  return (
    <Marker
      position={[stateData.lat, stateData.lng]}
      icon={createStateIcon(stateData.state, stateData.count)}
      eventHandlers={{ click: handleClick }}
    >
      <Popup>
        <div className="state-popup">
          <strong>{stateData.stateName}</strong>
          <div className="state-popup-count">{stateData.count.toLocaleString()} meetings</div>
          <div className="cluster-popup-hint">Click to view meetings</div>
        </div>
      </Popup>
    </Marker>
  );
}

// Cluster marker component
function ClusterMarker({ cluster, onClusterClick }) {
  const map = useMap();

  const handleClick = useCallback(() => {
    // Zoom in to this cluster location
    const targetZoom = Math.min(map.getZoom() + 3, 15);
    map.setView([cluster.lat, cluster.lng], targetZoom);
    if (onClusterClick) onClusterClick(cluster);
  }, [map, cluster, onClusterClick]);

  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={createClusterIcon(cluster.count)}
      eventHandlers={{ click: handleClick }}
    >
      <Popup>
        <div className="cluster-popup">
          <strong>{cluster.count} meetings</strong>
          <div className="cluster-popup-hint">Click to zoom in</div>
        </div>
      </Popup>
    </Marker>
  );
}

// Format day number to day name
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Component to handle map panning to a target location
function MapPanHandler({ targetLocation, onPanComplete }) {
  const map = useMap();
  const lastLocationRef = useRef(null);

  useEffect(() => {
    if (targetLocation && targetLocation.lat && targetLocation.lng) {
      // Check if location actually changed
      const locationKey = `${targetLocation.lat}-${targetLocation.lng}-${targetLocation.zoom || 12}`;
      if (lastLocationRef.current !== locationKey) {
        lastLocationRef.current = locationKey;
        const zoom = targetLocation.zoom || 12;
        map.setView([targetLocation.lat, targetLocation.lng], zoom, { animate: true });

        // Notify parent after pan completes
        setTimeout(() => {
          if (onPanComplete) {
            const bounds = map.getBounds();
            const center = map.getCenter();
            onPanComplete({
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest(),
              zoom: map.getZoom(),
              center_lat: center.lat,
              center_lng: center.lng
            });
          }
        }, 300);
      }
    }
  }, [map, targetLocation, onPanComplete]);

  return null;
}

function MeetingMap({ onSelectMeeting, onStateClick, showHeatmap = true, targetLocation, filters, onBoundsChange }) {
  const [mapData, setMapData] = useState({ clusters: [], meetings: [], total: 0, mode: 'clustered' });
  const [stateData, setStateData] = useState({ states: [], total: 0 });
  const [currentZoom, setCurrentZoom] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  // Cache previous valid data to show during loading transitions
  const prevMapDataRef = useRef(null);
  const prevStateDataRef = useRef(null);
  // Separate cache for heatmap clusters to persist during zoom transitions
  const heatmapClustersRef = useRef([]);
  // Track if we're in a zoom transition (e.g., from clusters to individual meetings)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef(null);

  const handleDataLoaded = useCallback((data) => {
    // Only update if we have valid data
    if (data && (data.clusters?.length > 0 || data.meetings?.length > 0 || data.total > 0)) {
      prevMapDataRef.current = data;
    }
    // Cache clusters for heatmap separately - only update when we have new clusters
    if (data && data.clusters?.length > 0) {
      heatmapClustersRef.current = data.clusters;
    }
    // Clear heatmap cache when we've loaded individual meetings
    if (data && data.mode === 'individual' && data.meetings?.length > 0) {
      heatmapClustersRef.current = [];
    }
    setMapData(data);
    // Clear transition state when new data arrives
    setIsTransitioning(false);
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  const handleStateDataLoaded = useCallback((data) => {
    // Only update if we have valid data
    if (data && data.states?.length > 0) {
      prevStateDataRef.current = data;
    }
    setStateData(data);
  }, []);

  const handleZoomChange = useCallback((zoom) => {
    setCurrentZoom(prevZoom => {
      // Detect when transitioning to detail zoom (individual meetings)
      if (prevZoom < DETAIL_ZOOM_THRESHOLD && zoom >= DETAIL_ZOOM_THRESHOLD) {
        setIsTransitioning(true);
        // Clear heatmap after a delay to allow smooth transition
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current);
        }
        transitionTimeoutRef.current = setTimeout(() => {
          heatmapClustersRef.current = [];
          setIsTransitioning(false);
        }, 500);
      }
      return zoom;
    });
  }, []);

  const handleLoadingChange = useCallback((loading) => {
    // When starting to load, mark as transitioning to preserve heatmap
    if (loading) {
      setIsTransitioning(true);
    }
    setIsLoading(loading);
  }, []);

  // Cleanup transition timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Use cached data during loading or when current data is empty
  // This prevents the map from going blank during transitions
  const effectiveMapData = useMemo(() => {
    // If current data has content, use it
    if (mapData.clusters?.length > 0 || mapData.meetings?.length > 0) {
      return mapData;
    }
    // During loading or transitions, use cached previous data if available
    if ((isLoading || isTransitioning) && prevMapDataRef.current) {
      return prevMapDataRef.current;
    }
    return mapData;
  }, [mapData, isLoading, isTransitioning]);

  // Separate memoized value for heatmap clusters that persists during transitions
  const effectiveHeatmapClusters = useMemo(() => {
    // If current data has clusters, use them
    if (mapData.clusters?.length > 0) {
      return mapData.clusters;
    }
    // During loading/transitions, use cached heatmap clusters
    if ((isLoading || isTransitioning) && heatmapClustersRef.current.length > 0) {
      return heatmapClustersRef.current;
    }
    return mapData.clusters || [];
  }, [mapData.clusters, isLoading, isTransitioning]);

  const effectiveStateData = useMemo(() => {
    // If current data has content, use it
    if (stateData.states?.length > 0) {
      return stateData;
    }
    // Use cached previous data if available
    if (prevStateDataRef.current) {
      return prevStateDataRef.current;
    }
    return stateData;
  }, [stateData]);

  // Determine what to display based on zoom level
  const showStateLevel = currentZoom < STATE_ZOOM_THRESHOLD && effectiveStateData.states?.length > 0;
  const showClusters = !showStateLevel && effectiveMapData.mode === 'clustered' && effectiveMapData.clusters?.length > 0;
  const showIndividualMeetings = effectiveMapData.mode === 'individual' && effectiveMapData.meetings?.length > 0;
  // Show heatmap during loading/transitions, but hide once individual meetings are loaded
  // The heatmap persists while waiting for data, then fades out when meetings are displayed
  const showHeatmapLayer = !showStateLevel && currentZoom < DETAIL_ZOOM_THRESHOLD &&
    !showIndividualMeetings && effectiveHeatmapClusters.length > 0;

  // Filter meetings with valid coordinates
  const validMeetings = useMemo(() =>
    (effectiveMapData.meetings || []).filter(m => m.latitude && m.longitude &&
      !isNaN(m.latitude) && !isNaN(m.longitude)),
    [effectiveMapData.meetings]
  );

  return (
    <div className="meeting-map-container">
      <div className="map-header">
        <h3>Meeting Locations</h3>
        <span className="map-stats">
          {isLoading ? (
            'Loading...'
          ) : showIndividualMeetings ? (
            `${validMeetings.length} meetings in view`
          ) : showStateLevel ? (
            `${effectiveStateData.total?.toLocaleString() || 0} meetings across ${effectiveStateData.statesWithMeetings || 0} states`
          ) : (
            `${effectiveMapData.total} meetings • ${effectiveMapData.clusters?.length || 0} clusters`
          )}
        </span>
      </div>

      <MapContainer
        center={[39.8283, -98.5795]} // Center of US
        zoom={5}
        className="meeting-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

        <MapDataLoader
          onDataLoaded={handleDataLoaded}
          onStateDataLoaded={handleStateDataLoaded}
          onZoomChange={handleZoomChange}
          onLoadingChange={handleLoadingChange}
          filters={filters}
          onBoundsChange={onBoundsChange}
        />

        <MapPanHandler targetLocation={targetLocation} onPanComplete={onBoundsChange} />

        {/* Show state-level bubbles at very low zoom */}
        {showStateLevel && effectiveStateData.states.map((state) => (
          <StateMarker
            key={`state-${state.state}`}
            stateData={state}
            onStateClick={onStateClick}
          />
        ))}

        {/* Show heatmap at medium zoom levels - persists during loading transitions */}
        {showHeatmap && showHeatmapLayer && (
          <HeatmapLayer clusters={effectiveHeatmapClusters} />
        )}

        {/* Show cluster markers at medium zoom levels */}
        {showClusters && currentZoom < DETAIL_ZOOM_THRESHOLD && effectiveMapData.clusters.map((cluster, index) => (
          <ClusterMarker
            key={`cluster-${index}`}
            cluster={cluster}
          />
        ))}

        {/* Show individual meeting markers at higher zoom levels */}
        {showIndividualMeetings && validMeetings.map((meeting, index) => (
          <Marker
            key={meeting.objectId || index}
            position={[meeting.latitude, meeting.longitude]}
            icon={createCustomIcon(meeting.isOnline || meeting.isHybrid ? '#22c55e' : '#667eea')}
            eventHandlers={{
              click: () => onSelectMeeting && onSelectMeeting(meeting),
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>{meeting.name}</strong>
                {meeting.locationName && (
                  <div className="popup-location">{meeting.locationName}</div>
                )}
                <div className="popup-schedule">
                  {dayNames[meeting.day]} at {meeting.time}
                </div>
                {meeting.city && meeting.state && (
                  <div className="popup-address">
                    {meeting.city}, {meeting.state}
                  </div>
                )}
                <button
                  className="popup-details-btn"
                  onClick={() => onSelectMeeting && onSelectMeeting(meeting)}
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {isLoading && (
        <div className="map-loading-overlay">
          <div className="loading-spinner small"></div>
          <span>Loading map data...</span>
        </div>
      )}

      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#667eea' }}></span>
          <span>In-Person</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#22c55e' }}></span>
          <span>Online/Hybrid</span>
        </div>
        {showHeatmap && showClusters && (
          <div className="legend-item">
            <span className="legend-gradient"></span>
            <span>Meeting Density</span>
          </div>
        )}
        <div className="legend-zoom-hint">
          {currentZoom < STATE_ZOOM_THRESHOLD ? (
            <span>Showing by state • Zoom in for details</span>
          ) : currentZoom < DETAIL_ZOOM_THRESHOLD ? (
            <span>Showing clusters • Zoom in for meetings</span>
          ) : (
            <span>Showing individual meetings</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MeetingMap;
