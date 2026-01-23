import os
import time
import json
import threading
import math
from flask import Flask, jsonify, request, Response
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


# =============================================================================
# UNIFIED CACHE MANAGER
# Memory-conscious caching with TTL and size limits
# =============================================================================
class CacheManager:
    """
    Thread-safe in-memory cache with TTL and size limits.
    Designed to be memory-conscious while providing fast lookups.
    """

    def __init__(self, name, ttl_seconds=300, max_entries=100):
        """
        Initialize a cache instance.

        Args:
            name: Identifier for this cache (for logging)
            ttl_seconds: Time-to-live for cache entries (default 5 minutes)
            max_entries: Maximum number of entries to store (default 100)
        """
        self.name = name
        self.ttl = ttl_seconds
        self.max_entries = max_entries
        self._cache = {}
        self._lock = threading.Lock()

    def get(self, key):
        """Get a value from cache. Returns None if not found or expired."""
        with self._lock:
            if key not in self._cache:
                return None

            entry = self._cache[key]
            if time.time() > entry['expires_at']:
                # Entry expired, remove it
                del self._cache[key]
                return None

            return entry['value']

    def set(self, key, value):
        """Set a value in cache with TTL."""
        with self._lock:
            # Enforce max entries - remove oldest expired entries first
            if len(self._cache) >= self.max_entries:
                self._evict_expired()

            # If still at max, remove oldest entry
            if len(self._cache) >= self.max_entries:
                oldest_key = min(self._cache.keys(),
                               key=lambda k: self._cache[k]['expires_at'])
                del self._cache[oldest_key]

            self._cache[key] = {
                'value': value,
                'expires_at': time.time() + self.ttl,
                'created_at': time.time()
            }

    def invalidate(self, key=None):
        """Invalidate a specific key or entire cache."""
        with self._lock:
            if key is None:
                self._cache.clear()
            elif key in self._cache:
                del self._cache[key]

    def _evict_expired(self):
        """Remove all expired entries (called while lock is held)."""
        current_time = time.time()
        expired_keys = [k for k, v in self._cache.items()
                       if current_time > v['expires_at']]
        for key in expired_keys:
            del self._cache[key]

    def stats(self):
        """Get cache statistics."""
        with self._lock:
            self._evict_expired()
            return {
                'name': self.name,
                'entries': len(self._cache),
                'max_entries': self.max_entries,
                'ttl_seconds': self.ttl
            }


# Initialize cache instances for different data types
# TTLs are tuned based on data change frequency and importance
changelog_cache = CacheManager('changelog', ttl_seconds=300, max_entries=5)  # 5 min TTL
users_cache = CacheManager('users', ttl_seconds=60, max_entries=10)  # 1 min TTL (shorter for user data)
api_versions_cache = CacheManager('api_versions', ttl_seconds=600, max_entries=5)  # 10 min TTL
git_versions_cache = CacheManager('git_versions', ttl_seconds=300, max_entries=10)  # 5 min TTL
coverage_gaps_cache = CacheManager('coverage_gaps', ttl_seconds=300, max_entries=20)  # 5 min TTL for coverage gaps
feeds_cache = CacheManager('feeds', ttl_seconds=600, max_entries=5)  # 10 min TTL for feeds (rarely changes)
meetings_count_cache = CacheManager('meetings_count', ttl_seconds=120, max_entries=50)  # 2 min TTL for meeting counts

# =============================================================================
# PARSE/BACK4APP INITIALIZATION WITH LOGGING
# =============================================================================
parse_init_log = []

def log_parse_init(message, level="info"):
    """Log a Parse initialization message with timestamp."""
    entry = {
        "timestamp": datetime.now().isoformat(),
        "level": level,
        "message": message
    }
    parse_init_log.append(entry)
    print(f"[PARSE-INIT] [{level.upper()}] {message}")

log_parse_init("Starting Parse/Back4App initialization...")

# Back4app Configuration - read from environment variables
# NOTE: These must be defined BEFORE back4app_session which uses them in headers
BACK4APP_APP_ID = os.environ.get('BACK4APP_APP_ID')
BACK4APP_REST_KEY = os.environ.get('BACK4APP_REST_KEY')
BACK4APP_URL = "https://parseapi.back4app.com/classes/Meetings"

# Log environment variable status
log_parse_init(f"BACK4APP_APP_ID from env: {'SET (' + BACK4APP_APP_ID[:8] + '...)' if BACK4APP_APP_ID else 'NOT SET'}")
log_parse_init(f"BACK4APP_REST_KEY from env: {'SET (' + BACK4APP_REST_KEY[:8] + '...)' if BACK4APP_REST_KEY else 'NOT SET'}")
log_parse_init(f"BACK4APP_URL: {BACK4APP_URL}")

# HTTP Session for connection pooling - reuse connections to Back4app
back4app_session = requests.Session()
session_app_id = BACK4APP_APP_ID or ""
session_rest_key = BACK4APP_REST_KEY or ""
back4app_session.headers.update({
    "X-Parse-Application-Id": session_app_id,
    "X-Parse-REST-API-Key": session_rest_key,
})

# Log session header status
log_parse_init(f"Session X-Parse-Application-Id header: {'SET (' + session_app_id[:8] + '...)' if session_app_id else 'EMPTY'}")
log_parse_init(f"Session X-Parse-REST-API-Key header: {'SET (' + session_rest_key[:8] + '...)' if session_rest_key else 'EMPTY'}")

