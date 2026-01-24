"""
Heatmap Indicator Service

Generates pre-computed cluster indicators for efficient heatmap rendering.
Creates hierarchical clusters at 5 zoom tiers with parent-child relationships.

HeatmapIndicator Schema (Back4App):
    - zoomTier: Number (1-5)
    - gridKey: String (unique: "{tier}:{lat_bucket}:{lng_bucket}")
    - filterType: String ("all", "AA", "NA", "Al-Anon", "Other", "state:XX")
    - latitude: Number (centroid)
    - longitude: Number (centroid)
    - meetingCount: Number
    - meetingTypes: Object ({AA: 50, NA: 12, ...})
    - state: String (primary state for cluster)
    - north, south, east, west: Number (bounding box)
    - parentGridKey: String (reference to parent cluster)
    - updatedAt: Date

Meeting Schema Addition:
    - clusterKey: String (tier 5 gridKey this meeting belongs to)
"""

import json
import threading
import time
import math
from datetime import datetime


# Zoom tier configuration
# Maps tier number to grid size in degrees
TIER_CONFIG = {
    1: {"grid_size": 5.0, "zoom_range": (1, 4), "name": "continental"},
    2: {"grid_size": 2.0, "zoom_range": (5, 6), "name": "regional"},
    3: {"grid_size": 1.0, "zoom_range": (7, 8), "name": "state"},
    4: {"grid_size": 0.5, "zoom_range": (9, 10), "name": "metro"},
    5: {"grid_size": 0.25, "zoom_range": (11, 12), "name": "neighborhood"},
}

# Filter types to pre-compute
FILTER_TYPES = ["all", "AA", "NA", "Al-Anon", "Other"]

# Job state tracking
indicator_job_state = {
    "is_running": False,
    "started_at": None,
    "progress": 0,
    "current_phase": "",
    "total_meetings": 0,
    "indicators_created": 0,
    "meetings_updated": 0,
    "errors": [],
    "last_completed_at": None,
    "last_duration_seconds": None,
}

# Lock for thread safety
_job_lock = threading.Lock()

# Back4App configuration (set by init function)
_back4app_config = {
    "app_id": None,
    "rest_key": None,
    "session": None,
}


def init_heatmap_service(app_id, rest_key, session=None):
    """Initialize the heatmap indicator service with Back4App credentials."""
    _back4app_config["app_id"] = app_id
    _back4app_config["rest_key"] = rest_key
    _back4app_config["session"] = session
    print(f"[HEATMAP-SERVICE] Initialized with app_id={app_id[:8]}...")


def get_job_status():
    """Get current job status."""
    with _job_lock:
        return dict(indicator_job_state)


def _get_headers():
    """Get Back4App API headers."""
    return {
        "X-Parse-Application-Id": _back4app_config["app_id"],
        "X-Parse-REST-API-Key": _back4app_config["rest_key"],
        "Content-Type": "application/json"
    }


def _update_progress(phase, progress=None, **kwargs):
    """Update job progress state."""
    with _job_lock:
        indicator_job_state["current_phase"] = phase
        if progress is not None:
            indicator_job_state["progress"] = progress
        for key, value in kwargs.items():
            if key in indicator_job_state:
                indicator_job_state[key] = value
    print(f"[HEATMAP-SERVICE] {phase} - {progress}%" if progress else f"[HEATMAP-SERVICE] {phase}")


def _fetch_all_meetings():
    """Fetch all meetings with lat/lng from Back4App."""
    import requests
    import urllib.parse

    meetings = []
    skip = 0
    limit = 1000

    session = _back4app_config["session"] or requests
    base_url = "https://parseapi.back4app.com/classes/Meetings"

    where = {
        "latitude": {"$exists": True},
        "longitude": {"$exists": True}
    }

    while True:
        params = {
            "limit": limit,
            "skip": skip,
            "keys": "latitude,longitude,meetingType,state,city,objectId",
            "where": json.dumps(where)
        }
        query_string = urllib.parse.urlencode(params)
        url = f"{base_url}?{query_string}"

        try:
            response = session.get(url, headers=_get_headers(), timeout=30)
            if response.status_code != 200:
                print(f"[HEATMAP-SERVICE] Error fetching meetings: {response.status_code}")
                break

            data = response.json()
            results = data.get("results", [])

            if not results:
                break

            meetings.extend(results)
            skip += limit

            _update_progress(f"Fetching meetings... {len(meetings)} loaded",
                           progress=min(10, int(len(meetings) / 1000)))

            # Safety limit
            if skip > 500000:
                print("[HEATMAP-SERVICE] Warning: Hit safety limit of 500k meetings")
                break

        except Exception as e:
            print(f"[HEATMAP-SERVICE] Error fetching meetings: {e}")
            indicator_job_state["errors"].append(f"Fetch error: {str(e)}")
            break

    return meetings


