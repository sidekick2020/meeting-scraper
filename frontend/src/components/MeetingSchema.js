import React from 'react';

function MeetingSchema() {
  const schemaFields = [
    {
      category: 'Identification',
      fields: [
        { name: 'objectId', type: 'String', description: 'Unique identifier (auto-generated)' },
        { name: 'uniqueKey', type: 'String', description: 'Composite key for deduplication (name|location|day|time)' },
      ]
    },
    {
      category: 'Basic Information',
      fields: [
        { name: 'name', type: 'String', description: 'Meeting name (e.g., "Saturday Morning Serenity")' },
        { name: 'slug', type: 'String', description: 'URL-friendly identifier' },
        { name: 'fellowship', type: 'String', description: 'Fellowship type: AA, NA, Al-Anon, Alateen, CA, OA, GA' },
        { name: 'meetingType', type: 'String', description: 'Alias for fellowship (backwards compatibility)' },
        { name: 'types', type: 'Array', description: 'Array of type codes (e.g., ["O", "D", "W"] for Open, Discussion, Women)' },
        { name: 'notes', type: 'String', description: 'Additional meeting notes or description' },
      ]
    },
    {
      category: 'Location',
      fields: [
        { name: 'locationName', type: 'String', description: 'Venue name (e.g., "First Baptist Church")' },
        { name: 'locationNotes', type: 'String', description: 'Directions within venue (e.g., "Room 202")' },
        { name: 'address', type: 'String', description: 'Street address' },
        { name: 'city', type: 'String', description: 'City name' },
        { name: 'state', type: 'String', description: 'Two-letter state code (e.g., "CA")' },
        { name: 'postalCode', type: 'String', description: 'ZIP code' },
        { name: 'country', type: 'String', description: 'Country code (default: "US")' },
        { name: 'region', type: 'String', description: 'Region or district within state' },
        { name: 'subRegion', type: 'String', description: 'Sub-region or neighborhood' },
        { name: 'formattedAddress', type: 'String', description: 'Full formatted address string' },
      ]
    },
    {
      category: 'Enhanced Location',
      fields: [
        { name: 'neighborhood', type: 'String', description: 'Neighborhood name' },
        { name: 'landmark', type: 'String', description: 'Nearby landmark or directions' },
        { name: 'parkingNotes', type: 'String', description: 'Parking information' },
        { name: 'publicTransitNotes', type: 'String', description: 'Public transit access info' },
        { name: 'placeId', type: 'String', description: 'Google Places ID (if available)' },
      ]
    },
    {
      category: 'Coordinates',
      fields: [
        { name: 'latitude', type: 'Number', description: 'GPS latitude (auto-geocoded if missing)' },
        { name: 'longitude', type: 'Number', description: 'GPS longitude (auto-geocoded if missing)' },
      ]
    },
    {
      category: 'Schedule',
      fields: [
        { name: 'day', type: 'Number', description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)' },
        { name: 'time', type: 'String', description: 'Start time in 24h format (e.g., "19:00")' },
        { name: 'endTime', type: 'String', description: 'End time in 24h format' },
        { name: 'timezone', type: 'String', description: 'Timezone (e.g., "America/Los_Angeles")' },
      ]
    },
    {
      category: 'Meeting Details',
      fields: [
        { name: 'format', type: 'String', description: 'Meeting format: discussion, big_book, step_study, speaker, beginners, etc.' },
        { name: 'duration', type: 'Number', description: 'Meeting duration in minutes' },
        { name: 'averageAttendance', type: 'Number', description: 'Typical number of attendees' },
        { name: 'isActive', type: 'Boolean', description: 'Whether the meeting is currently active' },
        { name: 'literatureUsed', type: 'String', description: 'Primary literature used (e.g., "Big Book")' },
      ]
    },
    {
      category: 'Accessibility & Amenities',
      fields: [
        { name: 'wheelchairAccessible', type: 'Boolean', description: 'Venue is wheelchair accessible' },
        { name: 'hasChildcare', type: 'Boolean', description: 'Childcare is available' },
        { name: 'signLanguageAvailable', type: 'Boolean', description: 'ASL interpretation available' },
        { name: 'hasParking', type: 'Boolean', description: 'Parking is available' },
        { name: 'languages', type: 'Array', description: 'Languages spoken (e.g., ["English", "Spanish"])' },
      ]
    },
    {
      category: 'Online Meeting Info',
      fields: [
        { name: 'isOnline', type: 'Boolean', description: 'Meeting is online-only' },
        { name: 'isHybrid', type: 'Boolean', description: 'Meeting is both in-person and online' },
        { name: 'onlineUrl', type: 'String', description: 'Zoom/video conference URL' },
        { name: 'onlineUrlNotes', type: 'String', description: 'Notes about online access (password, etc.)' },
        { name: 'conferencePhone', type: 'String', description: 'Phone dial-in number' },
        { name: 'conferencePhoneNotes', type: 'String', description: 'Phone access notes' },
      ]
    },
    {
      category: 'Group Information',
      fields: [
        { name: 'group', type: 'String', description: 'AA/NA group name (if different from meeting name)' },
        { name: 'groupNotes', type: 'String', description: 'Notes about the group' },
      ]
    },
    {
      category: 'Contact Information',
      fields: [
        { name: 'contactName', type: 'String', description: 'Primary contact name' },
        { name: 'contactEmail', type: 'String', description: 'Contact email address' },
        { name: 'contactPhone', type: 'String', description: 'Contact phone number' },
      ]
    },
    {
      category: 'Entity/Organization',
      fields: [
        { name: 'entityName', type: 'String', description: 'Parent organization name' },
        { name: 'entityEmail', type: 'String', description: 'Organization email' },
        { name: 'entityPhone', type: 'String', description: 'Organization phone' },
        { name: 'entityUrl', type: 'String', description: 'Organization website' },
      ]
    },
    {
      category: 'Source URLs',
      fields: [
        { name: 'meetingUrl', type: 'String', description: 'Direct URL to meeting page' },
        { name: 'locationUrl', type: 'String', description: 'URL to location info' },
        { name: 'editUrl', type: 'String', description: 'URL to edit meeting (if available)' },
      ]
    },
    {
      category: 'Verification & Quality',
      fields: [
        { name: 'lastVerifiedAt', type: 'Date', description: 'When the meeting was last verified' },
        { name: 'verifiedBy', type: 'String', description: 'Who verified the meeting' },
        { name: 'dataQualityScore', type: 'Number', description: 'Data completeness score (0-100)' },
        { name: 'reportCount', type: 'Number', description: 'Number of user reports/issues' },
      ]
    },
    {
      category: 'User Engagement',
      fields: [
        { name: 'favoriteCount', type: 'Number', description: 'Number of users who favorited this meeting' },
        { name: 'checkInCount', type: 'Number', description: 'Total check-ins at this meeting' },
        { name: 'lastCheckInAt', type: 'Date', description: 'Most recent check-in timestamp' },
      ]
    },
    {
      category: 'Metadata',
      fields: [
        { name: 'sourceType', type: 'String', description: 'Data source type (always "web_scraper")' },
        { name: 'sourceFeed', type: 'String', description: 'Name of the source feed (e.g., "San Diego AA")' },
        { name: 'scrapedAt', type: 'Date', description: 'When this record was scraped' },
        { name: 'updatedAt', type: 'Date', description: 'When meeting info was last updated at source' },
        { name: 'foundedDate', type: 'Date', description: 'When the meeting was founded' },
        { name: 'approximate', type: 'Boolean', description: 'Address is approximate (not exact)' },
        { name: 'feedbackEmails', type: 'Array', description: 'Emails for reporting issues' },
      ]
    },
  ];

  const typeCodes = [
    { code: 'O', name: 'Open', description: 'Open to anyone' },
    { code: 'C', name: 'Closed', description: 'For alcoholics/addicts only' },
    { code: 'D', name: 'Discussion', description: 'Discussion format' },
    { code: 'SP', name: 'Speaker', description: 'Speaker meeting' },
    { code: 'BB', name: 'Big Book', description: 'Big Book study' },
    { code: 'ST', name: 'Step Study', description: '12-step study' },
    { code: '12x12', name: '12 & 12', description: '12 Steps and 12 Traditions study' },
    { code: 'B', name: 'Beginners', description: 'Beginners meeting' },
    { code: 'W', name: 'Women', description: 'Women only' },
    { code: 'M', name: 'Men', description: 'Men only' },
    { code: 'Y', name: 'Young People', description: 'Young people focus' },
    { code: 'X', name: 'Wheelchair', description: 'Wheelchair accessible' },
    { code: 'BA', name: 'Babysitting', description: 'Childcare available' },
    { code: 'ASL', name: 'Sign Language', description: 'ASL interpretation' },
    { code: 'S', name: 'Spanish', description: 'Spanish language' },
    { code: 'TC', name: 'Temp Closed', description: 'Temporarily closed' },
    { code: 'ONL', name: 'Online', description: 'Online meeting' },
    { code: 'HY', name: 'Hybrid', description: 'In-person and online' },
    { code: 'LIT', name: 'Literature', description: 'Literature study' },
    { code: 'MED', name: 'Meditation', description: 'Meditation meeting' },
  ];

  return (
    <div className="docs-page">
      <h1>Meeting Schema</h1>
      <p className="lead">
        The Meeting schema defines the structure of meeting data stored in Back4app.
        This comprehensive schema supports 50+ fields covering all aspects of 12-step meetings.
      </p>

      <h2>Schema Overview</h2>
      <p>
        Each meeting record contains fields organized into logical categories.
        Most fields are optional - only <code>name</code>, <code>day</code>, <code>time</code>,
        and location fields are required for a valid meeting.
      </p>

      <h2>Field Reference</h2>

      {schemaFields.map((category) => (
        <div key={category.category} className="schema-category">
          <h3>{category.category}</h3>
          <table className="schema-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {category.fields.map((field) => (
                <tr key={field.name}>
                  <td><code>{field.name}</code></td>
                  <td><span className={`type-badge type-${field.type.toLowerCase()}`}>{field.type}</span></td>
                  <td>{field.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Meeting Type Codes</h2>
      <p>
        The <code>types</code> array contains standardized codes that describe meeting characteristics.
        These codes are used across the recovery community.
      </p>

      <table className="schema-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {typeCodes.map((type) => (
            <tr key={type.code}>
              <td><code>{type.code}</code></td>
              <td>{type.name}</td>
              <td>{type.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Day of Week Values</h2>
      <table className="schema-table">
        <thead>
          <tr>
            <th>Value</th>
            <th>Day</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>0</code></td><td>Sunday</td></tr>
          <tr><td><code>1</code></td><td>Monday</td></tr>
          <tr><td><code>2</code></td><td>Tuesday</td></tr>
          <tr><td><code>3</code></td><td>Wednesday</td></tr>
          <tr><td><code>4</code></td><td>Thursday</td></tr>
          <tr><td><code>5</code></td><td>Friday</td></tr>
          <tr><td><code>6</code></td><td>Saturday</td></tr>
        </tbody>
      </table>

      <h2>Deduplication</h2>
      <p>
        The <code>uniqueKey</code> field is used to prevent duplicate meetings. It's a composite
        key generated from:
      </p>
      <pre><code>{`name|locationName|day|time`}</code></pre>
      <p>
        For example: <code>saturday morning serenity|first baptist church|6|09:00</code>
      </p>
      <p>
        Before saving a new meeting, the scraper checks if a meeting with the same unique key
        already exists in the database.
      </p>

      <h2>Parse Date Format</h2>
      <p>
        Date fields use Parse's Date type format:
      </p>
      <pre><code>{`{
  "__type": "Date",
  "iso": "2024-01-29T19:00:00.000Z"
}`}</code></pre>

      <h2>Example Meeting Object</h2>
      <pre><code>{`{
  "objectId": "abc123xyz",
  "uniqueKey": "saturday serenity|community center|6|09:00",
  "name": "Saturday Serenity",
  "fellowship": "AA",
  "types": ["O", "D", "X"],
  "locationName": "Community Center",
  "address": "123 Main St",
  "city": "San Diego",
  "state": "CA",
  "postalCode": "92101",
  "latitude": 32.7157,
  "longitude": -117.1611,
  "day": 6,
  "time": "09:00",
  "endTime": "10:00",
  "format": "discussion",
  "duration": 60,
  "wheelchairAccessible": true,
  "languages": ["English"],
  "isOnline": false,
  "isHybrid": false,
  "sourceType": "web_scraper",
  "sourceFeed": "San Diego AA",
  "scrapedAt": {
    "__type": "Date",
    "iso": "2024-01-29T15:30:00.000Z"
  }
}`}</code></pre>
    </div>
  );
}

export default MeetingSchema;
