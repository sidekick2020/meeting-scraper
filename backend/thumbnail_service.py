"""
Thumbnail Generation Service for Meeting Images

CPU-Efficient Architecture:
1. Lazy Generation - Only generates when first requested
2. Background Queue - Non-blocking async generation
3. Deterministic Prompts - Same meeting data = consistent image
4. Caching - Stores generated thumbnails in Back4app
5. SVG Fallback - Instant placeholder while AI generates

Supports:
- OpenAI DALL-E 3
- Replicate (Stable Diffusion)
- Fallback SVG generation (no API needed)
"""

import os
import hashlib
import threading
import queue
import time
import base64
import requests
from datetime import datetime

# Configuration
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
REPLICATE_API_KEY = os.environ.get('REPLICATE_API_KEY')

# Thumbnail generation queue (CPU efficient - processes in background)
thumbnail_queue = queue.Queue()
thumbnail_status = {}  # meeting_id -> status ('pending', 'generating', 'complete', 'error')

# Color palettes for different meeting types (Sober Sidekick branding)
MEETING_TYPE_COLORS = {
    'AA': {'primary': '#2f5dff', 'secondary': '#0f2ccf', 'accent': '#597dff'},
    'NA': {'primary': '#22c55e', 'secondary': '#16a34a', 'accent': '#4ade80'},
    'Al-Anon': {'primary': '#8b5cf6', 'secondary': '#7c3aed', 'accent': '#a78bfa'},
    'Other': {'primary': '#f59e0b', 'secondary': '#d97706', 'accent': '#fbbf24'},
}

# Icons for meeting types (SVG paths)
MEETING_TYPE_ICONS = {
    'AA': '<circle cx="50" cy="35" r="15" fill="{accent}" opacity="0.8"/><path d="M35 75 L50 45 L65 75 Z" fill="{accent}" opacity="0.6"/>',
    'NA': '<circle cx="50" cy="50" r="20" fill="none" stroke="{accent}" stroke-width="3"/><path d="M40 50 L60 50 M50 40 L50 60" stroke="{accent}" stroke-width="3"/>',
    'Al-Anon': '<circle cx="40" cy="45" r="12" fill="{accent}" opacity="0.7"/><circle cx="60" cy="45" r="12" fill="{accent}" opacity="0.7"/><path d="M50 65 Q40 55 50 45 Q60 55 50 65" fill="{accent}" opacity="0.5"/>',
    'Other': '<rect x="35" y="35" width="30" height="30" rx="5" fill="{accent}" opacity="0.7"/>',
}


def generate_meeting_hash(meeting):
    """Generate a deterministic hash from meeting data for consistent thumbnails."""
    key_data = f"{meeting.get('name', '')}-{meeting.get('meetingType', '')}-{meeting.get('city', '')}-{meeting.get('state', '')}"
    return hashlib.md5(key_data.encode()).hexdigest()[:12]


def generate_ai_prompt(meeting):
    """Generate a descriptive prompt for AI image generation based on meeting data."""
    meeting_type = meeting.get('meetingType', 'AA')
    city = meeting.get('city', '')
    state = meeting.get('state', '')
    is_online = meeting.get('isOnline', False)

    # Base style
    style = "minimalist, abstract, calming, supportive, modern digital art, soft gradients"

    # Meeting type specific themes
    type_themes = {
        'AA': 'sobriety, recovery journey, unity, hope, serenity',
        'NA': 'recovery, strength, new beginnings, community support',
        'Al-Anon': 'family support, healing together, understanding, compassion',
        'Other': 'wellness, personal growth, community, support group',
    }

    theme = type_themes.get(meeting_type, type_themes['Other'])

    # Location context
    location_desc = ""
    if city and state:
        location_desc = f"inspired by {city}, {state} scenery, "
    elif state:
        location_desc = f"inspired by {state} landscape, "

    # Online meeting modifier
    online_desc = "digital connection, virtual gathering, " if is_online else ""

    prompt = f"Abstract artwork representing {theme}, {online_desc}{location_desc}{style}. Blue and purple color scheme. No text, no people, no faces. Safe for all audiences."

    return prompt