# Test the connection at startup
def test_back4app_connection():
    """Test Back4App connection and log result."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        log_parse_init("Skipping connection test - credentials not configured", "warning")
        return False

    try:
        log_parse_init("Testing Back4App connection...")
        test_url = f"{BACK4APP_URL}?limit=1"
        response = back4app_session.get(test_url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            count = len(data.get('results', []))
            log_parse_init(f"Connection test SUCCESS - status {response.status_code}, got {count} result(s)", "success")
            return True
        else:
            log_parse_init(f"Connection test FAILED - status {response.status_code}, response: {response.text[:200]}", "error")
            return False
    except Exception as e:
        log_parse_init(f"Connection test EXCEPTION: {type(e).__name__}: {str(e)}", "error")
        return False

# Run connection test at startup
parse_connection_ok = test_back4app_connection()
log_parse_init(f"Initialization complete. Connection OK: {parse_connection_ok}")

# Fields to return for meeting listings (reduces payload size by ~60%)
MEETING_LIST_FIELDS = "objectId,name,day,time,city,state,latitude,longitude,locationName,meetingType,isOnline,isHybrid,format,address,thumbnailUrl"

# Known working AA Meeting Guide API feeds (verified January 2026)
AA_FEEDS = {
    # === ALABAMA ===
    "Shoals AA (District 1)": {
        "url": "https://shoalsaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Cullman AA (District 2)": {
        "url": "https://the12traditions.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Northeast Alabama AA (District 3)": {
        "url": "https://aaarea1dist3.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Coosa Valley AA (District 4)": {
        "url": "https://coosavalleyaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "West Alabama AA": {
        "url": "https://westalaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Birmingham AA": {
        "url": "https://birminghamaa.org/wp/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Central Alabama AA (District 8)": {
        "url": "https://centralalaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Auburn AA (District 9)": {
        "url": "https://aaauburn.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Dothan AA (District 10)": {
        "url": "https://aadothan.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Southeast Alabama AA (District 11)": {
        "url": "https://district11aa.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Mobile AA (District 12)": {
        "url": "https://mobileaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Gulf Coast AA (District 19)": {
        "url": "https://gulfcoastaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Huntsville AA (District 20)": {
        "url": "https://aahuntsvilleal.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    "Eastern Shore AA (District 23)": {
        "url": "https://easternshoreaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AL"
    },
    # === ALASKA ===
    "Mat-Su AA (Wasilla)": {
        "url": "https://alaskamatsuaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AK"
    },
    "Anchorage AA": {
        "url": "https://anchorageaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AK"
    },
    "Fairbanks AA": {
        "url": "https://fairbanksaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AK"
    },
    # === ARIZONA ===
    "Rim Country AA (Payson)": {
        "url": "https://aapayson.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "East Valley AA (Mesa)": {
        "url": "https://aamesaaz.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Central Mountain AA (Cottonwood)": {
        "url": "https://centralmountain.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Phoenix": {
        "url": "https://aaphoenix.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "West Phoenix AA (Peoria)": {
        "url": "https://aawestphoenix.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Prescott AA": {
        "url": "https://prescottaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Flagstaff AA": {
        "url": "https://flagstaffaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Pinal County AA (Casa Grande)": {
        "url": "https://aapinalcounty.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Tucson AA": {
        "url": "https://aatucson.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Cochise County AA (Sierra Vista)": {
        "url": "https://aa-cochisecounty.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Kingman AA": {
        "url": "https://kingmanaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Lake Havasu AA": {
        "url": "https://havasuaa.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "River Cities AA (Bullhead City)": {
        "url": "https://rcco-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    "Yuma AA": {
        "url": "https://aayuma.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "AZ"
    },
    # === ARKANSAS ===
    "Arkansas Central Office (Little Rock)": {
        "url": "https://arkansascentraloffice.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AR"
    },
    "Hot Springs AA": {
        "url": "https://aawcar.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AR"
    },
    "Fort Smith AA": {
        "url": "https://aafsig.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AR"
    },
    "Northwest Arkansas AA": {
        "url": "https://nwarkaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "AR"
    },
    # === CALIFORNIA ===
    "Palo Alto (Bay Area)": {
        "url": "https://sheets.code4recovery.org/storage/12Ga8uwMG4WJ8pZ_SEU7vNETp_aQZ-2yNVsYDFqIwHyE.json",
        "state": "CA"
    },
    "San Diego": {
        "url": "https://aasandiego.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Los Angeles AA": {
        "url": "https://lacoaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Orange County AA": {
        "url": "https://www.oc-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Sacramento AA (CCFAA)": {
        "url": "https://aasacramento.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "San Luis Obispo AA": {
        "url": "https://sloaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "East Bay AA (Oakland)": {
        "url": "https://eastbayaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "San Jose AA": {
        "url": "https://aasanjose.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Contra Costa AA": {
        "url": "https://contracostaaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Central Valley AA (Modesto)": {
        "url": "https://cviaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Inland Empire AA": {
        "url": "https://aainlandempire.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "Antelope Valley AA (Lancaster)": {
        "url": "https://avcentraloffice.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "South Bay AA (Torrance)": {
        "url": "https://asbco.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    "San Mateo County AA": {
        "url": "https://aa-san-mateo.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CA"
    },
    # === COLORADO ===
    "Denver AA (DACCAA)": {
        "url": "https://daccaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CO"
    },
    "Western Colorado AA": {
        "url": "https://aa-westerncolorado.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "CO"
    },
    "Northern Colorado AA (Fort Collins)": {
        "url": "https://nocoaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CO"
    },
    "Boulder AA": {
        "url": "https://www.bouldercountyaa.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "CO"
    },
    # === CONNECTICUT ===
    "Connecticut AA": {
        "url": "https://ct-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CT"
    },
    "Central Connecticut AA": {
        "url": "https://ccti-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CT"
    },
    "Fairfield County AA": {
        "url": "https://iafc-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "CT"
    },
    # === DELAWARE ===
    "Delaware AA": {
        "url": "https://delawareaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "DE"
    },
    "Northern Delaware AA": {
        "url": "https://ndiaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "DE"
    },
    "Central Delaware AA": {
        "url": "https://cdiaa-de.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "DE"
    },
    "Southern Delaware AA": {
        "url": "https://sussexaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "DE"
    },
    # === FLORIDA ===
    "Central Florida AA (Orlando)": {
        "url": "https://cflintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "FL"
    },
    "Palm Beach County AA": {
        "url": "https://aa-palmbeachcounty.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "FL"
    },
    "Broward County AA": {
        "url": "https://aabroward.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "FL"
    },
    "Gainesville AA": {
        "url": "https://aagainesville.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "FL"
    },
    "Pensacola AA (Tri-District)": {
        "url": "https://aapensacola.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "FL"
    },
    "Fort Walton Beach AA": {
        "url": "https://fortwaltonbeachaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "FL"
    },
    "Panama City AA": {
        "url": "https://panamacityaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "FL"
    },
    # === GEORGIA ===
    "Georgia AA (Area 16)": {
        "url": "https://aageorgia.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "GA"
    },
    "Southeast Georgia AA": {
        "url": "https://aasega.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "GA"
    },
    "Athens GA AA": {
        "url": "https://athensaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "GA"
    },
    "Savannah AA": {
        "url": "https://savannahaa.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "GA"
    },
    "Atlanta AA": {
        "url": "https://atlantaaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "GA"
    },
    # === HAWAII ===
    "Oahu AA": {
        "url": "https://oahuaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "HI"
    },
    "Maui AA": {
        "url": "https://aamaui.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "HI"
    },
    "West Hawaii AA (Kona)": {
        "url": "https://westhawaiiaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "HI"
    },
    # === IDAHO ===
    "Idaho AA (Area 18)": {
        "url": "https://idahoarea18aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "ID"
    },
    "North Idaho AA": {
        "url": "https://northidahoaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "ID"
    },
    # === ILLINOIS ===
    "Central Illinois AA (District 11)": {
        "url": "https://aaci11.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IL"
    },
    "Northern Illinois AA (District 11)": {
        "url": "https://aa-nia-dist11.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IL"
    },
    "Southern Illinois AA (Area 21)": {
        "url": "https://area21aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IL"
    },
    # === INDIANA ===
    "Indianapolis AA": {
        "url": "https://indyaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IN"
    },
    "Southern Indiana AA (Area 23)": {
        "url": "https://area23aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IN"
    },
    "Fort Wayne AA": {
        "url": "https://aafortwayne.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IN"
    },
    # === IOWA ===
    "Iowa AA (Area 24)": {
        "url": "https://aa-iowa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IA"
    },
    "Ames AA": {
        "url": "https://amesaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IA"
    },
    "Cedar Rapids AA": {
        "url": "https://aa-cedarrapids.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IA"
    },
    "Des Moines AA": {
        "url": "https://aadesmoines.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IA"
    },
    "Siouxland AA (Sioux City)": {
        "url": "https://aasiouxcity.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IA"
    },
    "Quad Cities AA": {
        "url": "https://aaquadcities.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "IA"
    },
    # === KANSAS ===
    "Kansas AA (Area 25)": {
        "url": "https://ks-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "KS"
    },
    "Lawrence KS AA (District 23)": {
        "url": "https://aa-ksdist23.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "KS"
    },
    "Topeka AA": {
        "url": "https://aatopeka.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "KS"
    },
    "Kansas City AA": {
        "url": "https://kc-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "KS"
    },
    # === KENTUCKY ===
    "Kentucky AA (Area 26)": {
        "url": "https://area26.net/wp-admin/admin-ajax.php?action=meetings",
        "state": "KY"
    },
    "Bluegrass AA (Lexington)": {
        "url": "https://bluegrassintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "KY"
    },
    "Western Kentucky AA": {
        "url": "https://wkintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "KY"
    },
    "Louisville AA": {
        "url": "https://loukyaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "KY"
    },
    # === LOUISIANA ===
    "Louisiana AA (Area 27)": {
        "url": "https://aa-louisiana.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "LA"
    },
    "New Orleans AA": {
        "url": "https://aaneworleans.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "LA"
    },
    "Baton Rouge AA": {
        "url": "https://aabatonrouge.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "LA"
    },
    "Southwest Louisiana AA": {
        "url": "https://aa-swla.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "LA"
    },
    "Shreveport AA": {
        "url": "https://aa-shreveport.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "LA"
    },
    # === MAINE ===
    "Maine AA (Area 28)": {
        "url": "https://maineaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "ME"
    },
    "Maine Central Service Office": {
        "url": "https://csoaamaine.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "ME"
    },
    "Downeast Maine AA": {
        "url": "https://downeastintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "ME"
    },
    # === MARYLAND ===
    "Maryland AA (Area 29)": {
        "url": "https://marylandaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MD"
    },
    "Baltimore AA": {
        "url": "https://baltimoreaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MD"
    },
    "Northeastern Maryland AA": {
        "url": "https://nemdaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MD"
    },
    "Western Maryland AA": {
        "url": "https://westernmarylandaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MD"
    },
    "Maryland Mid-Shore AA": {
        "url": "https://midshoreintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MD"
    },
    # === MASSACHUSETTS ===
    "Eastern Massachusetts AA (Area 30)": {
        "url": "https://aaemass.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MA"
    },
    "Western Massachusetts AA": {
        "url": "https://westernmassaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MA"
    },
    "Boston AA": {
        "url": "https://aaboston.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MA"
    },
    "Worcester AA": {
        "url": "https://aaworcester.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MA"
    },
    "Cape Cod AA": {
        "url": "https://capecodaa.net/wp-admin/admin-ajax.php?action=meetings",
        "state": "MA"
    },
    "Berkshire AA": {
        "url": "https://berkshireaaintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MA"
    },
    # === MICHIGAN ===
    "Southeastern Michigan AA (Area 33)": {
        "url": "https://aa-semi.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MI"
    },
    "Michigan Statewide AA": {
        "url": "https://aamichiganstatewide.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "MI"
    },
    "Huron Valley AA": {
        "url": "https://hvai.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MI"
    },
    # === MINNESOTA ===
    "Minnesota AA": {
        "url": "https://aaminnesota.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MN"
    },
    "Southern Minnesota AA (Area 36)": {
        "url": "https://area36.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MN"
    },
    "Northern Minnesota AA (Area 35)": {
        "url": "https://area35.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MN"
    },
    "Minneapolis AA": {
        "url": "https://aaminneapolis.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MN"
    },
    "St. Paul AA": {
        "url": "https://aastpaul.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MN"
    },
    "St. Cloud AA": {
        "url": "https://aasaintcloud.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MN"
    },
    "Duluth AA": {
        "url": "https://duluthaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MN"
    },
    # === MISSISSIPPI ===
    "Mississippi AA (Area 37)": {
        "url": "https://aa-mississippi.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MS"
    },
    "Mid-Mississippi AA (Jackson)": {
        "url": "https://midmissintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MS"
    },
    "Gulf Coast AA (South MS)": {
        "url": "https://aagulfcoast.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "MS"
    },
    "DeSoto County AA": {
        "url": "https://desotocounty-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MS"
    },
    "Northeast Mississippi AA": {
        "url": "https://northmsaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MS"
    },
    # === MISSOURI ===
    "Eastern Missouri AA (Area 38)": {
        "url": "https://eamo.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MO"
    },
    "Tri-County AA (St. Charles)": {
        "url": "https://tricountyaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MO"
    },
    "Mid Missouri AA (Columbia)": {
        "url": "https://aacomm.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MO"
    },
    "Kansas City MO AA": {
        "url": "https://kc-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MO"
    },
    # === MONTANA ===
    "Montana AA (Area 40)": {
        "url": "https://aa-montana.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MT"
    },
    "Flathead Valley AA (NW Montana)": {
        "url": "https://aanwmt.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "MT"
    },
    # === NEBRASKA ===
    "Nebraska AA (Area 41)": {
        "url": "https://area41aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NE"
    },
    "Lincoln AA": {
        "url": "https://lincolnaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NE"
    },
    "Omaha AA": {
        "url": "https://omahaaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NE"
    },
    "Norfolk NE AA": {
        "url": "https://aane.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NE"
    },
    "Grand Island AA": {
        "url": "https://grandislandaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NE"
    },
    "Kearney AA": {
        "url": "https://kearneyaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NE"
    },
    # === NEVADA ===
    "Nevada AA (Area 42)": {
        "url": "https://nevadaarea42.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NV"
    },
    "Northern Nevada AA (Reno)": {
        "url": "https://nnig.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NV"
    },
    "Las Vegas AA": {
        "url": "https://lvcentraloffice.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NV"
    },
    # === NEW HAMPSHIRE ===
    "New Hampshire AA": {
        "url": "https://nhaa.net/wp-admin/admin-ajax.php?action=meetings",
        "state": "NH"
    },
    "Seacoast NH AA": {
        "url": "https://seacoastaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NH"
    },
    "North Conway AA": {
        "url": "https://northconwayaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NH"
    },
    # === NEW JERSEY ===
    "Northern New Jersey AA (Area 44)": {
        "url": "https://nnjaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NJ"
    },
    "Southern New Jersey AA": {
        "url": "https://snjaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NJ"
    },
    "South Jersey AA": {
        "url": "https://aasj.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NJ"
    },
    "Central Jersey AA": {
        "url": "https://cjiaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NJ"
    },
    "Cape Atlantic AA": {
        "url": "https://capeatlanticaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NJ"
    },
    # === NEW MEXICO ===
    "Santa Fe AA": {
        "url": "https://santafeaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NM"
    },
    "Las Cruces AA (District 4)": {
        "url": "https://nmdistrict4aa.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "NM"
    },
    # === NEW YORK ===
    "New York Intergroup (NYC)": {
        "url": "https://nyintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NY"
    },
    "Central New York AA (Area 47)": {
        "url": "https://aacny.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NY"
    },
    "Brooklyn AA": {
        "url": "https://brooklynintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NY"
    },
    # === NORTH CAROLINA ===
    "North Carolina AA (Area 51)": {
        "url": "https://aanorthcarolina.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NC"
    },
    "Western NC AA (Mountain)": {
        "url": "https://aancmco.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NC"
    },
    "Charlotte AA": {
        "url": "https://charlotteaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NC"
    },
    "Greensboro AA": {
        "url": "https://aagreensboronc.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "NC"
    },
    "Eastern NC AA (District 60)": {
        "url": "https://aaeasternnc.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "NC"
    },
    # === OHIO ===
    "Ohio AA": {
        "url": "https://aaohio.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OH"
    },
    "Central Ohio AA": {
        "url": "https://aacentralohio.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OH"
    },
    "Central Southeast Ohio AA (Area 53)": {
        "url": "https://area53aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OH"
    },
    "Akron AA": {
        "url": "https://akronaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OH"
    },
    # === OKLAHOMA ===
    "Oklahoma AA (Area 57)": {
        "url": "https://aaoklahoma.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OK"
    },
    "Oklahoma City AA": {
        "url": "https://okcintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OK"
    },
    "Tulsa AA (Northeast OK)": {
        "url": "https://aaneok.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OK"
    },
    "Southeast Oklahoma AA": {
        "url": "https://seokaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OK"
    },
    # === OREGON ===
    "Central Oregon AA": {
        "url": "https://coigaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OR"
    },
    "Portland AA (District 26)": {
        "url": "https://district26aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OR"
    },
    "Roseburg AA": {
        "url": "https://roseburgintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "OR"
    },
    "Grants Pass AA": {
        "url": "https://grantspassaa.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "OR"
    },
    # === PENNSYLVANIA ===
    "Western Pennsylvania AA (Area 60)": {
        "url": "https://wpaarea60.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Bucks & Montgomery Counties AA (District 23)": {
        "url": "https://aad23.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Lower Northeast Philadelphia AA": {
        "url": "https://district60aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Southern Bucks County AA": {
        "url": "https://d51a59aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Northwest Philadelphia AA": {
        "url": "https://district25aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Montgomery County PA AA": {
        "url": "https://district38-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "York PA AA": {
        "url": "https://york-pa-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Reading Berks AA": {
        "url": "https://readingberksintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Somerset County AA": {
        "url": "https://somersetcountyaa.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    "Harrisburg AA": {
        "url": "https://aaharrisburg.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "PA"
    },
    # === RHODE ISLAND ===
    "Rhode Island AA": {
        "url": "https://rhodeisland-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "RI"
    },
    "Rhode Island AA (Area 61)": {
        "url": "https://aainri.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "RI"
    },
    # === SOUTH CAROLINA ===
    "South Carolina AA (Area 62)": {
        "url": "https://sc-aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "SC"
    },
    "Upstate SC AA (Greenville)": {
        "url": "https://upstateintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "SC"
    },
    "Grand Strand AA (Myrtle Beach)": {
        "url": "https://aamyrtlebeach.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "SC"
    },
    "Columbia SC AA": {
        "url": "https://aacolumbia.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "SC"
    },
    "Charleston SC AA (Tri-County)": {
        "url": "https://tcio.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "SC"
    },
    # === SOUTH DAKOTA ===
    "South Dakota AA (Area 63)": {
        "url": "https://area63aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "SD"
    },
    "Northern Black Hills AA": {
        "url": "https://aanorthernhills.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "SD"
    },
    # === TENNESSEE ===
    "East Tennessee AA": {
        "url": "https://etiaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TN"
    },
    "Nashville AA": {
        "url": "https://aanashville.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TN"
    },
    # === TEXAS ===
    "Houston AA": {
        "url": "https://aahouston.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TX"
    },
    "Dallas AA": {
        "url": "https://aadallas.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TX"
    },
    "Austin AA": {
        "url": "https://www.austinaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TX"
    },
    "Southwest Texas AA (District 12)": {
        "url": "https://aa12.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TX"
    },
    "Coastal Bend AA (Corpus Christi)": {
        "url": "https://cbiaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TX"
    },
    "Central Texas Deaf AA": {
        "url": "https://centexdeafintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "TX"
    },
    # === UTAH ===
    "Utah AA": {
        "url": "https://utahaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "UT"
    },
    "Salt Lake AA": {
        "url": "https://saltlakeaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "UT"
    },
    "Northern Utah AA (Ogden)": {
        "url": "https://northernutahaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "UT"
    },
    # === VERMONT ===
    "Vermont AA (Area 70)": {
        "url": "https://aavt.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VT"
    },
    "Burlington VT AA": {
        "url": "https://burlingtonaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VT"
    },
    # === VIRGINIA ===
    "Virginia AA (Area 71)": {
        "url": "https://aavirginia.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VA"
    },
    "Northern Virginia AA": {
        "url": "https://nvintergroup.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VA"
    },
    "Roanoke AA": {
        "url": "https://aaroanoke.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VA"
    },
    "Richmond AA": {
        "url": "https://www.aarichmond.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VA"
    },
    "Charlottesville AA": {
        "url": "https://aaheartofva.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VA"
    },
    "Eastern Shore VA AA": {
        "url": "https://aaeasternshoreva.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VA"
    },
    "Blue Ridge AA": {
        "url": "https://aablueridge.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "VA"
    },
    # === WASHINGTON ===
    "Seattle AA (Greater Seattle)": {
        "url": "https://seattleaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WA"
    },
    "Eastside AA (Seattle)": {
        "url": "https://www.eastsideaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WA"
    },
    "Eastern Washington AA (Area 92)": {
        "url": "https://area92aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WA"
    },
    # === WEST VIRGINIA ===
    "West Virginia AA (Area 73)": {
        "url": "https://area73aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WV"
    },
    "Beckley WV AA (District 3)": {
        "url": "https://aawvdistrict3.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WV"
    },
    "Wheeling WV AA (District 6)": {
        "url": "https://aa6wv.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WV"
    },
    "Berkeley Morgan WV AA (District 11)": {
        "url": "https://aawv11.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WV"
    },
    "Northeast WV AA (District 13)": {
        "url": "https://aawv13.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "WV"
    },
    # === WISCONSIN ===
    "Madison WI AA": {
        "url": "https://aamadisonwi.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WI"
    },
    "Milwaukee AA": {
        "url": "https://aamilwaukee.com/wp-admin/admin-ajax.php?action=meetings",
        "state": "WI"
    },
    "Racine AA": {
        "url": "https://racinecentraloffice.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WI"
    },
    "Fox Valley WI AA": {
        "url": "https://district02aa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WI"
    },
    "Northern Wisconsin AA (Area 74)": {
        "url": "https://area74.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WI"
    },
    # === WYOMING ===
    "Wyoming AA (Area 76)": {
        "url": "https://wyomingaa.org/wp-admin/admin-ajax.php?action=meetings",
        "state": "WY"
    },
}

# BMLT (Basic Meeting List Toolkit) feeds for NA meetings
# These use a different API format and need transformation
NA_FEEDS = {
    # === ALABAMA / NW FLORIDA ===
    "Alabama NA": {
        "url": "https://bmlt.sezf.org/main_server/client_interface/json/?switcher=GetSearchResults&services[]=80&services[]=81&services[]=82&services[]=83&services[]=85&services[]=86&services[]=87&services[]=88&services[]=89&services[]=92&services[]=125",
        "state": "AL",
        "type": "bmlt"
    },
    # === ALASKA ===
    "Alaska NA": {
        "url": "https://akna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "AK",
        "type": "bmlt"
    },
    # === ARIZONA ===
    "Arizona NA": {
        "url": "https://arizona-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "AZ",
        "type": "bmlt"
    },
    # === ARKANSAS ===
    "Arkansas NA": {
        "url": "https://arscna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "AR",
        "type": "bmlt"
    },
    # === CALIFORNIA ===
    "Southern California NA": {
        "url": "https://todayna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    "Northern California NA": {
        "url": "https://norcalna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    "Central California NA": {
        "url": "https://ccrna.net/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    "Orange County NA": {
        "url": "https://orangecountyna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    "San Francisco NA": {
        "url": "https://sfna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    "Sacramento NA": {
        "url": "https://sacramentona.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    "Greater San Jose NA": {
        "url": "https://sjna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    "Inland Empire Foothills NA": {
        "url": "https://iefoothillsna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CA",
        "type": "bmlt"
    },
    # === COLORADO ===
    "Denver NA (Mile High)": {
        "url": "https://denverna.com/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CO",
        "type": "bmlt"
    },
    "Boulder NA": {
        "url": "https://naboulder.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CO",
        "type": "bmlt"
    },
    "Northern Colorado NA": {
        "url": "https://otwna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CO",
        "type": "bmlt"
    },
    # === CONNECTICUT ===
    "Connecticut NA": {
        "url": "https://ctna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "CT",
        "type": "bmlt"
    },
    # === DELAWARE ===
    "Delaware NA (Small Wonder)": {
        "url": "https://freestatena.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "DE",
        "type": "bmlt"
    },
    # === FLORIDA ===
    "Florida NA": {
        "url": "https://naflorida.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "FL",
        "type": "bmlt"
    },
    "South Florida NA": {
        "url": "https://sfrna.net/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "FL",
        "type": "bmlt"
    },
    "Orlando NA": {
        "url": "https://orlandona.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "FL",
        "type": "bmlt"
    },
    "MidCoast NA (Boca/Delray)": {
        "url": "https://midcoastarea.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "FL",
        "type": "bmlt"
    },
    # === GEORGIA ===
    "Georgia NA": {
        "url": "https://grscna.com/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "GA",
        "type": "bmlt"
    },
    "Northeast Georgia NA": {
        "url": "https://negana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "GA",
        "type": "bmlt"
    },
    "North Atlanta NA": {
        "url": "https://northatlantana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "GA",
        "type": "bmlt"
    },
    # === HAWAII ===
    "Hawaii NA": {
        "url": "https://na-hawaii.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "HI",
        "type": "bmlt"
    },
    # === IDAHO ===
    "Southern Idaho NA": {
        "url": "https://sirna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "ID",
        "type": "bmlt"
    },
    "North Idaho NA": {
        "url": "https://northidahona.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "ID",
        "type": "bmlt"
    },
    # === ILLINOIS ===
    "Chicagoland NA": {
        "url": "https://chicagona.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "IL",
        "type": "bmlt"
    },
    "Heart of Illinois NA": {
        "url": "https://heartofillinoisna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "IL",
        "type": "bmlt"
    },
    "Rock River NA (Rockford)": {
        "url": "https://rockriverna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "IL",
        "type": "bmlt"
    },
    # === INDIANA ===
    "Indiana NA": {
        "url": "https://naindiana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "IN",
        "type": "bmlt"
    },
    "Central Indiana NA": {
        "url": "https://centralindianana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "IN",
        "type": "bmlt"
    },
    "South Central Indiana NA": {
        "url": "https://southcentralna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "IN",
        "type": "bmlt"
    },
    # === IOWA ===
    "Iowa NA": {
        "url": "https://iowa-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "IA",
        "type": "bmlt"
    },
    # === KANSAS ===
    "Mid-America NA (Kansas)": {
        "url": "https://marscna.net/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "KS",
        "type": "bmlt"
    },
    "Kansas City NA": {
        "url": "https://kansascityna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "KS",
        "type": "bmlt"
    },
    "Wichita NA": {
        "url": "https://wmana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "KS",
        "type": "bmlt"
    },
    # === KENTUCKY ===
    "Northern Kentucky NA": {
        "url": "https://nkyna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "KY",
        "type": "bmlt"
    },
    "Louisville NA": {
        "url": "https://nalouisville.net/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "KY",
        "type": "bmlt"
    },
    "South Central Kentucky NA": {
        "url": "https://sckana.net/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "KY",
        "type": "bmlt"
    },
    "Eastern Kentucky NA (Grassroots)": {
        "url": "https://grassrootsna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "KY",
        "type": "bmlt"
    },
    # === LOUISIANA ===
    "Louisiana NA": {
        "url": "https://larna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "LA",
        "type": "bmlt"
    },
    "New Orleans NA": {
        "url": "https://noana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "LA",
        "type": "bmlt"
    },
    "Northshore LA NA": {
        "url": "https://nsana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "LA",
        "type": "bmlt"
    },
    # === MAINE ===
    "Maine NA": {
        "url": "https://namaine.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "ME",
        "type": "bmlt"
    },
    # === MARYLAND ===
    "Free State NA (Maryland)": {
        "url": "https://freestatena.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MD",
        "type": "bmlt"
    },
    "Chesapeake Potomac NA (MD/DC/VA)": {
        "url": "https://cprna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MD",
        "type": "bmlt"
    },
    # === MASSACHUSETTS ===
    "Western Mass NA": {
        "url": "https://westernmassna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MA",
        "type": "bmlt"
    },
    "Central Mass NA": {
        "url": "https://centralmassna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MA",
        "type": "bmlt"
    },
    "Southeast Mass NA": {
        "url": "https://semana.us/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MA",
        "type": "bmlt"
    },
    # === MICHIGAN ===
    "Michigan NA": {
        "url": "https://michigan-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MI",
        "type": "bmlt"
    },
    # === MINNESOTA ===
    "Minnesota NA": {
        "url": "https://naminnesota.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MN",
        "type": "bmlt"
    },
    "Twin Cities NA": {
        "url": "https://twin-cities-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MN",
        "type": "bmlt"
    },
    # === MISSISSIPPI ===
    "Mississippi NA": {
        "url": "https://mrscna.net/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MS",
        "type": "bmlt"
    },
    "Gulf Coast MS NA": {
        "url": "https://mgcana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MS",
        "type": "bmlt"
    },
    # === MISSOURI ===
    "Missouri NA": {
        "url": "https://missourina.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "MO",
        "type": "bmlt"
    },
    # === NEBRASKA ===
    "Nebraska NA": {
        "url": "https://nebraskana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NE",
        "type": "bmlt"
    },
    # === NEVADA ===
    "Southern Nevada NA (Region 51)": {
        "url": "https://region51na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NV",
        "type": "bmlt"
    },
    "Northern Nevada NA (Sierra Sage)": {
        "url": "https://sierrasagena.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NV",
        "type": "bmlt"
    },
    # === NEW HAMPSHIRE ===
    "Granite State NA (NH)": {
        "url": "https://gsana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NH",
        "type": "bmlt"
    },
    # === NEW JERSEY ===
    "New Jersey NA": {
        "url": "https://nanj.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NJ",
        "type": "bmlt"
    },
    "Middlesex County NJ NA": {
        "url": "https://middlesexna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NJ",
        "type": "bmlt"
    },
    "Bergen County NJ NA": {
        "url": "https://bergenarea.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NJ",
        "type": "bmlt"
    },
    # === NEW MEXICO ===
    "Rio Grande NA (NM)": {
        "url": "https://riograndena.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NM",
        "type": "bmlt"
    },
    # === NEW YORK ===
    "Greater New York NA": {
        "url": "https://newyorkna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NY",
        "type": "bmlt"
    },
    "NYC NA": {
        "url": "https://nycna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NY",
        "type": "bmlt"
    },
    "Western New York NA": {
        "url": "https://nawny.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NY",
        "type": "bmlt"
    },
    # === NORTH CAROLINA ===
    "North Carolina NA": {
        "url": "https://ncregion-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NC",
        "type": "bmlt"
    },
    "Carolina NA (NC/SC)": {
        "url": "https://crna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NC",
        "type": "bmlt"
    },
    "NC Mountain NA": {
        "url": "https://ncmountainna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "NC",
        "type": "bmlt"
    },
    # === OHIO ===
    "Ohio NA": {
        "url": "https://naohio.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OH",
        "type": "bmlt"
    },
    "Central Ohio NA": {
        "url": "https://nacentralohio.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OH",
        "type": "bmlt"
    },
    "Buckeye NA (NE Ohio)": {
        "url": "https://brscna.com/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OH",
        "type": "bmlt"
    },
    # === OKLAHOMA ===
    "Oklahoma NA": {
        "url": "https://okna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OK",
        "type": "bmlt"
    },
    "Western Oklahoma NA": {
        "url": "https://wascokna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OK",
        "type": "bmlt"
    },
    "Eastern Oklahoma NA": {
        "url": "https://eascna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OK",
        "type": "bmlt"
    },
    # === OREGON ===
    "Southern Oregon NA": {
        "url": "https://soana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OR",
        "type": "bmlt"
    },
    "Portland NA": {
        "url": "https://portlandna.com/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OR",
        "type": "bmlt"
    },
    "Washington County OR NA": {
        "url": "https://washingtoncountyna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OR",
        "type": "bmlt"
    },
    "Lane County NA (Eugene)": {
        "url": "https://lanecountyarea-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "OR",
        "type": "bmlt"
    },
    # === PENNSYLVANIA ===
    "Mid-Atlantic NA (PA)": {
        "url": "https://marscna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "PA",
        "type": "bmlt"
    },
    "Montgomery County PA NA": {
        "url": "https://montcona.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "PA",
        "type": "bmlt"
    },
    "Tri-State NA (PA/WV/OH)": {
        "url": "https://tristate-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "PA",
        "type": "bmlt"
    },
    # === SOUTH CAROLINA ===
    "South Carolina NA (Carolina Region)": {
        "url": "https://crna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "SC",
        "type": "bmlt"
    },
    "South Coastal SC NA": {
        "url": "https://southcoastalna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "SC",
        "type": "bmlt"
    },
    # === SOUTH DAKOTA ===
    "South Dakota NA": {
        "url": "https://sdrna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "SD",
        "type": "bmlt"
    },
    # === TENNESSEE ===
    "Tennessee NA (Volunteer Region)": {
        "url": "https://natennessee.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "TN",
        "type": "bmlt"
    },
    "Upper Cumberland TN NA": {
        "url": "https://nauca.us/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "TN",
        "type": "bmlt"
    },
    "Knoxville NA": {
        "url": "https://naknoxville.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "TN",
        "type": "bmlt"
    },
    # === TEXAS ===
    "Dallas NA": {
        "url": "https://dallasareana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "TX",
        "type": "bmlt"
    },
    "Central Texas NA (Austin)": {
        "url": "https://ctana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "TX",
        "type": "bmlt"
    },
    "Southeast Texas NA": {
        "url": "https://setana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "TX",
        "type": "bmlt"
    },
    "Coastal Bend TX NA": {
        "url": "https://cbana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "TX",
        "type": "bmlt"
    },
    # === UTAH ===
    "Utah NA": {
        "url": "https://nautah.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "UT",
        "type": "bmlt"
    },
    "United Wasatch NA (Salt Lake)": {
        "url": "https://uwana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "UT",
        "type": "bmlt"
    },
    "Northern Utah NA": {
        "url": "https://northernutahna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "UT",
        "type": "bmlt"
    },
    "Southern Utah NA": {
        "url": "https://nasouthernutah.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "UT",
        "type": "bmlt"
    },
    # === VIRGINIA ===
    "Chesapeake Potomac VA NA": {
        "url": "https://cprna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "VA",
        "type": "bmlt"
    },
    "Central Atlantic VA NA": {
        "url": "https://car-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "VA",
        "type": "bmlt"
    },
    # === WASHINGTON ===
    "Northeast Washington NA": {
        "url": "https://newana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WA",
        "type": "bmlt"
    },
    "Chelan Douglas WA NA": {
        "url": "https://cdcna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WA",
        "type": "bmlt"
    },
    # === WEST VIRGINIA ===
    "Mountaineer NA (WV)": {
        "url": "https://mrscna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WV",
        "type": "bmlt"
    },
    "Almost Heaven NA (East WV)": {
        "url": "https://almostheavenareana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WV",
        "type": "bmlt"
    },
    # === WISCONSIN ===
    "Badgerland NA (Madison)": {
        "url": "https://badgerlandna.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WI",
        "type": "bmlt"
    },
    "Metro Milwaukee NA": {
        "url": "https://namilwaukee.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WI",
        "type": "bmlt"
    },
    "Southeastern WI NA (SEFA)": {
        "url": "https://sefa-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WI",
        "type": "bmlt"
    },
    "Chippewa Valley NA": {
        "url": "https://chippewavalley-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WI",
        "type": "bmlt"
    },
    "Kettle Moraine NA": {
        "url": "https://kmana.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "WI",
        "type": "bmlt"
    },
    # === VIRTUAL NA ===
    "Virtual NA (Online)": {
        "url": "https://virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "state": "ONLINE",
        "type": "bmlt"
    },
}

def transform_bmlt_to_tsml(bmlt_meeting):
    """Transform BMLT meeting format to TSML-compatible format"""
    # BMLT weekday is 1-7 (Sunday=1), TSML uses 0-6 (Sunday=0)
    weekday = int(bmlt_meeting.get('weekday_tinyint', 1)) - 1

    # Convert time from "HH:MM:SS" to "HH:MM"
    start_time = bmlt_meeting.get('start_time', '')
    if start_time and len(start_time) > 5:
        start_time = start_time[:5]

    # Build formatted address
    street = bmlt_meeting.get('location_street', '')
    city = bmlt_meeting.get('location_municipality', '')
    state = bmlt_meeting.get('location_province', '')
    postal = bmlt_meeting.get('location_postal_code_1', '')
    formatted_address = ', '.join(filter(None, [street, city, f"{state} {postal}".strip()]))

    # Determine if online/hybrid based on venue_type
    venue_type = bmlt_meeting.get('venue_type', '1')
    is_online = venue_type == '2'
    is_hybrid = venue_type == '3'

    return {
        'name': bmlt_meeting.get('meeting_name', 'NA Meeting'),
        'day': weekday,
        'time': start_time,
        'end_time': '',
        'location': bmlt_meeting.get('location_text', '') or bmlt_meeting.get('location_info', ''),
        'location_name': bmlt_meeting.get('location_text', '') or bmlt_meeting.get('location_info', ''),
        'formatted_address': formatted_address,
        'address': street,
        'city': city,
        'state': state,
        'postal_code': postal,
        'latitude': bmlt_meeting.get('latitude'),
        'longitude': bmlt_meeting.get('longitude'),
        'types': bmlt_meeting.get('formats', '').split(',') if bmlt_meeting.get('formats') else [],
        'meeting_type': 'NA',
        'notes': bmlt_meeting.get('comments', ''),
        'location_notes': bmlt_meeting.get('location_info', ''),
        'conference_url': bmlt_meeting.get('virtual_meeting_link', ''),
        'conference_phone': bmlt_meeting.get('phone_meeting_number', ''),
        'attendance_option': 'online' if is_online else ('hybrid' if is_hybrid else 'in_person'),
        'region': bmlt_meeting.get('service_body_name', ''),
    }

def get_all_feeds():
    """Get combined dictionary of all feeds (AA + NA)"""
    all_feeds = {}
    for name, config in AA_FEEDS.items():
        all_feeds[name] = {**config, "type": "tsml"}
    for name, config in NA_FEEDS.items():
        all_feeds[name] = config  # Already has type
    return all_feeds


def get_all_feeds_cached():
    """Get combined dictionary of all feeds with caching.

    Since feeds rarely change (only when code is updated), cache for 10 minutes.
    """
    cached = feeds_cache.get('all_feeds')
    if cached is not None:
        return cached

    all_feeds = get_all_feeds()
    feeds_cache.set('all_feeds', all_feeds)
    return all_feeds

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

# State center coordinates for map display (approximate geographic centers)
US_STATE_CENTERS = {
    "AL": (32.806671, -86.791130), "AK": (61.370716, -152.404419), "AZ": (33.729759, -111.431221),
    "AR": (34.969704, -92.373123), "CA": (36.116203, -119.681564), "CO": (39.059811, -105.311104),
    "CT": (41.597782, -72.755371), "DE": (39.318523, -75.507141), "FL": (27.766279, -81.686783),
    "GA": (33.040619, -83.643074), "HI": (21.094318, -157.498337), "ID": (44.240459, -114.478828),
    "IL": (40.349457, -88.986137), "IN": (39.849426, -86.258278), "IA": (42.011539, -93.210526),
    "KS": (38.526600, -96.726486), "KY": (37.668140, -84.670067), "LA": (31.169546, -91.867805),
    "ME": (44.693947, -69.381927), "MD": (39.063946, -76.802101), "MA": (42.230171, -71.530106),
    "MI": (43.326618, -84.536095), "MN": (45.694454, -93.900192), "MS": (32.741646, -89.678696),
    "MO": (38.456085, -92.288368), "MT": (46.921925, -110.454353), "NE": (41.125370, -98.268082),
    "NV": (38.313515, -117.055374), "NH": (43.452492, -71.563896), "NJ": (40.298904, -74.521011),
    "NM": (34.840515, -106.248482), "NY": (42.165726, -74.948051), "NC": (35.630066, -79.806419),
    "ND": (47.528912, -99.784012), "OH": (40.388783, -82.764915), "OK": (35.565342, -96.928917),
    "OR": (44.572021, -122.070938), "PA": (40.590752, -77.209755), "RI": (41.680893, -71.511780),
    "SC": (33.856892, -80.945007), "SD": (44.299782, -99.438828), "TN": (35.747845, -86.692345),
    "TX": (31.054487, -97.563461), "UT": (40.150032, -111.862434), "VT": (44.045876, -72.710686),
    "VA": (37.769337, -78.169968), "WA": (47.400902, -121.490494), "WV": (38.491226, -80.954453),
    "WI": (44.268543, -89.616508), "WY": (42.755966, -107.302490), "DC": (38.897438, -77.026817),
    "PR": (18.220833, -66.590149),
}

# Cached state meeting counts (refreshed periodically)
state_meeting_counts_cache = {
    "data": {},
    "last_updated": None,
    "ttl": 300  # 5 minutes cache
}

# Global state
scraping_state = {
    "is_running": False,
    "total_found": 0,
    "total_saved": 0,
    "total_duplicates": 0,
    "total_errors": 0,
    "current_source": "",
    "errors": [],
    "meetings_by_state": {},
    "meetings_by_type": {"AA": 0, "NA": 0, "Al-Anon": 0, "Other": 0},
    "recent_meetings": [],
    "progress_message": "",
    # Detailed progress tracking
    "current_feed_index": 0,
    "total_feeds": len(AA_FEEDS) + len(NA_FEEDS),
    "current_feed_progress": 0,
    "current_feed_total": 0,
    "current_meeting": None,  # Current meeting being processed
    "activity_log": [],
    "started_at": None,
    "scrape_id": None,  # Unique ID for the current scrape run
    "feed_stats": {},  # Per-feed breakdown: {feed_name: {found, saved, duplicates, errors}}
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
            "path": "/classes/Meetings",
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

        # Transform BMLT meetings to TSML-compatible format
        feed_type = feed_config.get("type", "tsml")
        if feed_type == "bmlt":
            add_log(f"Transforming {len(raw_meetings)} BMLT meetings to standard format", "info")
            raw_meetings = [transform_bmlt_to_tsml(m) for m in raw_meetings]

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

                    # Track by meeting type (AA, NA, Al-Anon, or Other)
                    meeting_type = meeting.get("meetingType", "").upper()
                    if meeting_type == "AA":
                        scraping_state["meetings_by_type"]["AA"] = scraping_state["meetings_by_type"].get("AA", 0) + 1
                    elif meeting_type == "NA":
                        scraping_state["meetings_by_type"]["NA"] = scraping_state["meetings_by_type"].get("NA", 0) + 1
                    elif meeting_type in ["AL-ANON", "ALANON"]:
                        scraping_state["meetings_by_type"]["Al-Anon"] = scraping_state["meetings_by_type"].get("Al-Anon", 0) + 1
                    else:
                        scraping_state["meetings_by_type"]["Other"] = scraping_state["meetings_by_type"].get("Other", 0) + 1

                    # Keep recent meetings (last 20)
                    scraping_state["recent_meetings"].insert(0, meeting)
                    scraping_state["recent_meetings"] = scraping_state["recent_meetings"][:20]

                add_log(f"Batch {batch_num}: saved {result['saved']}, {len(batch_meetings) - len(meetings_to_save)} duplicates", "info")
            else:
                add_log(f"Batch {batch_num}: all {len(batch_meetings)} were duplicates", "info")

        scraping_state["total_found"] += total_in_feed
        scraping_state["total_duplicates"] += duplicate_count
        scraping_state["total_errors"] += error_count
        scraping_state["current_meeting"] = None

        # Store per-feed stats
        scraping_state["feed_stats"][feed_name] = {
            "found": total_in_feed,
            "saved": saved_count,
            "duplicates": duplicate_count,
            "errors": error_count
        }

        # Enhanced completion log
        log_msg = f"✓ {feed_name}: {saved_count} saved"
        if duplicate_count > 0:
            log_msg += f", {duplicate_count} duplicates"
        if error_count > 0:
            log_msg += f", {error_count} errors"
        log_msg += f" (of {total_in_feed} found)"
        add_log(log_msg, "success")
        return saved_count

    except requests.exceptions.Timeout:
        error_msg = f"{feed_name}: Request timed out"
        scraping_state["errors"].append(error_msg)
        scraping_state["feed_stats"][feed_name] = {"found": 0, "saved": 0, "duplicates": 0, "errors": 1}
        add_log(error_msg, "error")
        return 0
    except requests.exceptions.RequestException as e:
        error_msg = f"{feed_name}: {str(e)}"
        scraping_state["errors"].append(error_msg)
        scraping_state["feed_stats"][feed_name] = {"found": 0, "saved": 0, "duplicates": 0, "errors": 1}
        add_log(error_msg, "error")
        return 0
    except Exception as e:
        error_msg = f"{feed_name}: {str(e)}"
        scraping_state["errors"].append(error_msg)
        scraping_state["feed_stats"][feed_name] = {"found": 0, "saved": 0, "duplicates": 0, "errors": 1}
        add_log(error_msg, "error")
        return 0

@app.route('/api/config', methods=['GET'])
def get_config():
    """Check if back4app is configured via environment variables"""
    return jsonify({
        "configured": bool(BACK4APP_APP_ID and BACK4APP_REST_KEY),
        "hasAppId": bool(BACK4APP_APP_ID),
        "hasRestKey": bool(BACK4APP_REST_KEY)
    })

@app.route('/api/parse-diagnostics', methods=['GET'])
def get_parse_diagnostics():
    """Get Parse/Back4App initialization diagnostics for debugging."""
    # Re-test connection on demand
    current_test = {
        "timestamp": datetime.now().isoformat(),
        "level": "info",
        "message": "Running live connection test..."
    }

    test_result = None
    try:
        if BACK4APP_APP_ID and BACK4APP_REST_KEY:
            test_url = f"{BACK4APP_URL}?limit=1"
            response = back4app_session.get(test_url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                test_result = {
                    "success": True,
                    "status_code": response.status_code,
                    "results_count": len(data.get('results', [])),
                    "message": "Connection successful"
                }
            else:
                test_result = {
                    "success": False,
                    "status_code": response.status_code,
                    "response_text": response.text[:500],
                    "message": f"HTTP {response.status_code}"
                }
        else:
            test_result = {
                "success": False,
                "message": "Credentials not configured"
            }
    except Exception as e:
        test_result = {
            "success": False,
            "message": f"{type(e).__name__}: {str(e)}"
        }

    return jsonify({
        "initialization_log": parse_init_log,
        "current_state": {
            "BACK4APP_APP_ID": f"{BACK4APP_APP_ID[:8]}..." if BACK4APP_APP_ID else None,
            "BACK4APP_REST_KEY": f"{BACK4APP_REST_KEY[:8]}..." if BACK4APP_REST_KEY else None,
            "BACK4APP_URL": BACK4APP_URL,
            "session_headers": {
                "X-Parse-Application-Id": back4app_session.headers.get("X-Parse-Application-Id", "")[:12] + "..." if back4app_session.headers.get("X-Parse-Application-Id") else "EMPTY",
                "X-Parse-REST-API-Key": back4app_session.headers.get("X-Parse-REST-API-Key", "")[:12] + "..." if back4app_session.headers.get("X-Parse-REST-API-Key") else "EMPTY",
            },
            "initial_connection_ok": parse_connection_ok
        },
        "live_test": test_result
    })
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
        "feed_stats": dict(scraping_state.get("feed_stats", {})),
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

def run_scraper_in_background(start_from_feed=0, selected_feeds=None):
    """Background thread function to process all feeds

    Args:
        start_from_feed: Index to start from (for resuming)
        selected_feeds: Optional list of feed names to process. If None, process all.
    """
    all_feeds = get_all_feeds()

    # Get list of feeds to process
    if selected_feeds:
        # Filter to only selected feeds that exist
        feed_names = [name for name in selected_feeds if name in all_feeds]
    else:
        feed_names = list(all_feeds.keys())

    # Update total feeds count
    scraping_state["total_feeds"] = len(feed_names)

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

        feed_config = all_feeds[feed_name]
        fetch_and_process_feed(feed_name, feed_config, idx)
        feeds_completed += 1

        # Save periodic checkpoint after each feed completes (in case of crash/restart)
        save_scrape_history(status="in_progress", feeds_processed=feeds_completed)

    # Mark as complete
    scraping_state["is_running"] = False
    scraping_state["current_source"] = ""
    scraping_state["current_meeting"] = None
    scraping_state["progress_message"] = "Completed!"

    # Final summary with breakdown
    total_found = scraping_state['total_found']
    total_saved = scraping_state['total_saved']
    total_duplicates = scraping_state['total_duplicates']
    total_errors = scraping_state['total_errors']

    add_log("─" * 40, "info")
    add_log(f"SUMMARY: {total_found} found → {total_saved} saved", "success")
    add_log(f"  • New meetings saved: {total_saved}", "info")
    add_log(f"  • Duplicates skipped: {total_duplicates}", "info")
    if total_errors > 0:
        add_log(f"  • Errors: {total_errors}", "warning")
    add_log("─" * 40, "info")

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
    scraping_state["total_duplicates"] = data.get('resume_total_duplicates', 0)
    scraping_state["total_errors"] = data.get('resume_total_errors', 0)
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
    scraping_state["feed_stats"] = data.get('resume_feed_stats', {})
    scraping_state["started_at"] = data.get('resume_started_at') or datetime.now().isoformat()
    scraping_state["scrape_id"] = resume_scrape_id or generate_object_id()  # Use existing or new ID

    # Get selected feeds (optional - if not provided, all feeds are used)
    all_feeds = get_all_feeds()
    selected_feeds = data.get('selected_feeds', None)
    if selected_feeds:
        feeds_to_process = [name for name in selected_feeds if name in all_feeds]
        scraping_state["total_feeds"] = len(feeds_to_process)
    else:
        feeds_to_process = list(all_feeds.keys())
        scraping_state["total_feeds"] = len(all_feeds)

    if resume_scrape_id:
        current_scrape_object_id = data.get('resume_object_id')
        add_log(f"Resuming scrape - starting from feed {resume_feeds_processed + 1} of {scraping_state['total_feeds']}", "info")
    else:
        current_scrape_object_id = None  # Reset for new scrape
        feed_names = ', '.join(feeds_to_process) if len(feeds_to_process) <= 3 else f"{len(feeds_to_process)} feeds"
        add_log(f"Scraping started - {feed_names}", "info")

        # Create initial scrape history record in Back4app immediately
        save_scrape_history(status="in_progress", feeds_processed=0)

    # Start background thread with resume offset and selected feeds
    thread = threading.Thread(
        target=run_scraper_in_background,
        args=(resume_feeds_processed, selected_feeds),
        daemon=True
    )
    thread.start()

    return jsonify({"success": True, "message": "Scraper started", "scrape_id": scraping_state["scrape_id"]})

@app.route('/api/scrape-next', methods=['POST'])
def scrape_next_feed():
    """Scrape the next feed in the queue - called by frontend to process one feed at a time"""
    if not scraping_state["is_running"]:
        return jsonify({"success": False, "message": "Scraper not running", "done": True})

    data = request.json or {}
    feed_index = data.get('feed_index', 0)

    all_feeds = get_all_feeds()
    feed_names = list(all_feeds.keys())

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
    feed_config = all_feeds[feed_name]

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
    scraping_state["total_duplicates"] = 0
    scraping_state["total_errors"] = 0
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
    scraping_state["feed_stats"] = {}
    return jsonify({"success": True, "message": "Scraper state reset"})

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current scraping status"""
    return jsonify(scraping_state)


