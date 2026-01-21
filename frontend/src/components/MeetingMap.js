import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const DETAIL_ZOOM_THRESHOLD = 13; // Zoom level at which to show individual meetings

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon for individual meetings
const createCustomIcon = (color = '#667eea') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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
function MapDataLoader({ onDataLoaded, onZoomChange }) {
  const map = useMap();
  const fetchTimeoutRef = useRef(null);
  const lastFetchRef = useRef(null);

  const fetchHeatmapData = useCallback(async () => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // Create a cache key to avoid duplicate fetches
    const cacheKey = `${zoom}-${bounds.getNorth().toFixed(2)}-${bounds.getSouth().toFixed(2)}-${bounds.getEast().toFixed(2)}-${bounds.getWest().toFixed(2)}`;
    if (lastFetchRef.current === cacheKey) return;
    lastFetchRef.current = cacheKey;

    try {
      const url = `${BACKEND_URL}/api/meetings/heatmap?zoom=${zoom}&north=${bounds.getNorth()}&south=${bounds.getSouth()}&east=${bounds.getEast()}&west=${bounds.getWest()}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        onDataLoaded(data);
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
    }
  }, [map, onDataLoaded]);

  useEffect(() => {
    const handleMoveEnd = () => {
      const zoom = map.getZoom();
      onZoomChange(zoom);

      // Debounce the fetch
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(fetchHeatmapData, 300);
    };

    // Initial fetch
    fetchHeatmapData();

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [map, fetchHeatmapData, onZoomChange]);

  return null;
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

function MeetingMap({ onSelectMeeting, showHeatmap = true }) {
  const [mapData, setMapData] = useState({ clusters: [], meetings: [], total: 0, mode: 'clustered' });
  const [currentZoom, setCurrentZoom] = useState(5);
  const [isLoading, setIsLoading] = useState(true);

  const handleDataLoaded = useCallback((data) => {
    setMapData(data);
    setIsLoading(false);
  }, []);

  const handleZoomChange = useCallback((zoom) => {
    setCurrentZoom(zoom);
  }, []);

  // Determine what to display based on mode
  const showClusters = mapData.mode === 'clustered' && mapData.clusters?.length > 0;
  const showIndividualMeetings = mapData.mode === 'individual' && mapData.meetings?.length > 0;

  // Filter meetings with valid coordinates
  const validMeetings = useMemo(() =>
    (mapData.meetings || []).filter(m => m.latitude && m.longitude &&
      !isNaN(m.latitude) && !isNaN(m.longitude)),
    [mapData.meetings]
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
          ) : (
            `${mapData.total} meetings • ${mapData.clusters?.length || 0} clusters`
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
          onZoomChange={handleZoomChange}
        />

        {/* Show heatmap at lower zoom levels */}
        {showHeatmap && showClusters && currentZoom < DETAIL_ZOOM_THRESHOLD && (
          <HeatmapLayer clusters={mapData.clusters} />
        )}

        {/* Show cluster markers at lower zoom levels */}
        {showClusters && currentZoom < DETAIL_ZOOM_THRESHOLD && mapData.clusters.map((cluster, index) => (
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
          {currentZoom < DETAIL_ZOOM_THRESHOLD ? (
            <span>Zoom in to see individual meetings</span>
          ) : (
            <span>Showing individual meetings</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MeetingMap;
