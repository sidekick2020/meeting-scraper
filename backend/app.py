import os
import time
import json
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import random
import string
import re
from datetime import datetime

app = Flask(__name__)

# Build version - generated at startup time
BUILD_VERSION = datetime.now().strftime("%Y%m%d%H%M%S")
CORS(app, origins="*")

# Back4app Configuration - read from environment variables
BACK4APP_APP_ID = os.environ.get('BACK4APP_APP_ID')
BACK4APP_REST_KEY = os.environ.get('BACK4APP_REST_KEY')
BACK4APP_URL = "https://parseapi.back4app.com/classes/Meeting"

# Known working AA Meeting Guide API feeds (verified January 2026)
AA_FEEDS = {
    "Palo Alto (Bay Area)": {
        "url": "https://sheets.code4recovery.org/storage/12Ga8uwMG4WJ8pZ_SEU7vNETp_aQZ-2yNVsYDFqIwHyE.json",
        "state": "CA"
    },
    "San Diego": {
        "url": "https://aasandiego.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Phoenix": {
        "url": "https://aaphoenix.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
}

# Request headers to avoid 406 errors
REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0; +https://github.com/code4recovery)'
}

# US State population data (2023 estimates, in thousands)
US_STATE_POPULATION = {
    "AL": 5108, "AK": 733, "AZ": 7431, "AR": 3067, "CA": 38965,
    "CO": 5877, "CT": 3617, "DE": 1018, "FL": 22610, "GA": 11029,
    "HI": 1440, "ID": 1964, "IL": 12582, "IN": 6833, "IA": 3207,
    "KS": 2940, "KY": 4526, "LA": 4573, "ME": 1395, "MD": 6180,
    "MA": 7001, "MI": 10037, "MN": 5737, "MS": 2939, "MO": 6196,
    "MT": 1133, "NE": 1978, "NV": 3194, "NH": 1402, "NJ": 9290,
    "NM": 2114, "NY": 19571, "NC": 10835, "ND": 783, "OH": 11785,
    "OK": 4053, "OR": 4233, "PA": 12972, "RI": 1096, "SC": 5373,
    "SD": 919, "TN": 7126, "TX": 30503, "UT": 3417, "VT": 647,
    "VA": 8683, "WA": 7812, "WV": 1770, "WI": 5910, "WY": 584,
    "DC": 678, "PR": 3221,  # Including DC and Puerto Rico
}

# State names for display
US_STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia", "PR": "Puerto Rico",
}

# Global state
scraping_state = {
    "is_running": False,
    "total_found": 0,
    "total_saved": 0,
    "current_source": "",
    "errors": [],
    "meetings_by_state": {},
    "meetings_by_type": {"AA": 0, "NA": 0, "Al-Anon": 0, "Other": 0},
    "recent_meetings": [],
    "progress_message": "",
    # Detailed progress tracking
    "current_feed_index": 0,
    "total_feeds": len(AA_FEEDS),
    "current_feed_progress": 0,
    "current_feed_total": 0,
    "current_meeting": None,  # Current meeting being processed
    "activity_log": [],
    "started_at": None,
    "scrape_id": None,  # Unique ID for the current scrape run
}

# Scrape history - stores last 50 scrape runs
scrape_history = []
current_scrape_object_id = None  # Tracks Back4app objectId for in-progress scrape updates

def add_log(message, level="info"):
    """Add a message to the activity log"""
    from datetime import datetime
    entry = {
        "timestamp": datetime.now().isoformat(),
        "message": message,
        "level": level
    }
    scraping_state["activity_log"].insert(0, entry)
    scraping_state["activity_log"] = scraping_state["activity_log"][:50]