def _compute_grid_key(tier, lat, lng):
    """Compute grid key for a coordinate at a given tier."""
    grid_size = TIER_CONFIG[tier]["grid_size"]
    lat_bucket = round(lat / grid_size) * grid_size
    lng_bucket = round(lng / grid_size) * grid_size
    # Format with enough precision to avoid floating point issues
    return f"{tier}:{lat_bucket:.2f}:{lng_bucket:.2f}"


def _compute_parent_grid_key(tier, lat_centroid, lng_centroid):
    """Compute the parent grid key (tier - 1) for a cluster centroid."""
    if tier <= 1:
        return None
    return _compute_grid_key(tier - 1, lat_centroid, lng_centroid)


def _compute_bounding_box(tier, lat_bucket, lng_bucket):
    """Compute bounding box for a grid cell."""
    grid_size = TIER_CONFIG[tier]["grid_size"]
    half = grid_size / 2
    return {
        "north": lat_bucket + half,
        "south": lat_bucket - half,
        "east": lng_bucket + half,
        "west": lng_bucket - half,
    }


def _filter_meetings(meetings, filter_type):
    """Filter meetings based on filter type."""
    if filter_type == "all":
        return meetings
    elif filter_type in ["AA", "NA", "Al-Anon", "Other"]:
        return [m for m in meetings if m.get("meetingType") == filter_type]
    elif filter_type.startswith("state:"):
        state_code = filter_type[6:]
        return [m for m in meetings if m.get("state") == state_code]
    return meetings


def _generate_clusters_for_filter(meetings, filter_type):
    """Generate clusters at all tiers for a specific filter."""
    filtered = _filter_meetings(meetings, filter_type)

    if not filtered:
        return [], {}

    all_indicators = []
    meeting_cluster_keys = {}  # objectId -> tier5 gridKey

    # Process tiers from bottom (5) to top (1) so we can reference children
    for tier in [5, 4, 3, 2, 1]:
        grid_size = TIER_CONFIG[tier]["grid_size"]
        clusters = {}

        for meeting in filtered:
            lat = meeting.get("latitude")
            lng = meeting.get("longitude")
            if lat is None or lng is None:
                continue

            grid_key = _compute_grid_key(tier, lat, lng)

            if grid_key not in clusters:
                lat_bucket = round(lat / grid_size) * grid_size
                lng_bucket = round(lng / grid_size) * grid_size
                bbox = _compute_bounding_box(tier, lat_bucket, lng_bucket)

                clusters[grid_key] = {
                    "gridKey": grid_key,
                    "zoomTier": tier,
                    "filterType": filter_type,
                    "sum_lat": 0,
                    "sum_lng": 0,
                    "meetingCount": 0,
                    "meetingTypes": {},
                    "states": {},
                    **bbox,
                }

            cluster = clusters[grid_key]
            cluster["sum_lat"] += lat
            cluster["sum_lng"] += lng
            cluster["meetingCount"] += 1

            # Track meeting types
            mt = meeting.get("meetingType", "Other")
            cluster["meetingTypes"][mt] = cluster["meetingTypes"].get(mt, 0) + 1

            # Track states
            state = meeting.get("state")
            if state:
                cluster["states"][state] = cluster["states"].get(state, 0) + 1

            # Store tier 5 cluster key for each meeting (only for "all" filter)
            if tier == 5 and filter_type == "all":
                object_id = meeting.get("objectId")
                if object_id:
                    meeting_cluster_keys[object_id] = grid_key

        # Finalize clusters for this tier
        for grid_key, cluster in clusters.items():
            count = cluster["meetingCount"]
            if count > 0:
                # Calculate centroid
                cluster["latitude"] = cluster["sum_lat"] / count
                cluster["longitude"] = cluster["sum_lng"] / count

                # Determine primary state
                if cluster["states"]:
                    cluster["state"] = max(cluster["states"].items(), key=lambda x: x[1])[0]
                else:
                    cluster["state"] = None

                # Compute parent grid key
                cluster["parentGridKey"] = _compute_parent_grid_key(
                    tier, cluster["latitude"], cluster["longitude"]
                )

                # Clean up temporary fields
                del cluster["sum_lat"]
                del cluster["sum_lng"]
                del cluster["states"]

                all_indicators.append(cluster)

    return all_indicators, meeting_cluster_keys


