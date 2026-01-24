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
    "phase_detail": "",  # Detailed progress info (e.g., "5/42 filters")
    "total_meetings": 0,
    "new_meetings": 0,  # Meetings without clusterKey
    "indicators_created": 0,
    "meetings_updated": 0,
    "errors": [],
    "last_completed_at": None,
    "last_duration_seconds": None,
    "mode": "full",  # "full" or "incremental"
    "logs": [],  # Recent log entries for frontend display
}

# Job history (in-memory, limited to last 20 runs)
_job_history = []
MAX_JOB_HISTORY = 20
MAX_LOG_ENTRIES = 100  # Keep last 100 log entries

# Lock for thread safety
_job_lock = threading.Lock()

# Scheduler state
_scheduler_thread = None
_scheduler_running = False
DAILY_RUN_HOUR = 3  # Run at 3 AM UTC

# Back4App configuration (set by init function)
_back4app_config = {
    "app_id": None,
    "rest_key": None,
    "session": None,
}


def _log(message, level="info"):
    """Add a log entry to the job state and print to console.

    Args:
        message: Log message
        level: Log level (info, success, warning, error)
    """
    timestamp = datetime.utcnow().isoformat() + "Z"
    entry = {
        "timestamp": timestamp,
        "message": message,
        "level": level
    }

    with _job_lock:
        indicator_job_state["logs"].append(entry)
        # Trim to max entries
        if len(indicator_job_state["logs"]) > MAX_LOG_ENTRIES:
            indicator_job_state["logs"] = indicator_job_state["logs"][-MAX_LOG_ENTRIES:]

    # Also print to console with timestamp
    level_prefix = {"info": "INFO", "success": "✓", "warning": "WARN", "error": "ERROR"}.get(level, "INFO")
    print(f"[HEATMAP-SERVICE] [{level_prefix}] {message}")


def init_heatmap_service(app_id, rest_key, session=None):
    """Initialize the heatmap indicator service with Back4App credentials."""
    _back4app_config["app_id"] = app_id
    _back4app_config["rest_key"] = rest_key
    _back4app_config["session"] = session
    _log(f"Initialized with app_id={app_id[:8]}...", "info")


def get_job_status():
    """Get current job status including history from Back4app."""
    with _job_lock:
        status = dict(indicator_job_state)
        status["scheduler_enabled"] = _scheduler_running
        status["next_scheduled_run"] = _get_next_scheduled_run()

    # Fetch history from Back4app (source of truth)
    status["history"] = get_job_history()
    return status


def get_job_history():
    """Get job run history from Back4app (source of truth).

    Falls back to in-memory history if Back4app is unavailable.
    """
    # Try fetching from Back4app first
    if _back4app_config["app_id"] and _back4app_config["rest_key"]:
        history = _fetch_run_history_from_back4app(limit=MAX_JOB_HISTORY)
        if history:
            return history

    # Fallback to in-memory history
    with _job_lock:
        return list(_job_history)


def _save_run_history_to_back4app(entry):
    """Save a run history entry to Back4app.

    Args:
        entry: dict with run statistics

    Returns:
        objectId of the created record, or None on failure
    """
    import requests

    session = _back4app_config["session"] or requests
    url = "https://parseapi.back4app.com/classes/MapIndicatorRunHistory"

    # Convert to Back4app format
    record = {
        "completedAt": {"__type": "Date", "iso": entry["completed_at"] + ("Z" if not entry["completed_at"].endswith("Z") else "")},
        "success": entry.get("success", False),
        "mode": entry.get("mode", "full"),
        "totalMeetings": entry.get("total_meetings", 0),
        "newMeetings": entry.get("new_meetings", 0),
        "indicatorsCreated": entry.get("indicators_created", 0),
        "meetingsUpdated": entry.get("meetings_updated", 0),
        "durationSeconds": entry.get("duration_seconds", 0),
        "filterTypes": entry.get("filter_types", 0),
        "error": entry.get("error"),
    }

    try:
        response = session.post(url, headers=_get_headers(), json=record, timeout=15)
        if response.status_code == 201:
            data = response.json()
            _log(f"Saved run history to Back4app: {data.get('objectId')}", "info")
            return data.get("objectId")
        else:
            _log(f"Failed to save run history: HTTP {response.status_code}", "warning")
    except Exception as e:
        _log(f"Error saving run history to Back4app: {e}", "warning")

    return None