def generate_object_id():
    """Generate a 10-character alphanumeric objectId"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

def parse_address(formatted_address):
    """Parse a formatted address into components"""
    if not formatted_address:
        return {"city": "", "state": "", "postalCode": "", "address": ""}

    parts = formatted_address.split(',')
    result = {
        "address": parts[0].strip() if parts else "",
        "city": "",
        "state": "",
        "postalCode": ""
    }

    if len(parts) >= 2:
        result["city"] = parts[1].strip()

    if len(parts) >= 3:
        state_zip = parts[2].strip()
        match = re.match(r'([A-Z]{2})\s*(\d{5})?', state_zip)
        if match:
            result["state"] = match.group(1)
            result["postalCode"] = match.group(2) or ""

    return result

# Simple in-memory cache for geocoding results
geocode_cache = {}
last_geocode_time = 0

def geocode_address(address):
    """Geocode an address using Nominatim (OpenStreetMap) API"""
    global last_geocode_time

    if not address or len(address.strip()) < 5:
        return None, None

    # Check cache first
    cache_key = address.lower().strip()
    if cache_key in geocode_cache:
        return geocode_cache[cache_key]

    # Rate limit: Nominatim requires max 1 request per second
    elapsed = time.time() - last_geocode_time
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    last_geocode_time = time.time()

    try:
        # Use Nominatim API (free, no key required)
        # Important: Include a valid User-Agent per Nominatim usage policy
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": address,
            "format": "json",
            "limit": 1
        }
        headers = {
            "User-Agent": "MeetingScraper/1.0 (12-step meeting finder app)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=5)

        if response.status_code == 200:
            results = response.json()
            if results and len(results) > 0:
                lat = float(results[0]["lat"])
                lon = float(results[0]["lon"])
                geocode_cache[cache_key] = (lat, lon)
                return lat, lon

        geocode_cache[cache_key] = (None, None)
        return None, None

    except Exception as e:
        print(f"Geocoding error for '{address}': {e}")
        return None, None

def parse_types_for_accessibility(types):
    """Extract accessibility and format info from meeting type codes"""
    # Common AA meeting type codes
    # X = Wheelchair accessible, BA = Babysitting Available
    # ASL = American Sign Language, S = Spanish, etc.
    accessibility = {
        "wheelchairAccessible": "X" in types or "wheelchair" in str(types).lower(),
        "hasChildcare": "BA" in types or "CF" in types,
        "signLanguageAvailable": "ASL" in types,
    }

    # Determine meeting format from types
    format_mapping = {
        "BB": "big_book",
        "ST": "step_study",
        "D": "discussion",
        "SP": "speaker",
        "B": "beginners",
        "12x12": "twelve_and_twelve",
        "LIT": "literature",
        "MED": "meditation",
    }

    meeting_format = "discussion"  # default
    for code, fmt in format_mapping.items():
        if code in types:
            meeting_format = fmt
            break

    return accessibility, meeting_format

def extract_languages(types, notes):
    """Extract languages from types and notes"""
    languages = ["English"]  # default

    language_codes = {
        "S": "Spanish",
        "FR": "French",
        "P": "Polish",
        "JA": "Japanese",
        "KO": "Korean",
        "ZH": "Chinese",
        "RU": "Russian",
        "VI": "Vietnamese",
        "FA": "Farsi",
        "AR": "Arabic",
        "DE": "German",
        "IT": "Italian",
        "PT": "Portuguese",
    }

    for code, lang in language_codes.items():
        if code in types:
            if lang not in languages:
                languages.append(lang)

    # Check notes for language mentions
    notes_lower = (notes or "").lower()
    for lang in ["spanish", "french", "polish", "japanese", "korean", "chinese", "russian"]:
        if lang in notes_lower and lang.capitalize() not in languages:
            languages.append(lang.capitalize())

    return languages

def determine_fellowship(meeting_type, types, name):
    """Determine the fellowship type (AA, NA, Al-Anon, etc.)"""
    name_lower = (name or "").lower()

    if "na" in name_lower or "narcotics" in name_lower:
        return "NA"
    elif "al-anon" in name_lower or "alanon" in name_lower:
        return "Al-Anon"
    elif "alateen" in name_lower:
        return "Alateen"
    elif "ca" in name_lower and "cocaine" in name_lower:
        return "CA"
    elif "oa" in name_lower or "overeaters" in name_lower:
        return "OA"
    elif "ga" in name_lower or "gamblers" in name_lower:
        return "GA"

    return meeting_type or "AA"

def to_parse_date(date_str):
    """Convert a date string to Parse Date format"""
    if not date_str:
        return None

    try:
        # Try various date formats
        for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y"]:
            try:
                dt = datetime.strptime(date_str, fmt)
                return {"__type": "Date", "iso": dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")}
            except ValueError:
                continue
        return None
    except:
        return None

def normalize_meeting(raw_meeting, source_name, default_state, skip_geocoding=False):
    """Normalize meeting data from various feed formats to our standard format"""
    formatted_address = raw_meeting.get('formatted_address', '') or raw_meeting.get('address', '')
    addr_parts = parse_address(formatted_address)

    # Determine online/hybrid status
    is_online = False
    is_hybrid = False
    online_url = ""
    conference_phone = ""
    attendance = raw_meeting.get('attendance_option', '')

    if attendance == 'online':
        is_online = True
    elif attendance == 'hybrid':
        is_hybrid = True
        is_online = True
    elif raw_meeting.get('conference_url') or raw_meeting.get('conference_phone'):
        is_online = True

    if raw_meeting.get('conference_url'):
        online_url = raw_meeting.get('conference_url', '')
    if raw_meeting.get('conference_phone'):
        conference_phone = raw_meeting.get('conference_phone', '')

    location_name = raw_meeting.get('location', '') or raw_meeting.get('location_name', '')
    state = addr_parts.get("state") or raw_meeting.get('state', '') or default_state

    # Extract meeting types (e.g., O=Open, C=Closed, W=Women, M=Men, etc.)
    types = raw_meeting.get('types', [])
    if isinstance(types, str):
        types = [types]

    # Get regions - can be string or array
    regions = raw_meeting.get('regions', [])
    if isinstance(regions, str):
        regions = [regions]
    region = raw_meeting.get('region', '') or (regions[0] if regions else '')

    # Extract accessibility and format from types
    notes = raw_meeting.get('notes', '')
    accessibility, meeting_format = parse_types_for_accessibility(types)
    languages = extract_languages(types, notes)

    # Determine fellowship
    name = raw_meeting.get('name', 'Unknown Meeting')
    fellowship = determine_fellowship(raw_meeting.get('meeting_type', ''), types, name)

    # Calculate duration if end_time is available
    duration = None
    start_time = raw_meeting.get('time', '')
    end_time = raw_meeting.get('end_time', '')
    if start_time and end_time:
        try:
            from datetime import datetime as dt
            start = dt.strptime(start_time, "%H:%M")
            end = dt.strptime(end_time, "%H:%M")
            duration = int((end - start).seconds / 60)
            if duration < 0:
                duration = None
        except:
            pass

    # Get coordinates if available
    latitude = raw_meeting.get('latitude')
    longitude = raw_meeting.get('longitude')

    # Parse coordinates from string format "lat,lng"
    coordinates_str = raw_meeting.get('coordinates', '')
    if coordinates_str and not latitude and not longitude:
        try:
            lat_str, lng_str = coordinates_str.split(',')
            latitude = float(lat_str.strip())
            longitude = float(lng_str.strip())
        except (ValueError, AttributeError):
            pass

    # Try to parse as float if they're strings
    if latitude and isinstance(latitude, str):
        try:
            latitude = float(latitude)
        except ValueError:
            latitude = None
    if longitude and isinstance(longitude, str):
        try:
            longitude = float(longitude)
        except ValueError:
            longitude = None

    # Geocode if coordinates are missing and we have an address
    # Skip geocoding during bulk scrape for performance (1 sec per call rate limit)
    if not skip_geocoding and (latitude is None or longitude is None) and formatted_address:
        # Build a full address for better geocoding results
        city = addr_parts.get("city") or raw_meeting.get('city', '')
        geocode_query = formatted_address
        if city and city not in formatted_address:
            geocode_query = f"{formatted_address}, {city}"
        if state and state not in formatted_address:
            geocode_query = f"{geocode_query}, {state}"

        lat, lon = geocode_address(geocode_query)
        if lat and lon:
            latitude = lat
            longitude = lon

    # Generate unique key for deduplication (name + location + day + time)
    day = raw_meeting.get('day', 0)
    meeting_time = raw_meeting.get('time', '')
    unique_key = f"{name}|{location_name}|{day}|{meeting_time}".lower().strip()

    return {
        "objectId": generate_object_id(),
        "uniqueKey": unique_key,  # For deduplication

        # Basic info
        "name": name,
        "slug": raw_meeting.get('slug', ''),

        # Location
        "locationName": location_name,
        "locationNotes": raw_meeting.get('location_notes', ''),
        "address": addr_parts.get("address") or formatted_address,
        "city": addr_parts.get("city") or raw_meeting.get('city', ''),
        "state": state,
        "postalCode": addr_parts.get("postalCode") or raw_meeting.get('postal_code', ''),
        "country": raw_meeting.get('country', 'US'),
        "region": region,
        "subRegion": raw_meeting.get('sub_region', ''),
        "formattedAddress": formatted_address,

        # Enhanced Location
        "neighborhood": raw_meeting.get('neighborhood', ''),
        "landmark": raw_meeting.get('landmark', '') or raw_meeting.get('directions', ''),
        "parkingNotes": raw_meeting.get('parking_notes', ''),
        "publicTransitNotes": raw_meeting.get('transit_notes', ''),
        "placeId": raw_meeting.get('place_id', ''),

        # Coordinates
        "latitude": latitude,
        "longitude": longitude,

        # Schedule
        "day": raw_meeting.get('day', 0),
        "time": raw_meeting.get('time', ''),
        "endTime": raw_meeting.get('end_time', ''),
        "timezone": raw_meeting.get('timezone', ''),

        # Meeting Details
        "format": meeting_format,
        "duration": duration,
        "averageAttendance": raw_meeting.get('attendance', None),
        "isActive": True,
        "literatureUsed": raw_meeting.get('literature', ''),

        # Fellowship & Meeting characteristics
        "fellowship": fellowship,
        "meetingType": fellowship,  # Keep for backwards compatibility
        "types": types,  # Array of type codes like ['O', 'D', 'W']
        "notes": notes,

        # Accessibility & Amenities
        "wheelchairAccessible": accessibility["wheelchairAccessible"],
        "hasChildcare": accessibility["hasChildcare"],
        "signLanguageAvailable": accessibility["signLanguageAvailable"],
        "hasParking": "parking" in notes.lower() if notes else False,
        "languages": languages,

        # Online meeting info
        "isOnline": is_online,
        "isHybrid": is_hybrid,
        "onlineUrl": online_url,
        "onlineUrlNotes": raw_meeting.get('conference_url_notes', ''),
        "conferencePhone": conference_phone,
        "conferencePhoneNotes": raw_meeting.get('conference_phone_notes', ''),

        # Group info
        "group": raw_meeting.get('group', ''),
        "groupNotes": raw_meeting.get('group_notes', ''),

        # Contact info
        "contactName": raw_meeting.get('contact_1_name', ''),
        "contactEmail": raw_meeting.get('contact_1_email', '') or raw_meeting.get('email', ''),
        "contactPhone": raw_meeting.get('contact_1_phone', ''),

        # Entity/Organization info (from some feeds)
        "entityName": raw_meeting.get('entity', ''),
        "entityEmail": raw_meeting.get('entity_email', ''),
        "entityPhone": raw_meeting.get('entity_phone', ''),
        "entityUrl": raw_meeting.get('entity_url', ''),

        # Source URLs
        "meetingUrl": raw_meeting.get('url', ''),
        "locationUrl": raw_meeting.get('location_url', ''),
        "editUrl": raw_meeting.get('edit_url', ''),

        # Additional flags
        "approximate": str(raw_meeting.get('approximate', False)).lower() in ('true', '1', 'yes'),
        "feedbackEmails": raw_meeting.get('feedback_emails', []),

        # Verification & Quality
        "lastVerifiedAt": None,
        "verifiedBy": None,
        "dataQualityScore": None,
        "reportCount": 0,

        # User Engagement (initialized to defaults)
        "favoriteCount": 0,
        "checkInCount": 0,
        "lastCheckInAt": None,

        # Metadata
        "sourceType": "web_scraper",
        "sourceFeed": source_name,
        "updatedAt": to_parse_date(raw_meeting.get('updated', '')),
        "foundedDate": to_parse_date(raw_meeting.get('founded', '')),
        "scrapedAt": {"__type": "Date", "iso": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.000Z")},
    }

def check_duplicate(unique_key):
    """Check if a meeting with this unique key already exists"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return False

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
    }

    try:
        import urllib.parse
        where = json.dumps({"uniqueKey": unique_key})
        url = f"{BACK4APP_URL}?where={urllib.parse.quote(where)}&limit=1&keys=objectId"
        response = requests.get(url, headers=headers, timeout=5)

        if response.status_code == 200:
            data = response.json()
            return len(data.get("results", [])) > 0
        return False
    except:
        return False