@app.route('/api/cache-stats', methods=['GET'])
def get_cache_stats():
    """Get cache statistics for monitoring memory usage and performance."""
    return jsonify({
        "caches": [
            changelog_cache.stats(),
            users_cache.stats(),
            api_versions_cache.stats(),
            git_versions_cache.stats(),
            coverage_gaps_cache.stats(),
            feeds_cache.stats(),
            {
                "name": "state_meeting_counts",
                "entries": 1 if state_meeting_counts_cache["data"] else 0,
                "max_entries": 1,
                "ttl_seconds": state_meeting_counts_cache["ttl"],
                "last_updated": state_meeting_counts_cache["last_updated"]
            },
            {
                "name": "geocode",
                "entries": len(geocode_cache),
                "max_entries": "unlimited",
                "ttl_seconds": "permanent"
            },
            {
                "name": "task_state_index",
                "entries": len(task_state_index),
                "description": "O(1) task lookup by state"
            }
        ]
    })


@app.route('/api/feeds', methods=['GET'])
def get_feeds():
    """Get list of configured feeds with statistics (meeting count, last scrape time)"""
    # Check cache first for fast response
    cached_response = feeds_cache.get('feeds_list')
    if cached_response is not None:
        return jsonify(cached_response)

    all_feeds = get_all_feeds()

    # Get meeting counts by source from Back4app
    meeting_counts = {}
    last_scraped = {}

    if BACK4APP_APP_ID and BACK4APP_REST_KEY:
        try:
            headers = {
                "X-Parse-Application-Id": BACK4APP_APP_ID,
                "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
            }
            import urllib.parse

            # First, get feed stats from recent scrape history (most accurate and fast)
            if scrape_history:
                latest_completed = next(
                    (h for h in scrape_history if h.get("status") == "completed"),
                    None
                )
                if latest_completed:
                    feed_stats = latest_completed.get("feed_stats", {})
                    for feed_name, stats in feed_stats.items():
                        meeting_counts[feed_name] = stats.get("saved", 0)
                        last_scraped[feed_name] = latest_completed.get("completed_at")

            # If no history in memory, try to get from Back4app
            if not meeting_counts:
                # Get the most recent completed scrape from Back4app
                history_url = "https://parseapi.back4app.com/classes/ScrapeHistory?where=" + urllib.parse.quote('{"status":"completed"}') + "&order=-completedAt&limit=1"
                response = requests.get(history_url, headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    results = data.get("results", [])
                    if results:
                        latest = results[0]
                        feed_stats = latest.get("feed_stats", {})
                        completed_at = latest.get("completed_at") or latest.get("completedAt")
                        for feed_name, stats in feed_stats.items():
                            if isinstance(stats, dict):
                                meeting_counts[feed_name] = stats.get("saved", 0)
                            else:
                                meeting_counts[feed_name] = 0
                            last_scraped[feed_name] = completed_at

            # For feeds without counts, use a single batch query instead of N+1
            # Fetch sourceFeed field from a sample of meetings and count locally
            feeds_needing_counts = [f for f in all_feeds.keys() if f not in meeting_counts]
            if feeds_needing_counts:
                try:
                    # Single query: get sourceFeed for all meetings (limited to 5000 for performance)
                    # Only fetch the sourceFeed field to minimize data transfer
                    batch_url = "https://parseapi.back4app.com/classes/Meetings?keys=sourceFeed&limit=5000"
                    batch_response = requests.get(batch_url, headers=headers, timeout=15)
                    if batch_response.status_code == 200:
                        batch_data = batch_response.json()
                        meetings = batch_data.get("results", [])
                        # Count meetings by sourceFeed locally
                        for meeting in meetings:
                            source = meeting.get("sourceFeed")
                            if source:
                                meeting_counts[source] = meeting_counts.get(source, 0) + 1
                except Exception as e:
                    print(f"Error in batch feed count query: {e}")
                    # Fallback: set unknown feeds to 0 rather than making N+1 queries
                    for feed_name in feeds_needing_counts:
                        if feed_name not in meeting_counts:
                            meeting_counts[feed_name] = 0

        except Exception as e:
            print(f"Error fetching feed statistics: {e}")

    response_data = {
        "feeds": [
            {
                "name": name,
                "state": config["state"],
                "type": config.get("type", "tsml"),
                "meetingCount": meeting_counts.get(name, 0),
                "lastScraped": last_scraped.get(name)
            }
            for name, config in all_feeds.items()
        ]
    }

    # Cache the response for 5 minutes
    feeds_cache.set('feeds_list', response_data)

    return jsonify(response_data)

@app.route('/api/version', methods=['GET'])
def get_version():
    """Get build version for deployment detection"""
    return jsonify({
        "version": BUILD_VERSION,
        "started_at": BUILD_VERSION
    })

@app.route('/api/versions', methods=['GET'])
def get_version_history():
    """Get detailed version history from git tags with commit info.
    Results are cached for 5 minutes to avoid repeated git subprocess calls.
    """
    import subprocess

    # Check cache first
    cached = git_versions_cache.get('version_history')
    if cached is not None:
        return jsonify(cached)

    versions = []

    try:
        # Get all tags sorted by version (newest first)
        result = subprocess.run(
            ['git', 'tag', '-l', '--sort=-v:refname'],
            capture_output=True, text=True, timeout=10
        )
        tags = [t.strip() for t in result.stdout.strip().split('\n') if t.strip()]

        for tag in tags[:20]:  # Limit to 20 most recent versions
            try:
                # Get commit hash for this tag
                hash_result = subprocess.run(
                    ['git', 'rev-list', '-n', '1', tag],
                    capture_output=True, text=True, timeout=5
                )
                commit_hash = hash_result.stdout.strip()[:7] if hash_result.stdout else ''

                # Get commit date for this tag
                date_result = subprocess.run(
                    ['git', 'log', '-1', '--format=%ci', tag],
                    capture_output=True, text=True, timeout=5
                )
                commit_date = date_result.stdout.strip() if date_result.stdout else ''

                # Get commit message for this tag
                msg_result = subprocess.run(
                    ['git', 'log', '-1', '--format=%s', tag],
                    capture_output=True, text=True, timeout=5
                )
                commit_message = msg_result.stdout.strip() if msg_result.stdout else ''

                # Get tag annotation if it exists
                annotation_result = subprocess.run(
                    ['git', 'tag', '-l', '-n99', tag],
                    capture_output=True, text=True, timeout=5
                )
                annotation = ''
                if annotation_result.stdout:
                    # Format: "tag_name  annotation text"
                    parts = annotation_result.stdout.strip().split(None, 1)
                    if len(parts) > 1:
                        annotation = parts[1]

                versions.append({
                    "tag": tag,
                    "version": tag.lstrip('v'),  # Remove 'v' prefix if present
                    "commit_hash": commit_hash,
                    "commit_date": commit_date,
                    "commit_message": commit_message,
                    "annotation": annotation,
                    "is_current": False  # Will be updated below
                })
            except Exception as e:
                print(f"Error getting details for tag {tag}: {e}")
                continue

        # Mark current version based on HEAD
        if versions:
            try:
                head_result = subprocess.run(
                    ['git', 'describe', '--tags', '--exact-match', 'HEAD'],
                    capture_output=True, text=True, timeout=5
                )
                current_tag = head_result.stdout.strip()
                for v in versions:
                    if v['tag'] == current_tag:
                        v['is_current'] = True
                        break
            except:
                # HEAD may not be on a tag
                pass

        # Also get recent commits not yet tagged (for upcoming version info)
        recent_commits = []
        try:
            # Get commits since last tag (if any)
            if tags:
                log_result = subprocess.run(
                    ['git', 'log', f'{tags[0]}..HEAD', '--oneline', '--no-decorate'],
                    capture_output=True, text=True, timeout=10
                )
            else:
                log_result = subprocess.run(
                    ['git', 'log', '-10', '--oneline', '--no-decorate'],
                    capture_output=True, text=True, timeout=10
                )

            for line in log_result.stdout.strip().split('\n')[:10]:
                if line.strip():
                    parts = line.split(' ', 1)
                    recent_commits.append({
                        "hash": parts[0],
                        "message": parts[1] if len(parts) > 1 else ''
                    })
        except Exception as e:
            print(f"Error getting recent commits: {e}")

        result = {
            "versions": versions,
            "recent_commits": recent_commits,
            "has_tags": len(tags) > 0,
            "build_version": BUILD_VERSION
        }

        # Cache the result
        git_versions_cache.set('version_history', result)

        return jsonify(result)

    except FileNotFoundError:
        # Git not available
        return jsonify({
            "versions": [],
            "recent_commits": [],
            "has_tags": False,
            "build_version": BUILD_VERSION,
            "error": "Git not available on server"
        })
    except subprocess.TimeoutExpired:
        return jsonify({
            "versions": [],
            "recent_commits": [],
            "has_tags": False,
            "build_version": BUILD_VERSION,
            "error": "Git command timed out"
        })
    except Exception as e:
        return jsonify({
            "versions": [],
            "recent_commits": [],
            "has_tags": False,
            "build_version": BUILD_VERSION,
            "error": str(e)
        })

# API Versions with changelog support
API_VERSIONS = {
    "v1.8": {
        "version": "v1.8",
        "label": "v1.8 (Latest)",
        "description": "Enhanced search, loading overlay, navigation buttons, and state heatmaps",
        "status": "stable",
        "released_at": "2026-01-21",
        "features": [
            "Enhanced search bar with multi-day/type selection",
            "Loading overlay with real-time status logs",
            "Navigate and Join Meeting buttons",
            "State coverage heatmap visualization",
            "Smart scrape defaults and saved configs"
        ],
        "endpoints": [
            "/api/meetings",
            "/api/meetings/heatmap",
            "/api/meetings/by-state"
        ]
    },
    "v1": {
        "version": "v1",
        "label": "v1 (Stable)",
        "description": "Current stable API with full meeting data support",
        "status": "stable",
        "released_at": "2025-12-01",
        "features": [
            "Full meeting list with pagination",
            "Search and filtering",
            "Heatmap clustering",
            "State-based grouping"
        ],
        "endpoints": [
            "/api/meetings",
            "/api/meetings/heatmap",
            "/api/meetings/by-state"
        ]
    },
    "v2-beta": {
        "version": "v2-beta",
        "label": "v2 Beta",
        "description": "Next generation API with enhanced features",
        "status": "beta",
        "released_at": "2026-01-15",
        "features": [
            "All v1 features",
            "Enhanced filtering options",
            "Improved response format",
            "Batch operations support",
            "Webhooks (coming soon)"
        ],
        "endpoints": [
            "/api/v2/meetings",
            "/api/v2/meetings/heatmap",
            "/api/v2/meetings/by-state",
            "/api/v2/batch"
        ]
    }
}

@app.route('/api/api-versions', methods=['GET'])
def get_api_versions():
    """Get available API versions with their details"""
    return jsonify({
        "versions": list(API_VERSIONS.values()),
        "current_default": "v1.8"
    })

def parse_unreleased_fragments(base_path):
    """Parse unreleased changelog fragments from the fragments directory.

    Returns a dict with sections: New Features, Bug Fixes, UI/UX Improvements
    """
    sections = {}

    # Map directory names to section names
    dir_to_section = {
        'features': 'New Features',
        'fixes': 'Bug Fixes',
        'improvements': 'UI/UX Improvements'
    }

    unreleased_path = os.path.join(base_path, 'changelog', 'unreleased')

    if not os.path.exists(unreleased_path):
        return sections

    for dir_name, section_name in dir_to_section.items():
        dir_path = os.path.join(unreleased_path, dir_name)
        if not os.path.exists(dir_path):
            continue

        items = []
        for filename in sorted(os.listdir(dir_path)):
            if not filename.endswith('.md') or filename == '.gitkeep':
                continue

            filepath = os.path.join(dir_path, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read().strip()

                if not content:
                    continue

                # Parse the fragment - format is:
                # **Title**: Description
                # - Detail 1
                # - Detail 2
                lines = content.split('\n')
                current_item = None

                for line in lines:
                    line = line.rstrip()

                    # Match main bullet: **Title**: Description
                    title_match = re.match(r'^\*\*(.+?)\*\*:?\s*(.*)$', line)
                    if title_match:
                        if current_item:
                            items.append(current_item)
                        current_item = {
                            "title": title_match.group(1),
                            "description": title_match.group(2) if title_match.group(2) else "",
                            "details": []
                        }
                        continue

                    # Match detail bullet: - Detail text
                    detail_match = re.match(r'^- (.+)$', line)
                    if detail_match and current_item:
                        current_item["details"].append(detail_match.group(1))

                if current_item:
                    items.append(current_item)

            except Exception:
                continue

        if items:
            sections[section_name] = items

    return sections


@app.route('/api/changelog', methods=['GET'])
def get_changelog():
    """Get changelog from CHANGELOG.md file and unreleased fragments, parsed into structured format.
    Results are cached for 5 minutes to improve performance.

    Always includes unreleased changes from fragments directory if any exist.
    """
    # Check cache first
    cached = changelog_cache.get('changelog')
    if cached is not None:
        return jsonify(cached)

    # Determine base path for finding files
    base_path = os.path.dirname(os.path.dirname(__file__))
    if not os.path.exists(os.path.join(base_path, 'CHANGELOG.md')):
        base_path = os.path.dirname(__file__)
        if not os.path.exists(os.path.join(base_path, '..', 'CHANGELOG.md')):
            base_path = '/home/user/meeting-scraper'

    changelog_path = os.path.join(base_path, 'CHANGELOG.md')
    if not os.path.exists(changelog_path):
        changelog_path = os.path.join(os.path.dirname(__file__), '..', 'CHANGELOG.md')

    versions = []

    # First, parse unreleased fragments and add as first version if any exist
    unreleased_sections = parse_unreleased_fragments(base_path)
    if unreleased_sections:
        unreleased_version = {
            "version": "Unreleased",
            "date": None,
            "sections": unreleased_sections
        }
        versions.append(unreleased_version)

    try:
        with open(changelog_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse the changelog into structured format
        current_version = None
        current_section = None

        for line in content.split('\n'):
            line = line.rstrip()

            # Match version headers like "## [1.5.4] - 2026-01-21" or "## [Unreleased]"
            version_match = re.match(r'^## \[([^\]]+)\](?:\s*-\s*(.+))?', line)
            if version_match:
                if current_version:
                    versions.append(current_version)

                version_num = version_match.group(1)
                release_date = version_match.group(2) if version_match.group(2) else None

                # Skip if this is an "Unreleased" section in CHANGELOG.md (we use fragments instead)
                if version_num.lower() == 'unreleased':
                    current_version = None
                    current_section = None
                    continue

                current_version = {
                    "version": version_num,
                    "date": release_date,
                    "sections": {}
                }
                current_section = None
                continue

            # Match section headers like "### New Features"
            section_match = re.match(r'^### (.+)', line)
            if section_match and current_version:
                current_section = section_match.group(1)
                if current_section not in current_version["sections"]:
                    current_version["sections"][current_section] = []
                continue

            # Match bullet points
            bullet_match = re.match(r'^- \*\*(.+?)\*\*:?\s*(.*)$', line)
            if bullet_match and current_version and current_section:
                item = {
                    "title": bullet_match.group(1),
                    "description": bullet_match.group(2) if bullet_match.group(2) else "",
                    "details": []
                }
                current_version["sections"][current_section].append(item)
                continue

            # Match sub-bullets (indented with spaces)
            sub_bullet_match = re.match(r'^  - (.+)$', line)
            if sub_bullet_match and current_version and current_section:
                sections = current_version["sections"][current_section]
                if sections:
                    sections[-1]["details"].append(sub_bullet_match.group(1))
                continue

        # Don't forget the last version
        if current_version:
            versions.append(current_version)

        result = {
            "changelog": versions,
            "total_versions": len(versions)
        }

        # Cache the result
        changelog_cache.set('changelog', result)

        return jsonify(result)

    except FileNotFoundError:
        # Even if CHANGELOG.md is not found, return unreleased fragments if any
        if versions:
            result = {
                "changelog": versions,
                "total_versions": len(versions)
            }
            changelog_cache.set('changelog', result)
            return jsonify(result)

        return jsonify({
            "changelog": [],
            "total_versions": 0,
            "error": "Changelog file not found"
        })
    except Exception as e:
        # Even on error, return unreleased fragments if any
        if versions:
            result = {
                "changelog": versions,
                "total_versions": len(versions)
            }
            changelog_cache.set('changelog', result)
            return jsonify(result)

        return jsonify({
            "changelog": [],
            "total_versions": 0,
            "error": str(e)
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
            history_url = "https://parseapi.back4app.com/classes/ScrapeHistory?order=-createdAt&limit=20"
            response = requests.get(history_url, headers=headers, timeout=6)
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
                        "feed_stats": item.get("feed_stats", {}),
                        "errors": item.get("errors", []),
                        "status": item.get("status", "completed")
                    })
                return jsonify({"history": history})
        except Exception as e:
            print(f"Error fetching history from Back4app: {e}")

    return jsonify({"history": []})

@app.route('/api/history/feed/<path:feed_name>', methods=['GET'])
def get_feed_history(feed_name):
    """Get scrape history for a specific feed/source"""
    from urllib.parse import unquote
    feed_name = unquote(feed_name)

    feed_history = []

    # First check in-memory history
    if scrape_history:
        for entry in scrape_history:
            feed_stats = entry.get("feed_stats", {})
            if feed_name in feed_stats:
                stats = feed_stats[feed_name]
                feed_history.append({
                    "id": entry.get("id"),
                    "started_at": entry.get("started_at"),
                    "completed_at": entry.get("completed_at"),
                    "status": entry.get("status"),
                    "found": stats.get("found", 0),
                    "saved": stats.get("saved", 0),
                    "duplicates": stats.get("duplicates", 0),
                    "errors": stats.get("errors", 0)
                })
        if feed_history:
            return jsonify({"feed_name": feed_name, "history": feed_history})

    # Fall back to Back4app
    if BACK4APP_APP_ID and BACK4APP_REST_KEY:
        try:
            headers = {
                "X-Parse-Application-Id": BACK4APP_APP_ID,
                "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
            }
            history_url = "https://parseapi.back4app.com/classes/ScrapeHistory?order=-createdAt&limit=20"
            response = requests.get(history_url, headers=headers, timeout=6)
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                for item in results:
                    feed_stats = item.get("feed_stats", {})
                    if feed_name in feed_stats:
                        stats = feed_stats[feed_name]
                        feed_history.append({
                            "id": item.get("id") or item.get("objectId"),
                            "started_at": item.get("started_at"),
                            "completed_at": item.get("completed_at"),
                            "status": item.get("status", "completed"),
                            "found": stats.get("found", 0),
                            "saved": stats.get("saved", 0),
                            "duplicates": stats.get("duplicates", 0),
                            "errors": stats.get("errors", 0)
                        })
        except Exception as e:
            print(f"Error fetching feed history from Back4app: {e}")

    return jsonify({"feed_name": feed_name, "history": feed_history})

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
                        "total_feeds": len(get_all_feeds()),
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
        # Fetch all meetings with only the state field to count by state
        # This is much faster than making 52 separate requests
        import urllib.parse
        from collections import Counter

        meetings_by_state = Counter()
        total_meetings = 0
        skip = 0
        batch_size = 1000

        # Fetch all meetings in batches, only getting the state field
        while True:
            url = f"{BACK4APP_URL}?keys=state&limit={batch_size}&skip={skip}"
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code != 200:
                break

            data = response.json()
            results = data.get("results", [])
            if not results:
                break

            # Count meetings by state
            for meeting in results:
                state = meeting.get("state")
                if state:
                    meetings_by_state[state] += 1
                total_meetings += 1

            # If we got fewer results than batch_size, we've reached the end
            if len(results) < batch_size:
                break

            skip += batch_size

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
                "hasFeed": any(feed["state"] == state_code for feed in get_all_feeds().values()),
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
    """Get all meetings from Back4app for public viewing.

    Performance optimizations:
    - Uses connection pooling via requests.Session
    - Field projection reduces payload by ~60%
    - Cached count queries avoid duplicate requests
    """
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        # Return recent meetings from memory if no Back4app configured
        return jsonify({
            "meetings": scraping_state.get("recent_meetings", []),
            "total": len(scraping_state.get("recent_meetings", []))
        })

    try:
        # Get query parameters for filtering
        limit = request.args.get('limit', 1000, type=int)
        skip = request.args.get('skip', 0, type=int)
        state = request.args.get('state', '')
        day = request.args.get('day', '', type=str)
        search = request.args.get('search', '')
        meeting_type = request.args.get('type', '')
        city = request.args.get('city', '')
        online = request.args.get('online', '')
        hybrid = request.args.get('hybrid', '')
        meeting_format = request.args.get('format', '')

        # Geographic bounding box parameters
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        # Center point for distance-based sorting
        center_lat = request.args.get('center_lat', type=float)
        center_lng = request.args.get('center_lng', type=float)

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
        if city:
            where['city'] = city
        if online == 'true':
            where['isOnline'] = True
        if hybrid == 'true':
            where['isHybrid'] = True
        if meeting_format:
            where['format'] = meeting_format

        # Add geographic bounds filtering
        if all(v is not None for v in [north, south, east, west]):
            where['latitude'] = {"$gte": south, "$lte": north}
            where['longitude'] = {"$gte": west, "$lte": east}

        import urllib.parse
        params = {
            'limit': min(limit, 1000),
            'skip': skip,
            'order': '-createdAt',
            'keys': MEETING_LIST_FIELDS  # Field projection for smaller payload
        }
        if where:
            params['where'] = json.dumps(where)

        query_string = urllib.parse.urlencode(params)
        url = f"{BACK4APP_URL}?{query_string}"

        # Use session for connection pooling
        response = back4app_session.get(url, timeout=15)

        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])

            # Sort results by distance from center point if provided
            if center_lat is not None and center_lng is not None and results:
                def distance_from_center(meeting):
                    lat = meeting.get('latitude')
                    lng = meeting.get('longitude')
                    if lat is None or lng is None:
                        return float('inf')
                    # Use simple Euclidean distance adjusted for longitude compression
                    lat_diff = lat - center_lat
                    lng_diff = (lng - center_lng) * math.cos(math.radians(center_lat))
                    return lat_diff * lat_diff + lng_diff * lng_diff

                results.sort(key=distance_from_center)

            # Get total count for pagination with caching
            total = len(results)
            if len(results) == min(limit, 1000):
                # Build cache key from where clause
                cache_key = json.dumps(where, sort_keys=True) if where else "all"
                cached_count = meetings_count_cache.get(cache_key)

                if cached_count is not None:
                    total = cached_count
                else:
                    # Might be more results, get actual count
                    count_params = {'count': 1, 'limit': 0}
                    if where:
                        count_params['where'] = json.dumps(where)
                    count_query = urllib.parse.urlencode(count_params)
                    count_url = f"{BACK4APP_URL}?{count_query}"
                    try:
                        count_response = back4app_session.get(count_url, timeout=10)
                        if count_response.status_code == 200:
                            total = count_response.json().get("count", len(results))
                            meetings_count_cache.set(cache_key, total)
                    except:
                        pass  # Use len(results) as fallback

            return jsonify({
                "meetings": results,
                "total": total
            })
        else:
            return jsonify({"meetings": [], "total": 0, "error": "Failed to fetch meetings"}), 500

    except Exception as e:
        print(f"Error fetching meetings: {e}")
        return jsonify({"meetings": [], "total": 0, "error": str(e)}), 500


@app.route('/api/meetings/heatmap', methods=['GET'])
def get_meetings_heatmap():
    """Get aggregated heatmap data for efficient map display.

    Returns clustered meeting data based on zoom level, avoiding the need
    to load thousands of individual meetings at once.

    Performance optimizations:
    - Uses connection pooling via requests.Session
    """
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({"clusters": [], "total": 0})

    try:
        # Get query parameters
        zoom = request.args.get('zoom', 5, type=int)
        north = request.args.get('north', type=float)
        south = request.args.get('south', type=float)
        east = request.args.get('east', type=float)
        west = request.args.get('west', type=float)
        # Center point for distance-based sorting
        center_lat = request.args.get('center_lat', type=float)
        center_lng = request.args.get('center_lng', type=float)
        # Filter parameters
        day_filter = request.args.get('day', type=int)
        type_filter = request.args.get('type')
        state_filter = request.args.get('state')
        city_filter = request.args.get('city')
        online_filter = request.args.get('online')
        hybrid_filter = request.args.get('hybrid')
        format_filter = request.args.get('format')

        # Determine grid size based on zoom level
        # Lower zoom = larger grid cells = fewer clusters
        if zoom <= 4:
            grid_size = 5.0  # ~500km cells
        elif zoom <= 6:
            grid_size = 2.0  # ~200km cells
        elif zoom <= 8:
            grid_size = 1.0  # ~100km cells
        elif zoom <= 10:
            grid_size = 0.5  # ~50km cells
        elif zoom <= 12:
            grid_size = 0.2  # ~20km cells
        else:
            grid_size = 0.1  # ~10km cells - at this zoom, fetch individual meetings

        # Build where clause for bounds
        where = {
            'latitude': {"$exists": True},
            'longitude': {"$exists": True}
        }
        if all(v is not None for v in [north, south, east, west]):
            where['latitude'] = {"$gte": south, "$lte": north}
            where['longitude'] = {"$gte": west, "$lte": east}

        # Add filter conditions
        if day_filter is not None:
            where['day'] = day_filter
        if type_filter:
            where['meetingType'] = type_filter
        if state_filter:
            where['state'] = state_filter
        if city_filter:
            where['city'] = city_filter
        if online_filter == 'true':
            where['isOnline'] = True
        if hybrid_filter == 'true':
            where['isHybrid'] = True
        if format_filter:
            where['format'] = format_filter

        import urllib.parse

        # For high zoom levels (13+), return individual meetings
        if zoom >= 13:
            params = {
                'limit': 200,
                'keys': 'latitude,longitude,name,locationName,day,time,city,state,isOnline,isHybrid,meetingType',
                'where': json.dumps(where)
            }
            query_string = urllib.parse.urlencode(params)
            url = f"{BACK4APP_URL}?{query_string}"
            response = back4app_session.get(url, timeout=15)

            if response.status_code == 200:
                data = response.json()
                meetings = data.get("results", [])

                # Sort meetings by distance from center point if provided
                if center_lat is not None and center_lng is not None and meetings:
                    def distance_from_center(meeting):
                        lat = meeting.get('latitude')
                        lng = meeting.get('longitude')
                        if lat is None or lng is None:
                            return float('inf')
                        # Use simple Euclidean distance (sufficient for small areas at high zoom)
                        # Adjust for longitude compression at latitude
                        lat_diff = lat - center_lat
                        lng_diff = (lng - center_lng) * math.cos(math.radians(center_lat))
                        return lat_diff * lat_diff + lng_diff * lng_diff

                    meetings.sort(key=distance_from_center)

                return jsonify({
                    "clusters": [],
                    "meetings": meetings,
                    "total": len(meetings),
                    "mode": "individual"
                })
            return jsonify({"clusters": [], "meetings": [], "total": 0, "mode": "individual"})

        # For lower zoom levels, fetch and aggregate into clusters
        params = {
            'limit': 1000,
            'keys': 'latitude,longitude',
            'where': json.dumps(where)
        }
        query_string = urllib.parse.urlencode(params)
        url = f"{BACK4APP_URL}?{query_string}"
        response = back4app_session.get(url, timeout=15)

        if response.status_code != 200:
            return jsonify({"clusters": [], "total": 0, "mode": "clustered"})

        data = response.json()
        results = data.get("results", [])

        # Aggregate meetings into grid cells
        clusters = {}
        for meeting in results:
            lat = meeting.get('latitude')
            lng = meeting.get('longitude')
            if lat is None or lng is None:
                continue

            # Calculate grid cell
            cell_lat = round(lat / grid_size) * grid_size
            cell_lng = round(lng / grid_size) * grid_size
            cell_key = f"{cell_lat},{cell_lng}"

            if cell_key not in clusters:
                clusters[cell_key] = {
                    'lat': cell_lat,
                    'lng': cell_lng,
                    'count': 0,
                    'sum_lat': 0,
                    'sum_lng': 0
                }
            clusters[cell_key]['count'] += 1
            clusters[cell_key]['sum_lat'] += lat
            clusters[cell_key]['sum_lng'] += lng

        # Convert to list and calculate centroid for each cluster
        cluster_list = []
        for cluster in clusters.values():
            if cluster['count'] > 0:
                cluster_list.append({
                    'lat': cluster['sum_lat'] / cluster['count'],  # Centroid
                    'lng': cluster['sum_lng'] / cluster['count'],
                    'count': cluster['count']
                })

        # Sort by count descending
        cluster_list.sort(key=lambda x: x['count'], reverse=True)

        return jsonify({
            "clusters": cluster_list,
            "total": len(results),
            "mode": "clustered",
            "gridSize": grid_size
        })

    except Exception as e:
        print(f"Error fetching heatmap data: {e}")
        return jsonify({"clusters": [], "total": 0, "error": str(e)}), 500


# ==================== Thumbnail Generation ====================
from thumbnail_service import (
    request_thumbnail,
    get_placeholder_thumbnail,
    get_thumbnail_status,
    get_queue_stats,
    start_thumbnail_worker
)

# Start thumbnail workers if API keys are configured
if BACK4APP_APP_ID and BACK4APP_REST_KEY:
    start_thumbnail_worker(BACK4APP_APP_ID, BACK4APP_REST_KEY, num_workers=2)


@app.route('/api/meetings/by-state', methods=['GET'])
def get_meetings_by_state():
    """Get meeting counts by state for efficient map overview display.

    Returns cached aggregated counts with state center coordinates.
    This is very fast and avoids fetching individual meetings.
    """
    import time

    # Check cache
    cache = state_meeting_counts_cache
    current_time = time.time()

    if cache["last_updated"] and (current_time - cache["last_updated"]) < cache["ttl"]:
        # Return cached data
        return jsonify(cache["data"])

    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({"states": [], "total": 0})

    headers = {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
    }

    try:
        from collections import Counter

        # Fetch all meetings with only state field (very efficient)
        meetings_by_state = Counter()
        total_meetings = 0
        skip = 0
        batch_size = 1000

        while True:
            url = f"{BACK4APP_URL}?keys=state&limit={batch_size}&skip={skip}"
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code != 200:
                break

            data = response.json()
            results = data.get("results", [])
            if not results:
                break

            for meeting in results:
                state = meeting.get("state")
                if state:
                    meetings_by_state[state] += 1
                total_meetings += 1

            if len(results) < batch_size:
                break

            skip += batch_size

        # Build state data with coordinates
        states = []
        for state_code, count in meetings_by_state.items():
            if state_code in US_STATE_CENTERS:
                lat, lng = US_STATE_CENTERS[state_code]
                states.append({
                    "state": state_code,
                    "stateName": US_STATE_NAMES.get(state_code, state_code),
                    "count": count,
                    "lat": lat,
                    "lng": lng
                })

        # Sort by count descending
        states.sort(key=lambda x: x["count"], reverse=True)

        result = {
            "states": states,
            "total": total_meetings,
            "statesWithMeetings": len(states)
        }

        # Update cache
        cache["data"] = result
        cache["last_updated"] = current_time

        return jsonify(result)

    except Exception as e:
        print(f"Error fetching meetings by state: {e}")
        return jsonify({"states": [], "total": 0, "error": str(e)}), 500


@app.route('/api/thumbnail/<meeting_id>', methods=['GET'])
def get_thumbnail(meeting_id):
    """Get or generate thumbnail for a meeting."""
    try:
        # Fetch meeting from Back4app
        response = requests.get(
            f'{BACK4APP_URL}/{meeting_id}',
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            timeout=10
        )

        if response.status_code != 200:
            return jsonify({'error': 'Meeting not found'}), 404

        meeting = response.json()

        # If already has thumbnail, return it
        if meeting.get('thumbnailUrl'):
            return jsonify({
                'thumbnailUrl': meeting['thumbnailUrl'],
                'status': 'complete',
                'cached': True
            })

        # Request generation (non-blocking) and return placeholder
        placeholder_url = request_thumbnail(meeting)

        return jsonify({
            'thumbnailUrl': placeholder_url,
            'status': get_thumbnail_status(meeting_id),
            'cached': False
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/thumbnail/<meeting_id>/placeholder', methods=['GET'])
def get_placeholder(meeting_id):
    """Get instant SVG placeholder thumbnail (no queue, no API)."""
    try:
        # Fetch meeting from Back4app
        response = requests.get(
            f'{BACK4APP_URL}/{meeting_id}',
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            timeout=10
        )

        if response.status_code != 200:
            return jsonify({'error': 'Meeting not found'}), 404

        meeting = response.json()
        placeholder_url = get_placeholder_thumbnail(meeting)

        return jsonify({
            'thumbnailUrl': placeholder_url,
            'status': 'placeholder'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/thumbnails/status', methods=['GET'])
def thumbnails_status():
    """Get thumbnail generation queue status."""
    return jsonify(get_queue_stats())


@app.route('/api/thumbnails/batch', methods=['POST'])
def request_thumbnails_batch():
    """Request thumbnails for multiple meetings at once."""
    try:
        data = request.get_json() or {}
        meeting_ids = data.get('meetingIds', [])

        if not meeting_ids:
            return jsonify({'error': 'No meeting IDs provided'}), 400

        results = {}

        # Fetch meetings from Back4app (batch query)
        where_clause = json.dumps({'objectId': {'$in': meeting_ids}})
        response = requests.get(
            BACK4APP_URL,
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            params={'where': where_clause, 'limit': 100},
            timeout=15
        )

        if response.status_code == 200:
            meetings = response.json().get('results', [])
            for meeting in meetings:
                meeting_id = meeting.get('objectId')
                if meeting.get('thumbnailUrl'):
                    results[meeting_id] = {
                        'thumbnailUrl': meeting['thumbnailUrl'],
                        'status': 'complete'
                    }
                else:
                    placeholder = request_thumbnail(meeting)
                    results[meeting_id] = {
                        'thumbnailUrl': placeholder,
                        'status': get_thumbnail_status(meeting_id)
                    }

        return jsonify({'thumbnails': results})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# USER MANAGEMENT ENDPOINTS
# =====================================================

BACK4APP_USER_URL = "https://parseapi.back4app.com/classes/DashboardUser"
OWNER_EMAIL = "chris.thompson@sobersidekick.com"

# User permissions definitions
USER_PERMISSIONS = {
    'view_meetings': {
        'label': 'View Meetings',
        'description': 'View meetings list and details',
        'category': 'Meetings'
    },
    'manage_meetings': {
        'label': 'Manage Meetings',
        'description': 'Edit, update, and delete meetings',
        'category': 'Meetings'
    },
    'run_scraper': {
        'label': 'Run Scraper',
        'description': 'Execute scraper operations',
        'category': 'Operations'
    },
    'view_heatmap': {
        'label': 'View Heatmap',
        'description': 'Access heatmap visualization',
        'category': 'Analytics'
    },
    'view_analytics': {
        'label': 'View Analytics',
        'description': 'Access analytics and reports',
        'category': 'Analytics'
    },
    'manage_tasks': {
        'label': 'Manage Tasks',
        'description': 'Create and manage research tasks',
        'category': 'Operations'
    },
    'manage_users': {
        'label': 'Manage Users',
        'description': 'Invite users and manage permissions',
        'category': 'Administration'
    }
}

# All permission keys for admin users
ALL_PERMISSIONS = list(USER_PERMISSIONS.keys())

# Default permissions for standard users
DEFAULT_STANDARD_PERMISSIONS = ['view_meetings', 'view_heatmap', 'view_analytics']

# View-only permissions for domain users who join without invite
VIEW_ONLY_PERMISSIONS = ['view_meetings', 'view_heatmap', 'view_analytics']

# Allowed domains for auto-access (domain users can log in without invite)
ALLOWED_DOMAINS = ['sobersidekick.com', 'empathyhealthtech.com']

# Email configuration (using environment variables)
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
APP_URL = os.environ.get('APP_URL', 'http://localhost:3000')


def send_invite_email(to_email, invite_token, inviter_name, cc_email=None):
    """Send invitation email to new user."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    if not SMTP_USER or not SMTP_PASS:
        print(f"SMTP not configured - would send invite to {to_email}")
        return False

    try:
        invite_url = f"{APP_URL}?invite={invite_token}"

        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'You\'ve been invited to Sober Sidekick Admin Dashboard'
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        if cc_email:
            msg['Cc'] = cc_email

        text = f"""
Hi there!

{inviter_name} has invited you to join the Sober Sidekick Admin Dashboard.

Click the link below to accept your invitation:
{invite_url}

This invitation will expire in 7 days.

Best regards,
Sober Sidekick Team
"""

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .logo {{ font-size: 24px; font-weight: bold; color: #2f5dff; }}
        .content {{ background: #f9fafb; border-radius: 12px; padding: 30px; margin: 20px 0; }}
        .button {{ display: inline-block; background: #2f5dff; color: white !important; padding: 14px 28px;
                   text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
        .footer {{ text-align: center; color: #666; font-size: 14px; margin-top: 30px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Sober Sidekick</div>
        </div>
        <div class="content">
            <p>Hi there!</p>
            <p><strong>{inviter_name}</strong> has invited you to join the Sober Sidekick Admin Dashboard.</p>
            <p style="text-align: center;">
                <a href="{invite_url}" class="button">Accept Invitation</a>
            </p>
            <p style="font-size: 13px; color: #666;">
                Or copy and paste this link: {invite_url}
            </p>
        </div>
        <div class="footer">
            <p>This invitation will expire in 7 days.</p>
            <p>Sober Sidekick - You're Never Alone</p>
        </div>
    </div>
</body>
</html>
"""

        msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        recipients = [to_email]
        if cc_email:
            recipients.append(cc_email)
        server.sendmail(SMTP_USER, recipients, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send invite email: {e}")
        return False


@app.route('/api/users', methods=['GET'])
def get_users():
    """Get all dashboard users. Results are cached for 60 seconds."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({'error': 'Back4app not configured'}), 400

    # Check cache first
    cached = users_cache.get('all_users')
    if cached is not None:
        return jsonify(cached)

    try:
        response = requests.get(
            BACK4APP_USER_URL,
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            params={'order': '-createdAt', 'limit': 100},
            timeout=15  # Reduced timeout - fail faster if Back4App is slow
        )

        if response.status_code == 200:
            users = response.json().get('results', [])
            result = {'users': users}
            # Cache the result
            users_cache.set('all_users', result)
            return jsonify(result)
        else:
            return jsonify({'error': 'Failed to fetch users'}), response.status_code

    except requests.exceptions.Timeout:
        # Return cached data if available, even if expired
        return jsonify({'error': 'Request timed out. Please try again.'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/permissions', methods=['GET'])
def get_permissions():
    """Get all available permission definitions."""
    return jsonify({
        'permissions': USER_PERMISSIONS,
        'allPermissions': ALL_PERMISSIONS,
        'defaultStandardPermissions': DEFAULT_STANDARD_PERMISSIONS
    })


@app.route('/api/users', methods=['POST'])
def invite_user():
    """Invite a new user to the dashboard."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({'error': 'Back4app not configured'}), 400

    data = request.json
    email = data.get('email', '').lower().strip()
    role = data.get('role', 'standard')
    inviter_email = data.get('inviterEmail', '')
    inviter_name = data.get('inviterName', 'Admin')
    cc_email = data.get('ccEmail', '').strip() if data.get('ccEmail') else None

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Validate email format
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        return jsonify({'error': 'Invalid email format'}), 400

    # Validate role
    if role not in ['standard', 'admin']:
        return jsonify({'error': 'Invalid role'}), 400

    # Check if user already exists
    try:
        check_response = requests.get(
            BACK4APP_USER_URL,
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            params={'where': json.dumps({'email': email})},
            timeout=15
        )

        if check_response.status_code == 200:
            existing = check_response.json().get('results', [])
            if existing:
                return jsonify({'error': 'User already exists'}), 409

        # Generate invite token
        invite_token = ''.join(random.choices(string.ascii_letters + string.digits, k=32))

        # Set permissions based on role
        permissions = ALL_PERMISSIONS if role == 'admin' else DEFAULT_STANDARD_PERMISSIONS

        # Create user record
        user_data = {
            'email': email,
            'role': role,
            'status': 'pending',
            'inviteToken': invite_token,
            'invitedBy': inviter_email,
            'invitedAt': {'__type': 'Date', 'iso': datetime.utcnow().isoformat() + 'Z'},
            'isOwner': email == OWNER_EMAIL,
            'permissions': permissions
        }

        create_response = requests.post(
            BACK4APP_USER_URL,
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
                'Content-Type': 'application/json',
            },
            json=user_data,
            timeout=15
        )

        if create_response.status_code == 201:
            new_user = create_response.json()
            new_user.update(user_data)

            # Invalidate users cache since we added a new user
            users_cache.invalidate('all_users')

            # Send invite email
            email_sent = send_invite_email(email, invite_token, inviter_name, cc_email)

            return jsonify({
                'success': True,
                'user': new_user,
                'emailSent': email_sent
            }), 201
        else:
            return jsonify({'error': 'Failed to create user'}), create_response.status_code

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user role or status."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({'error': 'Back4app not configured'}), 400

    data = request.json
    requester_email = data.get('requesterEmail', '').lower()

    # First, fetch the user to check if they're the owner
    try:
        fetch_response = requests.get(
            f"{BACK4APP_USER_URL}/{user_id}",
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            timeout=15
        )

        if fetch_response.status_code != 200:
            return jsonify({'error': 'User not found'}), 404

        user = fetch_response.json()

        # Protect owner account
        if user.get('email') == OWNER_EMAIL or user.get('isOwner'):
            return jsonify({'error': 'Cannot modify owner account'}), 403

        # Build update data
        update_data = {}
        if 'role' in data:
            if data['role'] not in ['standard', 'admin']:
                return jsonify({'error': 'Invalid role'}), 400
            update_data['role'] = data['role']
            # When switching to admin, grant all permissions
            if data['role'] == 'admin':
                update_data['permissions'] = ALL_PERMISSIONS

        if 'status' in data:
            if data['status'] not in ['pending', 'active', 'suspended']:
                return jsonify({'error': 'Invalid status'}), 400
            update_data['status'] = data['status']

        if 'permissions' in data:
            # Validate permissions
            requested_perms = data['permissions']
            if not isinstance(requested_perms, list):
                return jsonify({'error': 'Permissions must be an array'}), 400
            # Filter to only valid permissions
            valid_perms = [p for p in requested_perms if p in ALL_PERMISSIONS]
            update_data['permissions'] = valid_perms

        if not update_data:
            return jsonify({'error': 'No valid fields to update'}), 400

        # Perform update
        update_response = requests.put(
            f"{BACK4APP_USER_URL}/{user_id}",
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
                'Content-Type': 'application/json',
            },
            json=update_data,
            timeout=15
        )

        if update_response.status_code == 200:
            # Invalidate users cache since we modified a user
            users_cache.invalidate('all_users')
            return jsonify({'success': True, 'user': {**user, **update_data}})
        else:
            return jsonify({'error': 'Failed to update user'}), update_response.status_code

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user (cannot delete owner)."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({'error': 'Back4app not configured'}), 400

    requester_email = request.args.get('requesterEmail', '').lower()

    # First, fetch the user to check if they're the owner
    try:
        fetch_response = requests.get(
            f"{BACK4APP_USER_URL}/{user_id}",
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            timeout=15
        )

        if fetch_response.status_code != 200:
            return jsonify({'error': 'User not found'}), 404

        user = fetch_response.json()

        # Protect owner account
        if user.get('email') == OWNER_EMAIL or user.get('isOwner'):
            return jsonify({'error': 'Cannot delete owner account'}), 403

        # Delete user
        delete_response = requests.delete(
            f"{BACK4APP_USER_URL}/{user_id}",
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            timeout=15
        )

        if delete_response.status_code == 200:
            # Invalidate users cache since we deleted a user
            users_cache.invalidate('all_users')
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to delete user'}), delete_response.status_code

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<user_id>/resend', methods=['POST'])
def resend_invite(user_id):
    """Resend invitation email to a pending user."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({'error': 'Back4app not configured'}), 400

    data = request.json
    inviter_name = data.get('inviterName', 'Admin')

    try:
        # Fetch the user
        fetch_response = requests.get(
            f"{BACK4APP_USER_URL}/{user_id}",
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            timeout=15
        )

        if fetch_response.status_code != 200:
            return jsonify({'error': 'User not found'}), 404

        user = fetch_response.json()

        if user.get('status') != 'pending':
            return jsonify({'error': 'Can only resend invites to pending users'}), 400

        # Generate new invite token
        new_token = ''.join(random.choices(string.ascii_letters + string.digits, k=32))

        # Update user with new token
        update_response = requests.put(
            f"{BACK4APP_USER_URL}/{user_id}",
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
                'Content-Type': 'application/json',
            },
            json={
                'inviteToken': new_token,
                'invitedAt': {'__type': 'Date', 'iso': datetime.utcnow().isoformat() + 'Z'}
            },
            timeout=15
        )

        if update_response.status_code == 200:
            # Send new invite email
            email_sent = send_invite_email(user.get('email'), new_token, inviter_name)
            return jsonify({'success': True, 'emailSent': email_sent})
        else:
            return jsonify({'error': 'Failed to update invite token'}), update_response.status_code

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/accept-invite', methods=['POST'])
def accept_invite():
    """Accept an invitation and activate user account."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({'error': 'Back4app not configured'}), 400

    data = request.json
    invite_token = data.get('inviteToken')
    google_email = data.get('email', '').lower()

    if not invite_token:
        return jsonify({'error': 'Invite token is required'}), 400

    try:
        # Find user by invite token
        fetch_response = requests.get(
            BACK4APP_USER_URL,
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            params={'where': json.dumps({'inviteToken': invite_token})},
            timeout=15
        )

        if fetch_response.status_code != 200:
            return jsonify({'error': 'Failed to verify invite'}), 500

        users = fetch_response.json().get('results', [])
        if not users:
            return jsonify({'error': 'Invalid or expired invite token'}), 404

        user = users[0]

        # Verify email matches (case insensitive)
        if user.get('email', '').lower() != google_email:
            return jsonify({'error': 'Email does not match invitation'}), 403

        # Activate user
        update_response = requests.put(
            f"{BACK4APP_USER_URL}/{user.get('objectId')}",
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
                'Content-Type': 'application/json',
            },
            json={
                'status': 'active',
                'inviteToken': None,  # Clear token after use
                'acceptedAt': {'__type': 'Date', 'iso': datetime.utcnow().isoformat() + 'Z'}
            },
            timeout=15
        )

        if update_response.status_code == 200:
            # Invalidate users cache since user status changed
            users_cache.invalidate('all_users')
            return jsonify({
                'success': True,
                'user': {
                    'email': user.get('email'),
                    'role': user.get('role'),
                    'status': 'active'
                }
            })
        else:
            return jsonify({'error': 'Failed to activate user'}), update_response.status_code

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/check-access', methods=['POST'])
def check_user_access():
    """Check if a Google user has access to the dashboard."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return jsonify({'error': 'Back4app not configured'}), 400

    data = request.json
    email = data.get('email', '').lower()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Owner always has access with all permissions
    if email == OWNER_EMAIL:
        return jsonify({
            'hasAccess': True,
            'role': 'admin',
            'isOwner': True,
            'permissions': ALL_PERMISSIONS
        })

    try:
        # Check if user exists and is active
        fetch_response = requests.get(
            BACK4APP_USER_URL,
            headers={
                'X-Parse-Application-Id': BACK4APP_APP_ID,
                'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
            },
            params={'where': json.dumps({'email': email})},
            timeout=15
        )

        if fetch_response.status_code == 200:
            users = fetch_response.json().get('results', [])
            if users:
                user = users[0]
                if user.get('status') == 'active':
                    user_role = user.get('role', 'standard')
                    # Get user's permissions, default based on role
                    user_permissions = user.get('permissions')
                    if user_permissions is None:
                        user_permissions = ALL_PERMISSIONS if user_role == 'admin' else DEFAULT_STANDARD_PERMISSIONS
                    return jsonify({
                        'hasAccess': True,
                        'role': user_role,
                        'isOwner': False,
                        'permissions': user_permissions
                    })
                elif user.get('status') == 'pending':
                    return jsonify({
                        'hasAccess': False,
                        'reason': 'pending',
                        'message': 'Your invitation is pending. Please check your email.'
                    })
                else:
                    return jsonify({
                        'hasAccess': False,
                        'reason': 'suspended',
                        'message': 'Your account has been suspended.'
                    })

        # Check if user is from an allowed domain - grant view-only access
        email_domain = email.split('@')[1].lower() if '@' in email else ''
        if email_domain in ALLOWED_DOMAINS:
            # Auto-create user with view-only permissions
            try:
                user_data = {
                    'email': email,
                    'role': 'standard',
                    'status': 'active',
                    'invitedBy': 'domain_auto',
                    'invitedAt': {'__type': 'Date', 'iso': datetime.utcnow().isoformat() + 'Z'},
                    'acceptedAt': {'__type': 'Date', 'iso': datetime.utcnow().isoformat() + 'Z'},
                    'isOwner': False,
                    'permissions': VIEW_ONLY_PERMISSIONS
                }

                create_response = requests.post(
                    BACK4APP_USER_URL,
                    headers={
                        'X-Parse-Application-Id': BACK4APP_APP_ID,
                        'X-Parse-REST-API-Key': BACK4APP_REST_KEY,
                        'Content-Type': 'application/json',
                    },
                    json=user_data,
                    timeout=15
                )

                if create_response.status_code == 201:
                    # Invalidate users cache since we added a new user
                    users_cache.invalidate('all_users')

                return jsonify({
                    'hasAccess': True,
                    'role': 'standard',
                    'isOwner': False,
                    'permissions': VIEW_ONLY_PERMISSIONS,
                    'autoCreated': True
                })
            except Exception as create_error:
                print(f"Failed to auto-create user: {create_error}")
                # Still grant access even if we can't save
                return jsonify({
                    'hasAccess': True,
                    'role': 'standard',
                    'isOwner': False,
                    'permissions': VIEW_ONLY_PERMISSIONS
                })

        return jsonify({
            'hasAccess': False,
            'reason': 'not_invited',
            'message': 'You do not have access to this dashboard.'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# In-memory tasks storage (in production, this would be in the database)
tasks_storage = []
task_id_counter = 1
# Task index by state for O(1) lookups (maps state_code -> set of task_ids)
task_state_index = {}

def _index_task_add(task):
    """Add a task to the state index for O(1) state lookups."""
    state = task.get('state')
    if state:
        if state not in task_state_index:
            task_state_index[state] = set()
        task_state_index[state].add(task['id'])

def _index_task_remove(task_id, state=None):
    """Remove a task from the state index."""
    if state and state in task_state_index:
        task_state_index[state].discard(task_id)
        if not task_state_index[state]:
            del task_state_index[state]
    else:
        # If state not provided, search all (fallback)
        for s in list(task_state_index.keys()):
            task_state_index[s].discard(task_id)
            if not task_state_index[s]:
                del task_state_index[s]

def _get_tasks_by_state(state_code):
    """Get task IDs for a state in O(1) time."""
    return task_state_index.get(state_code, set())

# Pending source submissions (for non-admin users to submit validated sources for review)
pending_submissions = []
submission_id_counter = 1

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Get research tasks with optional filtering.

    Query parameters:
        status: Filter by status ('pending', 'in_progress', 'completed', 'all')
        state: Filter by state code (e.g., 'CA', 'NY')
        limit: Maximum number of tasks to return (default: all)
        offset: Number of tasks to skip (for pagination)
    """
    status_filter = request.args.get('status', 'all')
    state_filter = request.args.get('state')
    limit = request.args.get('limit', type=int)
    offset = request.args.get('offset', 0, type=int)

    # Start with all tasks (reversed for newest-first since we use append)
    # or filter by state using O(1) index lookup
    if state_filter:
        task_ids = _get_tasks_by_state(state_filter)
        filtered_tasks = [t for t in reversed(tasks_storage) if t['id'] in task_ids]
    else:
        filtered_tasks = list(reversed(tasks_storage))

    # Apply status filter
    if status_filter and status_filter != 'all':
        filtered_tasks = [t for t in filtered_tasks if t.get('status') == status_filter]

    total_filtered = len(filtered_tasks)

    # Apply pagination
    if offset:
        filtered_tasks = filtered_tasks[offset:]
    if limit:
        filtered_tasks = filtered_tasks[:limit]

    return jsonify({
        'tasks': filtered_tasks,
        'total': len(tasks_storage),
        'filtered_count': total_filtered
    })

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Create a new task"""
    global task_id_counter
    data = request.json

    task = {
        'id': task_id_counter,
        'title': data.get('title', ''),
        'description': data.get('description', ''),
        'type': data.get('type', 'manual'),
        'status': data.get('status', 'pending'),
        'url': data.get('url'),
        'state': data.get('state'),
        'source': data.get('source'),
        'created_at': datetime.now().isoformat()
    }
    task_id_counter += 1
    # Use append O(1) instead of insert(0) O(n), list is reversed when returning
    tasks_storage.append(task)
    # Update state index for O(1) lookups
    _index_task_add(task)

    return jsonify({'task': task, 'success': True, 'cache_invalidated': True})

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Update a task"""
    data = request.json

    for task in tasks_storage:
        if task['id'] == task_id:
            if 'status' in data:
                task['status'] = data['status']
            if 'title' in data:
                task['title'] = data['title']
            if 'description' in data:
                task['description'] = data['description']
            return jsonify({'task': task, 'success': True, 'cache_invalidated': True})

    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task"""
    global tasks_storage
    # Find the task to get its state for index removal
    task_to_delete = next((t for t in tasks_storage if t['id'] == task_id), None)
    if task_to_delete:
        _index_task_remove(task_id, task_to_delete.get('state'))
    tasks_storage = [t for t in tasks_storage if t['id'] != task_id]
    return jsonify({'success': True, 'cache_invalidated': True})

def _fetch_all_state_meeting_counts():
    """Fetch meeting counts for all states in a single batch query.

    Uses cached data if available and not expired (5 min TTL).
    Returns dict mapping state_code -> meeting_count.
    """
    import time
    current_time = time.time()
    cache = state_meeting_counts_cache

    # Check if cache is valid
    if cache["last_updated"] and (current_time - cache["last_updated"]) < cache["ttl"]:
        if cache["data"]:
            return cache["data"]

    state_counts = {}

    if BACK4APP_APP_ID and BACK4APP_REST_KEY:
        headers = {
            "X-Parse-Application-Id": BACK4APP_APP_ID,
            "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        }
        # Batch fetch: Use aggregation pipeline to get counts per state in ONE request
        try:
            # Back4App supports aggregate queries - group by state and count
            aggregate_url = f"{BACK4APP_URL.replace('/classes/Meetings', '')}/aggregate/Meetings"
            pipeline = [
                {"$group": {"objectId": "$state", "count": {"$sum": 1}}}
            ]
            response = requests.post(
                aggregate_url,
                headers={**headers, "Content-Type": "application/json"},
                json=pipeline,
                timeout=30
            )
            if response.status_code == 200:
                results = response.json().get('results', [])
                for item in results:
                    state_code = item.get('objectId')
                    if state_code:
                        state_counts[state_code] = item.get('count', 0)
        except Exception:
            # Fallback: batch fetch with parallel requests if aggregate fails
            # Limit to essential states only (high population states)
            priority_states = [s for s, p in US_STATE_POPULATION.items() if p > 2000]
            for state_code in priority_states[:20]:  # Limit to top 20 by population
                try:
                    url = f"{BACK4APP_URL}?where={{\"state\":\"{state_code}\"}}&count=1&limit=0"
                    resp = requests.get(url, headers=headers, timeout=5)
                    if resp.status_code == 200:
                        state_counts[state_code] = resp.json().get('count', 0)
                except Exception:
                    pass

    # Update cache
    cache["data"] = state_counts
    cache["last_updated"] = current_time
    return state_counts


@app.route('/api/coverage/gaps', methods=['GET'])
def get_coverage_gaps():
    """Get states/regions with low meeting coverage (dry spots).

    Results are cached for 5 minutes to avoid repeated expensive queries.
    """
    # Check cache first
    cached_result = coverage_gaps_cache.get('gaps')
    if cached_result is not None:
        return jsonify(cached_result)

    # Get existing feeds to identify covered states (cached)
    all_feeds = get_all_feeds_cached()
    covered_states = set(feed['state'] for feed in all_feeds.values())

    # Batch fetch all state meeting counts in ONE query instead of N+1
    state_counts = _fetch_all_state_meeting_counts()

    gaps = []
    for state_code, population in US_STATE_POPULATION.items():
        meetings_count = state_counts.get(state_code, 0)

        # Consider it a gap if:
        # - No meetings at all, OR
        # - Very low coverage (less than 1 meeting per 100k population)
        coverage_ratio = (meetings_count / population * 100) if population > 0 else 0

        if meetings_count == 0 or coverage_ratio < 1:
            gaps.append({
                'state': state_code,
                'stateName': US_STATE_NAMES.get(state_code, state_code),
                'population': population * 1000,
                'meetingCount': meetings_count,
                'coverageRatio': round(coverage_ratio, 2),
                'hasFeed': state_code in covered_states
            })

    # Sort by population (highest first) to prioritize high-impact gaps
    gaps.sort(key=lambda x: x['population'], reverse=True)

    result = {'gaps': gaps[:20]}

    # Cache the result for 5 minutes
    coverage_gaps_cache.set('gaps', result)

    return jsonify(result)

@app.route('/api/tasks/research', methods=['POST'])
def research_intergroup():
    """Research intergroup websites for a specific state/region"""
    global task_id_counter
    data = request.json
    state = data.get('state', '')
    region = data.get('region', '')

    # This is a placeholder for AI-powered research
    # In a real implementation, this would use web search APIs or AI to find intergroup sites

    # For now, generate suggested tasks based on common intergroup naming patterns
    suggestions = []
    state_name = US_STATE_NAMES.get(state, state)

    # Common intergroup website patterns
    search_suggestions = [
        {
            'title': f'Research {state_name} AA Intergroup',
            'description': f'Search for AA intergroup/central office websites in {state_name}. Look for sites with meeting directories that use TSML format.',
            'type': 'research',
            'state': state,
            'source': 'auto-generated'
        },
        {
            'title': f'Check AA Area {state} website',
            'description': f'Look for the official AA Area website for {state_name} which may have links to district meeting lists.',
            'type': 'research',
            'state': state,
            'source': 'auto-generated'
        },
        {
            'title': f'Search for NA meetings in {state_name}',
            'description': f'Check BMLT (Basic Meeting List Toolkit) for NA meetings in {state_name}.',
            'type': 'research',
            'state': state,
            'source': 'auto-generated'
        }
    ]

    for suggestion in search_suggestions:
        task = {
            'id': task_id_counter,
            'title': suggestion['title'],
            'description': suggestion['description'],
            'type': suggestion['type'],
            'status': 'pending',
            'state': suggestion['state'],
            'source': suggestion['source'],
            'created_at': datetime.now().isoformat()
        }
        task_id_counter += 1
        suggestions.append(task)
        # Use append O(1) instead of insert(0) O(n)
        tasks_storage.append(task)
        # Update state index
        _index_task_add(task)

    return jsonify({
        'success': True,
        'suggestions': suggestions,
        'message': f'Created {len(suggestions)} research tasks for {state_name}',
        'cache_invalidated': True
    })

@app.route('/api/tasks/research-all', methods=['POST'])
def research_all_gaps():
    """Research all coverage gaps and create tasks.

    Optimized to use state index for O(1) task lookups instead of O(n) per state.
    """
    global task_id_counter

    # Get current coverage gaps (using cached feeds)
    all_feeds = get_all_feeds_cached()
    covered_states = set(feed['state'] for feed in all_feeds.values())

    suggestions_count = 0
    new_tasks = []

    # Find states without any feeds
    for state_code, population in US_STATE_POPULATION.items():
        if state_code not in covered_states and population > 1000:  # Only states with >1M population
            state_name = US_STATE_NAMES.get(state_code, state_code)

            # Use O(1) index lookup instead of O(n) list scan
            task_ids = _get_tasks_by_state(state_code)
            if task_ids:
                # Check if any existing task for this state is not completed
                existing = any(
                    t['status'] != 'completed'
                    for t in tasks_storage
                    if t['id'] in task_ids
                )
                if existing:
                    continue

            task = {
                'id': task_id_counter,
                'title': f'Add meeting source for {state_name}',
                'description': f'{state_name} has no meeting feeds configured. Search for intergroup websites with TSML-compatible meeting directories.',
                'type': 'source_needed',
                'status': 'pending',
                'state': state_code,
                'source': 'coverage-analysis',
                'created_at': datetime.now().isoformat()
            }
            task_id_counter += 1
            new_tasks.append(task)
            # Use append O(1) instead of insert(0) O(n)
            tasks_storage.append(task)
            # Update state index
            _index_task_add(task)
            suggestions_count += 1

    return jsonify({
        'success': True,
        'suggestionsCount': suggestions_count,
        'tasks': new_tasks,
        'message': f'Created {suggestions_count} tasks for uncovered states',
        'cache_invalidated': True
    })


@app.route('/api/tasks/autofill', methods=['POST'])
def autofill_task_source():
    """Auto-research and suggest potential meeting source URLs based on task info.
    Uses known patterns and existing feed data to suggest likely URLs."""
    data = request.json
    state = data.get('state', '')
    title = data.get('title', '')
    description = data.get('description', '')
    task_type = data.get('type', '')

    if not state:
        return jsonify({
            'success': False,
            'error': 'State is required for autofill'
        }), 400

    state_name = US_STATE_NAMES.get(state, state)
    suggestions = []

    # Known intergroup URL patterns by state
    # These are common patterns for AA/NA meeting directories
    known_patterns = {
        # Common AA TSML patterns
        'tsml': [
            f'https://aa{state.lower()}.org/wp-admin/admin-ajax.php?action=meetings',
            f'https://{state.lower()}aa.org/wp-admin/admin-ajax.php?action=meetings',
            f'https://aa{state_name.lower().replace(" ", "")}.org/wp-admin/admin-ajax.php?action=meetings',
        ],
        # Common BMLT patterns
        'bmlt': [
            f'https://bmlt.{state.lower()}-na.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name',
            f'https://na{state.lower()}.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name',
        ]
    }

    # Check existing feeds for this state to understand what we already have
    all_feeds = get_all_feeds()
    existing_for_state = [
        {'name': name, 'url': config.get('url'), 'type': config.get('type', 'tsml')}
        for name, config in all_feeds.items()
        if config.get('state') == state
    ]

    # Generate suggestions based on state
    # Try to find actual intergroup websites that might work
    common_aa_domains = [
        f'{state.lower()}aa.org',
        f'aa{state.lower()}.org',
        f'aa-{state.lower()}.org',
        f'{state_name.lower().replace(" ", "")}aa.org',
    ]

    common_na_domains = [
        f'{state.lower()}-na.org',
        f'na{state.lower()}.org',
        f'{state_name.lower().replace(" ", "")}na.org',
    ]

    # Generate TSML suggestions
    for domain in common_aa_domains[:2]:  # Limit to top 2
        url = f'https://{domain}/wp-admin/admin-ajax.php?action=meetings'
        if not any(e['url'] == url for e in existing_for_state):
            suggestions.append({
                'name': f'{state_name} AA Intergroup',
                'url': url,
                'feedType': 'tsml',
                'confidence': 0.6,
                'source': 'pattern'
            })

    # Generate BMLT suggestions
    for domain in common_na_domains[:1]:  # Limit to top 1
        url = f'https://{domain}/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name'
        if not any(e['url'] == url for e in existing_for_state):
            suggestions.append({
                'name': f'{state_name} NA Region',
                'url': url,
                'feedType': 'bmlt',
                'confidence': 0.5,
                'source': 'pattern'
            })

    # Look for similar existing feeds as templates
    similar_feeds = []
    for name, config in all_feeds.items():
        feed_state = config.get('state', '')
        if feed_state != state and config.get('url'):
            # Find feeds from neighboring or similar states as examples
            similar_feeds.append({
                'name': name,
                'url': config.get('url'),
                'state': feed_state,
                'type': config.get('type', 'tsml')
            })

    # Add code4recovery sheet suggestion (common pattern)
    code4recovery_url = f'https://sheets.code4recovery.org/sheet/{state.lower()}'
    suggestions.append({
        'name': f'{state_name} AA (Code4Recovery)',
        'url': code4recovery_url,
        'feedType': 'tsml',
        'confidence': 0.4,
        'source': 'code4recovery'
    })

    return jsonify({
        'success': True,
        'suggestions': suggestions[:5],  # Return top 5 suggestions
        'existingFeeds': existing_for_state,
        'similarFeeds': similar_feeds[:3],  # Example feeds from other states
        'state': state,
        'stateName': state_name
    })


@app.route('/api/tasks/research-stream', methods=['POST'])
def research_stream():
    """Streaming research endpoint that provides real-time progress updates.
    Uses Server-Sent Events to stream progress, notes, and results.
    Supports excluded URLs for retry functionality - won't try same URLs twice."""
    data = request.json
    state = data.get('state', '')
    title = data.get('title', '')
    description = data.get('description', '')
    task_type = data.get('type', '')
    excluded_urls = data.get('excludedUrls', [])  # URLs to skip (already tried)
    previous_failures = data.get('previousFailures', [])  # Info about past failures

    if not state:
        return jsonify({
            'success': False,
            'error': 'State is required for research'
        }), 400

    def generate():
        state_name = US_STATE_NAMES.get(state, state)
        notes = []
        suggestions = []
        tested_results = []

        # Step 1: Initialize research
        is_retry = len(excluded_urls) > 0
        if is_retry:
            yield f"data: {json.dumps({'type': 'progress', 'step': 1, 'total': 5, 'message': 'Researching new sources...', 'notes': notes})}\n\n"
            time.sleep(0.3)
            notes.append(f"Retry research for {state_name} - will try different sources")
            notes.append(f"Excluding {len(excluded_urls)} previously tried URL(s)")
        else:
            yield f"data: {json.dumps({'type': 'progress', 'step': 1, 'total': 5, 'message': 'Starting research...', 'notes': notes})}\n\n"
            time.sleep(0.3)
            notes.append(f"Researching meeting sources for {state_name} ({state})")

        yield f"data: {json.dumps({'type': 'note', 'note': notes[-1], 'notes': notes})}\n\n"
        time.sleep(0.2)

        # Step 2: Check existing feeds
        yield f"data: {json.dumps({'type': 'progress', 'step': 2, 'total': 5, 'message': 'Checking existing sources...', 'notes': notes})}\n\n"

        all_feeds = get_all_feeds()
        existing_for_state = [
            {'name': name, 'url': config.get('url'), 'type': config.get('type', 'tsml')}
            for name, config in all_feeds.items()
            if config.get('state') == state
        ]

        if existing_for_state:
            notes.append(f"Found {len(existing_for_state)} existing source(s) for {state}")
            for feed in existing_for_state[:3]:
                notes.append(f"  - {feed['name']}: {feed['type'].upper()}")
        else:
            notes.append(f"No existing sources found for {state}")

        yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"
        time.sleep(0.3)

        # Step 3: Generate URL patterns
        yield f"data: {json.dumps({'type': 'progress', 'step': 3, 'total': 5, 'message': 'Generating potential URLs...', 'notes': notes})}\n\n"

        if is_retry:
            notes.append("Generating alternative URL patterns (avoiding previously tried)...")
        else:
            notes.append("Generating URL patterns based on common intergroup formats...")
        yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"
        time.sleep(0.2)

        # Generate TSML patterns - primary patterns
        tsml_patterns = [
            (f'https://aa{state.lower()}.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA Intergroup'),
            (f'https://{state.lower()}aa.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA'),
            (f'https://aa{state_name.lower().replace(" ", "")}.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA (Full Name)'),
        ]

        # Additional TSML patterns for retries
        tsml_patterns_alt = [
            (f'https://aahome{state.lower()}.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA Home'),
            (f'https://{state.lower()}intergroup.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} Intergroup'),
            (f'https://aa{state.lower()}intergroup.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA Intergroup (Alt)'),
            (f'https://{state_name.lower().replace(" ", "")}aa.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA (Alt)'),
            (f'https://meetings.aa{state.lower()}.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA Meetings'),
            (f'https://www.aa{state.lower()}.org/wp-admin/admin-ajax.php?action=meetings', f'{state_name} AA (www)'),
        ]

        # Generate BMLT patterns
        bmlt_patterns = [
            (f'https://bmlt.{state.lower()}-na.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name', f'{state_name} NA Region'),
            (f'https://na{state.lower()}.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name', f'{state_name} NA'),
        ]

        # Additional BMLT patterns for retries
        bmlt_patterns_alt = [
            (f'https://{state.lower()}na.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name', f'{state_name} NA (Alt)'),
            (f'https://na{state_name.lower().replace(" ", "")}.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name', f'{state_name} NA (Full)'),
            (f'https://bmlt.na{state.lower()}.org/main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name', f'{state_name} BMLT NA'),
        ]

        # Code4Recovery fallback
        code4recovery_url = f'https://sheets.code4recovery.org/sheet/{state.lower()}'

        # Build all patterns - include alternate patterns for retries
        all_patterns = [
            {'url': url, 'name': name, 'feedType': 'tsml', 'confidence': 0.6} for url, name in tsml_patterns
        ] + [
            {'url': url, 'name': name, 'feedType': 'bmlt', 'confidence': 0.5} for url, name in bmlt_patterns
        ] + [
            {'url': url, 'name': name, 'feedType': 'tsml', 'confidence': 0.4} for url, name in tsml_patterns_alt
        ] + [
            {'url': url, 'name': name, 'feedType': 'bmlt', 'confidence': 0.35} for url, name in bmlt_patterns_alt
        ] + [
            {'url': code4recovery_url, 'name': f'{state_name} AA (Code4Recovery)', 'feedType': 'tsml', 'confidence': 0.3}
        ]

        # Filter out excluded URLs (previously tried)
        if excluded_urls:
            original_count = len(all_patterns)
            all_patterns = [p for p in all_patterns if p['url'] not in excluded_urls]
            skipped_count = original_count - len(all_patterns)
            if skipped_count > 0:
                notes.append(f"Skipping {skipped_count} previously tried URL(s)")
                yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"

        notes.append(f"Generated {len(all_patterns)} potential URL patterns to test")
        yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"
        time.sleep(0.3)

        # Step 4: Test URLs
        yield f"data: {json.dumps({'type': 'progress', 'step': 4, 'total': 5, 'message': 'Testing URLs...', 'notes': notes})}\n\n"

        # Test up to 6 patterns (more for retries since we have more options)
        max_tests = 6 if is_retry else 4
        for i, pattern in enumerate(all_patterns[:max_tests]):
            url = pattern['url']
            name = pattern['name']
            feed_type = pattern['feedType']

            notes.append(f"Testing: {name}...")
            yield f"data: {json.dumps({'type': 'note', 'notes': notes, 'testing': {'url': url, 'name': name}})}\n\n"

            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
                    'Accept': 'application/json'
                }
                response = requests.get(url, headers=headers, timeout=10)

                if response.status_code == 200:
                    try:
                        data = response.json()
                        if isinstance(data, list) and len(data) > 0:
                            meeting_count = len(data)
                            notes[-1] = f"Testing: {name}... SUCCESS ({meeting_count} meetings)"

                            # Extract sample meetings
                            sample_meetings = []
                            for m in data[:3]:
                                sample_meetings.append({
                                    'name': m.get('name', 'Unknown'),
                                    'city': m.get('city', ''),
                                    'state': m.get('state', state)
                                })

                            # Count by state
                            state_breakdown = {}
                            for m in data:
                                m_state = m.get('state', 'Unknown')
                                state_breakdown[m_state] = state_breakdown.get(m_state, 0) + 1

                            tested_results.append({
                                'url': url,
                                'name': name,
                                'feedType': feed_type,
                                'success': True,
                                'totalMeetings': meeting_count,
                                'sampleMeetings': sample_meetings,
                                'stateBreakdown': state_breakdown,
                                'confidence': pattern['confidence'] + 0.3  # Boost confidence for working URLs
                            })

                            suggestions.append({
                                'url': url,
                                'name': name,
                                'feedType': feed_type,
                                'confidence': pattern['confidence'] + 0.3,
                                'verified': True,
                                'meetingCount': meeting_count
                            })
                        else:
                            notes[-1] = f"Testing: {name}... Empty or invalid response"
                    except json.JSONDecodeError:
                        notes[-1] = f"Testing: {name}... Not valid JSON"
                else:
                    notes[-1] = f"Testing: {name}... HTTP {response.status_code}"
            except requests.exceptions.Timeout:
                notes[-1] = f"Testing: {name}... Timeout"
            except requests.exceptions.RequestException as e:
                notes[-1] = f"Testing: {name}... Connection failed"

            yield f"data: {json.dumps({'type': 'note', 'notes': notes, 'tested': tested_results})}\n\n"
            time.sleep(0.2)

        # Add Code4Recovery as a fallback suggestion if no working URLs found
        if not suggestions:
            suggestions.append({
                'url': code4recovery_url,
                'name': f'{state_name} AA (Code4Recovery)',
                'feedType': 'tsml',
                'confidence': 0.4,
                'verified': False,
                'note': 'Fallback option - may not have data for this state'
            })
            notes.append("No working feeds found, added Code4Recovery as fallback option")
            yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"

        # Step 5: Generate script for best result
        yield f"data: {json.dumps({'type': 'progress', 'step': 5, 'total': 5, 'message': 'Generating script...', 'notes': notes})}\n\n"
        time.sleep(0.2)

        generated_script = None
        best_result = None

        if tested_results:
            # Find the best result (most meetings)
            best_result = max(tested_results, key=lambda x: x.get('totalMeetings', 0))
            notes.append(f"Best source: {best_result['name']} with {best_result['totalMeetings']} meetings")
            yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"

            # Generate script
            generated_script = _generate_script_content(
                best_result['url'],
                best_result['name'],
                state,
                best_result['feedType']
            )
            notes.append("Generated Python scraping script")
        else:
            notes.append("No working sources found to generate script")

        yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"
        time.sleep(0.2)

        # Final result
        final_result = {
            'type': 'complete',
            'success': len(tested_results) > 0,
            'suggestions': suggestions,
            'testedResults': tested_results,
            'bestResult': best_result,
            'generatedScript': generated_script,
            'notes': notes,
            'state': state,
            'stateName': state_name,
            'existingFeeds': existing_for_state
        }

        yield f"data: {json.dumps(final_result)}\n\n"

    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    })


