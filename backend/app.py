from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import requests
from bs4 import BeautifulSoup
import time
import random
import string
from datetime import datetime
import json
import re
import os

app = Flask(__name__)
CORS(app, origins="*")

# Use gevent async mode for production, threading for local dev
async_mode = 'gevent' if os.environ.get('FLASK_ENV') == 'production' else 'threading'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=async_mode)

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
    "meetings_by_type": {"AA": 0, "NA": 0, "Al-Anon": 0, "Other": 0}
}

# Store recent meetings for display
recent_meetings = []

def generate_object_id():
    """Generate a 10-character alphanumeric objectId"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

def parse_address(formatted_address):
    """Parse a formatted address into components"""
    if not formatted_address:
        return {"city": "", "state": "", "postalCode": "", "address": ""}

    # Try to extract city, state, zip from formatted address
    # Example: "670 E Meadow Dr, Palo Alto, CA 94306, USA"
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
        # State and zip often together like "CA 94306"
        state_zip = parts[2].strip()
        match = re.match(r'([A-Z]{2})\s*(\d{5})?', state_zip)
        if match:
            result["state"] = match.group(1)
            result["postalCode"] = match.group(2) or ""

    return result

def normalize_meeting(raw_meeting, source_name, default_state):
    """Normalize meeting data from various feed formats to our standard format"""

    # Parse address components
    formatted_address = raw_meeting.get('formatted_address', '') or raw_meeting.get('address', '')
    addr_parts = parse_address(formatted_address)

    # Determine if online
    is_online = False
    online_url = ""

    attendance = raw_meeting.get('attendance_option', '')
    if attendance in ['online', 'hybrid'] or raw_meeting.get('conference_url'):
        is_online = True
        online_url = raw_meeting.get('conference_url', '') or raw_meeting.get('conference_url_notes', '')

    # Get location name
    location_name = raw_meeting.get('location', '') or raw_meeting.get('location_name', '')

    # Get region/state - prefer from data, fall back to default
    state = addr_parts.get("state") or raw_meeting.get('state', '') or default_state

    # Build normalized meeting
    normalized = {
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

    return normalized

def save_to_back4app(meeting_data):
    """Save a meeting to back4app"""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        # Skip saving but don't fail - allows testing without Back4app
        return True

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

def fetch_meetings_from_feed(feed_name, feed_config):
    """Fetch meetings from a Meeting Guide API feed"""
    url = feed_config["url"]
    default_state = feed_config["state"]

    try:
        socketio.emit('progress_update', {
            'message': f'Fetching meetings from {feed_name}...',
            'source': feed_name
        })
        scraping_state["current_source"] = feed_name

        response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()

        raw_meetings = response.json()

        if not isinstance(raw_meetings, list):
            scraping_state["errors"].append(f"{feed_name}: Invalid response format")
            return []

        socketio.emit('progress_update', {
            'message': f'Found {len(raw_meetings)} meetings from {feed_name}',
            'source': feed_name
        })

        # Normalize all meetings
        normalized = []
        for raw in raw_meetings:
            try:
                meeting = normalize_meeting(raw, feed_name, default_state)
                normalized.append(meeting)
            except Exception as e:
                # Skip malformed meetings
                continue

        return normalized

    except requests.exceptions.Timeout:
        scraping_state["errors"].append(f"{feed_name}: Request timed out")
        return []
    except requests.exceptions.RequestException as e:
        scraping_state["errors"].append(f"{feed_name}: {str(e)}")
        return []
    except json.JSONDecodeError as e:
        scraping_state["errors"].append(f"{feed_name}: Invalid JSON response")
        return []

def process_and_save_meeting(meeting_data):
    """Process and save a single meeting"""
    global recent_meetings

    # Save to back4app
    saved = save_to_back4app(meeting_data)

    if saved:
        scraping_state["total_saved"] += 1

        # Update stats
        state = meeting_data.get("state", "Unknown")
        meeting_type = meeting_data.get("meetingType", "Other")

        scraping_state["meetings_by_state"][state] = scraping_state["meetings_by_state"].get(state, 0) + 1
        scraping_state["meetings_by_type"][meeting_type] = scraping_state["meetings_by_type"].get(meeting_type, 0) + 1

        # Keep recent meetings for display (last 20)
        recent_meetings.insert(0, meeting_data)
        recent_meetings = recent_meetings[:20]

        # Emit progress update (throttled - every 10 meetings)
        if scraping_state["total_saved"] % 10 == 0:
            socketio.emit('meeting_saved', {
                'total_saved': scraping_state["total_saved"],
                'total_found': scraping_state["total_found"],
                'meeting': meeting_data,
                'stats': {
                    'by_state': scraping_state["meetings_by_state"],
                    'by_type': scraping_state["meetings_by_type"]
                }
            })

        return True
    return False

def run_scraper():
    """Main scraping function that runs in background"""
    global recent_meetings

    scraping_state["is_running"] = True
    scraping_state["total_found"] = 0
    scraping_state["total_saved"] = 0
    scraping_state["errors"] = []
    scraping_state["meetings_by_state"] = {}
    scraping_state["meetings_by_type"] = {"AA": 0, "NA": 0, "Al-Anon": 0, "Other": 0}
    recent_meetings = []

    socketio.emit('scraper_started', {'message': 'Scraper started!'})

    try:
        # Fetch from all AA feeds
        for feed_name, feed_config in AA_FEEDS.items():
            if not scraping_state["is_running"]:
                break

            meetings = fetch_meetings_from_feed(feed_name, feed_config)
            scraping_state["total_found"] += len(meetings)

            socketio.emit('progress_update', {
                'message': f'Processing {len(meetings)} meetings from {feed_name}...',
                'source': feed_name,
                'total_found': scraping_state["total_found"]
            })

            # Process each meeting
            for meeting in meetings:
                if not scraping_state["is_running"]:
                    break

                process_and_save_meeting(meeting)

                # Small delay to avoid overwhelming the system
                time.sleep(0.01)

            # Delay between feeds
            time.sleep(0.5)

        # Final update
        socketio.emit('scraper_completed', {
            'total_found': scraping_state["total_found"],
            'total_saved': scraping_state["total_saved"],
            'stats': {
                'by_state': scraping_state["meetings_by_state"],
                'by_type': scraping_state["meetings_by_type"]
            },
            'errors': scraping_state["errors"]
        })

    except Exception as e:
        scraping_state["errors"].append(f"Scraper error: {str(e)}")
        socketio.emit('scraper_error', {'error': str(e)})

    finally:
        scraping_state["is_running"] = False
        scraping_state["current_source"] = ""

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
    """Start the scraping process"""
    if scraping_state["is_running"]:
        return jsonify({"success": False, "message": "Scraper already running"}), 400

    # Start scraper using socketio's background task (works with both gevent and threading)
    socketio.start_background_task(run_scraper)

    return jsonify({"success": True, "message": "Scraper started"})

@app.route('/api/stop', methods=['POST'])
def stop_scraping():
    """Stop the scraping process"""
    scraping_state["is_running"] = False
    return jsonify({"success": True, "message": "Scraper stopping..."})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current scraping status"""
    return jsonify({
        **scraping_state,
        "recent_meetings": recent_meetings
    })

@app.route('/api/feeds', methods=['GET'])
def get_feeds():
    """Get list of configured feeds"""
    return jsonify({
        "feeds": [
            {"name": name, "state": config["state"]}
            for name, config in AA_FEEDS.items()
        ]
    })

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status_update', {
        **scraping_state,
        "recent_meetings": recent_meetings
    })

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