def save_to_back4app(meeting_data, skip_duplicate_check=False):
    """Save a meeting to back4app, optionally checking for duplicates"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        add_log("Back4app not configured - skipping save", "warning")
        return False  # Return False so it doesn't count as saved

    # Check for duplicates using uniqueKey
    if not skip_duplicate_check:
        unique_key = meeting_data.get("uniqueKey")
        if unique_key and check_duplicate(unique_key):
            return "duplicate"  # Return special value for duplicates

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(BACK4APP_URL, headers=headers, json=meeting_data, timeout=10)
        if response.status_code == 201:
            return True
        else:
            # Log the actual error from Back4app
            error_detail = response.text[:200] if response.text else "No details"
            print(f"Back4app error {response.status_code}: {error_detail}")
            return False
    except Exception as e:
        print(f"Error saving to back4app: {e}")
        return False

def check_duplicates_batch(unique_keys):
    """Check which unique keys already exist in Back4app (batch query)"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY or not unique_keys:
        return set()

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
    }

    existing_keys = set()
    # Query in batches of 100 (Parse limit for $in queries)
    batch_size = 100

    for i in range(0, len(unique_keys), batch_size):
        batch_keys = unique_keys[i:i + batch_size]
        try:
            import urllib.parse
            where = json.dumps({"uniqueKey": {"$in": batch_keys}})
            url = f"{BACK4APP_URL}?where={urllib.parse.quote(where)}&limit=1000&keys=uniqueKey"
            response = requests.get(url, headers=headers, timeout=15)

            if response.status_code == 200:
                results = response.json().get("results", [])
                for item in results:
                    if item.get("uniqueKey"):
                        existing_keys.add(item["uniqueKey"])
            else:
                # Log non-200 responses
                print(f"Duplicate check returned {response.status_code}: {response.text[:200]}")
        except Exception as e:
            print(f"Error checking duplicates batch: {e}")

    return existing_keys

