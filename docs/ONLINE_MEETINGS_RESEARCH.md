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

## Additional Support Groups Discovered

### Overview of All Online Meeting Sources

| Fellowship | Source | Website | API Available | Est. Meetings |
|------------|--------|---------|---------------|---------------|
| **AA** | Online Intergroup of AA | aa-intergroup.org | ✅ TSML JSON | ~8,400 |
| **NA** | Virtual NA | virtual-na.org | ✅ BMLT JSON | ~3,150 |
| **Celebrate Recovery** | CR Official | celebraterecovery.com | ❌ Manual | Unknown |
| **Al-Anon** | Online Al-Anon | ola-is.org | ❌ Manual | ~1,000+ |
| **SMART Recovery** | SMART Intl | smartrecovery.org | ❌ Manual | ~3,000 |
| **Recovery Dharma** | RD Online | recoverydharma.online | ❌ Manual | ~200+ |
| **Cocaine Anonymous** | CA Online | ca-online.org | ❌ Manual | Unknown |
| **Overeaters Anonymous** | OA Virtual | oavirtualregion.org | ❌ Manual | ~6,500 worldwide |
| **CoDA** | CoDA Online | coda.org | ❌ Manual | Unknown |
| **Gamblers Anonymous** | GA Virtual | gamblersanonymous.org | ❌ Manual | Unknown |
| **LifeRing** | LifeRing Secular | lifering.org | ❌ Manual | ~50+ |

---

## Celebrate Recovery (CR)

**Website**: https://celebraterecovery.com/weekly-online-recovery-meetings/

**Description**: Christ-centered 12-step recovery program addressing "hurts, habits, and hangups" including addiction, codependency, depression, anger, and more.

**Online Meeting**:
- Weekly Zoom group every **Wednesday at 12pm PST**
- Email required to receive Zoom link

**Meeting Finder**: https://crlocator.com - Searchable database of CR groups and step studies (in-person and online)

**Notes**:
- Individual churches offer additional online meetings
- No public API available
- Would require web scraping to collect meeting data

---

## Al-Anon / Alateen (Family Groups)

**Website**: https://al-anon.org/al-anon-meetings/

**Online Resources**:
- **Online Al-Anon Outreach (OLA-IS)**: https://ola-is.org
- **World Meeting List**: https://www.helplistnyc.org/awm

**Meeting Types**:
- Email meetings (24/7, asynchronous)
- Chat meetings (real-time text)
- Telephone/Zoom meetings

**Notes**:
- For family and friends of alcoholics
- No public JSON API
- Meetings available in multiple languages

---

## SMART Recovery

**Website**: https://smartrecovery.org/meeting

**Meeting Finder**: https://meetings.smartrecovery.org/meetings/

**Description**: Science-based, secular alternative to 12-step programs. Uses cognitive-behavioral techniques and motivational interviewing.

**Features**:
- ~3,000 meetings in 35+ countries
- Online meetings use Zoom or Microsoft Teams
- Meetings are 90 minutes, free with trained facilitators
- No camera required - voice/text chat supported

**Online Community**: SMART Recovery Online (SROL) offers:
- Daily online meetings
- 24/7 chat room
- Message boards

**Notes**:
- Suitable for any addictive behavior
- Registration required for SROL access
- No public API - would require scraping

---

## Recovery Dharma (Buddhist-Based)

**Website**: https://recoverydharma.org/meetings/

**Online Hub**: https://recoverydharma.online

**Description**: Buddhist-inspired, peer-led addiction recovery program using meditation, mindfulness, and the Eightfold Path.

**Meeting Types**:
- **Book Study**: Standard format with reading from RD book
- **Sitting Groups**: Focused on meditation and sharing
- **Speaker Meetings**: Weekly invited speakers
- **Identity Groups**: Women (WORD-OS), Men (BIRD), LGBTQIA+, BIPOC

**Features**:
- 200+ online meetings
- 7 days/week availability
- Google Calendar integration
- Most use Zoom

**Notes**:
- Formerly Refuge Recovery
- Multiple languages including German, Danish, Thai
- No public API

---

## Cocaine Anonymous (CA)

**Website**: https://ca.org/meetings/

**Online Service Area**: https://ca-online.org

**Description**: 12-step fellowship for recovery from cocaine and all mind-altering substances.

**Meeting Types**:
- Email meetings (24/7)
- Voice meetings via Skype, GoToMeeting, Freeconferencecall
- Zoom meetings

**Regional Online Resources**:
- Colorado: https://ca-colorado.org/online-phone-meetings/
- Arizona: https://caarizona.org/c-a-online-meetings/
- Los Angeles: https://ca4la.org/meetings/

**Notes**:
- "The Real Deal of CA" offers international Zoom meetings (Mon/Fri 11am EST)
- 24-hour helpline: (888) 714-8341
- No public API

---

## Overeaters Anonymous (OA)

**Website**: https://oa.org/find-a-meeting/

**Virtual Region**: https://oavirtualregion.org

**Description**: 12-step fellowship for compulsive eating and body image issues.

**Features**:
- ~6,500 meetings in 80+ countries
- Telephone, online, and asynchronous meetings
- No registration required
- Anonymous participation allowed

**Special Groups**:
- OA HOW (structured abstinence): https://oahowphonemeetings.com

**Notes**:
- Virtual meetings may have established procedures
- No public API

---

## CoDA (Codependents Anonymous)

**Website**: https://coda.org/find-a-meeting/online-meetings/

**Alternative**: https://www.onlinecoda.net

**Description**: 12-step fellowship for developing healthy relationships, addressing codependency patterns.

**Features**:
- Searchable online meeting directory
- Filter by day, language, meeting focus
- Times displayed in user's timezone

**Notes**:
- NYC CoDA and other regional groups have additional listings
- No public API

---

## Gamblers Anonymous (GA)

**Website**: https://gamblersanonymous.org/virtual-meetings/

**Family Groups**: https://www.gam-anon.org/meeting-directory/virtual-meetings

**Description**: 12-step fellowship for compulsive gamblers.

**Meeting Types**:
- Virtual (Zoom)
- Telephone
- Hybrid (in-person + virtual)

**Resources**:
- Hotline: 855-2CALLGA (855-222-5542)
- International: (909) 931-9056
- **Gamblers In Recovery**: https://gamblersinrecovery.com - Extensive Zoom meeting finder

**Notes**:
- Gam-Anon for family/friends
- No public API

---

## LifeRing Secular Recovery

**Website**: https://lifering.org/online-meetings/

**Meeting Calendar**: https://meetings.lifering.org/meetings/

**Description**: Secular, self-empowerment based recovery program (3-S Philosophy: Sobriety, Secularity, Self-Empowerment).

**Meeting Types**:
- **HWYW** (How Was Your Week) - Standard format
- **Focus meetings** - Specific communities
- **Topic meetings** - Discussion-based

**Features**:
- 1-hour meetings
- Court/treatment program verification available
- Open to all who want to stay sober

**Notes**:
- Must be sober to share
- No public API

---

## Other AA Sources (Potential Duplicates)

| Source | URL | Notes |
|--------|-----|-------|
| AA Home Group | https://aahomegroup.org | 24/7 online meetings |
| Online Group AA | https://www.onlinegroupaa.org | Online community |
| AA Global Australia | https://meetings.aa.org.au/international-online-meetings/ | International listings |
| International Secular AA | https://www.aasecular.org/online-meetings | Secular meetings |

These sources may duplicate data already in OIAA.

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
