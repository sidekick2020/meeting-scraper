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

# Emotive theme categories - maps keywords to emotional visual themes
EMOTIVE_THEMES = {
    # Speaker/Presentation themes - inspiring hero imagery
    'speaker': {
        'keywords': ['speaker', 'speakers', 'speak', 'talk', 'share', 'story', 'stories', 'podium', 'lead', 'leader'],
        'scene': 'confident cartoon character standing at a glowing podium with radiating light beams, inspiring silhouette with cape flowing gently, warm spotlight effect',
        'mood': 'inspiring',
        'style': 'heroic minimal illustration, bold shapes, confident pose'
    },
    # Comedy/Fun themes - playful expressive imagery
    'comedy': {
        'keywords': ['blooper', 'bloopers', 'fun', 'funny', 'laugh', 'laughter', 'humor', 'humorous', 'joy', 'joyful', 'happy', 'comedy'],
        'scene': 'playful pop-art style burst with expressive cartoon elements, dynamic shapes radiating outward, comic book style energy lines',
        'mood': 'playful',
        'style': 'pop art, bold colors, dynamic composition, comic book style'
    },
    # Study/Learning themes - wisdom imagery
    'study': {
        'keywords': ['study', 'book', 'big book', 'literature', 'reading', 'learn', 'learning', 'education', 'tradition', 'traditions', 'step study'],
        'scene': 'glowing open book with soft light emanating from pages, floating geometric wisdom symbols, gentle magical atmosphere',
        'mood': 'contemplative',
        'style': 'soft glow effects, magical realism, warm scholarly atmosphere'
    },
    # Steps/Journey themes - progress imagery
    'journey': {
        'keywords': ['step', 'steps', '12 step', 'journey', 'progress', 'path', 'climb', 'climbing', 'milestone', 'growth'],
        'scene': 'winding staircase ascending through clouds toward a bright light, each step glowing softly, sense of upward motion',
        'mood': 'hopeful',
        'style': 'ascending composition, gradient lighting, ethereal atmosphere'
    },
    # Meditation/Spiritual themes - zen peaceful imagery
    'meditation': {
        'keywords': ['meditation', 'meditate', 'spiritual', 'spirit', 'zen', 'mindful', 'mindfulness', 'prayer', 'pray', 'conscious', '11th step'],
        'scene': 'serene lotus flower floating on still water with gentle ripples, soft morning mist, balanced stones nearby',
        'mood': 'peaceful',
        'style': 'minimalist zen, soft pastels, balanced composition'
    },
    # Women empowerment themes
    'women': {
        'keywords': ['women', 'womens', "women's", 'ladies', 'sisterhood', 'sisters', 'female'],
        'scene': 'elegant abstract figure with flowing hair made of flowers and vines, empowering silhouette with nature elements',
        'mood': 'empowering',
        'style': 'elegant flowing lines, floral elements, strength in softness'
    },
    # Men themes
    'men': {
        'keywords': ['men', 'mens', "men's", 'guys', 'brotherhood', 'brothers', 'male', 'stag'],
        'scene': 'strong mountain silhouette with trees, sturdy oak tree with deep roots, grounded and steady imagery',
        'mood': 'grounded',
        'style': 'solid shapes, earth tones, strength and stability'
    },
    # Newcomer/Welcome themes - open welcoming imagery
    'welcome': {
        'keywords': ['newcomer', 'newcomers', 'welcome', 'first', 'begin', 'beginning', 'new', 'intro', 'introduction', 'open'],
        'scene': 'warm glowing doorway with soft light spilling out, welcoming arch with gentle gradient, inviting atmosphere',
        'mood': 'welcoming',
        'style': 'warm lighting, open composition, inviting atmosphere'
    },
    # Gratitude themes - abundant thankful imagery
    'gratitude': {
        'keywords': ['gratitude', 'grateful', 'thankful', 'thanks', 'blessing', 'blessings', 'appreciation', 'grace'],
        'scene': 'overflowing basket of soft glowing orbs representing blessings, warm golden light, abundance imagery',
        'mood': 'grateful',
        'style': 'warm golden tones, abundant feeling, soft glow'
    },
    # Strength/Courage themes - resilient imagery
    'strength': {
        'keywords': ['strength', 'strong', 'courage', 'courageous', 'brave', 'warrior', 'fight', 'fighting', 'resilient', 'resilience', 'power'],
        'scene': 'sturdy lighthouse beam cutting through gentle fog, beacon of strength standing firm, protective light',
        'mood': 'determined',
        'style': 'bold silhouettes, strong contrast, steadfast imagery'
    },
    # Unity/Fellowship themes - connection imagery
    'unity': {
        'keywords': ['unity', 'together', 'fellowship', 'community', 'group', 'circle', 'connected', 'connection', 'family', 'home'],
        'scene': 'abstract interconnected circles forming a unified pattern, warm overlapping shapes, sense of belonging',
        'mood': 'connected',
        'style': 'interlocking shapes, warm harmony, unified composition'
    },
    # Candlelight/Evening themes - intimate imagery
    'candlelight': {
        'keywords': ['candle', 'candlelight', 'candlelit', 'flame', 'glow', 'evening', 'night', 'late'],
        'scene': 'single warm candle flame with soft radiating glow, intimate atmosphere, gentle flicker effect',
        'mood': 'intimate',
        'style': 'warm single light source, soft shadows, cozy atmosphere'
    },
    # Daily/Regular themes - consistent steady imagery
    'daily': {
        'keywords': ['daily', 'everyday', 'regular', 'noon', 'midday', 'lunch', 'morning', 'nooner'],
        'scene': 'simple sun at its peak with balanced rays, clear sky with gentle clouds, steady reliable energy',
        'mood': 'steady',
        'style': 'balanced composition, clear simple shapes, reliable feeling'
    },
    # Young People themes - vibrant energetic imagery
    'youth': {
        'keywords': ['young', 'youth', 'ypaa', 'young people', 'teen', 'teens', 'college', 'university'],
        'scene': 'dynamic abstract shapes bursting with energy, fresh vibrant colors in motion, youthful momentum',
        'mood': 'energetic',
        'style': 'dynamic movement, fresh colors, energetic composition'
    },
    # Serenity/Peace themes - calm tranquil imagery
    'serenity': {
        'keywords': ['serenity', 'serene', 'peace', 'peaceful', 'calm', 'tranquil', 'quiet', 'still', 'gentle'],
        'scene': 'perfectly still lake reflecting soft pastel sky, single leaf floating peacefully, absolute tranquility',
        'mood': 'tranquil',
        'style': 'mirror reflections, soft pastels, stillness'
    },
    # Hope/Recovery themes - uplifting imagery
    'hope': {
        'keywords': ['hope', 'hopeful', 'recovery', 'recover', 'heal', 'healing', 'renew', 'renewal', 'rebirth', 'transform'],
        'scene': 'butterfly emerging from cocoon with soft light, transformation imagery, gentle metamorphosis',
        'mood': 'hopeful',
        'style': 'transformation imagery, soft emergence, gentle awakening'
    }
}

