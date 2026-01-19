import os
import time
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
    "activity_log": [],
    "started_at": None,
}

# Scrape history - stores last 50 scrape runs
scrape_history = []

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

def normalize_meeting(raw_meeting, source_name, default_state):
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
    if (latitude is None or longitude is None) and formatted_address:
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

    return {
        "objectId": generate_object_id(),
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
        "foundedDate": raw_meeting.get('founded', ''),
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
        "contactEmail": raw_meeting.get('contact_1_email', ''),
        "contactPhone": raw_meeting.get('contact_1_phone', ''),

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
        "updatedAt": raw_meeting.get('updated', ''),
        "scrapedAt": datetime.now().isoformat(),
    }

def save_to_back4app(meeting_data):
    """Save a meeting to back4app"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        add_log("Back4app not configured - skipping save", "warning")
        return False  # Return False so it doesn't count as saved

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

def fetch_and_process_feed(feed_name, feed_config, feed_index):
    """Fetch meetings from a single feed and process them"""
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
        scraping_state["progress_message"] = f"Processing {total_in_feed} meetings from {feed_name}..."
        add_log(f"Found {total_in_feed} meetings in {feed_name}", "info")

        saved_count = 0
        for idx, raw in enumerate(raw_meetings):
            if not scraping_state["is_running"]:
                add_log("Scraping stopped by user", "warning")
                break

            scraping_state["current_feed_progress"] = idx + 1

            try:
                meeting = normalize_meeting(raw, feed_name, default_state)

                if save_to_back4app(meeting):
                    saved_count += 1
                    scraping_state["total_saved"] += 1

                    # Update stats
                    state = meeting.get("state", "Unknown")
                    scraping_state["meetings_by_state"][state] = scraping_state["meetings_by_state"].get(state, 0) + 1
                    scraping_state["meetings_by_type"]["AA"] = scraping_state["meetings_by_type"].get("AA", 0) + 1

                    # Keep recent meetings (last 20)
                    scraping_state["recent_meetings"].insert(0, meeting)
                    scraping_state["recent_meetings"] = scraping_state["recent_meetings"][:20]

            except Exception as e:
                continue

        scraping_state["total_found"] += total_in_feed
        add_log(f"Completed {feed_name}: saved {saved_count}/{total_in_feed} meetings", "success")
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

@app.route('/api/start', methods=['POST'])
def start_scraping():
    """Start the scraping process - runs synchronously one feed at a time"""
    from datetime import datetime

    if scraping_state["is_running"]:
        return jsonify({"success": False, "message": "Scraper already running"}), 400

    # Reset state
    scraping_state["is_running"] = True
    scraping_state["total_found"] = 0
    scraping_state["total_saved"] = 0
    scraping_state["errors"] = []
    scraping_state["meetings_by_state"] = {}
    scraping_state["meetings_by_type"] = {"AA": 0, "NA": 0, "Al-Anon": 0, "Other": 0}
    scraping_state["recent_meetings"] = []
    scraping_state["progress_message"] = "Starting..."
    scraping_state["current_feed_index"] = 0
    scraping_state["current_feed_progress"] = 0
    scraping_state["current_feed_total"] = 0
    scraping_state["activity_log"] = []
    scraping_state["started_at"] = datetime.now().isoformat()

    add_log(f"Scraping started - {len(AA_FEEDS)} feeds to process", "info")

    return jsonify({"success": True, "message": "Scraper started"})

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
    """Get scrape history"""
    return jsonify({
        "history": scrape_history
    })

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
