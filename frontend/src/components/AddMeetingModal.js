import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// US States for dropdown
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Meeting type codes
const MEETING_TYPES = [
  { code: 'O', label: 'Open' },
  { code: 'C', label: 'Closed' },
  { code: 'M', label: 'Men' },
  { code: 'W', label: 'Women' },
  { code: 'Y', label: 'Young People' },
  { code: 'LGBTQ', label: 'LGBTQ+' },
  { code: 'D', label: 'Discussion' },
  { code: 'SP', label: 'Speaker' },
  { code: 'BB', label: 'Big Book' },
  { code: 'ST', label: 'Step Study' },
  { code: '12x12', label: '12 & 12' },
  { code: 'B', label: 'Beginners' },
  { code: 'MED', label: 'Meditation' },
  { code: 'LIT', label: 'Literature' },
  { code: 'X', label: 'Wheelchair Accessible' },
  { code: 'ASL', label: 'Sign Language' },
  { code: 'BA', label: 'Babysitting' },
  { code: 'S', label: 'Spanish' },
  { code: 'POL', label: 'Polish' },
  { code: 'POR', label: 'Portuguese' },
  { code: 'FR', label: 'French' },
];

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
];

function AddMeetingModal({ onClose, onMeetingCreated }) {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    meetingType: 'AA',
    day: '',
    time: '',
    endTime: '',
    timezone: 'America/New_York',
    locationName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    isOnline: false,
    isHybrid: false,
    onlineUrl: '',
    conferencePhone: '',
    types: [],
    notes: '',
    group: '',
    contactEmail: '',
    contactPhone: '',
    locationNotes: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  // Handle meeting types checkbox
  const handleTypeToggle = (code) => {
    setFormData(prev => ({
      ...prev,
      types: prev.types.includes(code)
        ? prev.types.filter(t => t !== code)
        : [...prev.types, code]
    }));
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Meeting name is required');
      setSaving(false);
      return;
    }
    if (formData.day === '') {
      setError('Day of week is required');
      setSaving(false);
      return;
    }
    if (!formData.time) {
      setError('Start time is required');
      setSaving(false);
      return;
    }

    // For in-person or hybrid meetings, require location
    if (!formData.isOnline || formData.isHybrid) {
      if (!formData.address && !formData.city && !formData.locationName) {
        setError('Location information required for in-person/hybrid meetings');
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        ...formData,
        day: parseInt(formData.day, 10),
      };

      const response = await fetch(`${BACKEND_URL}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError('A meeting with this name, location, day, and time already exists');
        } else if (data.details && Array.isArray(data.details)) {
          setError(data.details.join(', '));
        } else {
          setError(data.error || 'Failed to create meeting');
        }
        setSaving(false);
        return;
      }

      // Store the created meeting and show success state
      setCreatedMeeting(data.meeting);
      setShowSuccess(true);
      setSaving(false);

      // Notify parent component
      if (onMeetingCreated && data.meeting) {
        onMeetingCreated(data.meeting);
      }

    } catch (err) {
      setError(`Network error: ${err.message}`);
      setSaving(false);
    }
  };

  // Handle viewing the created meeting
  const handleViewMeeting = () => {
    if (createdMeeting?.objectId) {
      onClose();
      navigate(`/meeting/${createdMeeting.objectId}`);
    }
  };

  // Handle creating another meeting
  const handleCreateAnother = () => {
    setShowSuccess(false);
    setCreatedMeeting(null);
    setFormData({
      name: '',
      meetingType: 'AA',
      day: '',
      time: '',
      endTime: '',
      timezone: 'America/New_York',
      locationName: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      isOnline: false,
      isHybrid: false,
      onlineUrl: '',
      conferencePhone: '',
      types: [],
      notes: '',
      group: '',
      contactEmail: '',
      contactPhone: '',
      locationNotes: '',
    });
  };

  // Success view with animation
  if (showSuccess && createdMeeting) {
    return (
      <>
        <div className="settings-panel-overlay" onClick={onClose} />
        <div className="settings-panel add-meeting-panel add-meeting-success-panel">
          <div className="settings-header">
            <h2>Meeting Created</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          <div className="settings-content">
            <div className="add-meeting-success">
              <div className="success-animation">
                <svg className="success-checkmark" viewBox="0 0 52 52">
                  <circle className="success-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                  <path className="success-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
              </div>
              <h3 className="success-title">Meeting Created Successfully!</h3>
              <p className="success-meeting-name">{createdMeeting.name}</p>
              <p className="success-meeting-details">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][createdMeeting.day]}
                {' at '}{createdMeeting.time}
                {createdMeeting.city && ` in ${createdMeeting.city}`}
                {createdMeeting.state && `, ${createdMeeting.state}`}
              </p>
              <div className="success-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-view-meeting"
                  onClick={handleViewMeeting}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  View Meeting
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCreateAnother}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Create Another
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="settings-panel-overlay" onClick={onClose} />
      <div className="settings-panel add-meeting-panel">
        <div className="settings-header">
          <h2>Add Meeting</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-content">
          <form onSubmit={handleSubmit} className="add-meeting-form">
            {error && (
              <div className="form-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Basic Info Section */}
            <div className="form-section">
              <h3 className="form-section-title">Basic Information</h3>

              <div className="form-group">
                <label htmlFor="name">Meeting Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Saturday Morning Serenity"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="meetingType">Fellowship *</label>
                  <select
                    id="meetingType"
                    name="meetingType"
                    value={formData.meetingType}
                    onChange={handleChange}
                  >
                    <option value="AA">AA</option>
                    <option value="NA">NA</option>
                    <option value="Al-Anon">Al-Anon</option>
                    <option value="CA">CA</option>
                    <option value="OA">OA</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="group">Group Name</label>
                  <input
                    type="text"
                    id="group"
                    name="group"
                    value={formData.group}
                    onChange={handleChange}
                    placeholder="e.g., Serenity Group"
                  />
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="form-section">
              <h3 className="form-section-title">Schedule</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="day">Day of Week *</label>
                  <select
                    id="day"
                    name="day"
                    value={formData.day}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Day</option>
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="time">Start Time *</label>
                  <input
                    type="time"
                    id="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endTime">End Time</label>
                  <input
                    type="time"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="timezone">Timezone</label>
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meeting Format Section */}
            <div className="form-section">
              <h3 className="form-section-title">Meeting Format</h3>

              <div className="form-checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isOnline"
                    checked={formData.isOnline}
                    onChange={handleChange}
                  />
                  <span>Online Meeting</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isHybrid"
                    checked={formData.isHybrid}
                    onChange={handleChange}
                    disabled={!formData.isOnline}
                  />
                  <span>Hybrid (Online + In-Person)</span>
                </label>
              </div>

              {formData.isOnline && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="onlineUrl">Video Conference URL</label>
                    <input
                      type="url"
                      id="onlineUrl"
                      name="onlineUrl"
                      value={formData.onlineUrl}
                      onChange={handleChange}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="conferencePhone">Phone Dial-In</label>
                    <input
                      type="tel"
                      id="conferencePhone"
                      name="conferencePhone"
                      value={formData.conferencePhone}
                      onChange={handleChange}
                      placeholder="+1-555-123-4567"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Location Section */}
            {(!formData.isOnline || formData.isHybrid) && (
              <div className="form-section">
                <h3 className="form-section-title">Location</h3>

                <div className="form-group">
                  <label htmlFor="locationName">Venue Name</label>
                  <input
                    type="text"
                    id="locationName"
                    name="locationName"
                    value={formData.locationName}
                    onChange={handleChange}
                    placeholder="e.g., St. Michael's Church"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="address">Street Address</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group form-group-city">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="City"
                    />
                  </div>

                  <div className="form-group form-group-state">
                    <label htmlFor="state">State</label>
                    <select
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      {US_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group form-group-zip">
                    <label htmlFor="postalCode">ZIP</label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      placeholder="12345"
                      maxLength="10"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="locationNotes">Location Notes</label>
                  <input
                    type="text"
                    id="locationNotes"
                    name="locationNotes"
                    value={formData.locationNotes}
                    onChange={handleChange}
                    placeholder="e.g., Enter through side door, room 201"
                  />
                </div>
              </div>
            )}

            {/* Meeting Types Section */}
            <div className="form-section">
              <h3 className="form-section-title">Meeting Characteristics</h3>
              <p className="form-section-desc">Select all that apply</p>

              <div className="meeting-types-grid">
                {MEETING_TYPES.map(type => (
                  <label key={type.code} className="meeting-type-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.types.includes(type.code)}
                      onChange={() => handleTypeToggle(type.code)}
                    />
                    <span className="meeting-type-label">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact & Notes Section */}
            <div className="form-section">
              <h3 className="form-section-title">Contact & Notes</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contactEmail">Contact Email</label>
                  <input
                    type="email"
                    id="contactEmail"
                    name="contactEmail"
                    value={formData.contactEmail}
                    onChange={handleChange}
                    placeholder="contact@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contactPhone">Contact Phone</label>
                  <input
                    type="tel"
                    id="contactPhone"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="+1-555-123-4567"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Additional Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any other information about this meeting..."
                  rows="3"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <span className="btn-spinner"></span>
                    Creating...
                  </>
                ) : (
                  'Create Meeting'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default AddMeetingModal;