def _save_indicators_batch(indicators):
    """Save indicators to Back4App in batches."""
    import requests

    if not indicators:
        return 0

    session = _back4app_config["session"] or requests
    batch_url = "https://parseapi.back4app.com/batch"
    saved_count = 0
    batch_size = 50  # Parse batch limit

    for i in range(0, len(indicators), batch_size):
        batch = indicators[i:i + batch_size]
        requests_list = []

        for indicator in batch:
            # Add timestamp
            indicator["updatedAt"] = {"__type": "Date", "iso": datetime.utcnow().isoformat() + "Z"}

            requests_list.append({
                "method": "POST",
                "path": "/classes/HeatmapIndicator",
                "body": indicator
            })

        try:
            response = session.post(
                batch_url,
                headers=_get_headers(),
                json={"requests": requests_list},
                timeout=30
            )

            if response.status_code == 200:
                results = response.json()
                saved_count += sum(1 for r in results if isinstance(r, dict) and ("objectId" in r or "createdAt" in r or "success" in r))
            else:
                print(f"[HEATMAP-SERVICE] Batch save error: {response.status_code} - {response.text[:200]}")
                indicator_job_state["errors"].append(f"Batch save error: {response.status_code}")
        except Exception as e:
            print(f"[HEATMAP-SERVICE] Batch save exception: {e}")
            indicator_job_state["errors"].append(f"Batch save exception: {str(e)}")

    return saved_count


def _update_meetings_cluster_keys(cluster_keys):
    """Update meetings with their tier 5 cluster keys."""
    import requests

    if not cluster_keys:
        return 0

    session = _back4app_config["session"] or requests
    batch_url = "https://parseapi.back4app.com/batch"
    updated_count = 0
    batch_size = 50

    items = list(cluster_keys.items())

    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        requests_list = []

        for object_id, cluster_key in batch:
            requests_list.append({
                "method": "PUT",
                "path": f"/classes/Meetings/{object_id}",
                "body": {"clusterKey": cluster_key}
            })

        try:
            response = session.post(
                batch_url,
                headers=_get_headers(),
                json={"requests": requests_list},
                timeout=30
            )

            if response.status_code == 200:
                results = response.json()
                updated_count += sum(1 for r in results if isinstance(r, dict) and "updatedAt" in r)
            else:
                print(f"[HEATMAP-SERVICE] Meeting update error: {response.status_code}")
        except Exception as e:
            print(f"[HEATMAP-SERVICE] Meeting update exception: {e}")

    return updated_count


def _delete_existing_indicators(filter_type=None):
    """Delete existing indicators, optionally filtered by type."""
    import requests
    import urllib.parse

    session = _back4app_config["session"] or requests
    base_url = "https://parseapi.back4app.com/classes/HeatmapIndicator"

    where = {}
    if filter_type:
        where["filterType"] = filter_type

    deleted_count = 0

    # Fetch and delete in batches
    while True:
        params = {
            "limit": 100,
            "keys": "objectId"
        }
        if where:
            params["where"] = json.dumps(where)

        query_string = urllib.parse.urlencode(params)
        url = f"{base_url}?{query_string}"

        try:
            response = session.get(url, headers=_get_headers(), timeout=15)
            if response.status_code != 200:
                break

            data = response.json()
            results = data.get("results", [])

            if not results:
                break

            # Batch delete
            batch_url = "https://parseapi.back4app.com/batch"
            requests_list = [{
                "method": "DELETE",
                "path": f"/classes/HeatmapIndicator/{r['objectId']}"
            } for r in results]

            del_response = session.post(
                batch_url,
                headers=_get_headers(),
                json={"requests": requests_list},
                timeout=30
            )

            if del_response.status_code == 200:
                deleted_count += len(results)

        except Exception as e:
            print(f"[HEATMAP-SERVICE] Delete error: {e}")
            break

    return deleted_count


