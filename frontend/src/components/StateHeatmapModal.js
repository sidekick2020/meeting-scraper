import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// State bounding boxes [south, west, north, east] for proper map zoom
const STATE_BOUNDS = {
  "AL": [30.22, -88.47, 35.01, -84.89],
  "AK": [51.21, -179.15, 71.54, 179.77],
  "AZ": [31.33, -114.82, 37.00, -109.04],
  "AR": [33.00, -94.62, 36.50, -89.64],
  "CA": [32.53, -124.48, 42.01, -114.13],
  "CO": [36.99, -109.06, 41.00, -102.04],
  "CT": [40.95, -73.73, 42.05, -71.79],
  "DE": [38.45, -75.79, 39.84, -75.05],
  "FL": [24.40, -87.63, 31.00, -80.03],
  "GA": [30.36, -85.61, 35.00, -80.84],
  "HI": [18.91, -160.25, 22.24, -154.81],
  "ID": [41.99, -117.24, 49.00, -111.04],
  "IL": [36.97, -91.51, 42.51, -87.02],
  "IN": [37.77, -88.10, 41.76, -84.78],
  "IA": [40.38, -96.64, 43.50, -90.14],
  "KS": [36.99, -102.05, 40.00, -94.59],
  "KY": [36.50, -89.57, 39.15, -81.96],
  "LA": [28.93, -94.04, 33.02, -88.82],
  "ME": [43.06, -71.08, 47.46, -66.95],
  "MD": [37.91, -79.49, 39.72, -75.05],
  "MA": [41.24, -73.50, 42.89, -69.93],
  "MI": [41.70, -90.42, 48.19, -82.12],
  "MN": [43.50, -97.24, 49.38, -89.49],
  "MS": [30.17, -91.66, 35.00, -88.10],
  "MO": [35.99, -95.77, 40.61, -89.10],
  "MT": [44.36, -116.05, 49.00, -104.04],
  "NE": [40.00, -104.05, 43.00, -95.31],
  "NV": [35.00, -120.01, 42.00, -114.04],
  "NH": [42.70, -72.56, 45.31, -70.70],
  "NJ": [38.93, -75.56, 41.36, -73.89],
  "NM": [31.33, -109.05, 37.00, -103.00],
  "NY": [40.50, -79.76, 45.02, -71.86],
  "NC": [33.84, -84.32, 36.59, -75.46],
  "ND": [45.94, -104.05, 49.00, -96.55],
  "OH": [38.40, -84.82, 42.33, -80.52],
  "OK": [33.62, -103.00, 37.00, -94.43],
  "OR": [41.99, -124.57, 46.29, -116.46],
  "PA": [39.72, -80.52, 42.27, -74.69],
  "RI": [41.15, -71.86, 42.02, -71.12],
  "SC": [32.03, -83.35, 35.22, -78.54],
  "SD": [42.48, -104.06, 45.95, -96.44],
  "TN": [34.98, -90.31, 36.68, -81.65],
  "TX": [25.84, -106.65, 36.50, -93.51],
  "UT": [36.99, -114.05, 42.00, -109.04],
  "VT": [42.73, -73.44, 45.02, -71.46],
  "VA": [36.54, -83.68, 39.47, -75.24],
  "WA": [45.54, -124.85, 49.00, -116.92],
  "WV": [37.20, -82.64, 40.64, -77.72],
  "WI": [42.49, -92.89, 47.08, -86.25],
  "WY": [40.99, -111.06, 45.01, -104.05],
  "DC": [38.79, -77.12, 38.99, -76.91],
  "PR": [17.88, -67.95, 18.52, -65.22]
};

// Heatmap layer component
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

    import('leaflet.heat').then(() => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }

      const maxCount = Math.max(...clusters.map(c => c.count), 1);
      const points = clusters.map(c => [
        c.lat,
        c.lng,
        Math.min(c.count / maxCount, 1)
      ]);

      if (points.length > 0) {
        heatLayerRef.current = L.heatLayer(points, {
          radius: 25,
          blur: 15,
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
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, clusters]);

  return null;
}