def _fetch_run_history_from_back4app(limit=20):
    """Fetch run history from Back4app.

    Args:
        limit: Maximum number of entries to fetch

    Returns:
        List of run history entries
    """
    import requests
    import urllib.parse

    session = _back4app_config["session"] or requests
    base_url = "https://parseapi.back4app.com/classes/MapIndicatorRunHistory"

    params = {
        "limit": limit,
        "order": "-completedAt",  # Most recent first
    }

    query_string = urllib.parse.urlencode(params)
    url = f"{base_url}?{query_string}"

    try:
        response = session.get(url, headers=_get_headers(), timeout=15)
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])

            # Convert Back4app format to our format
            history = []
            for r in results:
                completed_at = r.get("completedAt", {})
                if isinstance(completed_at, dict):
                    completed_at = completed_at.get("iso", "")
                # Remove the Z suffix for consistency with existing format
                if completed_at.endswith("Z"):
                    completed_at = completed_at[:-1]

                history.append({
                    "completed_at": completed_at,
                    "success": r.get("success", False),
                    "mode": r.get("mode", "full"),
                    "total_meetings": r.get("totalMeetings", 0),
                    "new_meetings": r.get("newMeetings", 0),
                    "indicators_created": r.get("indicatorsCreated", 0),
                    "meetings_updated": r.get("meetingsUpdated", 0),
                    "duration_seconds": r.get("durationSeconds", 0),
                    "filter_types": r.get("filterTypes", 0),
                    "error": r.get("error"),
                })

            return history
    except Exception as e:
        _log(f"Error fetching run history from Back4app: {e}", "warning")

    return []


def _add_to_history(result):
    """Add a job result to history (both in-memory and Back4app)."""
    global _job_history
    entry = {
        "completed_at": datetime.utcnow().isoformat(),
        "success": result.get("success", False),
        "mode": result.get("mode", "full"),
        "total_meetings": result.get("total_meetings", 0),
        "new_meetings": result.get("new_meetings", 0),
        "indicators_created": result.get("indicators_created", 0),
        "meetings_updated": result.get("meetings_updated", 0),
        "duration_seconds": result.get("duration_seconds", 0),
        "filter_types": result.get("filter_types", 0),
        "error": result.get("error"),
    }

    # Save to Back4app (source of truth)
    _save_run_history_to_back4app(entry)

    # Also keep in-memory for quick access
    with _job_lock:
        _job_history.insert(0, entry)
        if len(_job_history) > MAX_JOB_HISTORY:
            _job_history = _job_history[:MAX_JOB_HISTORY]


def _get_next_scheduled_run():
    """Calculate next scheduled run time."""
    if not _scheduler_running:
        return None
    now = datetime.utcnow()
    next_run = now.replace(hour=DAILY_RUN_HOUR, minute=0, second=0, microsecond=0)
    if now.hour >= DAILY_RUN_HOUR:
        next_run = next_run.replace(day=now.day + 1)
    return next_run.isoformat() + "Z"


def _get_headers():
    """Get Back4App API headers."""
    return {
        "X-Parse-Application-Id": _back4app_config["app_id"],
        "X-Parse-REST-API-Key": _back4app_config["rest_key"],
        "Content-Type": "application/json"
    }


def _update_progress(phase, progress=None, detail=None, log_level="info", **kwargs):
    """Update job progress state and log the update.

    Args:
        phase: Current phase description
        progress: Progress percentage (0-100)
        detail: Detailed progress info (e.g., "5/42 filters")
        log_level: Log level for this update
        **kwargs: Additional state updates
    """
    with _job_lock:
        indicator_job_state["current_phase"] = phase
        if progress is not None:
            indicator_job_state["progress"] = progress
        if detail is not None:
            indicator_job_state["phase_detail"] = detail
        for key, value in kwargs.items():
            if key in indicator_job_state:
                indicator_job_state[key] = value

    # Build log message
    log_msg = phase
    if detail:
        log_msg = f"{phase} ({detail})"
    if progress is not None:
        log_msg = f"{log_msg} - {progress}%"

    _log(log_msg, log_level)


