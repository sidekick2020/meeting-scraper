#!/usr/bin/env python3
"""
Online Meeting Data Research and Cleaning Script

This script fetches and cleans online AA and NA meeting data from various sources
and prepares it for import into Back4app.

Sources researched:
1. Online Intergroup of AA (OIAA) - https://aa-intergroup.org/meetings/
   - Feed: https://data.aa-intergroup.org/6436f5a3f03fdecef8459055.json
   - Contains ~8,600+ online AA meetings worldwide

2. Virtual NA - https://virtual-na.org
   - BMLT Server: https://bmlt.virtual-na.org/main_server/
   - Feed: https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults
   - Contains worldwide online NA meetings

3. Additional sources discovered:
   - aaHomeGroup (24/7 online) - https://aahomegroup.org
   - Online Group AA - https://www.onlinegroupaa.org
   - AA Global Australia - https://meetings.aa.org.au/international-online-meetings/
   - International Secular AA - https://www.aasecular.org/online-meetings
"""

import requests
import json
import csv
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

# Online Meeting Source Definitions
ONLINE_SOURCES = {
    # AA Sources
    "Online Intergroup of AA (OIAA)": {
        "url": "https://data.aa-intergroup.org/6436f5a3f03fdecef8459055.json",
        "type": "tsml",
        "fellowship": "AA",
        "description": "Primary source for online AA meetings worldwide - over 8,600 meetings"
    },

    # NA Sources
    "Virtual NA (Online)": {
        "url": "https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults",
        "type": "bmlt",
        "fellowship": "NA",
        "description": "Primary source for online NA meetings worldwide"
    },
}

# Standard day mapping
DAY_MAP = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday"
}

def fetch_tsml_feed(url: str, source_name: str) -> List[Dict]:
    """Fetch and parse TSML format feed (used by AA)"""
    print(f"Fetching TSML feed: {source_name}")
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        meetings = response.json()
        print(f"  Retrieved {len(meetings)} meetings")
        return meetings
    except Exception as e:
        print(f"  Error fetching {source_name}: {e}")
        return []


def fetch_bmlt_feed(url: str, source_name: str) -> List[Dict]:
    """Fetch and parse BMLT format feed (used by NA)"""
    print(f"Fetching BMLT feed: {source_name}")
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        meetings = response.json()
        print(f"  Retrieved {len(meetings)} meetings")
        return meetings
    except Exception as e:
        print(f"  Error fetching {source_name}: {e}")
        return []


def transform_bmlt_to_standard(bmlt_meeting: Dict) -> Dict:
    """Transform BMLT meeting format to standard format"""
    # BMLT weekday is 1-7 (Sunday=1), standard uses 0-6 (Sunday=0)
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

    # Get latitude/longitude
    lat = bmlt_meeting.get('latitude', '')
    lng = bmlt_meeting.get('longitude', '')

    try:
        latitude = float(lat) if lat else None
    except (ValueError, TypeError):
        latitude = None

    try:
        longitude = float(lng) if lng else None
    except (ValueError, TypeError):
        longitude = None

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
        'country': 'US',
        'latitude': latitude,
        'longitude': longitude,
        'timezone': bmlt_meeting.get('time_zone', ''),
        'notes': bmlt_meeting.get('comments', ''),
        'types': extract_bmlt_types(bmlt_meeting),
        'conference_url': bmlt_meeting.get('virtual_meeting_link', ''),
        'conference_phone': bmlt_meeting.get('phone_meeting_number', ''),
        'attendance_option': 'online' if is_online else ('hybrid' if is_hybrid else 'in_person'),
        'meeting_type': 'NA',
    }


def extract_bmlt_types(bmlt_meeting: Dict) -> List[str]:
    """Extract meeting type codes from BMLT format list"""
    types = []

    # Check format codes from BMLT
    format_list = bmlt_meeting.get('formats', '')
    if format_list:
        for code in format_list.split(','):
            code = code.strip()
            if code:
                types.append(code)

    return types