def _get_active_states(meetings):
    """Get list of states that have meetings (for state-based filters)."""
    states = {}
    for m in meetings:
        state = m.get("state")
        if state:
            states[state] = states.get(state, 0) + 1

    # Only generate state filters for states with > 50 meetings
    return [s for s, count in states.items() if count > 50]


def generate_heatmap_indicators(include_state_filters=True, force=False):
    """
    Main job function to generate all heatmap indicators.

    Args:
        include_state_filters: If True, generate state:XX filters for active states
        force: If True, run even if already running

    Returns:
        dict with job results
    """
    global indicator_job_state

    with _job_lock:
        if indicator_job_state["is_running"] and not force:
            return {"success": False, "error": "Job already running"}

        indicator_job_state["is_running"] = True
        indicator_job_state["started_at"] = datetime.utcnow().isoformat()
        indicator_job_state["progress"] = 0
        indicator_job_state["current_phase"] = "Starting"
        indicator_job_state["errors"] = []
        indicator_job_state["indicators_created"] = 0
        indicator_job_state["meetings_updated"] = 0

    start_time = time.time()

    try:
        # Phase 1: Fetch all meetings
        _update_progress("Fetching meetings from Back4App", progress=5)
        meetings = _fetch_all_meetings()
        indicator_job_state["total_meetings"] = len(meetings)

        if not meetings:
            _update_progress("No meetings found", progress=100)
            return {"success": False, "error": "No meetings found"}

        print(f"[HEATMAP-SERVICE] Loaded {len(meetings)} meetings")

        # Phase 2: Delete existing indicators
        _update_progress("Deleting existing indicators", progress=15)
        deleted = _delete_existing_indicators()
        print(f"[HEATMAP-SERVICE] Deleted {deleted} existing indicators")

        # Phase 3: Generate filter list
        filter_types = list(FILTER_TYPES)
        if include_state_filters:
            active_states = _get_active_states(meetings)
            filter_types.extend([f"state:{s}" for s in active_states])

        print(f"[HEATMAP-SERVICE] Processing {len(filter_types)} filter types")

        # Phase 4: Generate clusters for each filter
        all_indicators = []
        meeting_cluster_keys = {}

        for idx, filter_type in enumerate(filter_types):
            progress = 20 + int((idx / len(filter_types)) * 60)
            _update_progress(f"Generating clusters for {filter_type}", progress=progress)

            indicators, cluster_keys = _generate_clusters_for_filter(meetings, filter_type)
            all_indicators.extend(indicators)

            # Only capture cluster keys from "all" filter
            if filter_type == "all":
                meeting_cluster_keys = cluster_keys

        print(f"[HEATMAP-SERVICE] Generated {len(all_indicators)} indicators")

        # Phase 5: Save indicators
        _update_progress("Saving indicators to Back4App", progress=80)
        saved = _save_indicators_batch(all_indicators)
        indicator_job_state["indicators_created"] = saved
        print(f"[HEATMAP-SERVICE] Saved {saved} indicators")

        # Phase 6: Update meetings with cluster keys
        _update_progress("Updating meetings with cluster keys", progress=90)
        updated = _update_meetings_cluster_keys(meeting_cluster_keys)
        indicator_job_state["meetings_updated"] = updated
        print(f"[HEATMAP-SERVICE] Updated {updated} meetings with cluster keys")

        # Done
        duration = time.time() - start_time
        _update_progress("Completed", progress=100)

        with _job_lock:
            indicator_job_state["is_running"] = False
            indicator_job_state["last_completed_at"] = datetime.utcnow().isoformat()
            indicator_job_state["last_duration_seconds"] = round(duration, 2)

        return {
            "success": True,
            "total_meetings": len(meetings),
            "indicators_created": saved,
            "meetings_updated": updated,
            "filter_types": len(filter_types),
            "duration_seconds": round(duration, 2),
            "errors": indicator_job_state["errors"]
        }

    except Exception as e:
        import traceback
        error_msg = f"Job failed: {str(e)}"
        print(f"[HEATMAP-SERVICE] {error_msg}")
        print(traceback.format_exc())

        with _job_lock:
            indicator_job_state["is_running"] = False
            indicator_job_state["errors"].append(error_msg)
            indicator_job_state["current_phase"] = "Failed"

        return {"success": False, "error": error_msg}


