#!/usr/bin/env python3
"""
Import Online Meetings to Back4app

This script imports cleaned online meeting data into the Back4app database.
It uses the same data format and deduplication logic as the main scraper.

Usage:
    python import_online_meetings.py [--dry-run] [--file meetings.json]

Options:
    --dry-run   Show what would be imported without making changes
    --file      Specify a JSON file to import (default: latest cleaned file)
    --limit     Maximum meetings to import (default: all)
"""

import os
import sys
import json
import glob
import argparse
import requests
import time
from datetime import datetime
from typing import List, Dict, Optional

# Back4app configuration
BACK4APP_APP_ID = os.environ.get('BACK4APP_APP_ID', '')
BACK4APP_REST_KEY = os.environ.get('BACK4APP_REST_KEY', '')
BACK4APP_URL = "https://parseapi.back4app.com/classes/Meetings"

# Rate limiting
BATCH_SIZE = 50  # Parse batch limit
DELAY_BETWEEN_BATCHES = 1.0  # seconds


def get_headers() -> Dict[str, str]:
    """Get Back4app API headers"""
    return {
        "X-Parse-Application-Id": BACK4APP_APP_ID,
        "X-Parse-REST-API-Key": BACK4APP_REST_KEY,
        "Content-Type": "application/json"
    }


def check_duplicate(unique_key: str) -> Optional[str]:
    """Check if a meeting with this unique key already exists.
    Returns the objectId if found, None otherwise."""
    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        return None

    try:
        import urllib.parse
        where = json.dumps({"uniqueKey": unique_key})
        url = f"{BACK4APP_URL}?where={urllib.parse.quote(where)}&limit=1&keys=objectId"
        response = requests.get(url, headers=get_headers(), timeout=10)

        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            if results:
                return results[0].get("objectId")
        return None
    except Exception as e:
        print(f"Error checking duplicate: {e}")
        return None


def prepare_for_parse(meeting: Dict) -> Dict:
    """Prepare meeting data for Parse/Back4app format"""

    # Generate objectId if not present
    if not meeting.get('objectId'):
        meeting['objectId'] = generate_object_id()

    # Convert types list to proper format
    types = meeting.get('types', [])
    if isinstance(types, str):
        types = [t.strip() for t in types.split(',') if t.strip()]
    meeting['types'] = types

    # Set default values
    meeting.setdefault('isActive', True)
    meeting.setdefault('favoriteCount', 0)
    meeting.setdefault('checkInCount', 0)
    meeting.setdefault('reportCount', 0)
    meeting.setdefault('sourceType', 'web_scraper')

    # Add scrapedAt timestamp
    meeting['scrapedAt'] = {
        "__type": "Date",
        "iso": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    }

    # Ensure proper number types for coordinates
    if meeting.get('latitude') is not None:
        try:
            meeting['latitude'] = float(meeting['latitude'])
        except (ValueError, TypeError):
            meeting['latitude'] = None

    if meeting.get('longitude') is not None:
        try:
            meeting['longitude'] = float(meeting['longitude'])
        except (ValueError, TypeError):
            meeting['longitude'] = None

    # Ensure day is an integer
    if meeting.get('day') is not None:
        try:
            meeting['day'] = int(meeting['day'])
        except (ValueError, TypeError):
            meeting['day'] = 0

    # Remove any None values (Parse doesn't like null for certain fields)
    cleaned = {k: v for k, v in meeting.items() if v is not None and v != ''}

    # Remove fields that shouldn't be sent to Parse
    for field in ['dayName']:  # Computed fields
        cleaned.pop(field, None)

    return cleaned


def generate_object_id() -> str:
    """Generate a unique object ID"""
    import hashlib
    import random
    seed = f"{time.time()}{random.random()}"
    return hashlib.sha1(seed.encode()).hexdigest()[:10]


