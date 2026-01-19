import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon
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

// Heatmap layer component
function HeatmapLayer({ meetings }) {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    // Dynamically import leaflet.heat
    import('leaflet.heat').then(() => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }

      const points = meetings
        .filter(m => m.latitude && m.longitude)
        .map(m => [m.latitude, m.longitude, 0.5]); // [lat, lng, intensity]

      if (points.length > 0) {
        heatLayerRef.current = L.heatLayer(points, {
          radius: 25,
          blur: 15,
          maxZoom: 12,
          gradient: {
            0.0: '#667eea',
            0.5: '#764ba2',
            0.7: '#f59e0b',
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
  }, [map, meetings]);

  return null;
}

// Component to fit map bounds to markers
function FitBounds({ meetings }) {
  const map = useMap();

  useEffect(() => {
    const validMeetings = meetings.filter(m => m.latitude && m.longitude);
    if (validMeetings.length > 0) {
      const bounds = L.latLngBounds(
        validMeetings.map(m => [m.latitude, m.longitude])
      );
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
    }
  }, [map, meetings]);

  return null;
}

// Format day number to day name
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function MeetingMap({ meetings, onSelectMeeting, showHeatmap = true }) {
  // Filter meetings with valid coordinates
  const validMeetings = useMemo(() =>
    meetings.filter(m => m.latitude && m.longitude &&
      !isNaN(m.latitude) && !isNaN(m.longitude)),
    [meetings]
  );

  // Calculate center from meetings or default to US center
  const center = useMemo(() => {
    if (validMeetings.length === 0) {
      return [39.8283, -98.5795]; // Center of US
    }
    const avgLat = validMeetings.reduce((sum, m) => sum + m.latitude, 0) / validMeetings.length;
    const avgLng = validMeetings.reduce((sum, m) => sum + m.longitude, 0) / validMeetings.length;
    return [avgLat, avgLng];
  }, [validMeetings]);

  if (meetings.length === 0) {
    return (
      <div className="meeting-map-empty">
        <p>No meetings to display on map.</p>
        <p>Run the scraper to load meeting data with coordinates.</p>
      </div>
    );
  }

  if (validMeetings.length === 0) {
    return (
      <div className="meeting-map-empty">
        <p>No meetings with location data available.</p>
        <p>{meetings.length} meetings found, but none have coordinates.</p>
      </div>
    );
  }

  return (
    <div className="meeting-map-container">
      <div className="map-header">
        <h3>Meeting Locations</h3>
        <span className="map-stats">
          {validMeetings.length} meetings with locations
        </span>
      </div>

      <MapContainer
        center={center}
        zoom={5}
        className="meeting-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds meetings={validMeetings} />

        {showHeatmap && validMeetings.length > 10 && (
          <HeatmapLayer meetings={validMeetings} />
        )}

        {validMeetings.map((meeting, index) => (
          <Marker
            key={meeting.objectId || index}
            position={[meeting.latitude, meeting.longitude]}
            icon={createCustomIcon(meeting.isOnline ? '#22c55e' : '#667eea')}
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
        {showHeatmap && validMeetings.length > 10 && (
          <div className="legend-item">
            <span className="legend-gradient"></span>
            <span>Meeting Density</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MeetingMap;
