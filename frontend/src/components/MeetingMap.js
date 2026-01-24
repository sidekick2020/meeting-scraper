import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDataCache } from '../contexts/DataCacheContext';
import { useParse } from '../contexts/ParseContext';

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

// Meeting type colors for cluster indicators
const MEETING_TYPE_COLORS = {
  'AA': '#3b82f6',      // Blue
  'NA': '#22c55e',      // Green
  'Al-Anon': '#a855f7', // Purple
  'Other': '#78716c',   // Gray
};

// Get dominant meeting type from meetingTypes object
const getDominantType = (meetingTypes) => {
  if (!meetingTypes || typeof meetingTypes !== 'object') return null;
  const entries = Object.entries(meetingTypes);
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
};

// Cluster marker icon with count and optional type indicator
const createClusterIcon = (count, meetingTypes = null) => {
  const size = count > 100 ? 50 : count > 50 ? 44 : count > 20 ? 38 : count > 10 ? 32 : 26;
  const fontSize = count > 100 ? 14 : count > 50 ? 13 : 12;

  // Get border color based on dominant meeting type
  const dominantType = getDominantType(meetingTypes);
  const borderColor = dominantType ? MEETING_TYPE_COLORS[dominantType] || '#78716c' : '#78716c';

  return L.divIcon({
    className: 'cluster-marker',
    html: `<div class="cluster-marker-inner" style="
      width: ${size}px;
      height: ${size}px;
      font-size: ${fontSize}px;
      border-color: ${borderColor};
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
function MapDataLoader({ onDataLoaded, onStateDataLoaded, onZoomChange, onLoadingChange, filters, onBoundsChange, cacheContext, parseFetchMeetingsByState, parseFetchMeetings, parseInitialized }) {
  const map = useMap();
  const fetchTimeoutRef = useRef(null);
  const lastFetchRef = useRef(null);
  const filtersRef = useRef(filters);
  const pendingFetchRef = useRef(null);
  // Refs for state data request deduplication
  const lastStateDataKeyRef = useRef(null);
  const pendingStateDataRef = useRef(null);

  // Refs to hold latest callback versions - prevents infinite loops
  // when callbacks are recreated (which would otherwise trigger useEffect)
  const fetchHeatmapDataRef = useRef(null);
  const fetchStateDataRef = useRef(null);

  // Fetch state-level data with filter support and request deduplication
  // Uses Parse SDK directly when available, falls back to backend API
  const fetchStateData = useCallback(async () => {
    const currentFilters = filtersRef.current || {};

    // Create request key for deduplication
    const stateDataKey = JSON.stringify({
      day: currentFilters.day,
      type: currentFilters.type,
      state: currentFilters.state,
      city: currentFilters.city,
      online: currentFilters.online,
      hybrid: currentFilters.hybrid,
      format: currentFilters.format
    });

    // Skip if identical request was just made
    if (lastStateDataKeyRef.current === stateDataKey) {
      return;
    }
    lastStateDataKeyRef.current = stateDataKey;

    // Cancel any pending state data fetch
    if (pendingStateDataRef.current) {
      pendingStateDataRef.current.abort();
    }
    pendingStateDataRef.current = new AbortController();

    try {
      onLoadingChange?.(true);

      // Use Parse SDK directly if available (bypasses backend)
      if (parseInitialized && parseFetchMeetingsByState) {
        const result = await parseFetchMeetingsByState({
          day: currentFilters.day,
          type: currentFilters.type,
          online: currentFilters.online,
          hybrid: currentFilters.hybrid,
          format: currentFilters.format
        });
        onStateDataLoaded(result);
      } else {
        // Fallback to backend API
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

        const response = await fetch(url, {
          signal: pendingStateDataRef.current.signal
        });
        if (response.ok) {
          const data = await response.json();
          onStateDataLoaded(data);
        }
      }
    } catch (error) {
      // Ignore abort errors - they're expected when cancelling stale requests
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching state data:', error);
    } finally {
      onLoadingChange?.(false);
    }
  }, [onStateDataLoaded, onLoadingChange, parseInitialized, parseFetchMeetingsByState]);

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

      // At high zoom levels, use Parse SDK directly for individual meetings
      // This bypasses the backend API and queries Back4App directly
      const useParseForIndividualMeetings = zoom >= DETAIL_ZOOM_THRESHOLD && parseInitialized && parseFetchMeetings;

      if (useParseForIndividualMeetings) {
        // Query Parse directly for individual meetings
        const result = await parseFetchMeetings({
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          },
          center: { lat: center.lat, lng: center.lng },
          day: currentFilters.day,
          type: currentFilters.type,
          state: currentFilters.state,
          city: currentFilters.city,
          online: currentFilters.online,
          hybrid: currentFilters.hybrid,
          format: currentFilters.format,
          limit: 200 // Reasonable limit for individual meetings view
        });

        const data = {
          meetings: result.meetings || [],
          clusters: [],
          total: result.total || result.meetings?.length || 0,
          mode: 'individual'
        };

        // Cache the fresh data
        if (cacheContext) {
          cacheContext.setCache(persistentCacheKey, data, HEATMAP_CACHE_TTL);
        }

        onDataLoaded(data, false);
      } else {
        // Fall back to backend API for cluster data or when Parse unavailable
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
  }, [map, onDataLoaded, onLoadingChange, cacheContext, parseInitialized, parseFetchMeetings]);

  // Keep refs updated with latest callback versions
  useEffect(() => {
    fetchHeatmapDataRef.current = fetchHeatmapData;
  }, [fetchHeatmapData]);

  useEffect(() => {
    fetchStateDataRef.current = fetchStateData;
  }, [fetchStateData]);

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
      // Abort any pending fetches to prevent memory leaks
      if (pendingFetchRef.current) {
        pendingFetchRef.current.abort();
      }
      if (pendingStateDataRef.current) {
        pendingStateDataRef.current.abort();
      }
    };
  }, [map, fetchHeatmapData, fetchStateData, onZoomChange, onBoundsChange]);

  // Refetch when filters change
  // IMPORTANT: Use refs to call callbacks to prevent infinite loops.
  // If we included fetchHeatmapData/fetchStateData in deps, any change to
  // their dependencies would trigger this effect, reset deduplication keys,
  // and fire requests - causing a cascading loop of 100+ requests/second.
  useEffect(() => {
    if (filters) {
      // Update filtersRef BEFORE fetching to avoid race condition
      // (the separate useEffect updating filtersRef may run after this one)
      filtersRef.current = filters;
      // Force refresh when filters change - reset deduplication keys
      lastFetchRef.current = null;
      lastStateDataKeyRef.current = null;
      // Call through refs to avoid dependency on callback references
      fetchHeatmapDataRef.current?.(true);
      // Also refetch state data with new filters
      fetchStateDataRef.current?.();
    }
  }, [filters]); // Only depend on filters, not on callback references

  return null;
}

// State marker component
function StateMarker({ stateData, onStateClick }) {
  const map = useMap();

  const handleClick = useCallback(() => {
    // Zoom in to this state with smooth animation
    map.flyTo([stateData.lat, stateData.lng], 7, {
      duration: 0.6,
      easeLinearity: 0.25
    });
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
      bubblingMouseEvents={false}
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

// Format meeting types for display
const formatMeetingTypes = (meetingTypes) => {
  if (!meetingTypes || typeof meetingTypes !== 'object') return null;
  const entries = Object.entries(meetingTypes).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return entries.map(([type, count]) => ({ type, count }));
};

// Cluster marker component with enhanced popup
function ClusterMarker({ cluster, onClusterClick }) {
  const map = useMap();

  const handleClick = useCallback(() => {
    // Calculate smart zoom level based on cluster size
    // Larger clusters need more zoom steps to break into sub-clusters
    const currentZoom = map.getZoom();
    let zoomIncrement = 3; // Default zoom increment

    // Adjust zoom based on cluster count - larger clusters may need gradual zoom
    if (cluster.count > 500) {
      zoomIncrement = 2; // Zoom less for very large clusters to show sub-clusters
    } else if (cluster.count < 20) {
      zoomIncrement = 4; // Zoom more for small clusters to show individual meetings faster
    }

    const targetZoom = Math.min(currentZoom + zoomIncrement, 16);

    // Use flyTo for smoother animation when expanding clusters
    map.flyTo([cluster.lat, cluster.lng], targetZoom, {
      duration: 0.5,
      easeLinearity: 0.25
    });

    if (onClusterClick) onClusterClick(cluster);
  }, [map, cluster, onClusterClick]);

  // Get meeting type breakdown if available (from indicator data)
  const typeBreakdown = formatMeetingTypes(cluster.meetingTypes);

  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={createClusterIcon(cluster.count, cluster.meetingTypes)}
      eventHandlers={{ click: handleClick }}
      bubblingMouseEvents={false}
    >
      <Popup>
        <div className="cluster-popup">
          <strong>{cluster.count.toLocaleString()} meetings</strong>
          {cluster.state && (
            <div className="cluster-popup-state">{cluster.state}</div>
          )}
          {typeBreakdown && typeBreakdown.length > 0 && (
            <div className="cluster-popup-types">
              {typeBreakdown.slice(0, 4).map(({ type, count }) => (
                <div key={type} className="cluster-type-row">
                  <span
                    className="cluster-type-dot"
                    style={{ background: MEETING_TYPE_COLORS[type] || '#78716c' }}
                  />
                  <span className="cluster-type-name">{type}</span>
                  <span className="cluster-type-count">{count}</span>
                </div>
              ))}
            </div>
          )}
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
      map.flyTo([e.latlng.lat, e.latlng.lng], targetZoom, {
        duration: 0.5,
        easeLinearity: 0.25
      });
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

  // Get Parse context for direct database queries (bypasses backend)
  const { isInitialized: parseInitialized, fetchMeetingsByState: parseFetchMeetingsByState, fetchMeetings: parseFetchMeetings } = useParse();

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
          {showIndividualMeetings ? (
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
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              className="map-tiles"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              className="map-tiles"
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              className="map-tiles"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Light">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              className="map-tiles"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <MapDataLoader
          onDataLoaded={handleDataLoaded}
          onStateDataLoaded={handleStateDataLoaded}
          onZoomChange={handleZoomChange}
          onLoadingChange={handleLoadingChange}
          filters={filters}
          onBoundsChange={onBoundsChange}
          cacheContext={cacheContext}
          parseInitialized={parseInitialized}
          parseFetchMeetingsByState={parseFetchMeetingsByState}
          parseFetchMeetings={parseFetchMeetings}
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
        {showClusters && currentZoom < DETAIL_ZOOM_THRESHOLD && effectiveMapData.clusters.map((cluster) => (
          <ClusterMarker
            key={`cluster-${cluster.lat}-${cluster.lng}`}
            cluster={cluster}
          />
        ))}

        {/* Show individual meeting markers at higher zoom levels */}
        {showIndividualMeetings && validMeetings.map((meeting) => {
          const isHovered = hoveredMeeting?.objectId === meeting.objectId;
          const color = meeting.isOnline || meeting.isHybrid ? '#78716c' : '#475569';
          const icon = isHovered ? createHighlightedIcon(color) : createCustomIcon(color);
          return (
          <Marker
            key={meeting.objectId || `${meeting.latitude}-${meeting.longitude}-${meeting.name}-${meeting.day}-${meeting.time}`}
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