# Icons for meeting types (SVG paths)
MEETING_TYPE_ICONS = {
    'AA': '<circle cx="50" cy="35" r="15" fill="{accent}" opacity="0.8"/><path d="M35 75 L50 45 L65 75 Z" fill="{accent}" opacity="0.6"/>',
    'NA': '<circle cx="50" cy="50" r="20" fill="none" stroke="{accent}" stroke-width="3"/><path d="M40 50 L60 50 M50 40 L50 60" stroke="{accent}" stroke-width="3"/>',
    'Al-Anon': '<circle cx="40" cy="45" r="12" fill="{accent}" opacity="0.7"/><circle cx="60" cy="45" r="12" fill="{accent}" opacity="0.7"/><path d="M50 65 Q40 55 50 45 Q60 55 50 65" fill="{accent}" opacity="0.5"/>',
    'Other': '<rect x="35" y="35" width="30" height="30" rx="5" fill="{accent}" opacity="0.7"/>',
}

# Emotive theme icons (SVG paths) - more expressive and contextual
EMOTIVE_THEME_ICONS = {
    # Speaker - podium with radiating lines (hero at podium)
    'speaker': '''
        <rect x="42" y="50" width="16" height="20" rx="2" fill="{accent}" opacity="0.9"/>
        <rect x="38" y="45" width="24" height="8" rx="1" fill="{accent}" opacity="0.7"/>
        <path d="M50 40 L50 30" stroke="{accent}" stroke-width="2" opacity="0.8"/>
        <path d="M35 35 L45 42" stroke="{accent}" stroke-width="1.5" opacity="0.5"/>
        <path d="M65 35 L55 42" stroke="{accent}" stroke-width="1.5" opacity="0.5"/>
        <circle cx="50" cy="25" r="8" fill="{accent}" opacity="0.6"/>
    ''',
    # Comedy - burst/explosion pattern (pop art style)
    'comedy': '''
        <polygon points="50,20 55,38 75,38 60,50 65,68 50,55 35,68 40,50 25,38 45,38" fill="{accent}" opacity="0.8"/>
        <circle cx="50" cy="42" r="10" fill="{primary}" opacity="0.9"/>
        <path d="M45 40 Q50 48 55 40" stroke="white" stroke-width="2" fill="none"/>
    ''',
    # Study - open book with glow
    'study': '''
        <path d="M25 55 Q50 45 75 55 L75 30 Q50 25 25 30 Z" fill="{accent}" opacity="0.7"/>
        <path d="M50 25 L50 55" stroke="{primary}" stroke-width="1"/>
        <path d="M30 35 L45 38 M55 38 L70 35" stroke="{accent}" stroke-width="1" opacity="0.5"/>
        <circle cx="50" cy="20" r="5" fill="{accent}" opacity="0.4"/>
    ''',
    # Journey - ascending steps
    'journey': '''
        <rect x="25" y="60" width="12" height="10" fill="{accent}" opacity="0.5"/>
        <rect x="37" y="50" width="12" height="20" fill="{accent}" opacity="0.6"/>
        <rect x="49" y="40" width="12" height="30" fill="{accent}" opacity="0.7"/>
        <rect x="61" y="30" width="12" height="40" fill="{accent}" opacity="0.8"/>
        <path d="M20 65 L75 25" stroke="{accent}" stroke-width="1" stroke-dasharray="2,2" opacity="0.4"/>
    ''',
    # Meditation - lotus/zen circle
    'meditation': '''
        <circle cx="50" cy="45" r="20" fill="none" stroke="{accent}" stroke-width="1.5" opacity="0.4"/>
        <ellipse cx="50" cy="55" rx="15" ry="8" fill="{accent}" opacity="0.5"/>
        <path d="M50 55 Q45 45 50 35 Q55 45 50 55" fill="{accent}" opacity="0.7"/>
        <path d="M40 55 Q42 48 50 50 Q58 48 60 55" fill="{accent}" opacity="0.6"/>
    ''',
    # Women - flowing abstract with flower
    'women': '''
        <circle cx="50" cy="35" r="12" fill="{accent}" opacity="0.7"/>
        <path d="M50 47 Q40 55 45 70 M50 47 Q60 55 55 70" stroke="{accent}" stroke-width="2" fill="none" opacity="0.6"/>
        <circle cx="50" cy="35" r="5" fill="{primary}" opacity="0.5"/>
        <path d="M45 30 Q50 25 55 30" stroke="{accent}" stroke-width="1.5" fill="none" opacity="0.8"/>
    ''',
    # Men - mountain/oak tree
    'men': '''
        <path d="M50 25 L70 65 L30 65 Z" fill="{accent}" opacity="0.6"/>
        <rect x="47" y="55" width="6" height="15" fill="{accent}" opacity="0.8"/>
        <circle cx="50" cy="25" r="8" fill="{accent}" opacity="0.5"/>
    ''',
    # Welcome - doorway with light
    'welcome': '''
        <rect x="35" y="25" width="30" height="45" rx="2" fill="{accent}" opacity="0.3"/>
        <rect x="38" y="28" width="24" height="39" fill="{accent}" opacity="0.6"/>
        <path d="M50 67 L50 45 M45 50 L55 50" stroke="white" stroke-width="2" opacity="0.5"/>
        <ellipse cx="50" cy="30" rx="8" ry="3" fill="white" opacity="0.3"/>
    ''',
    # Gratitude - overflowing cup/basket
    'gratitude': '''
        <path d="M35 45 L40 65 L60 65 L65 45" fill="{accent}" opacity="0.6"/>
        <circle cx="45" cy="40" r="6" fill="{accent}" opacity="0.7"/>
        <circle cx="55" cy="38" r="5" fill="{accent}" opacity="0.8"/>
        <circle cx="50" cy="32" r="4" fill="{accent}" opacity="0.9"/>
        <circle cx="42" cy="35" r="3" fill="{accent}" opacity="0.6"/>
    ''',
    # Strength - lighthouse beam
    'strength': '''
        <rect x="45" y="35" width="10" height="35" fill="{accent}" opacity="0.7"/>
        <path d="M42 35 L58 35 L55 25 L45 25 Z" fill="{accent}" opacity="0.8"/>
        <circle cx="50" cy="22" r="6" fill="{accent}" opacity="0.9"/>
        <path d="M50 22 L35 15 M50 22 L65 15 M50 22 L50 12" stroke="{accent}" stroke-width="2" opacity="0.5"/>
    ''',
    # Unity - interconnected circles
    'unity': '''
        <circle cx="40" cy="40" r="12" fill="{accent}" opacity="0.5"/>
        <circle cx="60" cy="40" r="12" fill="{accent}" opacity="0.5"/>
        <circle cx="50" cy="55" r="12" fill="{accent}" opacity="0.5"/>
        <circle cx="50" cy="45" r="5" fill="{primary}" opacity="0.7"/>
    ''',
    # Candlelight - single flame
    'candlelight': '''
        <rect x="46" y="45" width="8" height="25" fill="{accent}" opacity="0.6"/>
        <ellipse cx="50" cy="45" rx="6" ry="3" fill="{accent}" opacity="0.8"/>
        <path d="M50 45 Q45 35 50 20 Q55 35 50 45" fill="{accent}" opacity="0.9"/>
        <ellipse cx="50" cy="30" rx="3" ry="5" fill="white" opacity="0.3"/>
    ''',
    # Daily - balanced sun
    'daily': '''
        <circle cx="50" cy="40" r="12" fill="{accent}" opacity="0.8"/>
        <path d="M50 20 L50 25 M50 55 L50 60 M30 40 L35 40 M65 40 L70 40" stroke="{accent}" stroke-width="2" opacity="0.6"/>
        <path d="M36 26 L40 30 M64 26 L60 30 M36 54 L40 50 M64 54 L60 50" stroke="{accent}" stroke-width="2" opacity="0.5"/>
    ''',
    # Youth - dynamic burst
    'youth': '''
        <circle cx="50" cy="42" r="15" fill="{accent}" opacity="0.6"/>
        <path d="M50 42 L45 25 M50 42 L60 28 M50 42 L35 35 M50 42 L65 38" stroke="{accent}" stroke-width="2" opacity="0.7"/>
        <path d="M50 42 L40 58 M50 42 L62 55" stroke="{accent}" stroke-width="2" opacity="0.7"/>
        <circle cx="50" cy="42" r="6" fill="{primary}" opacity="0.8"/>
    ''',
    # Serenity - still water reflection
    'serenity': '''
        <ellipse cx="50" cy="50" rx="25" ry="10" fill="{accent}" opacity="0.3"/>
        <path d="M25 50 Q50 45 75 50" stroke="{accent}" stroke-width="1" opacity="0.5"/>
        <ellipse cx="50" cy="35" rx="8" ry="12" fill="{accent}" opacity="0.5"/>
        <ellipse cx="50" cy="35" rx="4" ry="6" fill="{accent}" opacity="0.7"/>
    ''',
    # Hope - butterfly/emergence
    'hope': '''
        <ellipse cx="50" cy="50" rx="3" ry="10" fill="{accent}" opacity="0.8"/>
        <path d="M50 45 Q35 35 40 50 Q35 65 50 55" fill="{accent}" opacity="0.6"/>
        <path d="M50 45 Q65 35 60 50 Q65 65 50 55" fill="{accent}" opacity="0.6"/>
        <circle cx="50" cy="38" r="3" fill="{accent}" opacity="0.9"/>
    '''
}