def _generate_script_content(url, name, state, feed_type):
    """Helper function to generate Python scraping script content.
    Used by both test-source and generate-script endpoints."""
    state_name = US_STATE_NAMES.get(state, state)

    if feed_type == 'bmlt':
        script = f'''#!/usr/bin/env python3
"""
Scraping script for: {name}
State: {state_name} ({state})
Feed Type: BMLT (Basic Meeting List Toolkit)
Generated: {datetime.now().isoformat()}

This script fetches NA meetings from a BMLT server and transforms them
to the standard TSML format used by the meeting scraper.
"""

import requests
import json

# Configuration
FEED_URL = "{url}"
FEED_NAME = "{name}"
STATE = "{state}"

# Request headers
HEADERS = {{
    'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
    'Accept': 'application/json'
}}

def transform_bmlt_meeting(meeting):
    """Transform BMLT meeting format to TSML-compatible format"""
    # BMLT weekday is 1-7 (Sunday=1), TSML uses 0-6 (Sunday=0)
    weekday = int(meeting.get('weekday_tinyint', 1)) - 1

    # Convert time from "HH:MM:SS" to "HH:MM"
    start_time = meeting.get('start_time', '')
    if start_time and len(start_time) > 5:
        start_time = start_time[:5]

    # Build formatted address
    street = meeting.get('location_street', '')
    city = meeting.get('location_municipality', '')
    state = meeting.get('location_province', '')
    postal = meeting.get('location_postal_code_1', '')

    # Determine venue type
    venue_type = meeting.get('venue_type', '1')
    is_online = venue_type == '2'
    is_hybrid = venue_type == '3'

    return {{
        'name': meeting.get('meeting_name', 'NA Meeting'),
        'day': weekday,
        'time': start_time,
        'location': meeting.get('location_text', '') or meeting.get('location_info', ''),
        'address': street,
        'city': city,
        'state': state,
        'postal_code': postal,
        'latitude': meeting.get('latitude'),
        'longitude': meeting.get('longitude'),
        'types': meeting.get('formats', '').split(',') if meeting.get('formats') else [],
        'meeting_type': 'NA',
        'notes': meeting.get('comments', ''),
        'conference_url': meeting.get('virtual_meeting_link', ''),
        'attendance_option': 'online' if is_online else ('hybrid' if is_hybrid else 'in_person'),
    }}

def fetch_meetings():
    """Fetch and transform meetings from BMLT source"""
    try:
        response = requests.get(FEED_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        bmlt_meetings = response.json()

        if not isinstance(bmlt_meetings, list):
            print(f"Error: Expected list, got {{type(bmlt_meetings)}}")
            return []

        meetings = [transform_bmlt_meeting(m) for m in bmlt_meetings]

        # Filter out meetings with no name
        meetings = [m for m in meetings if m.get('name')]

        return meetings

    except requests.exceptions.RequestException as e:
        print(f"Error fetching meetings: {{e}}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {{e}}")
        return []

if __name__ == '__main__':
    print(f"Fetching meetings from {{FEED_NAME}}...")
    meetings = fetch_meetings()
    print(f"Found {{len(meetings)}} meetings")

    # Print first 3 as sample
    for i, meeting in enumerate(meetings[:3]):
        print(f"\\n--- Meeting {{i+1}} ---")
        print(f"Name: {{meeting.get('name')}}")
        print(f"Day: {{meeting.get('day')}} Time: {{meeting.get('time')}}")
        print(f"Location: {{meeting.get('city')}}, {{meeting.get('state')}}")
'''
    elif feed_type == 'json':
        script = f'''#!/usr/bin/env python3
"""
Scraping script for: {name}
State: {state_name} ({state})
Feed Type: JSON (Direct/Google Sheets)
Generated: {datetime.now().isoformat()}

This script fetches meetings from a JSON endpoint (often Google Sheets
published through code4recovery).
"""

import requests
import json

# Configuration
FEED_URL = "{url}"
FEED_NAME = "{name}"
STATE = "{state}"

# Request headers
HEADERS = {{
    'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
    'Accept': 'application/json'
}}

def fetch_meetings():
    """Fetch meetings from JSON source"""
    try:
        response = requests.get(FEED_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        meetings = response.json()

        if not isinstance(meetings, list):
            print(f"Error: Expected list, got {{type(meetings)}}")
            return []

        # Ensure state is set
        for meeting in meetings:
            if not meeting.get('state'):
                meeting['state'] = STATE
            if not meeting.get('meeting_type'):
                meeting['meeting_type'] = 'AA'

        return meetings

    except requests.exceptions.RequestException as e:
        print(f"Error fetching meetings: {{e}}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {{e}}")
        return []

if __name__ == '__main__':
    print(f"Fetching meetings from {{FEED_NAME}}...")
    meetings = fetch_meetings()
    print(f"Found {{len(meetings)}} meetings")

    # Print first 3 as sample
    for i, meeting in enumerate(meetings[:3]):
        print(f"\\n--- Meeting {{i+1}} ---")
        print(f"Name: {{meeting.get('name')}}")
        print(f"Day: {{meeting.get('day')}} Time: {{meeting.get('time')}}")
        print(f"Location: {{meeting.get('city')}}, {{meeting.get('state')}}")
'''
    else:  # TSML format (default)
        script = f'''#!/usr/bin/env python3
"""
Scraping script for: {name}
State: {state_name} ({state})
Feed Type: TSML (12 Step Meeting List)
Generated: {datetime.now().isoformat()}

This script fetches AA meetings from a WordPress site using the
TSML (12 Step Meeting List) plugin API.
"""

import requests
import json

# Configuration
FEED_URL = "{url}"
FEED_NAME = "{name}"
STATE = "{state}"

# Request headers
HEADERS = {{
    'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
    'Accept': 'application/json'
}}

def fetch_meetings():
    """Fetch meetings from TSML source"""
    try:
        response = requests.get(FEED_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        meetings = response.json()

        if not isinstance(meetings, list):
            print(f"Error: Expected list, got {{type(meetings)}}")
            return []

        # Add state if not present and meeting_type
        for meeting in meetings:
            if not meeting.get('state'):
                meeting['state'] = STATE
            # TSML feeds are typically AA meetings
            if not meeting.get('meeting_type'):
                meeting['meeting_type'] = 'AA'

        # Filter out meetings with no name
        meetings = [m for m in meetings if m.get('name')]

        return meetings

    except requests.exceptions.RequestException as e:
        print(f"Error fetching meetings: {{e}}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {{e}}")
        return []

if __name__ == '__main__':
    print(f"Fetching meetings from {{FEED_NAME}}...")
    meetings = fetch_meetings()
    print(f"Found {{len(meetings)}} meetings")

    # Print first 3 as sample
    for i, meeting in enumerate(meetings[:3]):
        print(f"\\n--- Meeting {{i+1}} ---")
        print(f"Name: {{meeting.get('name')}}")
        print(f"Day: {{meeting.get('day')}} Time: {{meeting.get('time')}}")
        print(f"Location: {{meeting.get('city')}}, {{meeting.get('state')}}")
'''
    return script