def clean_meeting_data(meeting: Dict, source_name: str, fellowship: str) -> Dict:
    """
    Clean and normalize meeting data to Back4app schema format.

    Returns a dictionary ready for Back4app import.
    """
    # Get core fields
    name = meeting.get('name', '') or meeting.get('meeting_name', 'Unknown Meeting')
    name = clean_text(name)

    # Day (0-6, Sunday=0)
    day = meeting.get('day', 0)
    if isinstance(day, str):
        try:
            day = int(day)
        except ValueError:
            day = 0

    # Time in HH:MM format
    time = meeting.get('time', '')
    time = normalize_time(time)

    end_time = meeting.get('end_time', '') or meeting.get('endTime', '')
    end_time = normalize_time(end_time)

    # Location info
    location_name = meeting.get('location_name', '') or meeting.get('location', '') or meeting.get('locationName', '')
    location_name = clean_text(location_name)

    address = meeting.get('address', '')
    city = meeting.get('city', '')
    state = meeting.get('state', '') or 'ONLINE'
    postal_code = meeting.get('postal_code', '') or meeting.get('postalCode', '')
    country = meeting.get('country', 'US')
    formatted_address = meeting.get('formatted_address', '') or meeting.get('formattedAddress', '')

    # Coordinates
    latitude = meeting.get('latitude')
    longitude = meeting.get('longitude')

    if latitude is not None:
        try:
            latitude = float(latitude)
        except (ValueError, TypeError):
            latitude = None

    if longitude is not None:
        try:
            longitude = float(longitude)
        except (ValueError, TypeError):
            longitude = None

    # Timezone
    timezone = meeting.get('timezone', '')

    # Online meeting details
    attendance = meeting.get('attendance_option', '')
    types = meeting.get('types', [])
    if isinstance(types, str):
        types = [t.strip() for t in types.split(',') if t.strip()]

    # Determine online/hybrid status
    is_online = attendance == 'online' or 'ONL' in types or 'VM' in types
    is_hybrid = attendance == 'hybrid' or 'HY' in types or 'TC' in types

    # For online-only source feeds, assume online
    if source_name in ['Online Intergroup of AA (OIAA)', 'Virtual NA (Online)']:
        if not is_hybrid:
            is_online = True

    conference_url = meeting.get('conference_url', '') or meeting.get('onlineUrl', '')
    conference_url_notes = meeting.get('conference_url_notes', '') or meeting.get('onlineUrlNotes', '')
    conference_phone = meeting.get('conference_phone', '') or meeting.get('conferencePhone', '')
    conference_phone_notes = meeting.get('conference_phone_notes', '') or meeting.get('conferencePhoneNotes', '')

    # Clean URLs
    conference_url = clean_url(conference_url)

    # Notes
    notes = meeting.get('notes', '')
    notes = clean_text(notes)

    # Group info
    group = meeting.get('group', '')
    group = clean_text(group)

    # Contact info
    contact_email = meeting.get('email', '') or meeting.get('contact_1_email', '') or meeting.get('contactEmail', '')

    # Generate unique key for deduplication
    unique_key = f"{name}|{location_name}|{day}|{time}".lower().strip()

    # Clean types array - remove empty values and normalize
    clean_types = []
    for t in types:
        if t and isinstance(t, str):
            t = t.strip().upper()
            if t and t not in clean_types:
                clean_types.append(t)

    return {
        # Identity
        "uniqueKey": unique_key,
        "name": name,
        "slug": generate_slug(name),

        # Schedule
        "day": day,
        "dayName": DAY_MAP.get(day, ""),
        "time": time,
        "endTime": end_time,
        "timezone": timezone,

        # Location
        "locationName": location_name,
        "address": address,
        "city": city,
        "state": state,
        "postalCode": postal_code,
        "country": country,
        "formattedAddress": formatted_address,
        "latitude": latitude,
        "longitude": longitude,

        # Online meeting info
        "isOnline": is_online,
        "isHybrid": is_hybrid,
        "onlineUrl": conference_url,
        "onlineUrlNotes": conference_url_notes,
        "conferencePhone": conference_phone,
        "conferencePhoneNotes": conference_phone_notes,

        # Meeting characteristics
        "fellowship": fellowship,
        "meetingType": fellowship,
        "types": clean_types,
        "notes": notes,

        # Group info
        "group": group,
        "contactEmail": contact_email,

        # Metadata
        "sourceFeed": source_name,
        "sourceType": "web_scraper",
        "isActive": True,
    }


