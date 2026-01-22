# Meeting Data Schema

This document describes the complete schema for meeting data stored in the Back4app `Meetings` class.

## Overview

Each meeting record contains information about a 12-step recovery meeting, including when and where it meets, how to join (in-person or online), and what kind of format it uses. Most fields are optional - only `name`, `day`, `time`, and location fields are required.

---

## Core Fields

These fields uniquely identify each meeting in the database.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `objectId` | String | Auto | System-generated unique ID for this meeting record |
| `uniqueKey` | String | Yes | Prevents duplicates by combining name, location, day, and time |
| `name` | String | Yes | The display name of the meeting (e.g., "Saturday Morning Serenity") |
| `slug` | String | No | URL-safe version of the name for web links |

---

## Meeting Type

These fields describe what kind of meeting this is.

| Field | Type | Description |
|-------|------|-------------|
| `meetingType` | String | Which program: `AA` (Alcoholics Anonymous), `NA` (Narcotics Anonymous), `Al-Anon`, or `Other` |
| `fellowship` | String | Same as meetingType - the fellowship or program name |
| `types` | Array | Format codes describing the meeting style (see [Type Codes](#type-codes) below) |
| `notes` | String | Free-form text with any additional info about the meeting |

---

## Schedule

When the meeting occurs each week.

| Field | Type | Description |
|-------|------|-------------|
| `day` | Number | Day of week as a number: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday |
| `time` | String | When the meeting starts, in 24-hour format (e.g., "19:30" for 7:30 PM) |
| `endTime` | String | When the meeting typically ends (same 24-hour format) |
| `timezone` | String | IANA timezone (e.g., "America/Los_Angeles" for Pacific Time) |

---

## Location

Where the meeting takes place. Used for search, mapping, and directions.

| Field | Type | Description |
|-------|------|-------------|
| `locationName` | String | Name of the building or venue (e.g., "St. Michael's Church") |
| `address` | String | Street number and name |
| `city` | String | City or town name |
| `state` | String | Two-letter state code (e.g., "CA", "TX", "NY") |
| `postalCode` | String | ZIP or postal code |
| `country` | String | Country code, defaults to "US" |
| `formattedAddress` | String | Complete address as a single line, ready for display |
| `locationNotes` | String | How to find the meeting once you arrive (e.g., "Enter through side door, Room 202") |
| `region` | String | Larger area grouping, like a county or district |
| `subRegion` | String | Smaller area within the region, like a neighborhood |

---

## Geolocation

GPS coordinates for mapping and "meetings near me" searches.

| Field | Type | Description |
|-------|------|-------------|
| `latitude` | Number | North-south position (-90 to 90). Auto-filled from address if not provided. |
| `longitude` | Number | East-west position (-180 to 180). Auto-filled from address if not provided. |
| `location` | GeoPoint | Parse GeoPoint object for proximity queries |

---

## Online Meeting Info

Details for joining virtually via video or phone.

| Field | Type | Description |
|-------|------|-------------|
| `isOnline` | Boolean | `true` if this meeting is online-only (no physical location) |
| `isHybrid` | Boolean | `true` if you can attend either in-person OR online |
| `onlineUrl` | String | Link to join the video meeting (Zoom, Google Meet, etc.) |
| `onlineUrlNotes` | String | Password, meeting ID, or other instructions for joining online |
| `conferencePhone` | String | Phone number to dial in and listen/participate |
| `conferencePhoneNotes` | String | Access code or instructions for phone dial-in |

---

## Group & Contact Information

Details about who runs this meeting and how to reach them.

| Field | Type | Description |
|-------|------|-------------|
| `group` | String | Name of the home group that hosts this meeting |
| `groupNotes` | String | Additional information about the group |
| `contactName` | String | Name of the person to contact with questions |
| `contactEmail` | String | Email address for meeting-related questions |
| `contactPhone` | String | Phone number for meeting-related questions |

---

## Metadata

System fields that track where data came from and when it was updated.

| Field | Type | Description |
|-------|------|-------------|
| `source` | String | Which data feed this came from (e.g., "San Diego AA") |
| `sourceFeed` | String | Same as source - name of the feed |
| `sourceType` | String | How the data was collected (e.g., "web_scraper") |
| `sourceUrl` | String | Original meeting URL from the source |
| `updatedAt` | Date | When the meeting info was last modified |
| `createdAt` | Date | When this record was first created |
| `scrapedAt` | Date | When our system last pulled this data from the source |

---

## Type Codes

Meeting format codes used in the `types` array. These describe what to expect at the meeting.

### Participation Type

| Code | Name | What It Means |
|------|------|---------------|
| `O` | Open | Anyone may attend, including friends, family, and those curious about recovery |
| `C` | Closed | Only for people who identify as alcoholics/addicts or have a desire to stop |
| `M` | Men | Men-only meeting for those who prefer a same-gender setting |
| `W` | Women | Women-only meeting for those who prefer a same-gender setting |
| `Y` | Young People | Focused on younger members, typically under 35 |
| `LGBTQ` | LGBTQ+ | Welcoming space for LGBTQ+ community members |

### Meeting Format

| Code | Name | What It Means |
|------|------|---------------|
| `D` | Discussion | Members share their experiences and discuss recovery topics |
| `SP` | Speaker | One or more members tell their story, followed by discussion |
| `BB` | Big Book | Group reads and discusses the AA "Big Book" |
| `ST` | Step | Focused study of the 12 Steps of recovery |
| `12x12` | Twelve & Twelve | Study of "Twelve Steps and Twelve Traditions" book |
| `B` | Beginners | Geared toward newcomers who are new to the program |
| `H` | Birthday | Celebrating sobriety anniversaries |
| `MED` | Meditation | Includes meditation or mindfulness practice |
| `LIT` | Literature | Group reads and discusses recovery literature |

### Accessibility

| Code | Name | What It Means |
|------|------|---------------|
| `X` | Wheelchair | Venue is wheelchair accessible with ramps and accessible facilities |
| `ASL` | Sign Language | American Sign Language interpretation is provided |
| `AL` | Al-Anon | Concurrent Al-Anon meeting available |
| `BA` | Babysitting | Childcare is available during the meeting |

### Language

| Code | Name | What It Means |
|------|------|---------------|
| `S` | Spanish | Meeting is conducted primarily in Spanish |
| `POL` | Polish | Meeting is conducted primarily in Polish |
| `POR` | Portuguese | Meeting is conducted primarily in Portuguese |
| `FR` | French | Meeting is conducted primarily in French |

### Attendance Mode

| Code | Name | What It Means |
|------|------|---------------|
| `ONL` | Online | Virtual meeting only - no physical location |
| `HY` | Hybrid | Attend either in-person or join online via video/phone |
| `TC` | Temporarily Closed | Meeting is temporarily suspended (check back later) |

---

## Example Meeting Object

Here's what a complete meeting record looks like:

```json
{
  "objectId": "abc123xyz",
  "uniqueKey": "saturday morning serenity|st. michael's church|6|09:00",
  "name": "Saturday Morning Serenity",
  "meetingType": "AA",
  "types": ["O", "D", "X"],
  "day": 6,
  "time": "09:00",
  "endTime": "10:00",
  "timezone": "America/Los_Angeles",
  "locationName": "St. Michael's Church",
  "address": "123 Main Street",
  "city": "San Diego",
  "state": "CA",
  "postalCode": "92101",
  "formattedAddress": "123 Main Street, San Diego, CA 92101",
  "locationNotes": "Enter through side door, meeting is in Fellowship Hall",
  "latitude": 32.7157,
  "longitude": -117.1611,
  "isOnline": false,
  "isHybrid": true,
  "onlineUrl": "https://zoom.us/j/123456789",
  "onlineUrlNotes": "Password: serenity",
  "group": "Saturday Serenity Group",
  "contactEmail": "saturdayserenity@example.com",
  "source": "San Diego AA",
  "notes": "Parking available in back lot. Coffee provided."
}
```

---

## Querying Meetings

### By Location

```
/api/meetings?state=CA
/api/meetings?city=San Diego
```

### By Schedule

```
/api/meetings?day=6
/api/meetings?day=0&time=09:00
```

### By Meeting Type

```
/api/meetings?meetingType=AA
/api/meetings?meetingType=NA
```

### Near a Location

```
/api/meetings?lat=32.7157&lng=-117.1611&radius=10
```

---

## Parse SDK Queries

### iOS (Swift)
```swift
let query = Meeting.query()
    .where("state" == "CA")
    .where("day" == 6)
    .order([.ascending("time")])
```

### Android (Kotlin)
```kotlin
val query = ParseQuery.getQuery(Meeting::class.java)
query.whereEqualTo("state", "CA")
query.whereEqualTo("day", 6)
query.orderByAscending("time")
```

---

See [Mobile Quick Start Guide](MOBILE_QUICKSTART.md) for complete integration examples.