@app.route('/api/tasks/test-source', methods=['POST'])
def test_source_url():
    """Enhanced test endpoint for source URLs with retry support and better error handling.
    This is an alias/enhancement of test-script with additional features.
    Also generates a Python scraping script on successful test."""
    data = request.json
    url = data.get('url', '')
    feed_type = data.get('feedType', 'auto')
    state = data.get('state', 'XX')
    name = data.get('name', '')  # Source name for script generation
    attempt = data.get('attempt', 1)
    retry_with_alternate = data.get('retryWithAlternate', False)

    if not url:
        return jsonify({'success': False, 'error': 'URL is required'}), 400

    # If retrying, try to fix common URL issues
    if retry_with_alternate and attempt > 1:
        # Try common URL fixes
        if 'admin-ajax.php' not in url and 'action=meetings' not in url:
            # Try adding TSML endpoint
            if not url.endswith('/'):
                url += '/'
            url += 'wp-admin/admin-ajax.php?action=meetings'
        elif 'client_interface' not in url and 'main_server' not in url:
            # Try adding BMLT endpoint
            if not url.endswith('/'):
                url += '/'
            url += 'main_server/client_interface/json/?switcher=GetSearchResults&data_field_key=meeting_name'

    # Auto-detect feed type
    if feed_type == 'auto':
        if 'admin-ajax.php' in url or 'action=meetings' in url:
            feed_type = 'tsml'
        elif 'main_server' in url or 'client_interface' in url or 'switcher=' in url:
            feed_type = 'bmlt'
        elif 'sheets.code4recovery.org' in url or '.json' in url:
            feed_type = 'json'
        else:
            feed_type = 'tsml'

    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()

        raw_data = response.json()

        if not isinstance(raw_data, list):
            return jsonify({
                'success': False,
                'error': f'Expected JSON array, got {type(raw_data).__name__}',
                'hint': 'The URL should return a JSON array of meetings. Try adding /wp-admin/admin-ajax.php?action=meetings for TSML sites.',
                'attempt': attempt
            })

        if len(raw_data) == 0:
            return jsonify({
                'success': False,
                'error': 'No meetings found in response',
                'hint': 'The feed returned an empty array. The source may be inactive or require different parameters.',
                'attempt': attempt
            })

        # Transform if BMLT
        if feed_type == 'bmlt':
            meetings = [transform_bmlt_to_tsml(m) for m in raw_data]
        else:
            meetings = raw_data
            # Add state if missing
            for m in meetings:
                if not m.get('state'):
                    m['state'] = state
                if not m.get('meeting_type'):
                    m['meeting_type'] = 'AA'

        # Validate meeting structure
        sample_meeting = meetings[0]
        required_fields = ['name']
        missing_fields = [f for f in required_fields if not sample_meeting.get(f)]

        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}',
                'sampleData': sample_meeting,
                'attempt': attempt
            })

        # Count meetings by state
        state_counts = {}
        for m in meetings:
            s = m.get('state', 'Unknown')
            state_counts[s] = state_counts.get(s, 0) + 1

        # Get sample meetings (first 5)
        sample_meetings = []
        for m in meetings[:5]:
            sample_meetings.append({
                'name': m.get('name', 'Unknown'),
                'day': m.get('day'),
                'time': m.get('time', ''),
                'city': m.get('city', ''),
                'state': m.get('state', ''),
                'meeting_type': m.get('meeting_type', 'AA')
            })

        # Generate Python scraping script for this source
        script_name = name if name else f"Meeting Source ({state})"
        generated_script = _generate_script_content(url, script_name, state, feed_type)

        return jsonify({
            'success': True,
            'totalMeetings': len(meetings),
            'feedType': feed_type,
            'stateBreakdown': state_counts,
            'sampleMeetings': sample_meetings,
            'fieldsFound': list(sample_meeting.keys())[:15],
            'attempt': attempt,
            'urlTested': url,
            'generatedScript': generated_script
        })

    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request timed out after 30 seconds',
            'hint': 'The server may be slow or unreachable. Try again later.',
            'attempt': attempt
        })
    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code if e.response else 'unknown'
        hints = {
            404: 'The URL was not found. Check if the endpoint path is correct.',
            403: 'Access forbidden. The server may require authentication or block scrapers.',
            500: 'Server error. The meeting directory may be experiencing issues.',
            502: 'Bad gateway. Try again later.',
            503: 'Service unavailable. The server may be down for maintenance.'
        }
        return jsonify({
            'success': False,
            'error': f'HTTP error: {status_code}',
            'hint': hints.get(status_code, f'The server returned an error. Status: {status_code}'),
            'attempt': attempt
        })
    except requests.exceptions.ConnectionError:
        return jsonify({
            'success': False,
            'error': 'Could not connect to server',
            'hint': 'The domain may not exist or the server is unreachable.',
            'attempt': attempt
        })
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Request failed: {str(e)}',
            'hint': 'Check if the URL is correct and accessible',
            'attempt': attempt
        })
    except json.JSONDecodeError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid JSON response',
            'hint': 'The URL did not return valid JSON. This might not be a meeting feed endpoint.',
            'attempt': attempt
        })