def run_job_in_background(include_state_filters=True):
    """Start the indicator generation job in a background thread."""
    with _job_lock:
        if indicator_job_state["is_running"]:
            return {"success": False, "error": "Job already running"}

    def worker():
        generate_heatmap_indicators(include_state_filters=include_state_filters)

    thread = threading.Thread(target=worker, daemon=True, name="heatmap-indicator-worker")
    thread.start()

    return {"success": True, "message": "Job started in background"}


def query_indicators(zoom_tier, filter_type="all", bounds=None):
    """
    Query pre-computed indicators for a specific zoom tier and filter.

    Args:
        zoom_tier: 1-5
        filter_type: "all", "AA", "NA", etc.
        bounds: Optional dict with north, south, east, west

    Returns:
        List of indicator objects
    """
    import requests
    import urllib.parse

    session = _back4app_config["session"] or requests
    base_url = "https://parseapi.back4app.com/classes/HeatmapIndicator"

    where = {
        "zoomTier": zoom_tier,
        "filterType": filter_type
    }

    if bounds:
        where["latitude"] = {"$gte": bounds["south"], "$lte": bounds["north"]}
        where["longitude"] = {"$gte": bounds["west"], "$lte": bounds["east"]}

    params = {
        "limit": 1000,
        "where": json.dumps(where),
        "keys": "gridKey,latitude,longitude,meetingCount,meetingTypes,state,parentGridKey,north,south,east,west"
    }

    query_string = urllib.parse.urlencode(params)
    url = f"{base_url}?{query_string}"

    try:
        response = session.get(url, headers=_get_headers(), timeout=15)
        if response.status_code == 200:
            data = response.json()
            return data.get("results", [])
    except Exception as e:
        print(f"[HEATMAP-SERVICE] Query error: {e}")

    return []


def query_child_clusters(parent_grid_key, filter_type="all"):
    """
    Query child clusters for a parent cluster.

    Args:
        parent_grid_key: The gridKey of the parent cluster
        filter_type: Filter type to match

    Returns:
        List of child indicator objects
    """
    import requests
    import urllib.parse

    session = _back4app_config["session"] or requests
    base_url = "https://parseapi.back4app.com/classes/HeatmapIndicator"

    where = {
        "parentGridKey": parent_grid_key,
        "filterType": filter_type
    }

    params = {
        "limit": 1000,
        "where": json.dumps(where),
        "keys": "gridKey,latitude,longitude,meetingCount,meetingTypes,state,zoomTier,parentGridKey,north,south,east,west"
    }

    query_string = urllib.parse.urlencode(params)
    url = f"{base_url}?{query_string}"

    try:
        response = session.get(url, headers=_get_headers(), timeout=15)
        if response.status_code == 200:
            data = response.json()
            return data.get("results", [])
    except Exception as e:
        print(f"[HEATMAP-SERVICE] Query children error: {e}")

    return []


def query_meetings_by_cluster(cluster_key):
    """
    Query meetings that belong to a tier 5 cluster.

    Args:
        cluster_key: The tier 5 gridKey

    Returns:
        List of meeting objects
    """
    import requests
    import urllib.parse

    session = _back4app_config["session"] or requests
    base_url = "https://parseapi.back4app.com/classes/Meetings"

    where = {
        "clusterKey": cluster_key
    }

    params = {
        "limit": 500,
        "where": json.dumps(where),
        "keys": "objectId,name,day,time,city,state,latitude,longitude,locationName,meetingType,isOnline,isHybrid,format,address"
    }

    query_string = urllib.parse.urlencode(params)
    url = f"{base_url}?{query_string}"

    try:
        response = session.get(url, headers=_get_headers(), timeout=15)
        if response.status_code == 200:
            data = response.json()
            return data.get("results", [])
    except Exception as e:
        print(f"[HEATMAP-SERVICE] Query meetings error: {e}")

    return []


def zoom_to_tier(zoom_level):
    """Convert Leaflet zoom level to our tier system."""
    if zoom_level <= 4:
        return 1
    elif zoom_level <= 6:
        return 2
    elif zoom_level <= 8:
        return 3
    elif zoom_level <= 10:
        return 4
    elif zoom_level <= 12:
        return 5
    else:
        return None  # Individual meetings, not clustered