def _fetch_all_meetings(incremental=False):
    """Fetch meetings with lat/lng from Back4App.

    Args:
        incremental: If True, only fetch meetings without clusterKey
    """
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

    if incremental:
        # Only fetch meetings that haven't been assigned to a cluster yet
        where["clusterKey"] = {"$exists": False}

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
                _log(f"Error fetching meetings: HTTP {response.status_code}", "error")
                break

            data = response.json()
            results = data.get("results", [])

            if not results:
                break

            meetings.extend(results)
            skip += limit

            _update_progress(f"Fetching meetings", progress=min(10, int(len(meetings) / 1000)),
                           detail=f"{len(meetings):,} loaded")

            # Safety limit
            if skip > 500000:
                _log("Warning: Hit safety limit of 500k meetings", "warning")
                break

        except Exception as e:
            _log(f"Error fetching meetings: {e}", "error")
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
                # Log batch progress
                if saved_count % 500 == 0:
                    _log(f"Saved {saved_count:,} indicators so far...", "info")
            else:
                _log(f"Batch save error: HTTP {response.status_code}", "error")
                indicator_job_state["errors"].append(f"Batch save error: {response.status_code}")
        except Exception as e:
            _log(f"Batch save exception: {e}", "error")
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
                # Log batch progress
                if updated_count % 500 == 0:
                    _log(f"Updated {updated_count:,} meetings so far...", "info")
            else:
                _log(f"Meeting update error: HTTP {response.status_code}", "error")
        except Exception as e:
            _log(f"Meeting update exception: {e}", "error")

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
                # Log progress every 500 deletes
                if deleted_count % 500 == 0:
                    _log(f"Deleted {deleted_count:,} indicators so far...", "info")

        except Exception as e:
            _log(f"Delete error: {e}", "error")
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