@app.route('/api/tasks/generate-script', methods=['POST'])
def generate_scraping_script():
    """Generate a Python scraping script based on existing patterns"""
    data = request.json
    url = data.get('url', '')
    name = data.get('name', 'New Meeting Source')
    state = data.get('state', 'XX')
    feed_type = data.get('feedType', 'auto')  # 'tsml', 'bmlt', or 'auto'

    # Auto-detect feed type based on URL patterns
    if feed_type == 'auto':
        if 'admin-ajax.php' in url or 'action=meetings' in url:
            feed_type = 'tsml'
        elif 'main_server' in url or 'client_interface' in url or 'switcher=' in url:
            feed_type = 'bmlt'
        elif 'sheets.code4recovery.org' in url or '.json' in url:
            feed_type = 'json'
        else:
            feed_type = 'tsml'  # Default to TSML

    # Use helper function to generate script
    script = _generate_script_content(url, name, state, feed_type)

    return jsonify({
        'success': True,
        'script': script,
        'feedType': feed_type,
        'feedConfig': {
            'name': name,
            'url': url,
            'state': state,
            'type': feed_type if feed_type == 'bmlt' else 'tsml'
        }
    })


@app.route('/api/tasks/test-script', methods=['POST'])
def test_scraping_script():
    """Test a scraping URL to verify it returns valid meeting data"""
    data = request.json
    url = data.get('url', '')
    feed_type = data.get('feedType', 'auto')
    state = data.get('state', 'XX')

    if not url:
        return jsonify({'success': False, 'error': 'URL is required'}), 400

    # Auto-detect feed type
    if feed_type == 'auto':
        if 'admin-ajax.php' in url or 'action=meetings' in url:
            feed_type = 'tsml'
        elif 'main_server' in url or 'client_interface' in url or 'switcher=' in url:
            feed_type = 'bmlt'
        elif 'sheets.code4recovery.org' in url or '.json' in url:
            feed_type = 'json'
        else:
            feed_type = 'tsml'

    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()

        raw_data = response.json()

        if not isinstance(raw_data, list):
            return jsonify({
                'success': False,
                'error': f'Expected JSON array, got {type(raw_data).__name__}',
                'hint': 'The URL should return a JSON array of meetings'
            })

        if len(raw_data) == 0:
            return jsonify({
                'success': False,
                'error': 'No meetings found in response',
                'hint': 'The feed returned an empty array'
            })

        # Transform if BMLT
        if feed_type == 'bmlt':
            meetings = [transform_bmlt_to_tsml(m) for m in raw_data]
        else:
            meetings = raw_data
            # Add state if missing
            for m in meetings:
                if not m.get('state'):
                    m['state'] = state
                if not m.get('meeting_type'):
                    m['meeting_type'] = 'AA'

        # Validate meeting structure
        sample_meeting = meetings[0]
        required_fields = ['name']
        missing_fields = [f for f in required_fields if not sample_meeting.get(f)]

        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}',
                'sampleData': sample_meeting
            })

        # Count meetings by state
        state_counts = {}
        for m in meetings:
            s = m.get('state', 'Unknown')
            state_counts[s] = state_counts.get(s, 0) + 1

        # Get sample meetings (first 5)
        sample_meetings = []
        for m in meetings[:5]:
            sample_meetings.append({
                'name': m.get('name', 'Unknown'),
                'day': m.get('day'),
                'time': m.get('time', ''),
                'city': m.get('city', ''),
                'state': m.get('state', ''),
                'meeting_type': m.get('meeting_type', 'AA')
            })

        return jsonify({
            'success': True,
            'totalMeetings': len(meetings),
            'feedType': feed_type,
            'stateBreakdown': state_counts,
            'sampleMeetings': sample_meetings,
            'fieldsFound': list(sample_meeting.keys())[:15]  # First 15 fields
        })

    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request timed out after 30 seconds',
            'hint': 'The server may be slow or the URL may be incorrect'
        })
    except requests.exceptions.HTTPError as e:
        return jsonify({
            'success': False,
            'error': f'HTTP error: {e.response.status_code}',
            'hint': f'The server returned an error. Status: {e.response.status_code}'
        })
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Request failed: {str(e)}',
            'hint': 'Check if the URL is correct and accessible'
        })
    except json.JSONDecodeError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid JSON response',
            'hint': 'The URL did not return valid JSON data'
        })


@app.route('/api/tasks/add-source', methods=['POST'])
def add_meeting_source():
    """Add a new meeting source to the feeds configuration.
    Note: This adds to the in-memory configuration. In production,
    this would persist to a config file or database."""
    global AA_FEEDS, NA_FEEDS

    data = request.json
    name = data.get('name', '')
    url = data.get('url', '')
    state = data.get('state', '')
    feed_type = data.get('feedType', 'tsml')

    if not name or not url or not state:
        return jsonify({
            'success': False,
            'error': 'Name, URL, and state are required'
        }), 400

    # Check if source already exists
    all_feeds = get_all_feeds()
    if name in all_feeds:
        return jsonify({
            'success': False,
            'error': f'A source named "{name}" already exists'
        }), 400

    # Check for duplicate URL
    for existing_name, config in all_feeds.items():
        if config.get('url') == url:
            return jsonify({
                'success': False,
                'error': f'This URL is already configured as "{existing_name}"'
            }), 400

    # Add to appropriate feed dictionary
    if feed_type == 'bmlt':
        NA_FEEDS[name] = {
            'url': url,
            'state': state,
            'type': 'bmlt'
        }
    else:
        AA_FEEDS[name] = {
            'url': url,
            'state': state
        }

    return jsonify({
        'success': True,
        'message': f'Added "{name}" to {feed_type.upper()} feeds',
        'totalFeeds': len(AA_FEEDS) + len(NA_FEEDS),
        'feedConfig': {
            'name': name,
            'url': url,
            'state': state,
            'type': feed_type
        }
    })


@app.route('/api/feeds', methods=['GET'])
def list_all_feeds():
    """List all configured meeting feeds"""
    all_feeds = get_all_feeds()

    feeds_list = []
    for name, config in all_feeds.items():
        feeds_list.append({
            'name': name,
            'url': config.get('url'),
            'state': config.get('state'),
            'type': config.get('type', 'tsml')
        })

    # Sort by state then name
    feeds_list.sort(key=lambda x: (x['state'], x['name']))

    return jsonify({
        'feeds': feeds_list,
        'totalFeeds': len(feeds_list),
        'byType': {
            'tsml': len([f for f in feeds_list if f['type'] == 'tsml']),
            'bmlt': len([f for f in feeds_list if f['type'] == 'bmlt'])
        }
    })


# ============================================
# Pending Source Submissions (for non-admin review workflow)
# ============================================

@app.route('/api/submissions', methods=['GET'])
def get_pending_submissions():
    """Get all pending source submissions for admin review"""
    return jsonify({
        'submissions': pending_submissions,
        'total': len(pending_submissions),
        'byStatus': {
            'pending': len([s for s in pending_submissions if s['status'] == 'pending']),
            'approved': len([s for s in pending_submissions if s['status'] == 'approved']),
            'rejected': len([s for s in pending_submissions if s['status'] == 'rejected'])
        }
    })


@app.route('/api/submissions', methods=['POST'])
def submit_source_for_review():
    """Submit a validated source configuration for admin review.
    This allows non-admin users to contribute sources without directly adding them."""
    global submission_id_counter

    data = request.json
    name = data.get('name', '')
    url = data.get('url', '')
    state = data.get('state', '')
    feed_type = data.get('feedType', 'tsml')
    task_id = data.get('taskId')
    test_results = data.get('testResults', {})
    submitter = data.get('submitter', 'anonymous')
    notes = data.get('notes', '')

    if not name or not url or not state:
        return jsonify({
            'success': False,
            'error': 'Name, URL, and state are required'
        }), 400

    # Check for duplicate pending submissions
    for submission in pending_submissions:
        if submission['url'] == url and submission['status'] == 'pending':
            return jsonify({
                'success': False,
                'error': 'This URL has already been submitted and is pending review'
            }), 400

    # Check if already in sources
    all_feeds = get_all_feeds()
    for existing_name, config in all_feeds.items():
        if config.get('url') == url:
            return jsonify({
                'success': False,
                'error': f'This URL is already configured as "{existing_name}"'
            }), 400

    submission = {
        'id': submission_id_counter,
        'name': name,
        'url': url,
        'state': state,
        'feedType': feed_type,
        'status': 'pending',
        'taskId': task_id,
        'testResults': {
            'totalMeetings': test_results.get('totalMeetings', 0),
            'feedType': test_results.get('feedType'),
            'stateBreakdown': test_results.get('stateBreakdown', {}),
            'sampleMeetings': test_results.get('sampleMeetings', [])[:3],
            'generatedScript': test_results.get('generatedScript')  # Include generated Python script
        },
        'submitter': submitter,
        'notes': notes,
        'submittedAt': datetime.now().isoformat(),
        'reviewedAt': None,
        'reviewedBy': None,
        'reviewNotes': None
    }

    submission_id_counter += 1
    pending_submissions.insert(0, submission)

    # Mark associated task as completed if provided
    if task_id:
        for task in tasks_storage:
            if task['id'] == task_id:
                task['status'] = 'completed'
                break

    return jsonify({
        'success': True,
        'message': 'Source submitted for review',
        'submission': submission
    })


