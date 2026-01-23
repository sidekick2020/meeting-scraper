import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDataCache } from '../contexts/DataCacheContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const STATE_ZOOM_THRESHOLD = 6;   // Below this, show state-level bubbles
const DETAIL_ZOOM_THRESHOLD = 13; // Above this, show individual meetings

// Cache configuration for heatmap data
const HEATMAP_CACHE_TTL = 3 * 60 * 1000; // 3 minutes - balance freshness with performance
const HEATMAP_CACHE_PREFIX = 'heatmap:';

// Generate a region-based cache key that groups nearby requests
// This improves cache hit rates by rounding coordinates to grid cells
const generateHeatmapCacheKey = (zoom, bounds, filters) => {
  // Grid size varies by zoom level - larger areas at low zoom
  const gridSize = zoom <= 6 ? 5 : zoom <= 9 ? 2 : zoom <= 11 ? 1 : 0.5;

  // Round bounds to grid to increase cache hits for nearby views
  const roundedNorth = Math.ceil(bounds.north / gridSize) * gridSize;
  const roundedSouth = Math.floor(bounds.south / gridSize) * gridSize;
  const roundedEast = Math.ceil(bounds.east / gridSize) * gridSize;
  const roundedWest = Math.floor(bounds.west / gridSize) * gridSize;

  // Include filters in cache key
  const filterStr = JSON.stringify({
    day: filters?.day,
    type: filters?.type,
    state: filters?.state,
    city: filters?.city,
    online: filters?.online,
    hybrid: filters?.hybrid,
    format: filters?.format
  });

  return `${HEATMAP_CACHE_PREFIX}z${zoom}:${roundedNorth},${roundedSouth},${roundedEast},${roundedWest}:${filterStr}`;
};

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

