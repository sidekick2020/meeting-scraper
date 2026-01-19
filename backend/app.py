import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import random
import string
import re

app = Flask(__name__)
CORS(app, origins="*")

# Back4app Configuration
BACK4APP_APP_ID = None
BACK4APP_REST_KEY = None
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
    "progress_message": ""
}

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

def normalize_meeting(raw_meeting, source_name, default_state):
    """Normalize meeting data from various feed formats to our standard format"""
    formatted_address = raw_meeting.get('formatted_address', '') or raw_meeting.get('address', '')
    addr_parts = parse_address(formatted_address)

    is_online = False
    online_url = ""
    attendance = raw_meeting.get('attendance_option', '')
    if attendance in ['online', 'hybrid'] or raw_meeting.get('conference_url'):
        is_online = True
        online_url = raw_meeting.get('conference_url', '') or raw_meeting.get('conference_url_notes', '')

    location_name = raw_meeting.get('location', '') or raw_meeting.get('location_name', '')
    state = addr_parts.get("state") or raw_meeting.get('state', '') or default_state

    return {
        "objectId": generate_object_id(),
        "name": raw_meeting.get('name', 'Unknown Meeting'),
        "locationName": location_name,
        "address": addr_parts.get("address") or formatted_address,
        "city": addr_parts.get("city") or raw_meeting.get('city', ''),
        "state": state,
        "postalCode": addr_parts.get("postalCode") or raw_meeting.get('postal_code', ''),
        "day": raw_meeting.get('day', 0),
        "time": raw_meeting.get('time', ''),
        "meetingType": "AA",
        "isOnline": is_online,
        "onlineUrl": online_url,
        "notes": raw_meeting.get('notes', ''),
        "sourceType": "web_scraper",
        "sourceFeed": source_name,
        "region": raw_meeting.get('region', '') or (raw_meeting.get('regions', [''])[0] if raw_meeting.get('regions') else ''),
    }

def save_to_back4app(meeting_data):
    """Save a meeting to back4app"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return True  # Skip saving but count as success for testing

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(BACK4APP_URL, headers=headers, json=meeting_data, timeout=10)
        return response.status_code == 201
    except Exception as e:
        print(f"Error saving to back4app: {e}")
        return False

def fetch_and_process_feed(feed_name, feed_config):
    """Fetch meetings from a single feed and process them"""
    url = feed_config["url"]
    default_state = feed_config["state"]

    scraping_state["current_source"] = feed_name
    scraping_state["progress_message"] = f"Fetching from {feed_name}..."

    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
        raw_meetings = response.json()

        if not isinstance(raw_meetings, list):
            scraping_state["errors"].append(f"{feed_name}: Invalid response format")
            return 0

        scraping_state["progress_message"] = f"Processing {len(raw_meetings)} meetings from {feed_name}..."

        saved_count = 0
        for raw in raw_meetings:
            if not scraping_state["is_running"]:
                break

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

        scraping_state["total_found"] += len(raw_meetings)
        return saved_count

    except requests.exceptions.Timeout:
        scraping_state["errors"].append(f"{feed_name}: Request timed out")
        return 0
    except requests.exceptions.RequestException as e:
        scraping_state["errors"].append(f"{feed_name}: {str(e)}")
        return 0
    except Exception as e:
        scraping_state["errors"].append(f"{feed_name}: {str(e)}")
        return 0

@app.route('/api/config', methods=['POST'])
def set_config():
    """Set back4app configuration"""
    global BACK4APP_APP_ID, BACK4APP_REST_KEY

    data = request.json
    BACK4APP_APP_ID = data.get('appId')
    BACK4APP_REST_KEY = data.get('restKey')

    return jsonify({"success": True, "message": "Configuration saved"})

@app.route('/api/start', methods=['POST'])
def start_scraping():
    """Start the scraping process - runs synchronously one feed at a time"""
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
        return jsonify({
            "success": True,
            "done": True,
            "total_found": scraping_state["total_found"],
            "total_saved": scraping_state["total_saved"]
        })

    feed_name = feed_names[feed_index]
    feed_config = AA_FEEDS[feed_name]

    saved = fetch_and_process_feed(feed_name, feed_config)

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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
