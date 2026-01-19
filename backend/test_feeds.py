#!/usr/bin/env python3
"""
Test script to verify AA Meeting Guide API feeds are working.
Run this to prove the feeds are reliable before integrating into the main scraper.
"""

import requests
import json
from datetime import datetime

# Known working feeds (verified January 2026)
FEEDS = {
    "Palo Alto (Bay Area)": "https://sheets.code4recovery.org/storage/12Ga8uwMG4WJ8pZ_SEU7vNETp_aQZ-2yNVsYDFqIwHyE.json",
    "San Diego": "https://aasandiego.org/wp-admin/admin-ajax.php?action=meetings",
    "Phoenix": "https://aaphoenix.org/wp-admin/admin-ajax.php?action=meetings",
}

def test_feed(name, url):
    """Test a single feed and return results."""
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"URL: {url}")
    print('='*60)

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; MeetingScraper/1.0; +https://github.com/code4recovery)'
        }
        response = requests.get(url, timeout=30, headers=headers)
        response.raise_for_status()

        data = response.json()

        if not isinstance(data, list):
            print(f"ERROR: Expected list, got {type(data)}")
            return False, 0

        print(f"SUCCESS: Found {len(data)} meetings")

        if len(data) > 0:
            meeting = data[0]
            print(f"\nSample meeting:")
            print(f"  Name: {meeting.get('name', 'N/A')}")
            print(f"  Day: {meeting.get('day', 'N/A')}")
            print(f"  Time: {meeting.get('time', 'N/A')}")
            print(f"  Location: {meeting.get('location', meeting.get('location_name', 'N/A'))}")
            print(f"  Address: {meeting.get('formatted_address', meeting.get('address', 'N/A'))}")
            print(f"  Region: {meeting.get('region', meeting.get('regions', 'N/A'))}")

            # Check for required fields
            required = ['name', 'day', 'time']
            missing = [f for f in required if f not in meeting]
            if missing:
                print(f"  WARNING: Missing fields: {missing}")

        return True, len(data)

    except requests.exceptions.Timeout:
        print("ERROR: Request timed out")
        return False, 0
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Request failed - {e}")
        return False, 0
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON - {e}")
        return False, 0


def main():
    print("="*60)
    print("AA Meeting Guide Feed Tester")
    print(f"Time: {datetime.now().isoformat()}")
    print("="*60)

    results = {}
    total_meetings = 0

    for name, url in FEEDS.items():
        success, count = test_feed(name, url)
        results[name] = {"success": success, "count": count}
        if success:
            total_meetings += count

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    for name, result in results.items():
        status = "OK" if result["success"] else "FAILED"
        print(f"  {name}: {status} ({result['count']} meetings)")

    print(f"\nTotal meetings available: {total_meetings}")
    print(f"Feeds working: {sum(1 for r in results.values() if r['success'])}/{len(results)}")

    return all(r["success"] for r in results.values())


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