@app.route('/api/submissions/<int:submission_id>', methods=['PUT'])
def review_submission(submission_id):
    """Admin endpoint to approve or reject a submission"""
    global AA_FEEDS, NA_FEEDS

    data = request.json
    action = data.get('action')  # 'approve' or 'reject'
    reviewer = data.get('reviewer', 'admin')
    review_notes = data.get('notes', '')

    if action not in ['approve', 'reject']:
        return jsonify({
            'success': False,
            'error': 'Action must be "approve" or "reject"'
        }), 400

    submission = None
    for s in pending_submissions:
        if s['id'] == submission_id:
            submission = s
            break

    if not submission:
        return jsonify({
            'success': False,
            'error': 'Submission not found'
        }), 404

    if submission['status'] != 'pending':
        return jsonify({
            'success': False,
            'error': f'Submission has already been {submission["status"]}'
        }), 400

    submission['reviewedAt'] = datetime.now().isoformat()
    submission['reviewedBy'] = reviewer
    submission['reviewNotes'] = review_notes

    if action == 'approve':
        # Add to sources
        name = submission['name']
        url = submission['url']
        state = submission['state']
        feed_type = submission['feedType']

        # Check again for duplicates (in case added while pending)
        all_feeds = get_all_feeds()
        if name in all_feeds:
            submission['status'] = 'rejected'
            submission['reviewNotes'] = f'Duplicate name: "{name}" already exists'
            return jsonify({
                'success': False,
                'error': f'A source named "{name}" already exists'
            }), 400

        for existing_name, config in all_feeds.items():
            if config.get('url') == url:
                submission['status'] = 'rejected'
                submission['reviewNotes'] = f'Duplicate URL: already configured as "{existing_name}"'
                return jsonify({
                    'success': False,
                    'error': f'This URL is already configured as "{existing_name}"'
                }), 400

        # Add to appropriate feed dictionary
        if feed_type == 'bmlt':
            NA_FEEDS[name] = {
                'url': url,
                'state': state,
                'type': 'bmlt'
            }
        else:
            AA_FEEDS[name] = {
                'url': url,
                'state': state
            }

        submission['status'] = 'approved'

        return jsonify({
            'success': True,
            'message': f'Approved and added "{name}" to {feed_type.upper()} feeds',
            'submission': submission
        })
    else:
        submission['status'] = 'rejected'
        return jsonify({
            'success': True,
            'message': 'Submission rejected',
            'submission': submission
        })


@app.route('/api/submissions/<int:submission_id>', methods=['DELETE'])
def delete_submission(submission_id):
    """Delete a submission (admin only)"""
    global pending_submissions

    original_len = len(pending_submissions)
    pending_submissions = [s for s in pending_submissions if s['id'] != submission_id]

    if len(pending_submissions) == original_len:
        return jsonify({
            'success': False,
            'error': 'Submission not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Submission deleted'
    })


# =============================================================================
# INTERGROUP RESEARCH SYSTEM
# Deep research tool for discovering meeting data sources across states
# =============================================================================

# In-memory storage for research sessions (would use Parse/DB in production)
intergroup_research_sessions = []
intergroup_research_findings = []
intergroup_research_notes = []
intergroup_research_scripts = []
custom_research_sources = []  # Custom sources saved from tested scripts
script_execution_history = {}  # Script ID -> list of execution records
research_session_counter = 0

# Known intergroup URL patterns to try
INTERGROUP_URL_PATTERNS = {
    'tsml_standard': {
        'pattern': 'https://{domain}/wp-admin/admin-ajax.php?action=meetings',
        'type': 'tsml',
        'description': 'Standard TSML WordPress plugin endpoint'
    },
    'tsml_rest': {
        'pattern': 'https://{domain}/wp-json/tsml/v1/meetings/',
        'type': 'tsml',
        'description': 'TSML REST API endpoint'
    },
    'meetings_php': {
        'pattern': 'https://{domain}/meetings.php',
        'type': 'custom_html',
        'description': 'Custom PHP meeting finder (like lacoaa.org)'
    },
    'meeting_finder': {
        'pattern': 'https://{domain}/meeting-finder/',
        'type': 'unknown',
        'description': 'Generic meeting finder page'
    },
    'find_meeting': {
        'pattern': 'https://{domain}/find-a-meeting/',
        'type': 'unknown',
        'description': 'Common AA meeting finder URL'
    },
    'meetings_page': {
        'pattern': 'https://{domain}/meetings/',
        'type': 'unknown',
        'description': 'Meetings page'
    }
}

# Known California intergroup domains (can be extended per-state)
KNOWN_INTERGROUPS = {
    'CA': [
        {'name': 'Los Angeles Central Office', 'domain': 'lacoaa.org', 'type': 'custom'},
        {'name': 'Orange County Intergroup', 'domain': 'oc-aa.org', 'type': 'tsml'},
        {'name': 'San Francisco & Marin Intergroup', 'domain': 'aasfmarin.org', 'type': 'tsml'},
        {'name': 'San Mateo County Intergroup', 'domain': 'aa-san-mateo.org', 'type': 'tsml'},
        {'name': 'Sonoma County Intergroup', 'domain': 'sonomacountyaa.org', 'type': 'tsml'},
        {'name': 'Santa Clara County (San Jose)', 'domain': 'aasanjose.org', 'type': 'tsml'},
        {'name': 'East Bay Intergroup', 'domain': 'eastbayaa.org', 'type': 'tsml'},
        {'name': 'NorCal Intergroup', 'domain': 'aanorcal.org', 'type': 'tsml'},
        {'name': 'Central Coast (San Luis Obispo)', 'domain': 'sloaa.org', 'type': 'tsml'},
        {'name': 'Delta Intergroup (Stockton)', 'domain': 'aadelta.org', 'type': 'tsml'},
        {'name': 'Salinas Valley', 'domain': 'aasalinas.org', 'type': 'tsml'},
        {'name': 'Santa Cruz County', 'domain': 'aasantacruz.org', 'type': 'tsml'},
        {'name': 'Desert Intergroup', 'domain': 'aainthedesert.org', 'type': 'unknown'},
        {'name': 'Harbor Area', 'domain': 'hacoaa.org', 'type': 'unknown'},
        {'name': 'Inland Empire', 'domain': 'inlandempireaa.org', 'type': 'unknown'},
        {'name': 'San Fernando Valley', 'domain': 'sfvaa.org', 'type': 'unknown'},
        {'name': 'San Gabriel', 'domain': 'aasgvco.org', 'type': 'unknown'},
        {'name': 'North Orange County', 'domain': 'aanoc.org', 'type': 'unknown'},
        {'name': 'North San Diego', 'domain': 'ncsandiegoaa.org', 'type': 'unknown'},
        {'name': 'San Diego', 'domain': 'aasandiego.org', 'type': 'unknown'},
        {'name': 'Santa Barbara', 'domain': 'santabarbaraaa.com', 'type': 'unknown'},
        {'name': 'Monterey Bay', 'domain': 'aamonterey.org', 'type': 'unknown'},
    ],
    'NY': [
        {'name': 'New York Intergroup', 'domain': 'nyintergroup.org', 'type': 'unknown'},
        {'name': 'Nassau Intergroup', 'domain': 'nassauny-aa.org', 'type': 'unknown'},
    ],
    'TX': [
        {'name': 'Houston Intergroup', 'domain': 'aahouston.org', 'type': 'unknown'},
        {'name': 'Dallas Intergroup', 'domain': 'aadallas.org', 'type': 'unknown'},
        {'name': 'San Antonio Intergroup', 'domain': 'aasanantonio.org', 'type': 'unknown'},
    ],
    'FL': [
        {'name': 'South Florida Intergroup', 'domain': 'aamiami.org', 'type': 'unknown'},
        {'name': 'Tampa Bay Intergroup', 'domain': 'aatampa-area.org', 'type': 'unknown'},
    ],
}


@app.route('/api/intergroup-research/sessions', methods=['GET'])
def get_research_sessions():
    """Get all research sessions with optional filtering"""
    state_filter = request.args.get('state')
    status_filter = request.args.get('status')

    sessions = intergroup_research_sessions.copy()

    if state_filter:
        sessions = [s for s in sessions if s.get('state') == state_filter]
    if status_filter:
        sessions = [s for s in sessions if s.get('status') == status_filter]

    # Sort by created date, newest first
    sessions.sort(key=lambda x: x.get('createdAt', ''), reverse=True)

    return jsonify({
        'success': True,
        'sessions': sessions,
        'total': len(sessions)
    })


@app.route('/api/intergroup-research/sessions', methods=['POST'])
def create_research_session():
    """Create a new research session for a state"""
    global research_session_counter

    data = request.json
    state = data.get('state', '')
    notes = data.get('notes', '')

    if not state:
        return jsonify({
            'success': False,
            'error': 'State is required'
        }), 400

    research_session_counter += 1
    state_name = US_STATE_NAMES.get(state, state)

    session = {
        'id': research_session_counter,
        'state': state,
        'stateName': state_name,
        'status': 'active',
        'notes': notes,
        'createdAt': datetime.now().isoformat(),
        'updatedAt': datetime.now().isoformat(),
        'intergroups_found': 0,
        'endpoints_tested': 0,
        'working_sources': 0,
        'failed_attempts': 0
    }

    intergroup_research_sessions.append(session)

    return jsonify({
        'success': True,
        'session': session
    })


@app.route('/api/intergroup-research/sessions/<int:session_id>', methods=['GET'])
def get_research_session(session_id):
    """Get a specific research session with all its data"""
    session = None
    for s in intergroup_research_sessions:
        if s['id'] == session_id:
            session = s
            break

    if not session:
        return jsonify({
            'success': False,
            'error': 'Session not found'
        }), 404

    # Get related findings, notes, and scripts
    findings = [f for f in intergroup_research_findings if f.get('sessionId') == session_id]
    notes = [n for n in intergroup_research_notes if n.get('sessionId') == session_id]
    scripts = [s for s in intergroup_research_scripts if s.get('sessionId') == session_id]

    return jsonify({
        'success': True,
        'session': session,
        'findings': findings,
        'notes': notes,
        'scripts': scripts
    })


@app.route('/api/intergroup-research/sessions/<int:session_id>', methods=['PUT'])
def update_research_session(session_id):
    """Update a research session"""
    data = request.json

    for session in intergroup_research_sessions:
        if session['id'] == session_id:
            # Update allowed fields
            if 'status' in data:
                session['status'] = data['status']
            if 'notes' in data:
                session['notes'] = data['notes']
            session['updatedAt'] = datetime.now().isoformat()

            return jsonify({
                'success': True,
                'session': session
            })

    return jsonify({
        'success': False,
        'error': 'Session not found'
    }), 404


@app.route('/api/intergroup-research/sessions/<int:session_id>', methods=['DELETE'])
def delete_research_session(session_id):
    """Delete a research session and all related data"""
    global intergroup_research_sessions, intergroup_research_findings
    global intergroup_research_notes, intergroup_research_scripts

    original_len = len(intergroup_research_sessions)
    intergroup_research_sessions = [s for s in intergroup_research_sessions if s['id'] != session_id]

    if len(intergroup_research_sessions) == original_len:
        return jsonify({
            'success': False,
            'error': 'Session not found'
        }), 404

    # Delete related data
    intergroup_research_findings = [f for f in intergroup_research_findings if f.get('sessionId') != session_id]
    intergroup_research_notes = [n for n in intergroup_research_notes if n.get('sessionId') != session_id]
    intergroup_research_scripts = [s for s in intergroup_research_scripts if s.get('sessionId') != session_id]

    return jsonify({
        'success': True,
        'message': 'Session deleted'
    })


@app.route('/api/intergroup-research/discover', methods=['POST'])
def discover_intergroups():
    """Discover intergroups for a state - returns known intergroups and searches for more"""
    data = request.json
    state = data.get('state', '')
    session_id = data.get('sessionId')

    if not state:
        return jsonify({
            'success': False,
            'error': 'State is required'
        }), 400

    state_name = US_STATE_NAMES.get(state, state)

    # Get known intergroups for this state
    known = KNOWN_INTERGROUPS.get(state, [])

    # Generate search suggestions based on common patterns
    generated = []
    state_lower = state.lower()
    state_name_lower = state_name.lower().replace(' ', '')

    domain_patterns = [
        f'aa{state_lower}.org',
        f'{state_lower}aa.org',
        f'aa{state_name_lower}.org',
        f'{state_name_lower}aa.org',
        f'aa-{state_lower}.org',
    ]

    for domain in domain_patterns:
        if not any(k['domain'] == domain for k in known):
            generated.append({
                'name': f'{state_name} AA (Generated)',
                'domain': domain,
                'type': 'unknown',
                'generated': True
            })

    # Update session if provided
    if session_id:
        for session in intergroup_research_sessions:
            if session['id'] == session_id:
                session['intergroups_found'] = len(known) + len(generated)
                session['updatedAt'] = datetime.now().isoformat()
                break

    return jsonify({
        'success': True,
        'state': state,
        'stateName': state_name,
        'known': known,
        'generated': generated,
        'total': len(known) + len(generated)
    })


@app.route('/api/intergroup-research/probe-stream', methods=['POST'])
def probe_intergroup_stream():
    """Stream probe results for an intergroup domain - tries multiple URL patterns"""
    data = request.json
    domain = data.get('domain', '')
    name = data.get('name', '')
    session_id = data.get('sessionId')

    if not domain:
        return jsonify({
            'success': False,
            'error': 'Domain is required'
        }), 400

    def generate():
        results = []
        notes = []
        working_endpoints = []

        yield f"data: {json.dumps({'type': 'start', 'domain': domain, 'name': name})}\n\n"

        notes.append(f"Starting probe of {name} ({domain})")
        yield f"data: {json.dumps({'type': 'note', 'note': notes[-1], 'notes': notes})}\n\n"
        time.sleep(0.2)

        # First, check if the domain is reachable
        notes.append(f"Checking if {domain} is reachable...")
        yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"

        try:
            base_response = requests.get(f'https://{domain}', timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)'
            })
            notes.append(f"✓ Domain reachable (HTTP {base_response.status_code})")
            yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"
        except Exception as e:
            notes.append(f"✗ Domain not reachable: {str(e)[:50]}")
            yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"
            yield f"data: {json.dumps({'type': 'complete', 'success': False, 'notes': notes, 'results': [], 'working': []})}\n\n"
            return

        time.sleep(0.3)

        # Try each URL pattern
        for pattern_name, pattern_config in INTERGROUP_URL_PATTERNS.items():
            url = pattern_config['pattern'].format(domain=domain)
            pattern_type = pattern_config['type']
            description = pattern_config['description']

            notes.append(f"Testing: {description}")
            yield f"data: {json.dumps({'type': 'note', 'notes': notes, 'testing': url})}\n\n"

            result = {
                'pattern': pattern_name,
                'url': url,
                'type': pattern_type,
                'description': description,
                'status': 'unknown',
                'details': {}
            }

            try:
                response = requests.get(url, timeout=10, headers={
                    'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
                    'Accept': 'application/json, text/html, */*'
                })

                result['httpStatus'] = response.status_code

                if response.status_code == 200:
                    content_type = response.headers.get('Content-Type', '')
                    result['contentType'] = content_type

                    # Try to parse as JSON
                    if 'json' in content_type or pattern_type == 'tsml':
                        try:
                            json_data = response.json()
                            if isinstance(json_data, list) and len(json_data) > 0:
                                result['status'] = 'success'
                                result['details'] = {
                                    'meetingCount': len(json_data),
                                    'sampleFields': list(json_data[0].keys())[:10] if json_data else [],
                                    'dataType': 'json_array'
                                }
                                notes[-1] = f"✓ {description}: Found {len(json_data)} meetings (JSON)"
                                working_endpoints.append({
                                    'url': url,
                                    'type': pattern_type,
                                    'meetingCount': len(json_data),
                                    'name': name
                                })
                            elif isinstance(json_data, dict):
                                result['status'] = 'partial'
                                result['details'] = {
                                    'dataType': 'json_object',
                                    'keys': list(json_data.keys())[:10]
                                }
                                notes[-1] = f"~ {description}: JSON object returned (needs analysis)"
                            else:
                                result['status'] = 'empty'
                                notes[-1] = f"~ {description}: Empty or unexpected JSON"
                        except json.JSONDecodeError:
                            # Not JSON, check if it's HTML
                            if 'html' in content_type or '<html' in response.text[:500].lower():
                                result['status'] = 'html'
                                result['details'] = {
                                    'dataType': 'html',
                                    'length': len(response.text),
                                    'hasForm': '<form' in response.text.lower(),
                                    'hasTable': '<table' in response.text.lower(),
                                    'hasMeetingText': 'meeting' in response.text.lower()
                                }
                                if result['details']['hasMeetingText']:
                                    notes[-1] = f"~ {description}: HTML page with meeting content (needs scraping)"
                                else:
                                    notes[-1] = f"~ {description}: HTML page (may not have meetings)"
                            else:
                                result['status'] = 'unknown'
                                notes[-1] = f"? {description}: Unknown content type"
                    else:
                        # HTML content
                        result['status'] = 'html'
                        result['details'] = {
                            'dataType': 'html',
                            'length': len(response.text),
                            'hasForm': '<form' in response.text.lower(),
                            'hasTable': '<table' in response.text.lower(),
                            'hasMeetingText': 'meeting' in response.text.lower()
                        }
                        if result['details']['hasMeetingText']:
                            notes[-1] = f"~ {description}: HTML page with meeting content"
                        else:
                            notes[-1] = f"- {description}: HTML page (no meeting text found)"

                elif response.status_code == 404:
                    result['status'] = 'not_found'
                    notes[-1] = f"✗ {description}: Not found (404)"
                elif response.status_code in [401, 403]:
                    result['status'] = 'forbidden'
                    notes[-1] = f"✗ {description}: Access denied ({response.status_code})"
                else:
                    result['status'] = 'error'
                    notes[-1] = f"✗ {description}: HTTP {response.status_code}"

            except requests.exceptions.Timeout:
                result['status'] = 'timeout'
                notes[-1] = f"✗ {description}: Timeout"
            except requests.exceptions.RequestException as e:
                result['status'] = 'error'
                result['error'] = str(e)[:100]
                notes[-1] = f"✗ {description}: {str(e)[:30]}"

            results.append(result)
            yield f"data: {json.dumps({'type': 'note', 'notes': notes, 'result': result})}\n\n"
            time.sleep(0.3)

        # Summary
        successful = [r for r in results if r['status'] == 'success']
        partial = [r for r in results if r['status'] in ['partial', 'html']]

        summary_note = f"Probe complete: {len(successful)} working endpoints"
        if partial:
            summary_note += f", {len(partial)} need analysis"
        notes.append(summary_note)

        yield f"data: {json.dumps({'type': 'note', 'notes': notes})}\n\n"

        # Update session stats if provided
        if session_id:
            for session in intergroup_research_sessions:
                if session['id'] == session_id:
                    session['endpoints_tested'] = session.get('endpoints_tested', 0) + len(results)
                    session['working_sources'] = session.get('working_sources', 0) + len(successful)
                    if not successful:
                        session['failed_attempts'] = session.get('failed_attempts', 0) + 1
                    session['updatedAt'] = datetime.now().isoformat()
                    break

        # Final result
        yield f"data: {json.dumps({'type': 'complete', 'success': len(successful) > 0, 'domain': domain, 'name': name, 'notes': notes, 'results': results, 'working': working_endpoints})}\n\n"

    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    })


@app.route('/api/intergroup-research/findings', methods=['GET'])
def get_research_findings():
    """Get all findings, optionally filtered by session"""
    session_id = request.args.get('sessionId', type=int)
    state = request.args.get('state')

    findings = intergroup_research_findings.copy()

    if session_id:
        findings = [f for f in findings if f.get('sessionId') == session_id]
    if state:
        findings = [f for f in findings if f.get('state') == state]

    return jsonify({
        'success': True,
        'findings': findings,
        'total': len(findings)
    })


@app.route('/api/intergroup-research/findings', methods=['POST'])
def add_research_finding():
    """Add a new finding to a research session"""
    data = request.json
    session_id = data.get('sessionId')

    finding = {
        'id': len(intergroup_research_findings) + 1,
        'sessionId': session_id,
        'state': data.get('state', ''),
        'intergroupName': data.get('intergroupName', ''),
        'domain': data.get('domain', ''),
        'url': data.get('url', ''),
        'type': data.get('type', 'unknown'),  # tsml, bmlt, custom_html, unknown
        'status': data.get('status', 'discovered'),  # discovered, verified, failed
        'meetingCount': data.get('meetingCount', 0),
        'details': data.get('details', {}),
        'notes': data.get('notes', ''),
        'createdAt': datetime.now().isoformat()
    }

    intergroup_research_findings.append(finding)

    return jsonify({
        'success': True,
        'finding': finding
    })


@app.route('/api/intergroup-research/notes', methods=['GET'])
def get_research_notes():
    """Get all notes for a session"""
    session_id = request.args.get('sessionId', type=int)

    notes = intergroup_research_notes.copy()

    if session_id:
        notes = [n for n in notes if n.get('sessionId') == session_id]

    # Sort by created date
    notes.sort(key=lambda x: x.get('createdAt', ''))

    return jsonify({
        'success': True,
        'notes': notes,
        'total': len(notes)
    })


@app.route('/api/intergroup-research/notes', methods=['POST'])
def add_research_note():
    """Add a note to a research session - for learnings and reminders"""
    data = request.json
    session_id = data.get('sessionId')

    note = {
        'id': len(intergroup_research_notes) + 1,
        'sessionId': session_id,
        'type': data.get('type', 'general'),  # general, success, failure, reminder, learning
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'relatedDomain': data.get('relatedDomain', ''),
        'relatedUrl': data.get('relatedUrl', ''),
        'tags': data.get('tags', []),
        'createdAt': datetime.now().isoformat()
    }

    intergroup_research_notes.append(note)

    return jsonify({
        'success': True,
        'note': note
    })


@app.route('/api/intergroup-research/notes/<int:note_id>', methods=['DELETE'])
def delete_research_note(note_id):
    """Delete a research note"""
    global intergroup_research_notes

    original_len = len(intergroup_research_notes)
    intergroup_research_notes = [n for n in intergroup_research_notes if n['id'] != note_id]

    if len(intergroup_research_notes) == original_len:
        return jsonify({
            'success': False,
            'error': 'Note not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Note deleted'
    })


@app.route('/api/intergroup-research/scripts', methods=['GET'])
def get_research_scripts():
    """Get all saved scripts, optionally filtered"""
    session_id = request.args.get('sessionId', type=int)
    state = request.args.get('state')

    scripts = intergroup_research_scripts.copy()

    if session_id:
        scripts = [s for s in scripts if s.get('sessionId') == session_id]
    if state:
        scripts = [s for s in scripts if s.get('state') == state]

    return jsonify({
        'success': True,
        'scripts': scripts,
        'total': len(scripts)
    })


@app.route('/api/intergroup-research/scripts', methods=['POST'])
def save_research_script():
    """Save a scraping script for an intergroup"""
    data = request.json
    session_id = data.get('sessionId')

    script = {
        'id': len(intergroup_research_scripts) + 1,
        'sessionId': session_id,
        'state': data.get('state', ''),
        'intergroupName': data.get('intergroupName', ''),
        'domain': data.get('domain', ''),
        'url': data.get('url', ''),
        'scriptType': data.get('scriptType', 'python'),  # python, javascript
        'feedType': data.get('feedType', 'custom'),  # tsml, bmlt, custom
        'content': data.get('content', ''),
        'description': data.get('description', ''),
        'tested': data.get('tested', False),
        'testResults': data.get('testResults', {}),
        'createdAt': datetime.now().isoformat(),
        'updatedAt': datetime.now().isoformat()
    }

    intergroup_research_scripts.append(script)

    return jsonify({
        'success': True,
        'script': script
    })


@app.route('/api/intergroup-research/scripts/<int:script_id>', methods=['PUT'])
def update_research_script(script_id):
    """Update a saved script"""
    data = request.json

    for script in intergroup_research_scripts:
        if script['id'] == script_id:
            if 'content' in data:
                script['content'] = data['content']
            if 'description' in data:
                script['description'] = data['description']
            if 'tested' in data:
                script['tested'] = data['tested']
            if 'testResults' in data:
                script['testResults'] = data['testResults']
            script['updatedAt'] = datetime.now().isoformat()

            return jsonify({
                'success': True,
                'script': script
            })

    return jsonify({
        'success': False,
        'error': 'Script not found'
    }), 404


@app.route('/api/intergroup-research/scripts/<int:script_id>', methods=['DELETE'])
def delete_research_script(script_id):
    """Delete a saved script"""
    global intergroup_research_scripts

    original_len = len(intergroup_research_scripts)
    intergroup_research_scripts = [s for s in intergroup_research_scripts if s['id'] != script_id]

    if len(intergroup_research_scripts) == original_len:
        return jsonify({
            'success': False,
            'error': 'Script not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Script deleted'
    })