def generate_meeting_hash(meeting):
    """Generate a deterministic hash from meeting data for consistent thumbnails."""
    key_data = f"{meeting.get('name', '')}-{meeting.get('meetingType', '')}-{meeting.get('city', '')}-{meeting.get('state', '')}"
    return hashlib.md5(key_data.encode()).hexdigest()[:12]


def detect_emotive_theme(meeting_name):
    """Detect the emotional theme from meeting name keywords."""
    if not meeting_name:
        return None

    name_lower = meeting_name.lower()

    # Check each theme's keywords
    for theme_name, theme_data in EMOTIVE_THEMES.items():
        for keyword in theme_data['keywords']:
            # Check for whole word match or phrase match
            if keyword in name_lower:
                return theme_data

    return None


def generate_ai_prompt(meeting):
    """Generate an emotive, context-aware prompt for AI image generation.

    Creates simple but unique thumbnails that are expressive without being overwhelming.
    Matches the emotional tone of the meeting type for more meaningful imagery.
    """
    meeting_name = meeting.get('name', '')
    meeting_type = meeting.get('meetingType', 'AA')
    city = meeting.get('city', '')
    state = meeting.get('state', '')
    is_online = meeting.get('isOnline', False)

    # Base style - simple, clean, expressive but not loud
    base_style = "minimalist illustration, soft gradients, gentle curves, clean composition, subtle depth, muted but warm colors, understated elegance"

    # Meeting type color themes
    type_color_schemes = {
        'AA': 'soft blue and warm gold tones',
        'NA': 'gentle green and teal hues',
        'Al-Anon': 'soft purple and lavender palette',
        'Other': 'warm amber and soft orange tones',
    }
    color_scheme = type_color_schemes.get(meeting_type, type_color_schemes['Other'])

    # First, try to detect an emotive theme from the meeting name
    emotive_theme = detect_emotive_theme(meeting_name)

    if emotive_theme:
        # Use the emotive theme for the scene
        scene = emotive_theme['scene']
        style = f"{emotive_theme['style']}, {base_style}"

        prompt = f"{scene}, {color_scheme}, {style}. Abstract and symbolic, no text, no words, no letters, no realistic people, no faces. Simple yet evocative, emotionally resonant, safe for all audiences."
        return prompt

    # Fallback: Extract keywords from meeting name for nature/location imagery
    name_lower = meeting_name.lower() if meeting_name else ''
    scene_elements = []

    # Nature/outdoor keywords - with more emotive descriptions
    if any(word in name_lower for word in ['sunrise', 'dawn', 'early']):
        scene_elements.append('soft sunrise with gentle rays breaking through clouds, new beginning feeling')
    elif any(word in name_lower for word in ['sunset', 'dusk']):
        scene_elements.append('warm sunset gradient with soft orange to purple transition, peaceful ending')
    elif any(word in name_lower for word in ['mountain', 'hill', 'peak']):
        scene_elements.append('gentle mountain silhouette with soft mist, sense of accomplishment')
    elif any(word in name_lower for word in ['beach', 'ocean', 'sea', 'coast']):
        scene_elements.append('calm ocean horizon with single gentle wave, infinite possibility')
    elif any(word in name_lower for word in ['lake', 'river', 'water']):
        scene_elements.append('still water surface with subtle ripples, reflection and clarity')
    elif any(word in name_lower for word in ['garden', 'flower', 'bloom']):
        scene_elements.append('single flower blooming with soft petals, growth and beauty')
    elif any(word in name_lower for word in ['forest', 'tree', 'wood', 'grove']):
        scene_elements.append('soft tree silhouettes with dappled light, natural shelter')
    elif any(word in name_lower for word in ['park', 'meadow', 'field']):
        scene_elements.append('gentle rolling meadow with soft grass textures, open freedom')

    # Time/celestial keywords
    elif any(word in name_lower for word in ['star', 'night', 'moon']):
        scene_elements.append('soft starfield with gentle glow, peaceful night sky, quiet wonder')
    elif any(word in name_lower for word in ['sun', 'bright', 'light', 'ray']):
        scene_elements.append('warm light rays through soft clouds, illumination and clarity')
    elif any(word in name_lower for word in ['rainbow', 'color']):
        scene_elements.append('subtle rainbow arc with soft gradient colors, promise and hope')

    # Heart/caring keywords
    elif any(word in name_lower for word in ['heart', 'love', 'care']):
        scene_elements.append('abstract heart shape with warm glow, compassion')
    elif any(word in name_lower for word in ['bridge', 'cross']):
        scene_elements.append('graceful bridge arc over calm water, connection')

    # Location-based imagery with emotive touch
    elif city or state:
        state_scenes = {
            'CA': 'soft California coastal silhouette with gentle palm fronds',
            'California': 'soft California coastal silhouette with gentle palm fronds',
            'AZ': 'warm desert sunset with subtle saguaro silhouette',
            'Arizona': 'warm desert sunset with subtle saguaro silhouette',
            'CO': 'soft mountain range with gentle snow caps',
            'Colorado': 'soft mountain range with gentle snow caps',
            'FL': 'tropical horizon with soft palm shadows',
            'Florida': 'tropical horizon with soft palm shadows',
            'NY': 'soft urban park scene with gentle tree canopy',
            'New York': 'soft urban park scene with gentle tree canopy',
            'TX': 'warm prairie sunset with soft wildflower hints',
            'Texas': 'warm prairie sunset with soft wildflower hints',
        }
        scene_elements.append(state_scenes.get(state, 'gentle rolling landscape with soft horizon'))

    # Default scene if no keywords matched
    if not scene_elements:
        scene_elements.append('soft abstract landscape with gentle curves and warm horizon')

    # Online meeting modifier
    if is_online:
        scene_elements.append('with soft floating cloud elements suggesting connection')

    scene = ', '.join(scene_elements)

    prompt = f"{scene}, {color_scheme}, {base_style}. Abstract and symbolic, no text, no words, no letters, no realistic people, no faces. Simple yet evocative, emotionally resonant, safe for all audiences."

    return prompt