def clean_text(text: str) -> str:
    """Clean and normalize text fields"""
    if not text:
        return ""

    # Convert to string if needed
    text = str(text)

    # Remove excessive whitespace
    text = ' '.join(text.split())

    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)

    # Decode HTML entities
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    text = text.replace('&#39;', "'")
    text = text.replace('&nbsp;', ' ')

    return text.strip()


def normalize_time(time_str: str) -> str:
    """Normalize time to HH:MM format"""
    if not time_str:
        return ""

    time_str = str(time_str).strip()

    # Already in HH:MM format
    if re.match(r'^\d{2}:\d{2}$', time_str):
        return time_str

    # HH:MM:SS format - truncate
    if re.match(r'^\d{2}:\d{2}:\d{2}$', time_str):
        return time_str[:5]

    # H:MM format - pad hour
    if re.match(r'^\d:\d{2}$', time_str):
        return f"0{time_str}"

    return time_str


def clean_url(url: str) -> str:
    """Clean and validate URLs"""
    if not url:
        return ""

    url = str(url).strip()

    # Remove whitespace and newlines
    url = url.replace('\n', '').replace('\r', '').replace(' ', '')

    # Ensure http/https prefix for Zoom and other URLs
    if url and not url.startswith(('http://', 'https://')):
        if 'zoom.us' in url or 'meet.google' in url or 'teams.microsoft' in url:
            url = f"https://{url}"

    return url


def generate_slug(name: str) -> str:
    """Generate URL-safe slug from meeting name"""
    if not name:
        return ""

    # Convert to lowercase
    slug = name.lower()

    # Replace special characters with hyphens
    slug = re.sub(r'[^a-z0-9]+', '-', slug)

    # Remove leading/trailing hyphens
    slug = slug.strip('-')

    # Limit length
    slug = slug[:64]

    return slug


def analyze_data_quality(meetings: List[Dict]) -> Dict:
    """Analyze the quality of the cleaned meeting data"""
    total = len(meetings)

    stats = {
        "total_meetings": total,
        "has_name": sum(1 for m in meetings if m.get("name")),
        "has_time": sum(1 for m in meetings if m.get("time")),
        "has_day": sum(1 for m in meetings if m.get("day") is not None),
        "has_location": sum(1 for m in meetings if m.get("locationName")),
        "has_coordinates": sum(1 for m in meetings if m.get("latitude") and m.get("longitude")),
        "has_online_url": sum(1 for m in meetings if m.get("onlineUrl")),
        "has_phone": sum(1 for m in meetings if m.get("conferencePhone")),
        "is_online": sum(1 for m in meetings if m.get("isOnline")),
        "is_hybrid": sum(1 for m in meetings if m.get("isHybrid")),
        "by_day": {DAY_MAP.get(i, str(i)): 0 for i in range(7)},
        "by_fellowship": {},
    }

    for m in meetings:
        day = m.get("day", 0)
        if day is not None and 0 <= day <= 6:
            stats["by_day"][DAY_MAP.get(day, str(day))] += 1

        fellowship = m.get("fellowship", "Unknown")
        stats["by_fellowship"][fellowship] = stats["by_fellowship"].get(fellowship, 0) + 1

    return stats


def deduplicate_meetings(meetings: List[Dict]) -> List[Dict]:
    """Remove duplicate meetings based on uniqueKey"""
    seen = set()
    unique_meetings = []

    for meeting in meetings:
        key = meeting.get("uniqueKey", "")
        if key and key not in seen:
            seen.add(key)
            unique_meetings.append(meeting)
        elif not key:
            # Keep meetings without a key (shouldn't happen but be safe)
            unique_meetings.append(meeting)

    duplicates_removed = len(meetings) - len(unique_meetings)
    if duplicates_removed > 0:
        print(f"Removed {duplicates_removed} duplicate meetings")

    return unique_meetings