@app.route('/api/intergroup-research/generate-scraper', methods=['POST'])
def generate_custom_scraper():
    """Generate a custom scraping script based on page analysis"""
    data = request.json
    url = data.get('url', '')
    name = data.get('name', '')
    state = data.get('state', '')
    page_type = data.get('pageType', 'html')  # html, json, xml

    if not url:
        return jsonify({
            'success': False,
            'error': 'URL is required'
        }), 400

    state_name = US_STATE_NAMES.get(state, state)

    # Generate a template script based on page type
    if page_type == 'json' or 'tsml' in page_type.lower():
        script = f'''#!/usr/bin/env python3
"""
Scraping script for: {name}
URL: {url}
State: {state_name} ({state})
Type: JSON/TSML Feed
Generated: {datetime.now().isoformat()}

This script fetches meetings from a TSML-compatible JSON endpoint.
"""

import requests
import json
from datetime import datetime

# Configuration
FEED_URL = "{url}"
FEED_NAME = "{name}"
STATE = "{state}"

# Request headers
HEADERS = {{
    'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
    'Accept': 'application/json'
}}

def fetch_meetings():
    """Fetch meetings from the JSON feed"""
    try:
        response = requests.get(FEED_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        meetings = response.json()

        if not isinstance(meetings, list):
            print(f"Warning: Expected array, got {{type(meetings)}}")
            return []

        print(f"Found {{len(meetings)}} meetings")

        # Transform to standard format if needed
        standardized = []
        for m in meetings:
            meeting = {{
                'name': m.get('name', 'Unknown'),
                'address': m.get('address', m.get('formatted_address', '')),
                'city': m.get('city', ''),
                'state': m.get('state', STATE),
                'day': m.get('day', m.get('day_of_week', '')),
                'time': m.get('time', m.get('start_time', '')),
                'types': m.get('types', []),
                'notes': m.get('notes', ''),
                'location': m.get('location', m.get('location_notes', '')),
                'source': FEED_NAME
            }}
            standardized.append(meeting)

        return standardized

    except requests.exceptions.RequestException as e:
        print(f"Error fetching meetings: {{e}}")
        return []

if __name__ == '__main__':
    meetings = fetch_meetings()
    print(json.dumps(meetings[:5], indent=2))  # Show first 5
'''
    else:
        # HTML scraping template
        script = f'''#!/usr/bin/env python3
"""
Scraping script for: {name}
URL: {url}
State: {state_name} ({state})
Type: HTML Scraper (Custom)
Generated: {datetime.now().isoformat()}

This script scrapes meetings from an HTML page.
NOTE: This is a template - you'll need to customize the selectors
based on the actual page structure.
"""

import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime

# Configuration
BASE_URL = "{url}"
FEED_NAME = "{name}"
STATE = "{state}"

# Request headers
HEADERS = {{
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml'
}}

def fetch_page(url):
    """Fetch and parse an HTML page"""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return BeautifulSoup(response.text, 'html.parser')
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page: {{e}}")
        return None

def parse_meetings(soup):
    """
    Parse meetings from the HTML.

    TODO: Customize these selectors based on the actual page structure.
    Common patterns to look for:
    - Tables with meeting data (<table>, <tr>, <td>)
    - Lists (<ul>, <li>) with meeting information
    - Divs with specific classes (.meeting, .meeting-item, etc.)
    - JSON embedded in script tags
    """
    meetings = []

    # Example: Look for embedded JSON data
    scripts = soup.find_all('script')
    for script in scripts:
        if script.string and 'meetings' in script.string.lower():
            # Try to extract JSON from script tag
            json_match = re.search(r'\\[\\s*\\{{.*?\\}}\\s*\\]', script.string, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                    print(f"Found {{len(data)}} meetings in embedded JSON")
                    return data
                except json.JSONDecodeError:
                    pass

    # Example: Look for table rows
    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:  # Skip header row
            cells = row.find_all(['td', 'th'])
            if len(cells) >= 3:
                meeting = {{
                    'name': cells[0].get_text(strip=True),
                    'day': cells[1].get_text(strip=True) if len(cells) > 1 else '',
                    'time': cells[2].get_text(strip=True) if len(cells) > 2 else '',
                    'address': cells[3].get_text(strip=True) if len(cells) > 3 else '',
                    'state': STATE,
                    'source': FEED_NAME
                }}
                meetings.append(meeting)

    # Example: Look for meeting divs
    meeting_divs = soup.find_all('div', class_=re.compile(r'meeting', re.I))
    for div in meeting_divs:
        name = div.find(['h2', 'h3', 'h4', '.name', '.title'])
        meeting = {{
            'name': name.get_text(strip=True) if name else 'Unknown',
            'state': STATE,
            'source': FEED_NAME
        }}
        # Add more field extraction based on page structure
        meetings.append(meeting)

    return meetings

def scrape_meetings():
    """Main scraping function"""
    soup = fetch_page(BASE_URL)
    if not soup:
        return []

    meetings = parse_meetings(soup)
    print(f"Found {{len(meetings)}} meetings")

    return meetings

if __name__ == '__main__':
    meetings = scrape_meetings()
    print(json.dumps(meetings[:5], indent=2))  # Show first 5
'''

    return jsonify({
        'success': True,
        'script': script,
        'scriptType': 'python',
        'feedType': page_type
    })


@app.route('/api/intergroup-research/scripts/test', methods=['POST'])
def test_research_script():
    """Test a script by fetching its URL and returning normalized meeting data"""
    data = request.json
    url = data.get('url', '')
    feed_type = data.get('feedType', 'tsml')  # tsml, bmlt, json, custom
    state = data.get('state', '')
    source_name = data.get('sourceName', 'Test Script')

    if not url:
        return jsonify({
            'success': False,
            'error': 'URL is required'
        }), 400

    try:
        # Fetch data from the URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
            'Accept': 'application/json'
        }

        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        # Try to parse as JSON
        try:
            raw_data = response.json()
        except json.JSONDecodeError:
            return jsonify({
                'success': False,
                'error': 'Response is not valid JSON',
                'rawResponse': response.text[:500] if len(response.text) > 500 else response.text
            }), 400

        # Handle BMLT-style responses that wrap data in an array
        if isinstance(raw_data, dict):
            # Check common response wrappers
            if 'meetings' in raw_data:
                meetings_raw = raw_data['meetings']
            elif 'data' in raw_data:
                meetings_raw = raw_data['data']
            else:
                meetings_raw = [raw_data]
        elif isinstance(raw_data, list):
            meetings_raw = raw_data
        else:
            return jsonify({
                'success': False,
                'error': f'Unexpected data format: {type(raw_data).__name__}'
            }), 400

        # Normalize the meetings
        normalized_meetings = []
        errors = []
        field_stats = {
            'name': 0, 'address': 0, 'city': 0, 'state': 0,
            'day': 0, 'time': 0, 'latitude': 0, 'longitude': 0,
            'types': 0, 'notes': 0, 'location': 0
        }

        for i, raw_meeting in enumerate(meetings_raw[:100]):  # Limit to 100 for testing
            try:
                # Handle BMLT format transformation
                if feed_type == 'bmlt':
                    transformed = transform_bmlt_to_tsml(raw_meeting)
                    normalized = normalize_meeting(transformed, source_name, state, skip_geocoding=True)
                else:
                    normalized = normalize_meeting(raw_meeting, source_name, state, skip_geocoding=True)

                normalized_meetings.append(normalized)

                # Track field population stats
                for field in field_stats:
                    if normalized.get(field):
                        field_stats[field] += 1

            except Exception as e:
                errors.append(f"Meeting {i}: {str(e)}")

        # Calculate quality metrics
        total = len(normalized_meetings)
        quality_score = 0
        if total > 0:
            # Weight key fields more heavily
            weighted_fields = {
                'name': 15, 'address': 15, 'day': 20, 'time': 20,
                'city': 10, 'state': 5, 'latitude': 5, 'longitude': 5,
                'types': 3, 'notes': 1, 'location': 1
            }
            for field, weight in weighted_fields.items():
                quality_score += (field_stats[field] / total) * weight

        return jsonify({
            'success': True,
            'totalRaw': len(meetings_raw),
            'totalNormalized': total,
            'qualityScore': round(quality_score, 1),
            'fieldStats': field_stats,
            'sampleMeetings': normalized_meetings[:10],  # First 10 for preview
            'errors': errors[:10] if errors else [],
            'canSaveAsSource': quality_score >= 50 and total >= 1
        })

    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request timed out after 30 seconds'
        }), 504
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'error': f'Failed to fetch URL: {str(e)}'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }), 500


@app.route('/api/intergroup-research/sources', methods=['GET'])
def get_custom_sources():
    """Get all custom research sources"""
    state = request.args.get('state')

    sources = custom_research_sources.copy()

    if state:
        sources = [s for s in sources if s.get('state') == state]

    return jsonify({
        'success': True,
        'sources': sources,
        'total': len(sources)
    })


@app.route('/api/intergroup-research/sources', methods=['POST'])
def save_custom_source():
    """Save a tested script as a custom source"""
    data = request.json

    url = data.get('url', '')
    if not url:
        return jsonify({
            'success': False,
            'error': 'URL is required'
        }), 400

    # Check for duplicate URL
    for source in custom_research_sources:
        if source['url'] == url:
            return jsonify({
                'success': False,
                'error': 'A source with this URL already exists'
            }), 409

    source = {
        'id': len(custom_research_sources) + 1,
        'name': data.get('name', 'Custom Source'),
        'url': url,
        'state': data.get('state', ''),
        'feedType': data.get('feedType', 'tsml'),
        'meetingCount': data.get('meetingCount', 0),
        'qualityScore': data.get('qualityScore', 0),
        'scriptId': data.get('scriptId'),  # Link to original script if applicable
        'enabled': True,
        'lastTested': datetime.now().isoformat(),
        'createdAt': datetime.now().isoformat()
    }

    custom_research_sources.append(source)

    return jsonify({
        'success': True,
        'source': source
    })


@app.route('/api/intergroup-research/sources/<int:source_id>', methods=['DELETE'])
def delete_custom_source(source_id):
    """Delete a custom source"""
    global custom_research_sources

    original_len = len(custom_research_sources)
    custom_research_sources = [s for s in custom_research_sources if s['id'] != source_id]

    if len(custom_research_sources) == original_len:
        return jsonify({
            'success': False,
            'error': 'Source not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Source deleted'
    })


@app.route('/api/intergroup-research/sources/<int:source_id>/toggle', methods=['POST'])
def toggle_custom_source(source_id):
    """Toggle a custom source enabled/disabled"""
    for source in custom_research_sources:
        if source['id'] == source_id:
            source['enabled'] = not source['enabled']
            return jsonify({
                'success': True,
                'source': source
            })

    return jsonify({
        'success': False,
        'error': 'Source not found'
    }), 404


@app.route('/api/intergroup-research/scripts/<int:script_id>/execute', methods=['POST'])
def execute_research_script(script_id):
    """Execute a script and capture logs with meeting data visualization"""
    # Find the script
    script = None
    for s in intergroup_research_scripts:
        if s['id'] == script_id:
            script = s
            break

    if not script:
        return jsonify({
            'success': False,
            'error': 'Script not found'
        }), 404

    url = script.get('url', '')
    feed_type = script.get('feedType', 'tsml')
    state = script.get('state', '')
    source_name = script.get('intergroupName', 'Unknown Source')

    logs = []
    meetings_data = []
    execution_start = datetime.now()

    def add_log(level, message):
        logs.append({
            'timestamp': datetime.now().isoformat(),
            'level': level,
            'message': message
        })

    add_log('info', f'Starting script execution for {source_name}')
    add_log('info', f'URL: {url}')
    add_log('info', f'Feed type: {feed_type}')

    try:
        # Fetch data from the URL
        add_log('info', 'Fetching data from URL...')
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0)',
            'Accept': 'application/json'
        }

        response = requests.get(url, headers=headers, timeout=30)
        add_log('info', f'Response status: {response.status_code}')
        add_log('info', f'Content-Type: {response.headers.get("Content-Type", "unknown")}')
        add_log('info', f'Content-Length: {len(response.content)} bytes')

        response.raise_for_status()

        # Try to parse as JSON
        try:
            raw_data = response.json()
            add_log('success', 'Successfully parsed JSON response')
        except json.JSONDecodeError as e:
            add_log('error', f'JSON parse error: {str(e)}')
            add_log('info', f'Raw response (first 500 chars): {response.text[:500]}')
            raise

        # Handle different response structures
        if isinstance(raw_data, dict):
            if 'meetings' in raw_data:
                meetings_raw = raw_data['meetings']
                add_log('info', f'Found meetings in "meetings" key')
            elif 'data' in raw_data:
                meetings_raw = raw_data['data']
                add_log('info', f'Found meetings in "data" key')
            else:
                meetings_raw = [raw_data]
                add_log('warning', 'No standard key found, treating response as single meeting')
        elif isinstance(raw_data, list):
            meetings_raw = raw_data
            add_log('info', f'Response is a list with {len(meetings_raw)} items')
        else:
            add_log('error', f'Unexpected data format: {type(raw_data).__name__}')
            raise ValueError(f'Unexpected data format: {type(raw_data).__name__}')

        add_log('info', f'Processing {len(meetings_raw)} raw meetings...')

        # Normalize meetings
        normalized_count = 0
        error_count = 0
        field_stats = {
            'name': 0, 'address': 0, 'city': 0, 'state': 0,
            'day': 0, 'time': 0, 'latitude': 0, 'longitude': 0,
            'types': 0, 'notes': 0, 'location': 0
        }

        for i, raw_meeting in enumerate(meetings_raw[:200]):  # Limit for execution
            try:
                if feed_type == 'bmlt':
                    transformed = transform_bmlt_to_tsml(raw_meeting)
                    normalized = normalize_meeting(transformed, source_name, state, skip_geocoding=True)
                else:
                    normalized = normalize_meeting(raw_meeting, source_name, state, skip_geocoding=True)

                meetings_data.append(normalized)
                normalized_count += 1

                # Track field stats
                for field in field_stats:
                    if normalized.get(field):
                        field_stats[field] += 1

                # Log first few meetings
                if i < 3:
                    add_log('info', f'Meeting {i+1}: {normalized.get("name", "unnamed")} - {normalized.get("city", "?")}')

            except Exception as e:
                error_count += 1
                if error_count <= 5:
                    add_log('warning', f'Error processing meeting {i+1}: {str(e)}')

        add_log('success', f'Successfully normalized {normalized_count} meetings')
        if error_count > 0:
            add_log('warning', f'{error_count} meetings had errors during normalization')

        # Calculate quality score
        quality_score = 0
        if normalized_count > 0:
            weighted_fields = {
                'name': 15, 'address': 15, 'day': 20, 'time': 20,
                'city': 10, 'state': 5, 'latitude': 5, 'longitude': 5,
                'types': 3, 'notes': 1, 'location': 1
            }
            for field, weight in weighted_fields.items():
                quality_score += (field_stats[field] / normalized_count) * weight

        add_log('info', f'Quality score: {round(quality_score, 1)}%')
        add_log('info', f'Field coverage - Name: {field_stats["name"]}, Address: {field_stats["address"]}, Day: {field_stats["day"]}, Time: {field_stats["time"]}')

        execution_end = datetime.now()
        duration_ms = (execution_end - execution_start).total_seconds() * 1000
        add_log('success', f'Execution completed in {round(duration_ms)}ms')

        # Store execution history
        execution_record = {
            'id': len(script_execution_history.get(script_id, [])) + 1,
            'executedAt': execution_start.isoformat(),
            'duration_ms': round(duration_ms),
            'success': True,
            'totalRaw': len(meetings_raw),
            'totalNormalized': normalized_count,
            'errorCount': error_count,
            'qualityScore': round(quality_score, 1),
            'fieldStats': field_stats,
            'logs': logs
        }

        if script_id not in script_execution_history:
            script_execution_history[script_id] = []
        script_execution_history[script_id].append(execution_record)

        # Keep only last 10 executions
        if len(script_execution_history[script_id]) > 10:
            script_execution_history[script_id] = script_execution_history[script_id][-10:]

        return jsonify({
            'success': True,
            'execution': execution_record,
            'meetings': meetings_data[:50],  # Return first 50 for visualization
            'totalMeetings': len(meetings_data),
            'sampleMeetings': meetings_data[:10]
        })

    except requests.exceptions.Timeout:
        add_log('error', 'Request timed out after 30 seconds')
        execution_record = {
            'id': len(script_execution_history.get(script_id, [])) + 1,
            'executedAt': execution_start.isoformat(),
            'success': False,
            'error': 'Request timed out',
            'logs': logs
        }
        if script_id not in script_execution_history:
            script_execution_history[script_id] = []
        script_execution_history[script_id].append(execution_record)

        return jsonify({
            'success': False,
            'error': 'Request timed out after 30 seconds',
            'logs': logs
        }), 504

    except requests.exceptions.RequestException as e:
        add_log('error', f'Request failed: {str(e)}')
        execution_record = {
            'id': len(script_execution_history.get(script_id, [])) + 1,
            'executedAt': execution_start.isoformat(),
            'success': False,
            'error': str(e),
            'logs': logs
        }
        if script_id not in script_execution_history:
            script_execution_history[script_id] = []
        script_execution_history[script_id].append(execution_record)

        return jsonify({
            'success': False,
            'error': f'Failed to fetch URL: {str(e)}',
            'logs': logs
        }), 500

    except Exception as e:
        add_log('error', f'Unexpected error: {str(e)}')
        execution_record = {
            'id': len(script_execution_history.get(script_id, [])) + 1,
            'executedAt': execution_start.isoformat(),
            'success': False,
            'error': str(e),
            'logs': logs
        }
        if script_id not in script_execution_history:
            script_execution_history[script_id] = []
        script_execution_history[script_id].append(execution_record)

        return jsonify({
            'success': False,
            'error': f'Unexpected error: {str(e)}',
            'logs': logs
        }), 500


@app.route('/api/intergroup-research/scripts/<int:script_id>/executions', methods=['GET'])
def get_script_executions(script_id):
    """Get execution history for a script"""
    executions = script_execution_history.get(script_id, [])
    return jsonify({
        'success': True,
        'executions': executions,
        'total': len(executions)
    })


@app.route('/api/intergroup-research/scripts/<int:script_id>/regenerate', methods=['POST'])
def regenerate_script_from_logs(script_id):
    """Regenerate a script based on execution logs and errors"""
    # Find the script
    script = None
    script_idx = None
    for i, s in enumerate(intergroup_research_scripts):
        if s['id'] == script_id:
            script = s
            script_idx = i
            break

    if not script:
        return jsonify({
            'success': False,
            'error': 'Script not found'
        }), 404

    # Get execution history
    executions = script_execution_history.get(script_id, [])
    last_execution = executions[-1] if executions else None

    url = script.get('url', '')
    name = script.get('intergroupName', 'Unknown Source')
    state = script.get('state', '')
    feed_type = script.get('feedType', 'tsml')

    # Analyze logs to determine what went wrong
    issues = []
    suggestions = []

    if last_execution:
        logs = last_execution.get('logs', [])
        for log in logs:
            if log['level'] == 'error':
                msg = log['message'].lower()
                if 'json parse error' in msg:
                    issues.append('JSON parsing failed')
                    suggestions.append('The response may not be JSON - try HTML parsing')
                elif 'timeout' in msg:
                    issues.append('Request timed out')
                    suggestions.append('Increase timeout or check URL accessibility')
                elif 'unexpected data format' in msg:
                    issues.append('Unexpected data structure')
                    suggestions.append('Response structure differs from expected format')
            elif log['level'] == 'warning':
                msg = log['message'].lower()
                if 'error processing meeting' in msg:
                    issues.append('Meeting normalization errors')
                    suggestions.append('Field mappings may need adjustment')

        # Check field stats for insights
        field_stats = last_execution.get('fieldStats', {})
        quality_score = last_execution.get('qualityScore', 0)

        if quality_score < 50:
            issues.append(f'Low quality score: {quality_score}%')
            missing_fields = [f for f, v in field_stats.items() if v == 0]
            if missing_fields:
                suggestions.append(f'Missing fields: {", ".join(missing_fields)}')

    # Generate improved script based on analysis
    state_name = US_STATE_NAMES.get(state, state)
    issue_summary = "; ".join(issues) if issues else "No specific issues detected"
    suggestion_summary = "; ".join(suggestions) if suggestions else "Standard regeneration"

    # Create enhanced script with better error handling
    new_script = f'''#!/usr/bin/env python3
"""
Scraping script for: {name}
State: {state_name} ({state})
Feed Type: {feed_type.upper()}
Regenerated: {datetime.now().isoformat()}

Previous Issues: {issue_summary}
Applied Fixes: {suggestion_summary}

This script has been regenerated based on execution logs to address
identified issues with data fetching or normalization.
"""

import requests
import json
import re
from datetime import datetime

# Configuration
FEED_URL = "{url}"
FEED_NAME = "{name}"
STATE = "{state}"

# Request headers with additional browser mimicry
HEADERS = {{
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache'
}}

def clean_time(time_str):
    """Normalize time format to HH:MM"""
    if not time_str:
        return None
    time_str = str(time_str).strip()
    # Handle HH:MM:SS format
    if len(time_str) > 5 and ':' in time_str:
        time_str = time_str[:5]
    return time_str

def normalize_day(day_val):
    """Normalize day to 0-6 (Sunday=0)"""
    if day_val is None:
        return None
    if isinstance(day_val, str):
        day_map = {{'sunday': 0, 'sun': 0, 'monday': 1, 'mon': 1, 'tuesday': 2, 'tue': 2,
                   'wednesday': 3, 'wed': 3, 'thursday': 4, 'thu': 4, 'friday': 5, 'fri': 5,
                   'saturday': 6, 'sat': 6}}
        return day_map.get(day_val.lower().strip())
    day_int = int(day_val)
    # Handle 1-7 format (some feeds use Sunday=1)
    if day_int >= 1 and day_int <= 7:
        return day_int - 1
    return day_int if 0 <= day_int <= 6 else None

def extract_meeting_data(raw_data):
    """Extract meetings from various response structures"""
    if isinstance(raw_data, list):
        return raw_data
    if isinstance(raw_data, dict):
        # Try common wrapper keys
        for key in ['meetings', 'data', 'results', 'items', 'records']:
            if key in raw_data and isinstance(raw_data[key], list):
                return raw_data[key]
        # If it looks like a single meeting, wrap it
        if 'name' in raw_data or 'meeting_name' in raw_data:
            return [raw_data]
    return []

def transform_meeting(meeting):
    """Transform meeting to normalized format with robust field mapping"""
    # Try multiple field name variations
    name = (meeting.get('name') or meeting.get('meeting_name') or
            meeting.get('title') or meeting.get('group') or 'Unknown Meeting')

    # Day handling
    day_raw = (meeting.get('day') or meeting.get('weekday') or
               meeting.get('weekday_tinyint') or meeting.get('day_of_week'))
    day = normalize_day(day_raw)

    # Time handling
    time_raw = (meeting.get('time') or meeting.get('start_time') or
                meeting.get('time_start') or meeting.get('startTime'))
    time = clean_time(time_raw)

    # Location fields
    location = (meeting.get('location') or meeting.get('location_text') or
                meeting.get('venue') or meeting.get('location_info') or '')
    address = (meeting.get('address') or meeting.get('location_street') or
               meeting.get('street') or meeting.get('formatted_address') or '')
    city = (meeting.get('city') or meeting.get('location_municipality') or
            meeting.get('municipality') or meeting.get('town') or '')
    state_val = (meeting.get('state') or meeting.get('location_province') or
                 meeting.get('province') or meeting.get('region') or STATE)

    # Coordinates
    lat = meeting.get('latitude') or meeting.get('lat')
    lng = meeting.get('longitude') or meeting.get('lng') or meeting.get('lon')

    try:
        lat = float(lat) if lat else None
        lng = float(lng) if lng else None
    except (ValueError, TypeError):
        lat, lng = None, None

    return {{
        'name': name,
        'day': day,
        'time': time,
        'location': location,
        'address': address,
        'city': city,
        'state': state_val,
        'latitude': lat,
        'longitude': lng,
        'types': meeting.get('types', []),
        'notes': meeting.get('notes') or meeting.get('comments') or meeting.get('description') or '',
        'meeting_type': meeting.get('meeting_type', 'AA')
    }}

def fetch_meetings():
    """Fetch and transform meetings with enhanced error handling"""
    try:
        print(f"Fetching from: {{FEED_URL}}")
        response = requests.get(FEED_URL, headers=HEADERS, timeout=45)
        print(f"Status: {{response.status_code}}")

        response.raise_for_status()

        # Try JSON first
        try:
            raw_data = response.json()
        except json.JSONDecodeError as e:
            print(f"JSON decode failed: {{e}}")
            print(f"Content type: {{response.headers.get('Content-Type')}}")
            print(f"First 200 chars: {{response.text[:200]}}")
            return []

        meetings_raw = extract_meeting_data(raw_data)
        print(f"Found {{len(meetings_raw)}} raw meetings")

        meetings = []
        for i, m in enumerate(meetings_raw):
            try:
                transformed = transform_meeting(m)
                if transformed.get('name'):
                    meetings.append(transformed)
            except Exception as e:
                if i < 5:
                    print(f"Error on meeting {{i}}: {{e}}")

        print(f"Successfully transformed {{len(meetings)}} meetings")
        return meetings

    except requests.exceptions.RequestException as e:
        print(f"Request error: {{e}}")
        return []
    except Exception as e:
        print(f"Unexpected error: {{e}}")
        return []

if __name__ == '__main__':
    meetings = fetch_meetings()
    print(f"\\nTotal: {{len(meetings)}} meetings")
    for i, m in enumerate(meetings[:5]):
        print(f"\\n--- Meeting {{i+1}} ---")
        print(f"Name: {{m.get('name')}}")
        print(f"Day: {{m.get('day')}} Time: {{m.get('time')}}")
        print(f"Location: {{m.get('city')}}, {{m.get('state')}}")
        print(f"Address: {{m.get('address')}}")
'''

    # Update the script in storage
    intergroup_research_scripts[script_idx]['content'] = new_script
    intergroup_research_scripts[script_idx]['regeneratedAt'] = datetime.now().isoformat()
    intergroup_research_scripts[script_idx]['regenerationReason'] = issue_summary

    return jsonify({
        'success': True,
        'script': intergroup_research_scripts[script_idx],
        'issues': issues,
        'suggestions': suggestions,
        'newContent': new_script
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