def generate_svg_placeholder(meeting):
    """Generate an SVG placeholder thumbnail - instant, no API needed."""
    meeting_type = meeting.get('meetingType', 'AA')
    if meeting_type not in MEETING_TYPE_COLORS:
        meeting_type = 'Other'

    colors = MEETING_TYPE_COLORS[meeting_type]
    icon = MEETING_TYPE_ICONS[meeting_type].format(**colors)

    # Use meeting hash for unique gradient angle
    meeting_hash = generate_meeting_hash(meeting)
    angle = int(meeting_hash[:2], 16) % 360

    # Generate unique pattern based on hash
    hash_int = int(meeting_hash, 16)
    pattern_opacity = 0.05 + (hash_int % 10) / 100

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 100 75">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate({angle})">
      <stop offset="0%" style="stop-color:{colors['primary']};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{colors['secondary']};stop-opacity:1" />
    </linearGradient>
    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="5" r="1" fill="white" opacity="{pattern_opacity}"/>
    </pattern>
  </defs>
  <rect width="100" height="75" fill="url(#bg)"/>
  <rect width="100" height="75" fill="url(#grid)"/>
  {icon}
</svg>'''

    return svg


def svg_to_data_uri(svg):
    """Convert SVG to data URI for direct use in img src."""
    encoded = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
    return f"data:image/svg+xml;base64,{encoded}"


def generate_thumbnail_openai(meeting, prompt):
    """Generate thumbnail using OpenAI DALL-E 3."""
    if not OPENAI_API_KEY:
        return None, "OpenAI API key not configured"

    try:
        response = requests.post(
            'https://api.openai.com/v1/images/generations',
            headers={
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'dall-e-3',
                'prompt': prompt,
                'n': 1,
                'size': '1024x1024',
                'quality': 'standard',
                'response_format': 'url',
            },
            timeout=60
        )

        if response.status_code == 200:
            data = response.json()
            image_url = data['data'][0]['url']
            return image_url, None
        else:
            return None, f"OpenAI API error: {response.status_code}"
    except Exception as e:
        return None, str(e)


def generate_thumbnail_replicate(meeting, prompt):
    """Generate thumbnail using Replicate (Stable Diffusion)."""
    if not REPLICATE_API_KEY:
        return None, "Replicate API key not configured"

    try:
        # Start prediction
        response = requests.post(
            'https://api.replicate.com/v1/predictions',
            headers={
                'Authorization': f'Token {REPLICATE_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'version': 'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4',  # SDXL
                'input': {
                    'prompt': prompt,
                    'negative_prompt': 'text, words, letters, people, faces, hands, violent, nsfw',
                    'width': 768,
                    'height': 512,
                    'num_outputs': 1,
                },
            },
            timeout=30
        )

        if response.status_code != 201:
            return None, f"Replicate API error: {response.status_code}"

        prediction = response.json()
        prediction_id = prediction['id']

        # Poll for completion (max 60 seconds)
        for _ in range(30):
            time.sleep(2)
            status_response = requests.get(
                f'https://api.replicate.com/v1/predictions/{prediction_id}',
                headers={'Authorization': f'Token {REPLICATE_API_KEY}'},
                timeout=10
            )

            if status_response.status_code == 200:
                status_data = status_response.json()
                if status_data['status'] == 'succeeded':
                    return status_data['output'][0], None
                elif status_data['status'] == 'failed':
                    return None, "Image generation failed"

        return None, "Generation timed out"
    except Exception as e:
        return None, str(e)


def save_thumbnail_to_back4app(meeting_id, thumbnail_url, app_id, rest_key):
    """Save the generated thumbnail URL to the meeting record in Back4app."""
    try:
        response = requests.put(
            f'https://parseapi.back4app.com/classes/Meeting/{meeting_id}',
            headers={
                'X-Parse-Application-Id': app_id,
                'X-Parse-REST-API-Key': rest_key,
                'Content-Type': 'application/json',
            },
            json={
                'thumbnailUrl': thumbnail_url,
                'thumbnailGeneratedAt': {'__type': 'Date', 'iso': datetime.utcnow().isoformat() + 'Z'},
            },
            timeout=10
        )
        return response.status_code == 200
    except Exception:
        return False


def thumbnail_worker(app_id, rest_key):
    """Background worker that processes thumbnail generation queue."""
    while True:
        try:
            # Get next meeting from queue (blocks until available)
            meeting = thumbnail_queue.get(timeout=5)
            meeting_id = meeting.get('objectId')

            if not meeting_id:
                continue

            thumbnail_status[meeting_id] = 'generating'

            # Generate prompt
            prompt = generate_ai_prompt(meeting)

            # Try AI generation (prefer OpenAI, fallback to Replicate)
            thumbnail_url = None
            error = None

            if OPENAI_API_KEY:
                thumbnail_url, error = generate_thumbnail_openai(meeting, prompt)

            if not thumbnail_url and REPLICATE_API_KEY:
                thumbnail_url, error = generate_thumbnail_replicate(meeting, prompt)

            # If AI generation fails, use SVG placeholder
            if not thumbnail_url:
                svg = generate_svg_placeholder(meeting)
                thumbnail_url = svg_to_data_uri(svg)

            # Save to Back4app
            if save_thumbnail_to_back4app(meeting_id, thumbnail_url, app_id, rest_key):
                thumbnail_status[meeting_id] = 'complete'
            else:
                thumbnail_status[meeting_id] = 'error'

            thumbnail_queue.task_done()

            # Rate limiting - don't hammer APIs
            time.sleep(1)

        except queue.Empty:
            continue
        except Exception as e:
            print(f"Thumbnail worker error: {e}")
            time.sleep(5)


def start_thumbnail_worker(app_id, rest_key, num_workers=2):
    """Start background thumbnail generation workers."""
    for i in range(num_workers):
        worker = threading.Thread(
            target=thumbnail_worker,
            args=(app_id, rest_key),
            daemon=True,
            name=f'ThumbnailWorker-{i}'
        )
        worker.start()


def request_thumbnail(meeting):
    """Request thumbnail generation for a meeting. Returns immediately."""
    meeting_id = meeting.get('objectId')
    if not meeting_id:
        return None

    # Check if already has thumbnail
    if meeting.get('thumbnailUrl'):
        return meeting.get('thumbnailUrl')

    # Check if already in queue
    if meeting_id in thumbnail_status:
        status = thumbnail_status[meeting_id]
        if status in ('pending', 'generating'):
            # Return placeholder while generating
            return svg_to_data_uri(generate_svg_placeholder(meeting))

    # Add to queue
    thumbnail_status[meeting_id] = 'pending'
    thumbnail_queue.put(meeting)

    # Return placeholder immediately
    return svg_to_data_uri(generate_svg_placeholder(meeting))


def get_placeholder_thumbnail(meeting):
    """Get an instant SVG placeholder thumbnail (no queue, no API)."""
    return svg_to_data_uri(generate_svg_placeholder(meeting))


def get_thumbnail_status(meeting_id):
    """Get the current status of thumbnail generation for a meeting."""
    return thumbnail_status.get(meeting_id, 'unknown')


def get_queue_stats():
    """Get statistics about the thumbnail generation queue."""
    return {
        'queue_size': thumbnail_queue.qsize(),
        'statuses': dict(thumbnail_status),
        'pending_count': sum(1 for s in thumbnail_status.values() if s == 'pending'),
        'generating_count': sum(1 for s in thumbnail_status.values() if s == 'generating'),
        'complete_count': sum(1 for s in thumbnail_status.values() if s == 'complete'),
        'error_count': sum(1 for s in thumbnail_status.values() if s == 'error'),
    }