// Highlighted marker icon for hovered meetings (larger with pulse animation)
const createHighlightedIcon = (color = '#2f5dff') => {
  return L.divIcon({
    className: 'custom-marker highlighted-marker',
    html: `<div class="highlighted-marker-outer">
      <div class="highlighted-marker-pulse" style="border-color: ${color};"></div>
      <div class="highlighted-marker-inner" style="border-color: ${color};">
        <div class="highlighted-marker-dot" style="background: ${color};"></div>
      </div>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
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
    // Track whether component is still mounted to prevent updates after unmount
    let isMounted = true;

    if (!clusters || clusters.length === 0) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    // Dynamically import leaflet.heat
    import('leaflet.heat').then(() => {
      // Prevent operations if component unmounted during import
      if (!isMounted) return;

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
            0.0: '#94a3b8',
            0.3: '#78716c',
            0.6: '#a8a29e',
            1.0: '#57534e'
          }
        }).addTo(map);
      }
    });

    return () => {
      isMounted = false;
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, clusters]);

  return null;
}

// Component to handle map movement events and fetch data
function MapDataLoader({ onDataLoaded, onStateDataLoaded, onZoomChange, onLoadingChange, filters, onBoundsChange, cacheContext }) {
  const map = useMap();
  const fetchTimeoutRef = useRef(null);
  const lastFetchRef = useRef(null);
  const filtersRef = useRef(filters);
  const pendingFetchRef = useRef(null);

  // Fetch state-level data with filter support
  const fetchStateData = useCallback(async () => {
    try {
      onLoadingChange?.(true);
      const currentFilters = filtersRef.current || {};

      // Build URL with filter parameters
      let url = `${BACKEND_URL}/api/meetings/by-state`;
      const params = new URLSearchParams();

      if (currentFilters.day !== undefined && currentFilters.day !== null) {
        params.append('day', currentFilters.day);
      }
      if (currentFilters.type) {
        params.append('type', currentFilters.type);
      }
      if (currentFilters.state) {
        params.append('state', currentFilters.state);
      }
      if (currentFilters.city) {
        params.append('city', currentFilters.city);
      }
      if (currentFilters.online) {
        params.append('online', 'true');
      }
      if (currentFilters.hybrid) {
        params.append('hybrid', 'true');
      }
      if (currentFilters.format) {
        params.append('format', currentFilters.format);
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await fetch(url);
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

    // Create request identifier for deduplication
    const requestKey = `${zoom}-${bounds.getNorth().toFixed(2)}-${bounds.getSouth().toFixed(2)}-${bounds.getEast().toFixed(2)}-${bounds.getWest().toFixed(2)}-${center.lat.toFixed(3)}-${center.lng.toFixed(3)}`;
    if (!forceRefresh && lastFetchRef.current === requestKey) return;
    lastFetchRef.current = requestKey;

    // Generate cache key for persistent storage
    const persistentCacheKey = generateHeatmapCacheKey(zoom, {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    }, currentFilters);

    // Check cache first - show cached data immediately
    if (cacheContext) {
      const cached = cacheContext.getCache(persistentCacheKey);
      if (cached?.data) {
        // Immediately show cached data (stale-while-revalidate pattern)
        onDataLoaded(cached.data, true); // true indicates this is from cache

        // If data is fresh (not stale), we're done
        if (!cached.isStale && !forceRefresh) {
          onLoadingChange?.(false);
          return;
        }
        // Otherwise, continue to fetch fresh data in background
      }
    }

    // Cancel any pending fetch for this region
    if (pendingFetchRef.current) {
      pendingFetchRef.current.abort();
    }
    pendingFetchRef.current = new AbortController();

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

      const response = await fetch(url, {
        signal: pendingFetchRef.current.signal
      });

      if (response.ok) {
        const data = await response.json();

        // Cache the fresh data
        if (cacheContext) {
          cacheContext.setCache(persistentCacheKey, data, HEATMAP_CACHE_TTL);
        }

        onDataLoaded(data, false); // false indicates this is fresh data
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      console.error('Error fetching heatmap data:', error);
    } finally {
      onLoadingChange?.(false);
    }
  }, [map, onDataLoaded, onLoadingChange, cacheContext]);

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

    // Trigger onBoundsChange on initial mount to populate the meeting list
    if (onBoundsChange) {
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();
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

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      // Abort any pending fetch to prevent memory leaks
      if (pendingFetchRef.current) {
        pendingFetchRef.current.abort();
      }
    };
  }, [map, fetchHeatmapData, fetchStateData, onZoomChange, onBoundsChange]);

  // Refetch when filters change
  useEffect(() => {
    if (filters) {
      // Force refresh when filters change
      lastFetchRef.current = null;
      fetchHeatmapData(true);
      // Also refetch state data with new filters
      fetchStateData();
    }
  }, [filters, fetchHeatmapData, fetchStateData]);

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

// Component to handle clicks on the heatmap area
// When heatmap is visible and user clicks, zoom in and center on that location
function HeatmapClickHandler({ isHeatmapVisible }) {
  const map = useMap();

  useEffect(() => {
    if (!isHeatmapVisible) return;

    const handleClick = (e) => {
      const currentZoom = map.getZoom();
      // Zoom in by 3 levels, but cap at zoom 15
      const targetZoom = Math.min(currentZoom + 3, 15);
      map.setView([e.latlng.lat, e.latlng.lng], targetZoom, { animate: true });
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [map, isHeatmapVisible]);

  return null;
}

// Component to handle map panning to a target location
// Note: onPanComplete is intentionally not called here because MapDataLoader
// already handles the moveend event and triggers data fetching. Calling both
// would cause duplicate API requests and slow data loading.
function MapPanHandler({ targetLocation }) {
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
        // The moveend event will be handled by MapDataLoader which triggers onBoundsChange
      }
    }
  }, [map, targetLocation]);

  return null;
}

function MeetingMap({ onSelectMeeting, onStateClick, showHeatmap = true, targetLocation, filters, onBoundsChange, onMapMeetingCount, hoveredMeeting }) {
  const [mapData, setMapData] = useState({ clusters: [], meetings: [], total: 0, mode: 'clustered' });
  const [stateData, setStateData] = useState({ states: [], total: 0 });
  const [currentZoom, setCurrentZoom] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // True when showing cached data while fetching fresh

  // Get cache context for persistent heatmap caching
  const cacheContext = useDataCache();

  // Cache previous valid data to show during loading transitions
  const prevMapDataRef = useRef(null);
  const prevStateDataRef = useRef(null);
  // Separate cache for heatmap clusters to persist during zoom transitions
  const heatmapClustersRef = useRef([]);
  // Track if we're in a zoom transition (e.g., from clusters to individual meetings)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef(null);

  const handleDataLoaded = useCallback((data, isFromCache = false) => {
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

    // Update refreshing state - if we got cached data, we're refreshing in background
    if (isFromCache) {
      setIsRefreshing(true);
    } else {
      setIsRefreshing(false);
    }

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
        // Don't pre-emptively clear heatmap - let it stay visible until
        // individual meetings are actually loaded (handled in handleDataLoaded)
      }
      return zoom;
    });
  }, []);

  const handleLoadingChange = useCallback((loading) => {
    // When starting to load, mark as transitioning to preserve heatmap
    if (loading) {
      setIsTransitioning(true);
    } else {
      // When loading completes, clear the refreshing indicator
      setIsRefreshing(false);
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
  // Show heatmap during loading/transitions - only hide when we actually have individual meetings displayed
  // The heatmap persists while waiting for data, ensuring users see context until better data loads
  const showHeatmapLayer = !showStateLevel && !showIndividualMeetings && effectiveHeatmapClusters.length > 0;

  // Filter meetings with valid coordinates
  const validMeetings = useMemo(() =>
    (effectiveMapData.meetings || []).filter(m => m.latitude && m.longitude &&
      !isNaN(m.latitude) && !isNaN(m.longitude)),
    [effectiveMapData.meetings]
  );

  // Report meeting count back to parent for list/map sync
  useEffect(() => {
    if (!onMapMeetingCount) return;

    let count = 0;
    if (showIndividualMeetings) {
      count = validMeetings.length;
    } else if (showStateLevel) {
      count = effectiveStateData.total || 0;
    } else {
      count = effectiveMapData.total || 0;
    }
    onMapMeetingCount(count);
  }, [onMapMeetingCount, showIndividualMeetings, showStateLevel, validMeetings.length, effectiveStateData.total, effectiveMapData.total]);

  return (
    <div className="meeting-map-container">
      <div className="map-header">
        <h3>Meeting Locations</h3>
        <span className="map-stats">
          {isLoading && !mapData.clusters?.length && !mapData.meetings?.length && !stateData.states?.length ? (
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          className="map-tiles"
        />

        <MapDataLoader
          onDataLoaded={handleDataLoaded}
          onStateDataLoaded={handleStateDataLoaded}
          onZoomChange={handleZoomChange}
          onLoadingChange={handleLoadingChange}
          filters={filters}
          onBoundsChange={onBoundsChange}
          cacheContext={cacheContext}
        />

        <MapPanHandler targetLocation={targetLocation} />

        {/* Handle clicks on heatmap area to zoom in */}
        <HeatmapClickHandler isHeatmapVisible={showHeatmap && showHeatmapLayer} />

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
        {showIndividualMeetings && validMeetings.map((meeting, index) => {
          const isHovered = hoveredMeeting?.objectId === meeting.objectId;
          const color = meeting.isOnline || meeting.isHybrid ? '#78716c' : '#475569';
          const icon = isHovered ? createHighlightedIcon(color) : createCustomIcon(color);
          return (
          <Marker
            key={meeting.objectId || index}
            position={[meeting.latitude, meeting.longitude]}
            icon={icon}
            zIndexOffset={isHovered ? 1000 : 0}
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
          );
        })}
      </MapContainer>

      {/* Show full loading overlay only when we have no data to show */}
      {isLoading && !mapData.clusters?.length && !mapData.meetings?.length && !stateData.states?.length && (
        <div className="map-loading-overlay">
          <div className="loading-spinner small"></div>
          <span>Loading map data...</span>
        </div>
      )}

      {/* Show subtle refresh indicator when we have cached data and are updating */}
      {isRefreshing && (mapData.clusters?.length > 0 || mapData.meetings?.length > 0) && (
        <div className="map-refresh-indicator">
          <div className="loading-spinner tiny"></div>
          <span>Updating...</span>
        </div>
      )}

      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#475569' }}></span>
          <span>In-Person</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#78716c' }}></span>
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