def save_to_back4app_batch(meetings):
    """Save multiple meetings to Back4app in a single batch request (up to 50)"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY or not meetings:
        add_log(f"Batch save skipped: config={bool(BACK4APP_APP_ID)}, meetings={len(meetings) if meetings else 0}", "warning")
        return {"saved": 0, "errors": 0}

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        "Content-Type": "application/json"
    }

    # Parse batch API format
    requests_list = []
    for meeting in meetings:
        requests_list.append({
            "method": "POST",
            "path": "/classes/Meeting",
            "body": meeting
        })

    try:
        batch_url = "https://parseapi.back4app.com/batch"
        add_log(f"Sending batch of {len(meetings)} to Back4app...", "info")

        response = requests.post(
            batch_url,
            headers=headers,
            json={"requests": requests_list},
            timeout=30
        )

        add_log(f"Batch response status: {response.status_code}", "info")

        if response.status_code == 200:
            results = response.json()

            # Debug: Log the actual response structure
            if results and isinstance(results, list) and len(results) > 0:
                first_result = results[0]
                add_log(f"Response structure: {list(first_result.keys()) if isinstance(first_result, dict) else type(first_result)}", "info")

            saved = sum(1 for r in results if "success" in r)
            errors = sum(1 for r in results if "error" in r)

            # If no success/error keys found, check for objectId (Parse returns objectId on success)
            if saved == 0 and errors == 0 and isinstance(results, list):
                # Parse batch API might return list of objects with objectId on success
                saved = sum(1 for r in results if isinstance(r, dict) and ("objectId" in r or "createdAt" in r))
                errors = len(results) - saved

            # Log all errors for debugging
            if errors > 0:
                for r in results:
                    if "error" in r:
                        add_log(f"Save error: {r.get('error', {})}", "error")
                        break  # Just log first one to avoid spam

            add_log(f"Batch result: {saved} saved, {errors} errors", "info" if saved > 0 else "warning")
            return {"saved": saved, "errors": errors}
        else:
            error_detail = response.text[:500] if response.text else "No details"
            add_log(f"Batch save failed HTTP {response.status_code}: {error_detail[:200]}", "error")
            return {"saved": 0, "errors": len(meetings)}
    except Exception as e:
        add_log(f"Batch save exception: {e}", "error")
        print(f"Error in batch save: {e}")
        return {"saved": 0, "errors": len(meetings)}

def fetch_and_process_feed(feed_name, feed_config, feed_index):
    """Fetch meetings from a single feed and process them using batch operations.

    Processing flow (batches of 50):
    1. Normalize 50 raw meetings
    2. Check duplicates for those 50 (1 query)
    3. Save non-duplicates (1 batch save)
    4. Repeat until done

    This keeps memory low and provides real-time feedback.
    """
    url = feed_config["url"]
    default_state = feed_config["state"]

    scraping_state["current_source"] = feed_name
    scraping_state["current_feed_index"] = feed_index
    scraping_state["current_feed_progress"] = 0
    scraping_state["current_feed_total"] = 0
    scraping_state["progress_message"] = f"Fetching from {feed_name}..."
    add_log(f"Starting feed: {feed_name}", "info")

    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
        raw_meetings = response.json()

        if not isinstance(raw_meetings, list):
            error_msg = f"{feed_name}: Invalid response format"
            scraping_state["errors"].append(error_msg)
            add_log(error_msg, "error")
            return 0

        total_in_feed = len(raw_meetings)
        scraping_state["current_feed_total"] = total_in_feed
        add_log(f"Found {total_in_feed} meetings in {feed_name}", "info")

        saved_count = 0
        duplicate_count = 0
        error_count = 0
        batch_size = 50

        # Process in batches of 50: normalize -> check duplicates -> save
        for batch_start in range(0, total_in_feed, batch_size):
            if not scraping_state["is_running"]:
                add_log("Scraping stopped by user", "warning")
                break

            batch_end = min(batch_start + batch_size, total_in_feed)
            batch_num = (batch_start // batch_size) + 1
            total_batches = (total_in_feed + batch_size - 1) // batch_size

            scraping_state["progress_message"] = f"Processing batch {batch_num}/{total_batches}..."
            scraping_state["current_feed_progress"] = batch_end

            # Step 1: Normalize this batch
            batch_meetings = []
            batch_keys = []

            for idx in range(batch_start, batch_end):
                raw = raw_meetings[idx]
                meeting_name = raw.get('name', 'Unknown Meeting')
                meeting_city = raw.get('city', '') or ''

                scraping_state["current_meeting"] = {
                    "name": meeting_name,
                    "city": meeting_city,
                    "index": idx + 1,
                    "total": total_in_feed
                }

                try:
                    meeting = normalize_meeting(raw, feed_name, default_state, skip_geocoding=True)
                    batch_meetings.append(meeting)
                    if meeting.get("uniqueKey"):
                        batch_keys.append(meeting["uniqueKey"])
                except Exception as e:
                    error_count += 1
                    continue

            # Step 2: Check duplicates for this batch (1 query for up to 50 keys)
            existing_keys = check_duplicates_batch(batch_keys) if batch_keys else set()

            # Filter out duplicates
            meetings_to_save = []
            for meeting in batch_meetings:
                if meeting.get("uniqueKey") in existing_keys:
                    duplicate_count += 1
                else:
                    meetings_to_save.append(meeting)

            # Debug: log duplicate check results for every batch
            add_log(f"Batch {batch_num}: {len(batch_keys)} keys, {len(existing_keys)} existing, {len(meetings_to_save)} new", "info")

            # Step 3: Batch save non-duplicates (1 request for up to 50 meetings)
            if meetings_to_save:
                result = save_to_back4app_batch(meetings_to_save)
                saved_count += result["saved"]
                error_count += result["errors"]
                scraping_state["total_saved"] += result["saved"]

                # Update stats for saved meetings
                for meeting in meetings_to_save[:result["saved"]]:
                    state = meeting.get("state", "Unknown")
                    scraping_state["meetings_by_state"][state] = scraping_state["meetings_by_state"].get(state, 0) + 1
                    scraping_state["meetings_by_type"]["AA"] = scraping_state["meetings_by_type"].get("AA", 0) + 1

                    # Keep recent meetings (last 20)
                    scraping_state["recent_meetings"].insert(0, meeting)
                    scraping_state["recent_meetings"] = scraping_state["recent_meetings"][:20]

                add_log(f"Batch {batch_num}: saved {result['saved']}, {len(batch_meetings) - len(meetings_to_save)} duplicates", "info")
            else:
                add_log(f"Batch {batch_num}: all {len(batch_meetings)} were duplicates", "info")

        scraping_state["total_found"] += total_in_feed
        scraping_state["current_meeting"] = None
        log_msg = f"Completed {feed_name}: saved {saved_count}/{total_in_feed} meetings"
        if duplicate_count > 0:
            log_msg += f" ({duplicate_count} duplicates skipped)"
        add_log(log_msg, "success")
        return saved_count

    except requests.exceptions.Timeout:
        error_msg = f"{feed_name}: Request timed out"
        scraping_state["errors"].append(error_msg)
        add_log(error_msg, "error")
        return 0
    except requests.exceptions.RequestException as e:
        error_msg = f"{feed_name}: {str(e)}"
        scraping_state["errors"].append(error_msg)
        add_log(error_msg, "error")
        return 0
    except Exception as e:
        error_msg = f"{feed_name}: {str(e)}"
        scraping_state["errors"].append(error_msg)
        add_log(error_msg, "error")
        return 0

@app.route('/api/config', methods=['GET'])
def get_config():
    """Check if back4app is configured"""
    return jsonify({
        "configured": bool(BACK4APP_APP_ID and BACK4APP_REST_KEY),
        "hasAppId": bool(BACK4APP_APP_ID),
        "hasRestKey": bool(BACK4APP_REST_KEY)
    })

@app.route('/api/config', methods=['POST'])
def set_config():
    """Set back4app configuration (overrides env vars)"""
    global BACK4APP_APP_ID, BACK4APP_REST_KEY

    data = request.json
    if data.get('appId'):
        BACK4APP_APP_ID = data.get('appId')
    if data.get('restKey'):
        BACK4APP_REST_KEY = data.get('restKey')

    return jsonify({"success": True, "message": "Configuration saved"})

@app.route('/api/test-save', methods=['POST'])
def test_save():
    """Test saving a single meeting to Back4app - for debugging"""
    # Check config
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({
            "success": False,
            "error": "Back4app not configured",
            "hasAppId": bool(BACK4APP_APP_ID),
            "hasRestKey": bool(BACK4APP_REST_KEY)
        }), 400

    # Fetch one meeting from the first feed
    feed_name = list(AA_FEEDS.keys())[0]
    feed_config = AA_FEEDS[feed_name]

    try:
        response = requests.get(feed_config["url"], headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
        raw_meetings = response.json()

        if not raw_meetings or not isinstance(raw_meetings, list):
            return jsonify({"success": False, "error": "No meetings found in feed"}), 400

        # Get the first meeting
        raw_meeting = raw_meetings[0]
        meeting = normalize_meeting(raw_meeting, feed_name, feed_config["state"])

        # Try to save to Back4app
        headers = {
            "X-Parse-Application-Id": BACK4APP_APP_ID,
            "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
            "Content-Type": "application/json"
        }

        save_response = requests.post(BACK4APP_URL, headers=headers, json=meeting, timeout=10)

        return jsonify({
            "success": save_response.status_code == 201,
            "statusCode": save_response.status_code,
            "response": save_response.text[:500] if save_response.text else None,
            "meetingName": meeting.get("name"),
            "meetingAddress": meeting.get("formattedAddress"),
            "meetingData": meeting
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/test-batch', methods=['POST'])
def test_batch_save():
    """Test batch saving to Back4app - for debugging"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({
            "success": False,
            "error": "Back4app not configured"
        }), 400

    # Fetch a few meetings from the first feed
    feed_name = list(AA_FEEDS.keys())[0]
    feed_config = AA_FEEDS[feed_name]

    try:
        response = requests.get(feed_config["url"], headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
        raw_meetings = response.json()

        if not raw_meetings or not isinstance(raw_meetings, list):
            return jsonify({"success": False, "error": "No meetings found in feed"}), 400

        # Normalize 5 meetings for testing
        test_meetings = []
        for i, raw in enumerate(raw_meetings[:5]):
            meeting = normalize_meeting(raw, feed_name, feed_config["state"], skip_geocoding=True)
            # Add test suffix to make unique
            meeting["uniqueKey"] = f"TEST_{i}_{meeting.get('uniqueKey', '')}"
            meeting["name"] = f"[TEST] {meeting.get('name', '')}"
            test_meetings.append(meeting)

        # Check what keys we're sending
        keys_info = [m.get("uniqueKey", "NO_KEY")[:50] for m in test_meetings]

        # Try batch save
        result = save_to_back4app_batch(test_meetings)

        return jsonify({
            "success": result["saved"] > 0,
            "result": result,
            "meetings_sent": len(test_meetings),
            "sample_keys": keys_info,
            "first_meeting_fields": list(test_meetings[0].keys()) if test_meetings else []
        })

    except Exception as e:
        import traceback
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500

@app.route('/api/diagnose', methods=['GET'])
def diagnose_saves():
    """Diagnose why meetings might not be saving"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({"error": "Back4app not configured"}), 400

    results = {
        "config": {
            "hasAppId": bool(BACK4APP_APP_ID),
            "hasRestKey": bool(BACK4APP_REST_KEY),
            "appIdPrefix": BACK4APP_APP_ID[:8] + "..." if BACK4APP_APP_ID else None
        },
        "feeds": {},
        "duplicateCheck": {}
    }

    # Test each feed
    for feed_name, feed_config in AA_FEEDS.items():
        try:
            response = requests.get(feed_config["url"], headers=REQUEST_HEADERS, timeout=30)
            response.raise_for_status()
            raw_meetings = response.json()

            if isinstance(raw_meetings, list):
                # Normalize first 10 meetings and check for duplicates
                sample_keys = []
                for raw in raw_meetings[:10]:
                    meeting = normalize_meeting(raw, feed_name, feed_config["state"], skip_geocoding=True)
                    sample_keys.append(meeting.get("uniqueKey"))

                # Check how many are duplicates
                existing = check_duplicates_batch(sample_keys)

                results["feeds"][feed_name] = {
                    "status": "ok",
                    "total_meetings": len(raw_meetings),
                    "sample_size": len(sample_keys),
                    "duplicates_in_sample": len(existing),
                    "sample_keys": sample_keys[:3]  # Show first 3 keys
                }
            else:
                results["feeds"][feed_name] = {"status": "error", "error": "Not a list"}
        except Exception as e:
            results["feeds"][feed_name] = {"status": "error", "error": str(e)}

    # Get total count in Back4app
    try:
        headers = {
            "X-Parse-Application-Id": BACK4APP_APP_ID,
            "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        }
        count_url = f"{BACK4APP_URL}?count=1&limit=0"
        count_response = requests.get(count_url, headers=headers, timeout=10)
        if count_response.status_code == 200:
            results["totalMeetingsInDb"] = count_response.json().get("count", 0)
        else:
            results["totalMeetingsInDb"] = f"Error: {count_response.status_code}"
    except Exception as e:
        results["totalMeetingsInDb"] = f"Error: {e}"

    return jsonify(results)

@app.route('/api/test-single-save', methods=['POST'])
def test_single_save():
    """Test saving a SINGLE meeting directly (no batch) - for debugging"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({"error": "Back4app not configured"}), 400

    feed_name = list(AA_FEEDS.keys())[0]
    feed_config = AA_FEEDS[feed_name]

    try:
        # Fetch one meeting
        response = requests.get(feed_config["url"], headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
        raw_meetings = response.json()

        if not raw_meetings:
            return jsonify({"error": "No meetings in feed"}), 400

        # Normalize it
        meeting = normalize_meeting(raw_meetings[0], feed_name, feed_config["state"], skip_geocoding=True)
        # Make it unique so it won't be a duplicate
        meeting["uniqueKey"] = f"SINGLE_TEST_{datetime.now().isoformat()}"
        meeting["name"] = f"[SINGLE TEST] {meeting.get('name', '')}"

        # Try direct POST (not batch)
        headers = {
            "X-Parse-Application-Id": BACK4APP_APP_ID,
            "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
            "Content-Type": "application/json"
        }

        save_response = requests.post(BACK4APP_URL, headers=headers, json=meeting, timeout=10)

        return jsonify({
            "success": save_response.status_code == 201,
            "status_code": save_response.status_code,
            "response_text": save_response.text[:500] if save_response.text else None,
            "meeting_name": meeting.get("name"),
            "meeting_keys_count": len(meeting.keys())
        })

    except Exception as e:
        import traceback
        return jsonify({
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500

def save_scrape_history(status="completed", feeds_processed=0):
    """Save scrape run to history (both in-memory and Back4app)"""
    global current_scrape_object_id

    history_entry = {
        "id": scraping_state.get("scrape_id") or generate_object_id(),
        "started_at": scraping_state["started_at"],
        "completed_at": datetime.now().isoformat() if status != "in_progress" else None,
        "last_updated": datetime.now().isoformat(),
        "total_found": scraping_state["total_found"],
        "total_saved": scraping_state["total_saved"],
        "feeds_processed": feeds_processed,
        "meetings_by_state": dict(scraping_state["meetings_by_state"]),
        "errors": list(scraping_state["errors"]),
        "status": status
    }

    # Update or insert in-memory history
    existing_idx = next((i for i, h in enumerate(scrape_history) if h.get("id") == history_entry["id"]), None)
    if existing_idx is not None:
        scrape_history[existing_idx] = history_entry
    else:
        scrape_history.insert(0, history_entry)
        while len(scrape_history) > 50:
            scrape_history.pop()

    # Also persist to Back4app for durability across restarts
    if BACK4APP_APP_ID and BACK4APP_REST_KEY:
        try:
            headers = {
                "X-Parse-Application-Id": BACK4APP_APP_ID,
                "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
                "Content-Type": "application/json"
            }

            # If we have an existing Back4app objectId, update it; otherwise create new
            if current_scrape_object_id and status == "in_progress":
                # Update existing record
                history_url = f"https://parseapi.back4app.com/classes/ScrapeHistory/{current_scrape_object_id}"
                response = requests.put(history_url, headers=headers, json=history_entry, timeout=10)
            else:
                # Create new record
                history_url = "https://parseapi.back4app.com/classes/ScrapeHistory"
                response = requests.post(history_url, headers=headers, json=history_entry, timeout=10)
                if response.status_code == 201:
                    # Store the objectId for future updates
                    result = response.json()
                    current_scrape_object_id = result.get("objectId")

            if response.status_code in [200, 201]:
                if status != "in_progress":
                    add_log(f"Scrape history saved to Back4app", "info")
            else:
                error_detail = response.text[:200] if response.text else "No details"
                add_log(f"Failed to save history to Back4app: {response.status_code} - {error_detail}", "warning")
        except Exception as e:
            add_log(f"Error saving history to Back4app: {e}", "warning")

    return history_entry

def run_scraper_in_background(start_from_feed=0):
    """Background thread function to process all feeds"""
    feed_names = list(AA_FEEDS.keys())
    feeds_completed = start_from_feed  # Start from resume point if resuming

    for idx, feed_name in enumerate(feed_names):
        # Skip feeds that were already processed (when resuming)
        if idx < start_from_feed:
            continue

        if not scraping_state["is_running"]:
            add_log("Scraping stopped by user", "warning")
            # Save history even when stopped
            save_scrape_history(status="stopped", feeds_processed=feeds_completed)
            return

        feed_config = AA_FEEDS[feed_name]
        fetch_and_process_feed(feed_name, feed_config, idx)
        feeds_completed += 1

        # Save periodic checkpoint after each feed completes (in case of crash/restart)
        save_scrape_history(status="in_progress", feeds_processed=feeds_completed)

    # Mark as complete
    scraping_state["is_running"] = False
    scraping_state["current_source"] = ""
    scraping_state["current_meeting"] = None
    scraping_state["progress_message"] = "Completed!"
    add_log(f"All feeds completed! Total: {scraping_state['total_found']} found, {scraping_state['total_saved']} saved", "success")

    # Save to scrape history
    save_scrape_history(status="completed", feeds_processed=feeds_completed)

@app.route('/api/start', methods=['POST'])
def start_scraping():
    """Start the scraping process - runs in background thread for real-time updates"""
    global current_scrape_object_id
    from datetime import datetime

    # Check if we're resuming an existing scrape
    data = request.json or {}

    # Allow force start to override stuck state
    force = data.get('force', False)

    if scraping_state["is_running"] and not force:
        return jsonify({"success": False, "message": "Scraper already running"}), 400

    # If forcing, reset the state first
    if force and scraping_state["is_running"]:
        scraping_state["is_running"] = False
        add_log("Force starting - previous scrape state cleared", "warning")
    resume_scrape_id = data.get('resume_scrape_id')
    resume_feeds_processed = data.get('resume_feeds_processed', 0)

    # Check if we need to abandon an old scrape before starting new
    abandon_scrape_id = data.get('abandon_scrape_id')
    if abandon_scrape_id and BACK4APP_APP_ID and BACK4APP_REST_KEY:
        try:
            headers = {
                "X-Parse-Application-Id": BACK4APP_APP_ID,
                "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
                "Content-Type": "application/json"
            }
            # Mark the old scrape as abandoned
            abandon_url = f"https://parseapi.back4app.com/classes/ScrapeHistory/{abandon_scrape_id}"
            abandon_data = {
                "status": "abandoned",
                "completed_at": datetime.now().isoformat()
            }
            requests.put(abandon_url, headers=headers, json=abandon_data, timeout=10)
            add_log(f"Previous scrape marked as abandoned", "info")
        except Exception as e:
            print(f"Error abandoning old scrape: {e}")

    # Reset state
    scraping_state["is_running"] = True
    scraping_state["total_found"] = data.get('resume_total_found', 0)
    scraping_state["total_saved"] = data.get('resume_total_saved', 0)
    scraping_state["errors"] = []
    scraping_state["meetings_by_state"] = data.get('resume_meetings_by_state', {})
    scraping_state["meetings_by_type"] = {"AA": 0, "NA": 0, "Al-Anon": 0, "Other": 0}
    scraping_state["recent_meetings"] = []
    scraping_state["progress_message"] = "Starting..."
    scraping_state["current_feed_index"] = resume_feeds_processed
    scraping_state["current_feed_progress"] = 0
    scraping_state["current_feed_total"] = 0
    scraping_state["current_meeting"] = None
    scraping_state["activity_log"] = []
    scraping_state["started_at"] = data.get('resume_started_at') or datetime.now().isoformat()
    scraping_state["scrape_id"] = resume_scrape_id or generate_object_id()  # Use existing or new ID

    if resume_scrape_id:
        current_scrape_object_id = data.get('resume_object_id')
        add_log(f"Resuming scrape - starting from feed {resume_feeds_processed + 1} of {len(AA_FEEDS)}", "info")
    else:
        current_scrape_object_id = None  # Reset for new scrape
        add_log(f"Scraping started - {len(AA_FEEDS)} feeds to process", "info")

        # Create initial scrape history record in Back4app immediately
        save_scrape_history(status="in_progress", feeds_processed=0)

    # Start background thread with resume offset
    thread = threading.Thread(target=run_scraper_in_background, args=(resume_feeds_processed,), daemon=True)
    thread.start()

    return jsonify({"success": True, "message": "Scraper started", "scrape_id": scraping_state["scrape_id"]})

@app.route('/api/scrape-next', methods=['POST'])
def scrape_next_feed():
    """Scrape the next feed in the queue - called by frontend to process one feed at a time"""
    if not scraping_state["is_running"]:
        return jsonify({"success": False, "message": "Scraper not running", "done": True})

    data = request.json or {}
    feed_index = data.get('feed_index', 0)

    feed_names = list(AA_FEEDS.keys())

    if feed_index >= len(feed_names):
        # All feeds processed
        scraping_state["is_running"] = False
        scraping_state["current_source"] = ""
        scraping_state["progress_message"] = "Completed!"
        scraping_state["current_feed_progress"] = 0
        scraping_state["current_feed_total"] = 0
        add_log(f"All feeds completed! Total: {scraping_state['total_found']} found, {scraping_state['total_saved']} saved", "success")

        # Save to scrape history
        history_entry = {
            "id": generate_object_id(),
            "started_at": scraping_state["started_at"],
            "completed_at": datetime.now().isoformat(),
            "total_found": scraping_state["total_found"],
            "total_saved": scraping_state["total_saved"],
            "feeds_processed": len(feed_names),
            "meetings_by_state": dict(scraping_state["meetings_by_state"]),
            "errors": list(scraping_state["errors"]),
            "status": "completed"
        }
        scrape_history.insert(0, history_entry)
        # Keep only last 50 entries
        while len(scrape_history) > 50:
            scrape_history.pop()

        return jsonify({
            "success": True,
            "done": True,
            "total_found": scraping_state["total_found"],
            "total_saved": scraping_state["total_saved"]
        })

    feed_name = feed_names[feed_index]
    feed_config = AA_FEEDS[feed_name]

    saved = fetch_and_process_feed(feed_name, feed_config, feed_index)

    return jsonify({
        "success": True,
        "done": False,
        "feed_index": feed_index + 1,
        "feed_name": feed_name,
        "saved": saved,
        "total_found": scraping_state["total_found"],
        "total_saved": scraping_state["total_saved"],
        "stats": {
            "by_state": scraping_state["meetings_by_state"],
            "by_type": scraping_state["meetings_by_type"]
        }
    })

@app.route('/api/stop', methods=['POST'])
def stop_scraping():
    """Stop the scraping process"""
    scraping_state["is_running"] = False
    scraping_state["progress_message"] = "Stopped"
    add_log("Scraping stopped by user", "warning")
    return jsonify({"success": True, "message": "Scraper stopped"})

@app.route('/api/reset', methods=['POST'])
def reset_scraper():
    """Force reset the scraper state - use if scraper gets stuck"""
    scraping_state["is_running"] = False
    scraping_state["total_found"] = 0
    scraping_state["total_saved"] = 0
    scraping_state["current_source"] = ""
    scraping_state["errors"] = []
    scraping_state["meetings_by_state"] = {}
    scraping_state["meetings_by_type"] = {"AA": 0, "NA": 0, "Al-Anon": 0, "Other": 0}
    scraping_state["recent_meetings"] = []
    scraping_state["progress_message"] = ""
    scraping_state["current_feed_index"] = 0
    scraping_state["current_feed_progress"] = 0
    scraping_state["current_feed_total"] = 0
    scraping_state["current_meeting"] = None
    scraping_state["activity_log"] = []
    return jsonify({"success": True, "message": "Scraper state reset"})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current scraping status"""
    return jsonify(scraping_state)

@app.route('/api/feeds', methods=['GET'])
def get_feeds():
    """Get list of configured feeds"""
    return jsonify({
        "feeds": [
            {"name": name, "state": config["state"]}
            for name, config in AA_FEEDS.items()
        ]
    })

@app.route('/api/version', methods=['GET'])
def get_version():
    """Get build version for deployment detection"""
    return jsonify({
        "version": BUILD_VERSION,
        "started_at": BUILD_VERSION
    })

@app.route('/api/history', methods=['GET'])
def get_history():
    """Get scrape history - from memory and Back4app"""
    # If we have in-memory history, return it
    if scrape_history:
        return jsonify({"history": scrape_history})

    # Otherwise try to fetch from Back4app
    if BACK4APP_APP_ID and BACK4APP_REST_KEY:
        try:
            headers = {
                "X-Parse-Application-Id": BACK4APP_APP_ID,
                "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
            }
            history_url = "https://parseapi.back4app.com/classes/ScrapeHistory?order=-createdAt&limit=50"
            response = requests.get(history_url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                # Transform Back4app format to our expected format
                history = []
                for item in results:
                    history.append({
                        "id": item.get("id") or item.get("objectId"),
                        "started_at": item.get("started_at"),
                        "completed_at": item.get("completed_at"),
                        "total_found": item.get("total_found", 0),
                        "total_saved": item.get("total_saved", 0),
                        "feeds_processed": item.get("feeds_processed", 0),
                        "meetings_by_state": item.get("meetings_by_state", {}),
                        "errors": item.get("errors", []),
                        "status": item.get("status", "completed")
                    })
                return jsonify({"history": history})
        except Exception as e:
            print(f"Error fetching history from Back4app: {e}")

    return jsonify({"history": []})

@app.route('/api/check-unfinished', methods=['GET'])
def check_unfinished_scrape():
    """Check if there's an unfinished scrape in Back4app that can be resumed"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({"hasUnfinished": False})

    try:
        headers = {
            "X-Parse-Application-Id": BACK4APP_APP_ID,
            "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        }

        # Look for in_progress scrapes
        import urllib.parse
        where = json.dumps({"status": "in_progress"})
        history_url = f"https://parseapi.back4app.com/classes/ScrapeHistory?where={urllib.parse.quote(where)}&order=-createdAt&limit=1"

        response = requests.get(history_url, headers=headers, timeout=10)

        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])

            if results:
                unfinished = results[0]
                return jsonify({
                    "hasUnfinished": True,
                    "scrape": {
                        "objectId": unfinished.get("objectId"),
                        "id": unfinished.get("id"),
                        "started_at": unfinished.get("started_at"),
                        "last_updated": unfinished.get("last_updated"),
                        "total_found": unfinished.get("total_found", 0),
                        "total_saved": unfinished.get("total_saved", 0),
                        "feeds_processed": unfinished.get("feeds_processed", 0),
                        "total_feeds": len(AA_FEEDS),
                        "meetings_by_state": unfinished.get("meetings_by_state", {}),
                    }
                })

        return jsonify({"hasUnfinished": False})

    except Exception as e:
        print(f"Error checking for unfinished scrapes: {e}")
        return jsonify({"hasUnfinished": False, "error": str(e)})

@app.route('/api/coverage', methods=['GET'])
def get_coverage():
    """Get coverage analysis - meetings per capita by state"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({"error": "Back4app not configured"}), 400

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
    }

    try:
        # Get meeting counts by state from Back4app
        # Using aggregation pipeline to count by state
        import urllib.parse

        # First, get total count
        count_url = f"{BACK4APP_URL}?count=1&limit=0"
        count_response = requests.get(count_url, headers=headers, timeout=10)
        total_meetings = 0
        if count_response.status_code == 200:
            total_meetings = count_response.json().get("count", 0)

        # Get meetings grouped by state (we'll fetch a sample and count)
        # Parse doesn't support GROUP BY directly, so we'll use a different approach
        # Fetch all unique states and their counts
        meetings_by_state = {}

        # Query each state's count individually (more reliable)
        for state_code in US_STATE_POPULATION.keys():
            where = json.dumps({"state": state_code})
            url = f"{BACK4APP_URL}?where={urllib.parse.quote(where)}&count=1&limit=0"
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                count = response.json().get("count", 0)
                if count > 0:
                    meetings_by_state[state_code] = count

        # Calculate coverage metrics
        coverage_data = []
        total_us_population = sum(US_STATE_POPULATION.values())  # in thousands

        for state_code, population in US_STATE_POPULATION.items():
            meetings = meetings_by_state.get(state_code, 0)
            # Coverage = meetings per 100k population
            coverage_per_100k = (meetings / population * 100) if population > 0 else 0

            coverage_data.append({
                "state": state_code,
                "stateName": US_STATE_NAMES.get(state_code, state_code),
                "population": population * 1000,  # Convert to actual population
                "meetings": meetings,
                "coveragePer100k": round(coverage_per_100k, 2),
                "hasFeed": any(feed["state"] == state_code for feed in AA_FEEDS.values()),
            })

        # Sort by coverage (lowest first to show gaps)
        coverage_data.sort(key=lambda x: x["coveragePer100k"])

        # Calculate summary stats
        states_with_meetings = [s for s in coverage_data if s["meetings"] > 0]
        states_without_meetings = [s for s in coverage_data if s["meetings"] == 0]

        avg_coverage = 0
        if states_with_meetings:
            avg_coverage = sum(s["coveragePer100k"] for s in states_with_meetings) / len(states_with_meetings)

        # Identify priority states (high population, low/no coverage)
        priority_states = [
            s for s in coverage_data
            if s["population"] > 2000000 and s["coveragePer100k"] < avg_coverage
        ]

        return jsonify({
            "summary": {
                "totalMeetings": total_meetings,
                "statesWithMeetings": len(states_with_meetings),
                "statesWithoutMeetings": len(states_without_meetings),
                "averageCoveragePer100k": round(avg_coverage, 2),
                "totalUSPopulation": total_us_population * 1000,
            },
            "coverage": coverage_data,
            "priorityStates": priority_states[:10],  # Top 10 priority states
            "statesWithoutCoverage": states_without_meetings,
        })

    except Exception as e:
        print(f"Error getting coverage: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/meetings', methods=['GET'])
def get_meetings():
    """Get all meetings from Back4app for public viewing"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        # Return recent meetings from memory if no Back4app configured
        return jsonify({
            "meetings": scraping_state.get("recent_meetings", []),
            "total": len(scraping_state.get("recent_meetings", []))
        })

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
    }

    try:
        # Get query parameters for filtering
        limit = request.args.get('limit', 1000, type=int)
        skip = request.args.get('skip', 0, type=int)
        state = request.args.get('state', '')
        day = request.args.get('day', '', type=str)
        search = request.args.get('search', '')
        meeting_type = request.args.get('type', '')

        # Build where clause
        where = {}
        if state:
            where['state'] = state
        if day and day.isdigit():
            where['day'] = int(day)
        if meeting_type:
            where['meetingType'] = meeting_type
        if search:
            # Search in name field (case-insensitive regex)
            where['name'] = {"$regex": search, "$options": "i"}

        import urllib.parse
        params = {
            'limit': min(limit, 1000),
            'skip': skip,
            'order': '-updatedAt'
        }
        if where:
            params['where'] = str(where).replace("'", '"')

        query_string = urllib.parse.urlencode(params)
        url = f"{BACK4APP_URL}?{query_string}"

        response = requests.get(url, headers=headers, timeout=15)

        if response.status_code == 200:
            data = response.json()
            return jsonify({
                "meetings": data.get("results", []),
                "total": len(data.get("results", []))
            })
        else:
            return jsonify({"meetings": [], "total": 0, "error": "Failed to fetch meetings"}), 500

    except Exception as e:
        print(f"Error fetching meetings: {e}")
        return jsonify({"meetings": [], "total": 0, "error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