def export_to_csv(meetings: List[Dict], filename: str):
    """Export cleaned meetings to CSV for review"""
    if not meetings:
        print("No meetings to export")
        return

    # Define column order
    columns = [
        "uniqueKey", "name", "fellowship", "day", "dayName", "time", "endTime",
        "timezone", "locationName", "address", "city", "state", "postalCode",
        "country", "formattedAddress", "latitude", "longitude",
        "isOnline", "isHybrid", "onlineUrl", "conferencePhone",
        "types", "notes", "group", "contactEmail", "sourceFeed"
    ]

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()

        for meeting in meetings:
            row = meeting.copy()
            # Convert types list to string for CSV
            if isinstance(row.get('types'), list):
                row['types'] = ','.join(row['types'])
            writer.writerow(row)

    print(f"Exported {len(meetings)} meetings to {filename}")


def export_to_json(meetings: List[Dict], filename: str):
    """Export cleaned meetings to JSON for Back4app import"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(meetings, f, indent=2, default=str)

    print(f"Exported {len(meetings)} meetings to {filename}")


def main():
    """Main function to fetch, clean, and export online meeting data"""
    print("=" * 60)
    print("Online Meeting Data Research and Cleaning")
    print("=" * 60)
    print()

    all_meetings = []

    # Fetch from each source
    for source_name, config in ONLINE_SOURCES.items():
        print(f"\n--- Processing: {source_name} ---")
        print(f"Description: {config['description']}")

        # Fetch data based on feed type
        if config['type'] == 'tsml':
            raw_meetings = fetch_tsml_feed(config['url'], source_name)
        elif config['type'] == 'bmlt':
            raw_meetings = fetch_bmlt_feed(config['url'], source_name)
            # Transform BMLT to standard format
            raw_meetings = [transform_bmlt_to_standard(m) for m in raw_meetings]
        else:
            print(f"  Unknown feed type: {config['type']}")
            continue

        # Clean and normalize
        fellowship = config.get('fellowship', 'AA')
        for raw in raw_meetings:
            cleaned = clean_meeting_data(raw, source_name, fellowship)
            all_meetings.append(cleaned)

        print(f"  Processed {len(raw_meetings)} meetings")

    print("\n" + "=" * 60)
    print("Data Cleaning Complete")
    print("=" * 60)

    # Deduplicate
    print(f"\nTotal meetings before deduplication: {len(all_meetings)}")
    all_meetings = deduplicate_meetings(all_meetings)
    print(f"Total meetings after deduplication: {len(all_meetings)}")

    # Analyze data quality
    print("\n--- Data Quality Analysis ---")
    stats = analyze_data_quality(all_meetings)

    print(f"Total meetings: {stats['total_meetings']}")
    print(f"With name: {stats['has_name']} ({stats['has_name']/stats['total_meetings']*100:.1f}%)")
    print(f"With time: {stats['has_time']} ({stats['has_time']/stats['total_meetings']*100:.1f}%)")
    print(f"With online URL: {stats['has_online_url']} ({stats['has_online_url']/stats['total_meetings']*100:.1f}%)")
    print(f"With phone: {stats['has_phone']} ({stats['has_phone']/stats['total_meetings']*100:.1f}%)")
    print(f"Online-only: {stats['is_online']} ({stats['is_online']/stats['total_meetings']*100:.1f}%)")
    print(f"Hybrid: {stats['is_hybrid']} ({stats['is_hybrid']/stats['total_meetings']*100:.1f}%)")

    print("\nMeetings by day:")
    for day, count in stats['by_day'].items():
        print(f"  {day}: {count}")

    print("\nMeetings by fellowship:")
    for fellowship, count in sorted(stats['by_fellowship'].items()):
        print(f"  {fellowship}: {count}")

    # Export
    print("\n--- Exporting Data ---")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    csv_file = f"online_meetings_cleaned_{timestamp}.csv"
    json_file = f"online_meetings_cleaned_{timestamp}.json"

    export_to_csv(all_meetings, csv_file)
    export_to_json(all_meetings, json_file)

    print("\n" + "=" * 60)
    print("DONE!")
    print(f"CSV file: {csv_file}")
    print(f"JSON file: {json_file}")
    print("=" * 60)

    return all_meetings


if __name__ == "__main__":
    main()