// Component to fit map to state bounds and load data
function StateMapController({ stateCode, onDataLoaded, onLoadingChange }) {
  const map = useMap();
  const dataFetchedRef = useRef(false);

  useEffect(() => {
    const bounds = STATE_BOUNDS[stateCode];
    if (bounds) {
      const [south, west, north, east] = bounds;
      map.fitBounds([[south, west], [north, east]], { padding: [20, 20] });
    }
  }, [map, stateCode]);

  const fetchStateHeatmapData = useCallback(async () => {
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

    const bounds = STATE_BOUNDS[stateCode];
    if (!bounds) return;

    const [south, west, north, east] = bounds;

    try {
      onLoadingChange(true);

      // Calculate appropriate zoom level based on state size
      const latDiff = north - south;
      const lngDiff = east - west;
      const maxDiff = Math.max(latDiff, lngDiff);
      let zoom = 7;
      if (maxDiff > 10) zoom = 5;
      else if (maxDiff > 5) zoom = 6;
      else if (maxDiff > 2) zoom = 7;
      else zoom = 8;

      const url = `${BACKEND_URL}/api/meetings/heatmap?zoom=${zoom}&north=${north}&south=${south}&east=${east}&west=${west}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        onDataLoaded(data);
      }
    } catch (error) {
      console.error('Error fetching state heatmap data:', error);
    } finally {
      onLoadingChange(false);
    }
  }, [stateCode, onDataLoaded, onLoadingChange]);

  useEffect(() => {
    fetchStateHeatmapData();
  }, [fetchStateHeatmapData]);

  return null;
}

// Cluster marker for showing meeting counts
function ClusterMarker({ cluster }) {
  const size = cluster.count > 100 ? 40 : cluster.count > 50 ? 35 : cluster.count > 20 ? 30 : cluster.count > 10 ? 26 : 22;

  return (
    <div
      className="state-heatmap-cluster"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size > 30 ? 12 : 10,
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
        border: '2px solid white'
      }}
    >
      {cluster.count > 999 ? '999+' : cluster.count}
    </div>
  );
}

function StateHeatmapModal({ state, onClose, avgCoverage }) {
  const [mapData, setMapData] = useState({ clusters: [], meetings: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const handleDataLoaded = useCallback((data) => {
    setMapData(data);
  }, []);

  const handleLoadingChange = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  // Get coverage color based on state's coverage
  const getCoverageColor = (coveragePer100k) => {
    if (coveragePer100k === 0) return '#ef4444';
    if (coveragePer100k < avgCoverage * 0.5) return '#f97316';
    if (coveragePer100k < avgCoverage) return '#eab308';
    return '#22c55e';
  };

  const getCoverageLevel = (coveragePer100k) => {
    if (coveragePer100k === 0) return 'No Coverage';
    if (coveragePer100k < avgCoverage * 0.5) return 'Low Coverage';
    if (coveragePer100k < avgCoverage) return 'Below Average';
    return 'Good Coverage';
  };

  if (!state) return null;

  const bounds = STATE_BOUNDS[state.state];
  const center = bounds
    ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
    : [39.8283, -98.5795];

  return (
    <div className="state-heatmap-overlay" onClick={onClose}>
      <div className="state-heatmap-modal" onClick={e => e.stopPropagation()}>
        <div className="state-heatmap-header">
          <div className="state-heatmap-title">
            <h2>{state.stateName}</h2>
            <span
              className="state-coverage-badge"
              style={{ backgroundColor: getCoverageColor(state.coveragePer100k) }}
            >
              {getCoverageLevel(state.coveragePer100k)}
            </span>
          </div>
          <button className="state-heatmap-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="state-heatmap-stats">
          <div className="state-stat">
            <span className="state-stat-value">{state.meetings.toLocaleString()}</span>
            <span className="state-stat-label">Total Meetings</span>
          </div>
          <div className="state-stat">
            <span className="state-stat-value">{(state.population / 1000000).toFixed(1)}M</span>
            <span className="state-stat-label">Population</span>
          </div>
          <div className="state-stat">
            <span className="state-stat-value">{state.coveragePer100k}</span>
            <span className="state-stat-label">Per 100k</span>
          </div>
          <div className="state-stat">
            <span className="state-stat-value">{mapData.clusters?.length || 0}</span>
            <span className="state-stat-label">Areas</span>
          </div>
        </div>

        <div className="state-heatmap-map-container">
          {state.meetings === 0 ? (
            <div className="state-no-meetings">
              <div className="state-no-meetings-icon">📍</div>
              <h3>No Meetings Found</h3>
              <p>There are currently no meetings registered in {state.stateName}.</p>
              <p className="state-no-meetings-hint">
                Population: {(state.population / 1000000).toFixed(1)}M
              </p>
            </div>
          ) : (
            <MapContainer
              center={center}
              zoom={6}
              className="state-heatmap-map"
              scrollWheelZoom={true}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              <StateMapController
                stateCode={state.state}
                onDataLoaded={handleDataLoaded}
                onLoadingChange={handleLoadingChange}
              />

              {mapData.clusters?.length > 0 && (
                <HeatmapLayer clusters={mapData.clusters} />
              )}
            </MapContainer>
          )}

          {isLoading && state.meetings > 0 && (
            <div className="state-heatmap-loading">
              <div className="loading-spinner small"></div>
              <span>Loading meeting data...</span>
            </div>
          )}
        </div>

        <div className="state-heatmap-legend">
          <div className="legend-title">Meeting Density</div>
          <div className="legend-gradient-bar">
            <span className="legend-gradient"></span>
            <div className="legend-labels">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </div>

        <div className="state-heatmap-footer">
          <p>Zoom in to explore specific areas with meeting concentrations</p>
        </div>
      </div>
    </div>
  );
}

export default StateHeatmapModal;