def generate_heatmap_indicators(include_state_filters=True, force=False, incremental=False):
    """
    Main job function to generate all heatmap indicators.

    Args:
        include_state_filters: If True, generate state:XX filters for active states
        force: If True, run even if already running
        incremental: If True, only process meetings without clusterKey (faster for daily updates)

    Returns:
        dict with job results
    """
    global indicator_job_state

    mode = "incremental" if incremental else "full"

    with _job_lock:
        if indicator_job_state["is_running"] and not force:
            return {"success": False, "error": "Job already running"}

        indicator_job_state["is_running"] = True
        indicator_job_state["started_at"] = datetime.utcnow().isoformat()
        indicator_job_state["progress"] = 0
        indicator_job_state["current_phase"] = "Starting"
        indicator_job_state["phase_detail"] = ""
        indicator_job_state["errors"] = []
        indicator_job_state["indicators_created"] = 0
        indicator_job_state["meetings_updated"] = 0
        indicator_job_state["new_meetings"] = 0
        indicator_job_state["mode"] = mode
        indicator_job_state["logs"] = []  # Clear logs for new run

    start_time = time.time()
    _log(f"=== Starting {mode.upper()} map indicator job ===", "info")

    try:
        if incremental:
            # Incremental mode: only process new meetings
            phase_start = time.time()
            _update_progress("Fetching new meetings", progress=5, detail="incremental mode")
            new_meetings = _fetch_all_meetings(incremental=True)
            indicator_job_state["new_meetings"] = len(new_meetings)
            fetch_time = round(time.time() - phase_start, 2)
            _log(f"Fetched meetings in {fetch_time}s", "info")

            if not new_meetings:
                _update_progress("No new meetings to process", progress=100, log_level="success")
                result = {
                    "success": True,
                    "mode": mode,
                    "total_meetings": 0,
                    "new_meetings": 0,
                    "indicators_created": 0,
                    "meetings_updated": 0,
                    "duration_seconds": round(time.time() - start_time, 2),
                    "errors": []
                }
                _add_to_history(result)
                with _job_lock:
                    indicator_job_state["is_running"] = False
                    indicator_job_state["last_completed_at"] = datetime.utcnow().isoformat()
                    indicator_job_state["last_duration_seconds"] = result["duration_seconds"]
                _log(f"=== Completed in {result['duration_seconds']}s (no new meetings) ===", "success")
                return result

            _log(f"Found {len(new_meetings)} new meetings to process", "info")

            # For incremental, we only update cluster keys, no indicator regeneration
            phase_start = time.time()
            _update_progress("Assigning cluster keys", progress=50, detail=f"{len(new_meetings)} meetings")

            # Generate cluster keys for new meetings only
            meeting_cluster_keys = {}
            for i, meeting in enumerate(new_meetings):
                lat = meeting.get("latitude")
                lng = meeting.get("longitude")
                object_id = meeting.get("objectId")
                if lat is not None and lng is not None and object_id:
                    grid_key = _compute_grid_key(5, lat, lng)
                    meeting_cluster_keys[object_id] = grid_key

                # Log progress every 100 meetings
                if (i + 1) % 100 == 0:
                    _update_progress("Assigning cluster keys", progress=50 + int(25 * i / len(new_meetings)),
                                    detail=f"{i + 1}/{len(new_meetings)} meetings")

            assign_time = round(time.time() - phase_start, 2)
            _log(f"Assigned cluster keys in {assign_time}s", "info")

            phase_start = time.time()
            _update_progress("Updating meetings in Back4App", progress=75, detail=f"{len(meeting_cluster_keys)} meetings")
            updated = _update_meetings_cluster_keys(meeting_cluster_keys)
            indicator_job_state["meetings_updated"] = updated
            update_time = round(time.time() - phase_start, 2)
            _log(f"Updated {updated} meetings with cluster keys in {update_time}s", "success")

            # Done with incremental
            duration = time.time() - start_time
            _update_progress("Completed (incremental)", progress=100, log_level="success")
            _log(f"=== INCREMENTAL JOB COMPLETED in {round(duration, 2)}s ===", "success")

            result = {
                "success": True,
                "mode": mode,
                "total_meetings": len(new_meetings),
                "new_meetings": len(new_meetings),
                "indicators_created": 0,
                "meetings_updated": updated,
                "duration_seconds": round(duration, 2),
                "errors": indicator_job_state["errors"]
            }

        else:
            # Full mode: regenerate all indicators
            phase_start = time.time()
            _update_progress("Fetching all meetings from Back4App", progress=5, detail="full rebuild")
            meetings = _fetch_all_meetings(incremental=False)
            indicator_job_state["total_meetings"] = len(meetings)
            fetch_time = round(time.time() - phase_start, 2)
            _log(f"Fetched {len(meetings)} meetings in {fetch_time}s", "info")

            if not meetings:
                _update_progress("No meetings found", progress=100, log_level="error")
                result = {"success": False, "error": "No meetings found", "mode": mode}
                _add_to_history(result)
                return result

            # Phase 2: Delete existing indicators
            phase_start = time.time()
            _update_progress("Deleting existing indicators", progress=15, detail="clearing old data")
            deleted = _delete_existing_indicators()
            delete_time = round(time.time() - phase_start, 2)
            _log(f"Deleted {deleted} existing indicators in {delete_time}s", "info")

            # Phase 3: Generate filter list
            filter_types = list(FILTER_TYPES)
            if include_state_filters:
                active_states = _get_active_states(meetings)
                filter_types.extend([f"state:{s}" for s in active_states])
                _log(f"Found {len(active_states)} active states for filtering", "info")

            _log(f"Processing {len(filter_types)} filter types: {', '.join(filter_types[:5])}{'...' if len(filter_types) > 5 else ''}", "info")

            # Phase 4: Generate clusters for each filter
            phase_start = time.time()
            all_indicators = []
            meeting_cluster_keys = {}

            for idx, filter_type in enumerate(filter_types):
                progress = 20 + int((idx / len(filter_types)) * 60)
                _update_progress(f"Generating clusters: {filter_type}", progress=progress,
                               detail=f"{idx + 1}/{len(filter_types)} filters")

                indicators, cluster_keys = _generate_clusters_for_filter(meetings, filter_type)
                all_indicators.extend(indicators)

                # Only capture cluster keys from "all" filter
                if filter_type == "all":
                    meeting_cluster_keys = cluster_keys

            cluster_time = round(time.time() - phase_start, 2)
            _log(f"Generated {len(all_indicators)} indicators across {len(filter_types)} filters in {cluster_time}s", "success")

            # Phase 5: Save indicators
            phase_start = time.time()
            _update_progress("Saving indicators to Back4App", progress=80, detail=f"{len(all_indicators)} indicators")
            saved = _save_indicators_batch(all_indicators)
            indicator_job_state["indicators_created"] = saved
            save_time = round(time.time() - phase_start, 2)
            _log(f"Saved {saved} indicators in {save_time}s", "success")

            # Phase 6: Update meetings with cluster keys
            phase_start = time.time()
            _update_progress("Updating meetings with cluster keys", progress=90, detail=f"{len(meeting_cluster_keys)} meetings")
            updated = _update_meetings_cluster_keys(meeting_cluster_keys)
            indicator_job_state["meetings_updated"] = updated
            update_time = round(time.time() - phase_start, 2)
            _log(f"Updated {updated} meetings with cluster keys in {update_time}s", "success")

            # Done
            duration = time.time() - start_time
            _update_progress("Completed", progress=100, log_level="success")
            _log(f"=== FULL JOB COMPLETED in {round(duration, 2)}s ===", "success")

            result = {
                "success": True,
                "mode": mode,
                "total_meetings": len(meetings),
                "new_meetings": 0,
                "indicators_created": saved,
                "meetings_updated": updated,
                "filter_types": len(filter_types),
                "duration_seconds": round(duration, 2),
                "errors": indicator_job_state["errors"]
            }

        # Add to history
        _add_to_history(result)

        with _job_lock:
            indicator_job_state["is_running"] = False
            indicator_job_state["last_completed_at"] = datetime.utcnow().isoformat()
            indicator_job_state["last_duration_seconds"] = result["duration_seconds"]

        return result

    except Exception as e:
        import traceback
        error_msg = f"Job failed: {str(e)}"
        _log(error_msg, "error")
        _log(traceback.format_exc(), "error")

        with _job_lock:
            indicator_job_state["is_running"] = False
            indicator_job_state["errors"].append(error_msg)
            indicator_job_state["current_phase"] = "Failed"

        return {"success": False, "error": error_msg}