def detect_emotive_theme_name(meeting_name):
    """Detect the emotional theme name from meeting name keywords. Returns theme key."""
    if not meeting_name:
        return None

    name_lower = meeting_name.lower()

    # Check each theme's keywords
    for theme_name, theme_data in EMOTIVE_THEMES.items():
        for keyword in theme_data['keywords']:
            if keyword in name_lower:
                return theme_name

    return None


def generate_svg_placeholder(meeting):
    """Generate an emotive SVG placeholder thumbnail - instant, no API needed.

    Uses emotive theme icons when detected, falls back to meeting type icons.
    """
    meeting_type = meeting.get('meetingType', 'AA')
    meeting_name = meeting.get('name', '')

    if meeting_type not in MEETING_TYPE_COLORS:
        meeting_type = 'Other'

    colors = MEETING_TYPE_COLORS[meeting_type]

    # Try to detect emotive theme for more expressive icon
    emotive_theme_name = detect_emotive_theme_name(meeting_name)

    if emotive_theme_name and emotive_theme_name in EMOTIVE_THEME_ICONS:
        # Use emotive theme icon - more expressive and contextual
        icon = EMOTIVE_THEME_ICONS[emotive_theme_name].format(**colors)
    else:
        # Fall back to meeting type icon
        icon = MEETING_TYPE_ICONS[meeting_type].format(**colors)

    # Use meeting hash for unique gradient angle
    meeting_hash = generate_meeting_hash(meeting)
    angle = int(meeting_hash[:2], 16) % 360

    # Generate unique pattern based on hash
    hash_int = int(meeting_hash, 16)
    pattern_opacity = 0.05 + (hash_int % 10) / 100

    # Vary the pattern style based on emotive theme for more uniqueness
    if emotive_theme_name == 'comedy':
        # Pop art style dots
        pattern = f'<circle cx="5" cy="5" r="2" fill="white" opacity="{pattern_opacity * 2}"/>'
    elif emotive_theme_name in ['meditation', 'serenity']:
        # Minimal, sparse pattern
        pattern = f'<circle cx="5" cy="5" r="0.5" fill="white" opacity="{pattern_opacity * 0.5}"/>'
    elif emotive_theme_name in ['youth', 'comedy']:
        # Dynamic diagonal lines
        pattern = f'<path d="M0 0 L10 10 M10 0 L0 10" stroke="white" stroke-width="0.5" opacity="{pattern_opacity}"/>'
    else:
        # Default subtle dots
        pattern = f'<circle cx="5" cy="5" r="1" fill="white" opacity="{pattern_opacity}"/>'

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 100 75">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate({angle})">
      <stop offset="0%" style="stop-color:{colors['primary']};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{colors['secondary']};stop-opacity:1" />
    </linearGradient>
    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
      {pattern}
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
            f'https://parseapi.back4app.com/classes/Meetings/{meeting_id}',
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
