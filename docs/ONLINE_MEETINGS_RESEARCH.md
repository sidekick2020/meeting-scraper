# Online Meeting Research Findings

This document summarizes research on online Zoom AA and NA meeting sources for potential addition to the Back4app database.

## Summary

| Source | Fellowship | Meetings | Format | Status |
|--------|------------|----------|--------|--------|
| Online Intergroup of AA (OIAA) | AA | ~8,400 | TSML JSON | Already configured |
| Virtual NA | NA | ~3,150 | BMLT JSON | Fixed URL in app.py |
| **Total** | - | **~11,550** | - | - |

## Data Quality Analysis

From our data collection run (January 2026):

- **Total unique meetings**: 11,538
- **With Zoom/video URL**: 10,687 (92.6%)
- **With phone dial-in**: 1,781 (15.4%)
- **Online-only meetings**: 11,444 (99.2%)
- **Hybrid meetings**: 94 (0.8%)

### Distribution by Day
| Day | Meetings |
|-----|----------|
| Sunday | 1,663 |
| Monday | 1,699 |
| Tuesday | 1,669 |
| Wednesday | 1,733 |
| Thursday | 1,642 |
| Friday | 1,605 |
| Saturday | 1,527 |

### Distribution by Fellowship
| Fellowship | Meetings |
|------------|----------|
| AA | 8,391 |
| NA | 3,147 |

---

## Verified Online Meeting Sources

### 1. Online Intergroup of AA (OIAA)

**Website**: https://aa-intergroup.org/meetings/

**Feed URL**: `https://data.aa-intergroup.org/6436f5a3f03fdecef8459055.json`

**Format**: TSML (12 Step Meeting List) JSON

**Description**: The primary international directory for online AA meetings. Features over 8,400 online meetings worldwide in multiple languages. Meetings include Zoom video, phone dial-in, and text chat formats.

**Key Features**:
- Multi-language meetings (English, Spanish, French, etc.)
- Various meeting formats (Discussion, Speaker, Big Book, Steps, etc.)
- Timezone-aware scheduling
- Zoom URLs and phone dial-in numbers

**Status**: Already configured in `backend/app.py` under `AA_FEEDS`

---

### 2. Virtual NA

**Website**: https://virtual-na.org

**BMLT Server**: https://bmlt.virtual-na.org/main_server/

**Feed URL**: `https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults`

**Format**: BMLT (Basic Meeting List Toolbox) JSON

**Description**: The primary source for online NA meetings worldwide. Contains approximately 3,150 virtual meetings across multiple languages and platforms (Zoom, phone, Bluejeans, etc.).

**Key Features**:
- 24/7 Marathon meetings available
- Multi-language support
- Phone and video meeting options
- International coverage

**Status**: Configured in `backend/app.py` under `NA_FEEDS` - **URL corrected** from `virtual-na.org` to `bmlt.virtual-na.org`

---

## Additional Sources Discovered (Not Yet Integrated)

### Potential Future Sources

| Source | Type | URL | Notes |
|--------|------|-----|-------|
| AA Home Group | AA | https://aahomegroup.org | 24/7 online meetings |
| Online Group AA | AA | https://www.onlinegroupaa.org | Online community |
| AA Global Australia | AA | https://meetings.aa.org.au/international-online-meetings/ | International listings |
| International Secular AA | AA | https://www.aasecular.org/online-meetings | Secular meetings |

These sources may duplicate data already in OIAA or require different scraping approaches.

---

## Technical Details

### TSML Format (AA)

The 12 Step Meeting List (TSML) format is the standard for AA meeting data. Key fields:

```json
{
  "name": "Meeting Name",
  "slug": "meeting-name",
  "day": 0,
  "time": "19:30",
  "end_time": "20:30",
  "timezone": "America/New_York",
  "types": ["O", "D", "VM"],
  "conference_url": "https://zoom.us/j/...",
  "conference_phone": "+1-555-555-5555",
  "notes": "Meeting description"
}
```

### BMLT Format (NA)

The Basic Meeting List Toolbox (BMLT) format is used by NA. Key fields:

```json
{
  "meeting_name": "Meeting Name",
  "weekday_tinyint": "1",
  "start_time": "19:30:00",
  "venue_type": "2",
  "virtual_meeting_link": "https://zoom.us/j/...",
  "phone_meeting_number": "+1-555-555-5555",
  "comments": "Meeting description"
}
```

**Venue Type Codes**:
- `1` = In-person
- `2` = Virtual only
- `3` = Hybrid

---

## Data Cleaning Applied

The `online_meetings_research.py` script applies the following cleaning:

1. **Time normalization**: Converts various formats to `HH:MM`
2. **Day normalization**: Ensures 0-6 format (Sunday=0)
3. **URL cleaning**: Removes whitespace, ensures https prefix
4. **Text cleaning**: Removes HTML tags, normalizes whitespace
5. **Deduplication**: Uses `uniqueKey` based on name, location, day, time
6. **Type normalization**: Uppercase, trimmed format codes

---

## Files Generated

### Data Collection Script
- **Path**: `backend/online_meetings_research.py`
- **Purpose**: Fetches, cleans, and exports online meeting data
- **Output**: CSV and JSON files ready for Back4app import

### Import Script
- **Path**: `backend/import_online_meetings.py`
- **Purpose**: Imports cleaned data directly to Back4app

### Generated Data Files
- `online_meetings_cleaned_YYYYMMDD_HHMMSS.csv` - For review
- `online_meetings_cleaned_YYYYMMDD_HHMMSS.json` - For import

---

## Recommendations

1. **Run regular imports**: Execute the data collection weekly to keep meetings current
2. **Monitor feed health**: Check for feed URL changes periodically
3. **Deduplicate carefully**: Some meetings appear in multiple sources
4. **Preserve timezone data**: Critical for online meetings with international attendees
5. **Validate Zoom URLs**: Some URLs may be expired or inactive

---

## Resources

- [Meeting Guide API Specification](https://github.com/code4recovery/spec)
- [TSML WordPress Plugin](https://wordpress.org/plugins/12-step-meeting-list/)
- [BMLT Documentation](https://bmlt.app/)
- [Code for Recovery](https://code4recovery.org/)