def run_job_in_background(include_state_filters=True, incremental=False):
    """Start the indicator generation job in a background thread.

    Args:
        include_state_filters: If True, generate state:XX filters
        incremental: If True, only process meetings without clusterKey
    """
    with _job_lock:
        if indicator_job_state["is_running"]:
            return {"success": False, "error": "Job already running"}

    def worker():
        generate_heatmap_indicators(
            include_state_filters=include_state_filters,
            incremental=incremental
        )

    thread = threading.Thread(target=worker, daemon=True, name="heatmap-indicator-worker")
    thread.start()

    mode = "incremental" if incremental else "full"
    return {"success": True, "message": f"Job started in background ({mode} mode)"}


def start_scheduler():
    """Start the daily scheduler for automatic indicator generation."""
    global _scheduler_thread, _scheduler_running

    if _scheduler_running:
        return {"success": False, "error": "Scheduler already running"}

    _scheduler_running = True

    def scheduler_loop():
        import time as time_module
        _log(f"Scheduler started. Will run daily at {DAILY_RUN_HOUR}:00 UTC", "info")

        while _scheduler_running:
            now = datetime.utcnow()

            # Check if it's time to run (within the first minute of the scheduled hour)
            if now.hour == DAILY_RUN_HOUR and now.minute == 0:
                _log("Scheduled run starting (incremental mode)", "info")
                run_job_in_background(include_state_filters=True, incremental=True)
                # Sleep for 2 minutes to avoid running again in the same minute
                time_module.sleep(120)
            else:
                # Check every 30 seconds
                time_module.sleep(30)

    _scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True, name="heatmap-scheduler")
    _scheduler_thread.start()

    _log(f"Daily scheduler enabled - will run at {DAILY_RUN_HOUR}:00 UTC", "success")
    return {"success": True, "message": f"Scheduler started. Daily run at {DAILY_RUN_HOUR}:00 UTC"}


def stop_scheduler():
    """Stop the daily scheduler."""
    global _scheduler_running

    if not _scheduler_running:
        return {"success": False, "error": "Scheduler not running"}

    _scheduler_running = False
    _log("Daily scheduler stopped", "info")

    return {"success": True, "message": "Scheduler stopped"}


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
