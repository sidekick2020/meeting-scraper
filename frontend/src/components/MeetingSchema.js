import React from 'react';

function MeetingSchema() {
  const schemaFields = [
    {
      category: 'Identification',
      description: 'Unique identifiers used to track and deduplicate meetings in the database.',
      fields: [
        { name: 'objectId', type: 'String', description: 'System-generated unique ID for this meeting record' },
        { name: 'uniqueKey', type: 'String', description: 'Prevents duplicate entries by combining name, location, day, and time into a single key' },
      ]
    },
    {
      category: 'Basic Information',
      description: 'Core details that identify what kind of meeting this is.',
      fields: [
        { name: 'name', type: 'String', description: 'The display name of the meeting (e.g., "Saturday Morning Serenity")' },
        { name: 'slug', type: 'String', description: 'URL-safe version of the name for web links' },
        { name: 'fellowship', type: 'String', description: 'Which program: AA (Alcoholics Anonymous), NA (Narcotics Anonymous), Al-Anon, etc.' },
        { name: 'meetingType', type: 'String', description: 'Same as fellowship - kept for compatibility with older systems' },
        { name: 'types', type: 'Array', description: 'Format codes describing the meeting style (see Type Codes below for full list)' },
        { name: 'notes', type: 'String', description: 'Free-form text with any additional info about the meeting' },
      ]
    },
    {
      category: 'Location',
      description: 'Where the meeting takes place. Used for search, mapping, and directions.',
      fields: [
        { name: 'locationName', type: 'String', description: 'Name of the building or venue (e.g., "First Baptist Church")' },
        { name: 'locationNotes', type: 'String', description: 'How to find the meeting once you arrive (e.g., "Enter through side door, Room 202")' },
        { name: 'address', type: 'String', description: 'Street number and name' },
        { name: 'city', type: 'String', description: 'City or town name' },
        { name: 'state', type: 'String', description: 'Two-letter state abbreviation (e.g., "CA", "TX", "NY")' },
        { name: 'postalCode', type: 'String', description: 'ZIP or postal code for the address' },
        { name: 'country', type: 'String', description: 'Country code, defaults to "US" for United States' },
        { name: 'region', type: 'String', description: 'Larger area grouping, like a county or district' },
        { name: 'subRegion', type: 'String', description: 'Smaller area within the region, like a neighborhood' },
        { name: 'formattedAddress', type: 'String', description: 'Complete address as a single line, ready for display' },
      ]
    },
    {
      category: 'Enhanced Location',
      description: 'Extra details to help people find and access the meeting location.',
      fields: [
        { name: 'neighborhood', type: 'String', description: 'Local neighborhood name for easier identification' },
        { name: 'landmark', type: 'String', description: 'Nearby landmark to help with navigation (e.g., "across from City Hall")' },
        { name: 'parkingNotes', type: 'String', description: 'Where to park and any parking fees or restrictions' },
        { name: 'publicTransitNotes', type: 'String', description: 'Bus stops, train stations, or transit routes nearby' },
        { name: 'placeId', type: 'String', description: 'Google Maps Place ID for precise location linking' },
      ]
    },
    {
      category: 'Coordinates',
      description: 'GPS coordinates for mapping and "meetings near me" searches.',
      fields: [
        { name: 'latitude', type: 'Number', description: 'North-south position (-90 to 90). Auto-filled from address if not provided.' },
        { name: 'longitude', type: 'Number', description: 'East-west position (-180 to 180). Auto-filled from address if not provided.' },
      ]
    },
    {
      category: 'Schedule',
      description: 'When the meeting occurs each week.',
      fields: [
        { name: 'day', type: 'Number', description: 'Day of week as a number: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday' },
        { name: 'time', type: 'String', description: 'When the meeting starts, in 24-hour format (e.g., "19:00" for 7:00 PM)' },
        { name: 'endTime', type: 'String', description: 'When the meeting typically ends (same format as start time)' },
        { name: 'timezone', type: 'String', description: 'Local timezone (e.g., "America/Los_Angeles" for Pacific Time)' },
      ]
    },
    {
      category: 'Meeting Details',
      description: 'Information about how the meeting is run.',
      fields: [
        { name: 'format', type: 'String', description: 'Primary meeting format: discussion, big_book, step_study, speaker, beginners, etc.' },
        { name: 'duration', type: 'Number', description: 'How long the meeting typically lasts, in minutes (e.g., 60 or 90)' },
        { name: 'averageAttendance', type: 'Number', description: 'Typical number of people who attend' },
        { name: 'isActive', type: 'Boolean', description: 'True if the meeting is currently running, false if suspended or closed' },
        { name: 'literatureUsed', type: 'String', description: 'Which book or materials the meeting focuses on (e.g., "Big Book", "12 and 12")' },
      ]
    },
    {
      category: 'Accessibility & Amenities',
      description: 'Features that help people attend and participate.',
      fields: [
        { name: 'wheelchairAccessible', type: 'Boolean', description: 'True if the venue has wheelchair access (ramps, elevators, accessible restrooms)' },
        { name: 'hasChildcare', type: 'Boolean', description: 'True if childcare or babysitting is available during the meeting' },
        { name: 'signLanguageAvailable', type: 'Boolean', description: 'True if ASL interpretation is provided' },
        { name: 'hasParking', type: 'Boolean', description: 'True if parking is available at or near the venue' },
        { name: 'languages', type: 'Array', description: 'Languages used in the meeting (e.g., ["English", "Spanish"])' },
      ]
    },
    {
      category: 'Online Meeting Info',
      description: 'Details for joining virtually via video or phone.',
      fields: [
        { name: 'isOnline', type: 'Boolean', description: 'True if this meeting is online-only (no physical location)' },
        { name: 'isHybrid', type: 'Boolean', description: 'True if you can attend either in-person OR online' },
        { name: 'onlineUrl', type: 'String', description: 'Link to join the video meeting (Zoom, Google Meet, etc.)' },
        { name: 'onlineUrlNotes', type: 'String', description: 'Password, meeting ID, or other instructions for joining online' },
        { name: 'conferencePhone', type: 'String', description: 'Phone number to dial in and listen/participate' },
        { name: 'conferencePhoneNotes', type: 'String', description: 'Access code or instructions for phone dial-in' },
      ]
    },
    {
      category: 'Group Information',
      description: 'Details about the home group that hosts this meeting.',
      fields: [
        { name: 'group', type: 'String', description: 'Name of the AA/NA group, if different from the meeting name' },
        { name: 'groupNotes', type: 'String', description: 'Additional information about the group history or focus' },
      ]
    },
    {
      category: 'Contact Information',
      description: 'How to reach someone with questions about this specific meeting.',
      fields: [
        { name: 'contactName', type: 'String', description: 'Name of the person to contact (usually a group officer)' },
        { name: 'contactEmail', type: 'String', description: 'Email address for meeting-related questions' },
        { name: 'contactPhone', type: 'String', description: 'Phone number for meeting-related questions' },
      ]
    },
    {
      category: 'Entity/Organization',
      description: 'Information about the intergroup or central office that oversees this meeting.',
      fields: [
        { name: 'entityName', type: 'String', description: 'Name of the parent organization (e.g., "San Diego Central Office")' },
        { name: 'entityEmail', type: 'String', description: 'Email for the organization' },
        { name: 'entityPhone', type: 'String', description: 'Phone number for the organization' },
        { name: 'entityUrl', type: 'String', description: 'Website of the organization' },
      ]
    },
    {
      category: 'Source URLs',
      description: 'Links back to the original meeting data sources.',
      fields: [
        { name: 'meetingUrl', type: 'String', description: 'Direct link to this meeting on the original website' },
        { name: 'locationUrl', type: 'String', description: 'Link to more info about the venue' },
        { name: 'editUrl', type: 'String', description: 'Link to submit corrections to the original data source' },
      ]
    },
    {
      category: 'Verification & Quality',
      description: 'Tracks data accuracy and user feedback.',
      fields: [
        { name: 'lastVerifiedAt', type: 'Date', description: 'When someone last confirmed this meeting info is correct' },
        { name: 'verifiedBy', type: 'String', description: 'Who verified the information' },
        { name: 'dataQualityScore', type: 'Number', description: 'Completeness score from 0-100 based on how many fields are filled' },
        { name: 'reportCount', type: 'Number', description: 'Number of times users have reported issues with this listing' },
      ]
    },
    {
      category: 'User Engagement',
      description: 'Tracks how users interact with this meeting.',
      fields: [
        { name: 'favoriteCount', type: 'Number', description: 'How many users have saved this meeting to their favorites' },
        { name: 'checkInCount', type: 'Number', description: 'Total number of times users have checked in at this meeting' },
        { name: 'lastCheckInAt', type: 'Date', description: 'When the most recent user check-in occurred' },
      ]
    },
    {
      category: 'Metadata',
      description: 'System fields that track where data came from and when it was updated.',
      fields: [
        { name: 'sourceType', type: 'String', description: 'How the data was collected (e.g., "web_scraper")' },
        { name: 'sourceFeed', type: 'String', description: 'Which data feed this came from (e.g., "San Diego AA", "Phoenix NA")' },
        { name: 'scrapedAt', type: 'Date', description: 'When our system last pulled this data from the source' },
        { name: 'updatedAt', type: 'Date', description: 'When the meeting info was last modified' },
        { name: 'foundedDate', type: 'Date', description: 'When this meeting first started (if known)' },
        { name: 'approximate', type: 'Boolean', description: 'True if the address is estimated rather than exact' },
        { name: 'feedbackEmails', type: 'Array', description: 'Email addresses for reporting data issues' },
      ]
    },
  ];

  const typeCodes = [
    { code: 'O', name: 'Open', description: 'Anyone may attend, including friends, family, and those curious about recovery' },
    { code: 'C', name: 'Closed', description: 'Only for people who identify as alcoholics/addicts or have a desire to stop' },
    { code: 'D', name: 'Discussion', description: 'Members share their experiences and discuss recovery topics' },
    { code: 'SP', name: 'Speaker', description: 'One or more members tell their story, followed by discussion' },
    { code: 'BB', name: 'Big Book', description: 'Group reads and discusses the AA "Big Book" (Alcoholics Anonymous)' },
    { code: 'ST', name: 'Step Study', description: 'Focused study of the 12 Steps of recovery' },
    { code: '12x12', name: '12 & 12', description: 'Study of the book "Twelve Steps and Twelve Traditions"' },
    { code: 'B', name: 'Beginners', description: 'Geared toward newcomers who are new to the program' },
    { code: 'W', name: 'Women', description: 'Women-only meeting for those who prefer a same-gender setting' },
    { code: 'M', name: 'Men', description: 'Men-only meeting for those who prefer a same-gender setting' },
    { code: 'Y', name: 'Young People', description: 'Focused on younger members (typically under 35)' },
    { code: 'X', name: 'Wheelchair', description: 'Venue is wheelchair accessible with ramps and accessible facilities' },
    { code: 'BA', name: 'Babysitting', description: 'Childcare is available during the meeting' },
    { code: 'ASL', name: 'Sign Language', description: 'American Sign Language interpretation is provided' },
    { code: 'S', name: 'Spanish', description: 'Meeting is conducted primarily in Spanish' },
    { code: 'TC', name: 'Temp Closed', description: 'Meeting is temporarily suspended (check back later)' },
    { code: 'ONL', name: 'Online', description: 'Virtual meeting only - no physical location' },
    { code: 'HY', name: 'Hybrid', description: 'Attend either in-person or join online via video/phone' },
    { code: 'LIT', name: 'Literature', description: 'Group reads and discusses recovery literature' },
    { code: 'MED', name: 'Meditation', description: 'Includes meditation or mindfulness practice' },
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
          {category.description && (
            <p className="category-description">{category.description}</p>
          )}
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