def create_meeting(meeting: Dict) -> Optional[str]:
    """Create a new meeting in Back4app. Returns objectId on success."""
    try:
        prepared = prepare_for_parse(meeting)
        response = requests.post(
            BACK4APP_URL,
            headers=get_headers(),
            json=prepared,
            timeout=30
        )

        if response.status_code == 201:
            result = response.json()
            return result.get('objectId')
        else:
            print(f"Error creating meeting: {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print(f"Exception creating meeting: {e}")
        return None


def update_meeting(object_id: str, meeting: Dict) -> bool:
    """Update an existing meeting in Back4app"""
    try:
        prepared = prepare_for_parse(meeting)
        # Remove objectId from update payload
        prepared.pop('objectId', None)

        url = f"{BACK4APP_URL}/{object_id}"
        response = requests.put(
            url,
            headers=get_headers(),
            json=prepared,
            timeout=30
        )

        return response.status_code == 200
    except Exception as e:
        print(f"Exception updating meeting: {e}")
        return False


def batch_create_meetings(meetings: List[Dict]) -> Dict:
    """Create multiple meetings using Parse batch API"""
    if not meetings:
        return {"created": 0, "errors": 0}

    # Prepare batch requests
    requests_list = []
    for meeting in meetings:
        prepared = prepare_for_parse(meeting)
        requests_list.append({
            "method": "POST",
            "path": "/classes/Meetings",
            "body": prepared
        })

    try:
        batch_url = "https://parseapi.back4app.com/batch"
        response = requests.post(
            batch_url,
            headers=get_headers(),
            json={"requests": requests_list},
            timeout=60
        )

        if response.status_code == 200:
            results = response.json()
            created = sum(1 for r in results if 'success' in r)
            errors = sum(1 for r in results if 'error' in r)
            return {"created": created, "errors": errors}
        else:
            print(f"Batch error: {response.status_code} - {response.text[:200]}")
            return {"created": 0, "errors": len(meetings)}
    except Exception as e:
        print(f"Batch exception: {e}")
        return {"created": 0, "errors": len(meetings)}


def find_latest_data_file() -> Optional[str]:
    """Find the most recent cleaned data file"""
    pattern = "online_meetings_cleaned_*.json"
    files = glob.glob(pattern)
    if not files:
        return None
    return max(files, key=os.path.getctime)


def import_meetings(
    meetings: List[Dict],
    dry_run: bool = False,
    skip_duplicates: bool = True
) -> Dict:
    """Import meetings to Back4app

    Returns a dict with import statistics.
    """
    stats = {
        "total": len(meetings),
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0
    }

    if dry_run:
        print(f"\n[DRY RUN] Would import {len(meetings)} meetings")
        return stats

    if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
        print("Error: BACK4APP_APP_ID and BACK4APP_REST_KEY environment variables required")
        return stats

    # Process in batches
    to_create = []

    print(f"\nProcessing {len(meetings)} meetings...")

    for i, meeting in enumerate(meetings):
        unique_key = meeting.get('uniqueKey', '')

        if skip_duplicates and unique_key:
            # Check for existing meeting
            existing_id = check_duplicate(unique_key)
            if existing_id:
                stats['skipped'] += 1
                if (i + 1) % 100 == 0:
                    print(f"  Processed {i + 1}/{len(meetings)} - Skipped (duplicate)")
                continue

        to_create.append(meeting)

        # Create batch when full
        if len(to_create) >= BATCH_SIZE:
            result = batch_create_meetings(to_create)
            stats['created'] += result['created']
            stats['errors'] += result['errors']
            print(f"  Processed {i + 1}/{len(meetings)} - Created batch of {result['created']}")
            to_create = []
            time.sleep(DELAY_BETWEEN_BATCHES)

    # Process remaining meetings
    if to_create:
        result = batch_create_meetings(to_create)
        stats['created'] += result['created']
        stats['errors'] += result['errors']
        print(f"  Created final batch of {result['created']}")

    return stats


def main():
    parser = argparse.ArgumentParser(description='Import online meetings to Back4app')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be imported')
    parser.add_argument('--file', type=str, help='JSON file to import')
    parser.add_argument('--limit', type=int, help='Max meetings to import')
    parser.add_argument('--no-skip-duplicates', action='store_true', help='Import even if duplicate exists')
    args = parser.parse_args()

    print("=" * 60)
    print("Online Meetings Import Tool")
    print("=" * 60)

    # Find data file
    data_file = args.file
    if not data_file:
        data_file = find_latest_data_file()
        if not data_file:
            print("Error: No data file found. Run online_meetings_research.py first.")
            sys.exit(1)

    if not os.path.exists(data_file):
        print(f"Error: File not found: {data_file}")
        sys.exit(1)

    print(f"\nData file: {data_file}")

    # Load meetings
    with open(data_file, 'r', encoding='utf-8') as f:
        meetings = json.load(f)

    print(f"Loaded {len(meetings)} meetings")

    # Apply limit if specified
    if args.limit:
        meetings = meetings[:args.limit]
        print(f"Limited to {len(meetings)} meetings")

    # Check credentials
    if not args.dry_run:
        if not BACK4APP_APP_ID or not BACK4APP_REST_KEY:
            print("\nWarning: Back4app credentials not set!")
            print("Set BACK4APP_APP_ID and BACK4APP_REST_KEY environment variables")
            print("Running in dry-run mode instead...")
            args.dry_run = True

    # Import
    stats = import_meetings(
        meetings,
        dry_run=args.dry_run,
        skip_duplicates=not args.no_skip_duplicates
    )

    # Report
    print("\n" + "=" * 60)
    print("Import Summary")
    print("=" * 60)
    print(f"Total meetings:  {stats['total']}")
    print(f"Created:         {stats['created']}")
    print(f"Updated:         {stats['updated']}")
    print(f"Skipped (dup):   {stats['skipped']}")
    print(f"Errors:          {stats['errors']}")
    print("=" * 60)

    return 0 if stats['errors'] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
