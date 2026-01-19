from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import requests
from bs4 import BeautifulSoup
import threading
import time
import random
import string
from datetime import datetime
import json

app = Flask(__name__)
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")

# Back4app Configuration
BACK4APP_APP_ID = "YOUR_APP_ID"  # User needs to fill this
BACK4APP_REST_KEY = "YOUR_REST_KEY"  # User needs to fill this
BACK4APP_URL = "https://parseapi.back4app.com/classes/Meeting"

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

def generate_object_id():
    """Generate a 10-character alphanumeric objectId"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

def get_timestamp():
    """Get current timestamp"""
    return datetime.now().strftime('%a %b %d %Y %H:%M:%S GMT%z (Central Standard Time)')

def save_to_back4app(meeting_data):
    """Save a meeting to back4app"""
    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        "Content-Type": "application/json"
    }
    
    # Convert meeting data to back4app format
    payload = {
        "objectId": meeting_data.get("objectId"),
        "state": meeting_data.get("state"),
        "sourceType": meeting_data.get("sourceType", "web_scraper"),
        "time": meeting_data.get("time"),
        "address": meeting_data.get("address"),
        "name": meeting_data.get("name"),
        "meetingType": meeting_data.get("meetingType"),
        "locationName": meeting_data.get("locationName"),
        "isOnline": meeting_data.get("isOnline", False),
        "searchLocation": meeting_data.get("searchLocation"),
        "day": meeting_data.get("day"),
        "city": meeting_data.get("city"),
        "notes": meeting_data.get("notes", ""),
        "postalCode": meeting_data.get("postalCode"),
        "onlineUrl": meeting_data.get("onlineUrl")
    }
    
    try:
        response = requests.post(BACK4APP_URL, headers=headers, json=payload)
        return response.status_code == 201
    except Exception as e:
        print(f"Error saving to back4app: {e}")
        return False

def scrape_ny_aa_meetings():
    """Scrape AA meetings from NY Intergroup"""
    try:
        url = "https://www.nyintergroup.org/meetings/?type=active"
        response = requests.get(url, timeout=30)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # This is a simplified example - actual parsing would be more complex
        meetings = []
        
        # Update: You'll need to parse the actual HTML structure
        # For now, returning sample structure
        
        return meetings
    except Exception as e:
        scraping_state["errors"].append(f"NY AA error: {str(e)}")
        return []

def scrape_aa_meetings_by_state(state_code, state_name):
    """Scrape AA meetings for a specific state"""
    meetings = []
    
    try:
        # Different states have different AA websites
        # This would need to be customized per state
        socketio.emit('progress_update', {
            'message': f'Scraping AA meetings in {state_name}...',
            'source': f'AA - {state_name}'
        })
        
        # Add actual scraping logic here based on state
        
    except Exception as e:
        scraping_state["errors"].append(f"AA {state_name} error: {str(e)}")
    
    return meetings

def scrape_na_meetings_by_region(region_name, region_url):
    """Scrape NA meetings for a specific region"""
    meetings = []
    
    try:
        socketio.emit('progress_update', {
            'message': f'Scraping NA meetings in {region_name}...',
            'source': f'NA - {region_name}'
        })
        
        # Add actual NA scraping logic here
        
    except Exception as e:
        scraping_state["errors"].append(f"NA {region_name} error: {str(e)}")
    
    return meetings

def process_and_save_meeting(meeting_raw, meeting_type):
    """Process a raw meeting and save to back4app"""
    meeting_data = {
        "objectId": generate_object_id(),
        "updatedAt": get_timestamp(),
        "createdAt": get_timestamp(),
        "locationName": meeting_raw.get("location_name", ""),
        "notes": meeting_raw.get("notes", ""),
        "city": meeting_raw.get("city", ""),
        "name": meeting_raw.get("name", ""),
        "time": meeting_raw.get("time", ""),
        "state": meeting_raw.get("state", ""),
        "address": meeting_raw.get("address", ""),
        "meetingType": meeting_type,
        "sourceType": "web_scraper",
        "day": meeting_raw.get("day", 0),
        "isOnline": meeting_raw.get("is_online", False),
        "searchLocation": meeting_raw.get("search_location", ""),
        "postalCode": meeting_raw.get("postal_code", ""),
        "onlineUrl": meeting_raw.get("online_url", "")
    }
    
    # Save to back4app
    if save_to_back4app(meeting_data):
        scraping_state["total_saved"] += 1
        
        # Update stats
        state = meeting_data.get("state", "Unknown")
        scraping_state["meetings_by_state"][state] = scraping_state["meetings_by_state"].get(state, 0) + 1
        scraping_state["meetings_by_type"][meeting_type] = scraping_state["meetings_by_type"].get(meeting_type, 0) + 1
        
        # Emit progress update
        socketio.emit('meeting_saved', {
            'total_saved': scraping_state["total_saved"],
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
    scraping_state["is_running"] = True
    scraping_state["total_found"] = 0
    scraping_state["total_saved"] = 0
    scraping_state["errors"] = []
    
    socketio.emit('scraper_started', {'message': 'Scraper started!'})
    
    # List of states to scrape
    states = [
        ("NY", "New York"),
        ("CA", "California"),
        ("TX", "Texas"),
        ("FL", "Florida"),
        ("IL", "Illinois"),
        ("PA", "Pennsylvania"),
        ("OH", "Ohio"),
        ("GA", "Georgia"),
        ("NC", "North Carolina"),
        ("MI", "Michigan"),
        # Add more states...
    ]
    
    try:
        # Scrape AA meetings
        for state_code, state_name in states:
            if not scraping_state["is_running"]:
                break
            
            meetings = scrape_aa_meetings_by_state(state_code, state_name)
            
            for meeting in meetings:
                scraping_state["total_found"] += 1
                process_and_save_meeting(meeting, "AA")
                time.sleep(0.1)  # Rate limiting
        
        # Scrape NA meetings
        # Add NA regions here
        
        socketio.emit('scraper_completed', {
            'total_found': scraping_state["total_found"],
            'total_saved': scraping_state["total_saved"],
            'stats': {
                'by_state': scraping_state["meetings_by_state"],
                'by_type': scraping_state["meetings_by_type"]
            }
        })
        
    except Exception as e:
        scraping_state["errors"].append(f"Scraper error: {str(e)}")
        socketio.emit('scraper_error', {'error': str(e)})
    
    finally:
        scraping_state["is_running"] = False

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
    
    # Start scraper in background thread
    thread = threading.Thread(target=run_scraper)
    thread.daemon = True
    thread.start()
    
    return jsonify({"success": True, "message": "Scraper started"})

@app.route('/api/stop', methods=['POST'])
def stop_scraping():
    """Stop the scraping process"""
    scraping_state["is_running"] = False
    return jsonify({"success": True, "message": "Scraper stopping..."})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current scraping status"""
    return jsonify(scraping_state)

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status_update', scraping_state)

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
