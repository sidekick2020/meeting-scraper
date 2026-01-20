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

# Base icons for meeting types (SVG paths) - emotive character silhouettes
MEETING_TYPE_ICONS = {
    # Fox silhouette (confident, friendly)
    'AA': '''<g transform="translate(35, 25)" opacity="0.85">
      <ellipse cx="15" cy="25" rx="12" ry="15" fill="{accent}"/>
      <polygon points="5,15 15,0 25,15" fill="{accent}"/>
      <circle cx="10" cy="22" r="2" fill="{secondary}"/>
      <circle cx="20" cy="22" r="2" fill="{secondary}"/>
      <ellipse cx="15" cy="28" rx="3" ry="2" fill="{secondary}"/>
    </g>''',
    # Owl silhouette (wise, watchful)
    'NA': '''<g transform="translate(35, 22)" opacity="0.85">
      <ellipse cx="15" cy="22" rx="14" ry="18" fill="{accent}"/>
      <circle cx="9" cy="18" r="6" fill="{secondary}"/>
      <circle cx="21" cy="18" r="6" fill="{secondary}"/>
      <circle cx="9" cy="18" r="3" fill="{accent}"/>
      <circle cx="21" cy="18" r="3" fill="{accent}"/>
      <polygon points="15,24 12,30 18,30" fill="{secondary}"/>
      <polygon points="3,8 9,16 3,16" fill="{accent}"/>
      <polygon points="27,8 21,16 27,16" fill="{accent}"/>
    </g>''',
    # Butterfly silhouette (transformation, grace)
    'Al-Anon': '''<g transform="translate(32, 22)" opacity="0.85">
      <ellipse cx="18" cy="25" rx="3" ry="12" fill="{accent}"/>
      <ellipse cx="8" cy="18" rx="8" ry="10" fill="{accent}"/>
      <ellipse cx="28" cy="18" rx="8" ry="10" fill="{accent}"/>
      <ellipse cx="6" cy="32" rx="5" ry="7" fill="{accent}"/>
      <ellipse cx="30" cy="32" rx="5" ry="7" fill="{accent}"/>
      <circle cx="18" cy="12" r="3" fill="{accent}"/>
      <path d="M16,9 Q14,4 12,6" stroke="{accent}" stroke-width="1.5" fill="none"/>
      <path d="M20,9 Q22,4 24,6" stroke="{accent}" stroke-width="1.5" fill="none"/>
    </g>''',
    # Hedgehog silhouette (cozy, friendly)
    'Other': '''<g transform="translate(32, 25)" opacity="0.85">
      <ellipse cx="18" cy="22" rx="16" ry="14" fill="{accent}"/>
      <path d="M5,15 L2,8 L8,12" fill="{accent}"/>
      <path d="M12,10 L10,2 L16,8" fill="{accent}"/>
      <path d="M20,8 L22,0 L26,6" fill="{accent}"/>
      <path d="M28,12 L34,6 L32,14" fill="{accent}"/>
      <circle cx="12" cy="20" r="2" fill="{secondary}"/>
      <circle cx="22" cy="20" r="2" fill="{secondary}"/>
      <ellipse cx="17" cy="26" rx="4" ry="3" fill="{secondary}"/>
    </g>''',
}

# Emotive icons for specific meeting themes (SVG paths)
EMOTIVE_ICONS = {
    # Fox at podium - speaker meetings
    'speaker': '''<g transform="translate(30, 18)" opacity="0.85">
      <rect x="12" y="35" width="16" height="20" rx="2" fill="{secondary}" opacity="0.6"/>
      <ellipse cx="20" cy="22" rx="10" ry="12" fill="{accent}"/>
      <polygon points="12,14 20,2 28,14" fill="{accent}"/>
      <circle cx="16" cy="19" r="2" fill="{secondary}"/>
      <circle cx="24" cy="19" r="2" fill="{secondary}"/>
      <path d="M30,28 L38,20" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>
    </g>''',
    # Surprised owl - bloopers
    'bloopers': '''<g transform="translate(30, 18)" opacity="0.85">
      <ellipse cx="20" cy="28" rx="16" ry="20" fill="{accent}"/>
      <circle cx="13" cy="22" r="8" fill="white"/>
      <circle cx="27" cy="22" r="8" fill="white"/>
      <circle cx="13" cy="22" r="5" fill="{secondary}"/>
      <circle cx="27" cy="22" r="5" fill="{secondary}"/>
      <ellipse cx="20" cy="36" rx="4" ry="3" fill="{secondary}"/>
      <path d="M5,10 Q10,5 15,12" stroke="{accent}" stroke-width="2" fill="none"/>
      <path d="M35,10 Q30,5 25,12" stroke="{accent}" stroke-width="2" fill="none"/>
      <path d="M8,40 Q4,50 12,48 Q8,55 18,50" stroke="{accent}" stroke-width="2" fill="{accent}" opacity="0.5"/>
    </g>''',
    # Warm mugs - discussion
    'discussion': '''<g transform="translate(25, 25)" opacity="0.85">
      <rect x="5" y="15" width="18" height="22" rx="3" fill="{accent}"/>
      <path d="M23,20 Q30,20 30,28 Q30,35 23,35" stroke="{accent}" stroke-width="2" fill="none"/>
      <rect x="27" y="15" width="18" height="22" rx="3" fill="{accent}" opacity="0.7"/>
      <path d="M45,20 Q52,20 52,28 Q52,35 45,35" stroke="{accent}" stroke-width="2" fill="none" opacity="0.7"/>
      <path d="M12,10 Q14,5 16,10" stroke="{secondary}" stroke-width="1.5" fill="none" opacity="0.6"/>
      <path d="M34,10 Q36,5 38,10" stroke="{secondary}" stroke-width="1.5" fill="none" opacity="0.5"/>
    </g>''',
    # Peaceful panda - meditation
    'meditation': '''<g transform="translate(30, 20)" opacity="0.85">
      <ellipse cx="20" cy="28" rx="16" ry="18" fill="white"/>
      <ellipse cx="20" cy="28" rx="16" ry="18" fill="{accent}" opacity="0.2"/>
      <ellipse cx="10" cy="22" rx="6" ry="5" fill="{secondary}"/>
      <ellipse cx="30" cy="22" rx="6" ry="5" fill="{secondary}"/>
      <path d="M8,24 Q12,22 16,24" stroke="{secondary}" stroke-width="1.5" fill="none"/>
      <path d="M24,24 Q28,22 32,24" stroke="{secondary}" stroke-width="1.5" fill="none"/>
      <ellipse cx="20" cy="32" rx="4" ry="2" fill="{secondary}"/>
      <circle cx="8" cy="12" r="6" fill="{secondary}"/>
      <circle cx="32" cy="12" r="6" fill="{secondary}"/>
    </g>''',
    # Party hedgehog - celebration
    'celebration': '''<g transform="translate(30, 15)" opacity="0.85">
      <ellipse cx="20" cy="32" rx="14" ry="12" fill="{accent}"/>
      <path d="M8,25 L4,16 L12,22" fill="{accent}"/>
      <path d="M16,22 L14,12 L20,20" fill="{accent}"/>
      <path d="M24,20 L28,10 L30,18" fill="{accent}"/>
      <polygon points="20,5 15,20 25,20" fill="{secondary}"/>
      <circle cx="15" cy="30" r="2" fill="{secondary}"/>
      <circle cx="25" cy="30" r="2" fill="{secondary}"/>
      <path d="M16,36 Q20,40 24,36" stroke="{secondary}" stroke-width="1.5" fill="none"/>
      <circle cx="8" cy="45" r="3" fill="{accent}" opacity="0.5"/>
      <circle cx="35" cy="40" r="2" fill="{accent}" opacity="0.4"/>
      <circle cx="40" cy="50" r="2.5" fill="{accent}" opacity="0.3"/>
    </g>''',
    # Welcoming bear - newcomer
    'newcomer': '''<g transform="translate(30, 18)" opacity="0.85">
      <ellipse cx="20" cy="28" rx="14" ry="16" fill="{accent}"/>
      <circle cx="10" cy="12" r="6" fill="{accent}"/>
      <circle cx="30" cy="12" r="6" fill="{accent}"/>
      <circle cx="14" cy="24" r="2.5" fill="{secondary}"/>
      <circle cx="26" cy="24" r="2.5" fill="{secondary}"/>
      <ellipse cx="20" cy="32" rx="5" ry="3" fill="{secondary}"/>
      <path d="M4,35 Q0,25 4,20" stroke="{accent}" stroke-width="4" stroke-linecap="round"/>
      <path d="M36,35 Q40,25 36,20" stroke="{accent}" stroke-width="4" stroke-linecap="round"/>
    </g>''',
    # Climbing turtle - steps
    'steps': '''<g transform="translate(25, 22)" opacity="0.85">
      <rect x="5" y="40" width="15" height="8" fill="{secondary}" opacity="0.4"/>
      <rect x="20" y="30" width="15" height="8" fill="{secondary}" opacity="0.5"/>
      <rect x="35" y="20" width="15" height="8" fill="{secondary}" opacity="0.6"/>
      <ellipse cx="32" cy="22" rx="10" ry="8" fill="{accent}"/>
      <circle cx="40" cy="18" r="5" fill="{accent}"/>
      <circle cx="42" cy="17" r="1.5" fill="{secondary}"/>
      <ellipse cx="25" cy="26" rx="3" ry="2" fill="{accent}"/>
      <ellipse cx="38" cy="26" rx="3" ry="2" fill="{accent}"/>
    </g>''',
    # Reading owl - literature
    'literature': '''<g transform="translate(28, 18)" opacity="0.85">
      <rect x="8" y="38" width="28" height="18" rx="2" fill="{secondary}" opacity="0.5"/>
      <rect x="10" y="40" width="24" height="14" fill="white" opacity="0.3"/>
      <ellipse cx="22" cy="25" rx="14" ry="16" fill="{accent}"/>
      <circle cx="16" cy="22" r="5" fill="white"/>
      <circle cx="28" cy="22" r="5" fill="white"/>
      <circle cx="16" cy="23" r="2.5" fill="{secondary}"/>
      <circle cx="28" cy="23" r="2.5" fill="{secondary}"/>
      <polygon points="22,28 19,34 25,34" fill="{secondary}"/>
      <rect x="14" cy="18" width="4" height="1.5" rx="0.5" fill="{secondary}" transform="rotate(-10, 16, 18)"/>
      <rect x="26" cy="18" width="4" height="1.5" rx="0.5" fill="{secondary}" transform="rotate(10, 28, 18)"/>
    </g>''',
}


def generate_meeting_hash(meeting):
    """Generate a deterministic hash from meeting data for consistent thumbnails."""
    key_data = f"{meeting.get('name', '')}-{meeting.get('meetingType', '')}-{meeting.get('city', '')}-{meeting.get('state', '')}"
    return hashlib.md5(key_data.encode()).hexdigest()[:12]


# Emotive scene mappings - character-based illustrations for different meeting themes
EMOTIVE_THEMES = {
    # Speaker/presentation meetings - heroic, inspiring vibes
    'speaker': {
        'keywords': ['speaker', 'speaking', 'talk', 'presentation', 'keynote', 'lecture', 'share'],
        'scene': 'adorable cartoon fox standing confidently at a podium with a gentle spotlight, inspiring pose with one paw raised, warm encouraging atmosphere',
        'mood': 'confident and inspiring'
    },
    # Fun/comedy meetings - playful and silly
    'bloopers': {
        'keywords': ['blooper', 'fun', 'funny', 'laugh', 'comedy', 'humor', 'silly', 'goofy', 'oops'],
        'scene': 'cute cartoon owl with surprised wide eyes and ruffled feathers, comically tangled in colorful streamers, playful oops moment',
        'mood': 'playful and lighthearted'
    },
    # Discussion/sharing meetings - cozy and intimate
    'discussion': {
        'keywords': ['discussion', 'share', 'sharing', 'talk', 'chat', 'conversation', 'story', 'stories'],
        'scene': 'cozy cartoon scene with warm mugs of cocoa on a table, soft cushions, gentle lamplight creating intimate atmosphere',
        'mood': 'warm and inviting'
    },
    # Meditation/mindfulness meetings - zen and peaceful
    'meditation': {
        'keywords': ['meditation', 'meditate', 'mindful', 'mindfulness', 'breathing', 'zen', 'reflect', 'reflection'],
        'scene': 'serene cartoon panda sitting peacefully on a lily pad, soft lotus flowers floating nearby, gentle ripples in calm water',
        'mood': 'peaceful and centered'
    },
    # Celebration/milestone meetings - joyful and festive
    'celebration': {
        'keywords': ['celebration', 'celebrate', 'birthday', 'anniversary', 'milestone', 'achievement', 'congrats', 'victory'],
        'scene': 'joyful cartoon hedgehog wearing a tiny party hat, surrounded by floating balloons and confetti, beaming with pride',
        'mood': 'joyful and celebratory'
    },
    # Newcomer/welcome meetings - warm and welcoming
    'newcomer': {
        'keywords': ['newcomer', 'welcome', 'first', 'introduction', 'intro', 'beginner', 'new member', 'orientation'],
        'scene': 'friendly cartoon bear holding an open door with warm light spilling out, welcoming gesture with cozy interior visible',
        'mood': 'welcoming and supportive'
    },
    # Step work meetings - journey and progress
    'steps': {
        'keywords': ['step', 'steps', '12 step', 'twelve step', 'working', 'work'],
        'scene': 'determined cartoon turtle climbing gentle stone steps in a garden, each step glowing softly, sense of steady progress',
        'mood': 'determined and hopeful'
    },
    # Literature/study meetings - thoughtful and curious
    'literature': {
        'keywords': ['literature', 'book', 'study', 'reading', 'big book', 'text', 'chapter'],
        'scene': 'wise cartoon owl perched on stack of cozy books, reading glasses slightly askew, surrounded by soft candlelight',
        'mood': 'thoughtful and curious'
    },
    # Women's meetings - empowering and supportive
    'women': {
        'keywords': ['women', 'woman', 'ladies', 'sisterhood', 'girls'],
        'scene': 'graceful cartoon butterflies in a circle formation, soft lavender and rose colors, garden of blooming flowers',
        'mood': 'empowering and nurturing'
    },
    # Men's meetings - strong and supportive
    'men': {
        'keywords': ['men', 'mans', 'mens', 'brotherhood', 'guys', 'stag'],
        'scene': 'strong cartoon oak tree with deep roots visible, protective branches forming a sheltering canopy, steady and grounded',
        'mood': 'strong and supportive'
    },
    # Young people meetings - energetic and vibrant
    'young': {
        'keywords': ['young', 'youth', 'teen', 'college', 'university', 'student'],
        'scene': 'energetic cartoon hummingbird mid-flight among vibrant wildflowers, sense of motion and possibility',
        'mood': 'energetic and hopeful'
    },
    # Gratitude meetings - thankful and warm
    'gratitude': {
        'keywords': ['gratitude', 'grateful', 'thankful', 'blessing', 'blessed', 'appreciation'],
        'scene': 'content cartoon squirrel hugging a golden acorn, autumn leaves gently falling, warm sunset glow',
        'mood': 'thankful and content'
    },
    # Solution/problem-solving meetings - clarity and insight
    'solution': {
        'keywords': ['solution', 'solve', 'answer', 'clarity', 'insight', 'breakthrough'],
        'scene': 'clever cartoon raccoon with a lightbulb glowing softly above head, moment of realization, gentle sparkles',
        'mood': 'insightful and clear'
    },
    # LGBTQ+ meetings - inclusive and colorful
    'lgbtq': {
        'keywords': ['lgbtq', 'lgbt', 'pride', 'rainbow', 'queer', 'inclusive'],
        'scene': 'cheerful cartoon chameleon in gentle rainbow gradient colors, sitting on a branch with heart-shaped leaves',
        'mood': 'inclusive and vibrant'
    },
    # Early morning meetings - fresh start energy
    'morning': {
        'keywords': ['sunrise', 'morning', 'dawn', 'early', 'breakfast', 'am', 'daybreak'],
        'scene': 'sleepy but hopeful cartoon rooster stretching toward a soft pink sunrise, dewdrops on grass, fresh new day',
        'mood': 'fresh and hopeful'
    },
    # Evening/night meetings - reflective and calm
    'evening': {
        'keywords': ['sunset', 'evening', 'night', 'dusk', 'twilight', 'pm', 'late'],
        'scene': 'peaceful cartoon fireflies glowing gently in a dusky meadow, crescent moon rising, calm end of day',
        'mood': 'reflective and peaceful'
    },
}


def generate_ai_prompt(meeting):
    """Generate a descriptive prompt for AI image generation based on meeting data.

    Creates emotive, character-based illustrations that are simple but expressive.
    Uses cute animal characters and scenes to convey the meeting's mood and purpose.
    """
    meeting_name = meeting.get('name', '')
    meeting_type = meeting.get('meetingType', 'AA')
    city = meeting.get('city', '')
    state = meeting.get('state', '')
    is_online = meeting.get('isOnline', False)

    # Soft, expressive style - not loud but emotive
    style = "soft watercolor illustration style, gentle pastel colors, expressive cartoon character, warm and inviting, simple composition, subtle emotions, Studio Ghibli inspired gentleness, cozy atmosphere"

    # Extract keywords from meeting name for imagery
    name_lower = meeting_name.lower() if meeting_name else ''

    scene_elements = []
    mood = None

    # First, check for emotive themes (character-based)
    matched_theme = None
    for theme_name, theme_data in EMOTIVE_THEMES.items():
        if any(keyword in name_lower for keyword in theme_data['keywords']):
            matched_theme = theme_data
            break

    if matched_theme:
        scene_elements.append(matched_theme['scene'])
        mood = matched_theme['mood']

    # If no emotive theme matched, fall back to nature/location-based scenes
    if not scene_elements:
        # Nature/outdoor keywords with emotive characters
        if any(word in name_lower for word in ['mountain', 'hill', 'peak', 'summit']):
            scene_elements.append('brave cartoon mountain goat standing atop gentle peaks, gazing at horizon with quiet determination')
            mood = 'adventurous and determined'
        elif any(word in name_lower for word in ['beach', 'ocean', 'sea', 'coast', 'shore']):
            scene_elements.append('content cartoon sea turtle gliding through crystal clear waters, peaceful expression, gentle waves')
            mood = 'peaceful and free'
        elif any(word in name_lower for word in ['lake', 'river', 'water', 'stream']):
            scene_elements.append('serene cartoon frog sitting on lily pad, watching dragonflies dance over calm reflective water')
            mood = 'tranquil and present'
        elif any(word in name_lower for word in ['garden', 'flower', 'bloom', 'rose']):
            scene_elements.append('gentle cartoon bunny among blooming flowers, nose twitching happily, soft petals floating')
            mood = 'gentle and growing'
        elif any(word in name_lower for word in ['forest', 'tree', 'wood', 'grove']):
            scene_elements.append('curious cartoon deer peeking through friendly forest trees, dappled sunlight, mushrooms dotting the ground')
            mood = 'curious and grounded'
        elif any(word in name_lower for word in ['park', 'meadow', 'field', 'grass']):
            scene_elements.append('happy cartoon mouse having a picnic in sunny meadow, tiny blanket with acorn treats')
            mood = 'carefree and content'

        # Celestial/time keywords
        elif any(word in name_lower for word in ['star', 'moon', 'night', 'sky']):
            scene_elements.append('dreamy cartoon bat with big gentle eyes watching shooting stars, wrapped in cozy wings')
            mood = 'dreamy and wonder-filled'
        elif any(word in name_lower for word in ['sun', 'bright', 'light', 'shine']):
            scene_elements.append('cheerful cartoon sunflower with a subtle smile, face turned toward warm gentle sunbeams')
            mood = 'bright and optimistic'

        # Hope/recovery keywords with emotive characters
        elif any(word in name_lower for word in ['hope', 'new', 'fresh', 'start', 'beginning', 'restart']):
            scene_elements.append('tiny cartoon sprout pushing through soil with determined expression, first rays of sunlight touching leaves')
            mood = 'hopeful and resilient'
        elif any(word in name_lower for word in ['serenity', 'peace', 'calm', 'tranquil', 'quiet']):
            scene_elements.append('zen cartoon sloth hanging peacefully from branch, eyes closed in contentment, gentle breeze')
            mood = 'serene and present'
        elif any(word in name_lower for word in ['strength', 'strong', 'courage', 'brave', 'power']):
            scene_elements.append('noble cartoon lion cub with gentle but confident expression, small mane blowing in breeze')
            mood = 'strong and courageous'
        elif any(word in name_lower for word in ['together', 'unity', 'group', 'circle', 'community']):
            scene_elements.append('circle of different cartoon animals holding paws around warm campfire, sense of belonging')
            mood = 'connected and supported'
        elif any(word in name_lower for word in ['heart', 'love', 'care', 'compassion']):
            scene_elements.append('caring cartoon elephant gently cradling a tiny bird in trunk, tender moment of kindness')
            mood = 'loving and compassionate'
        elif any(word in name_lower for word in ['path', 'way', 'road', 'journey', 'walk']):
            scene_elements.append('determined cartoon caterpillar on leaf bridge over stream, looking toward distant butterfly silhouette')
            mood = 'journeying and transforming'
        elif any(word in name_lower for word in ['bridge', 'cross', 'connect']):
            scene_elements.append('two cartoon otters meeting in the middle of a log bridge, paws touching in greeting')
            mood = 'bridging and connecting'
        elif any(word in name_lower for word in ['freedom', 'free', 'soar', 'fly']):
            scene_elements.append('joyful cartoon bird with wings spread wide against soft clouds, expression of pure freedom')
            mood = 'free and unburdened'
        elif any(word in name_lower for word in ['heal', 'healing', 'recover', 'recovery']):
            scene_elements.append('gentle cartoon phoenix chick emerging from soft embers, tiny wings beginning to glow with new life')
            mood = 'healing and renewing'

    # Location-based fallback with regional character themes
    if not scene_elements and (city or state):
        if state in ['CA', 'California']:
            scene_elements.append('laid-back cartoon sea otter floating on back among kelp, watching pacific sunset')
            mood = 'relaxed and coastal'
        elif state in ['AZ', 'Arizona']:
            scene_elements.append('wise cartoon roadrunner pausing on desert rock, saguaro cacti silhouetted against warm sky')
            mood = 'resilient and warm'
        elif state in ['CO', 'Colorado']:
            scene_elements.append('adventurous cartoon chipmunk atop rocky mountain overlook, tiny hiking pack')
            mood = 'adventurous and elevated'
        elif state in ['FL', 'Florida']:
            scene_elements.append('cheerful cartoon manatee floating in crystal springs, surrounded by gentle bubbles')
            mood = 'gentle and tropical'
        elif state in ['NY', 'New York']:
            scene_elements.append('friendly cartoon pigeon in cozy central park setting, autumn leaves falling softly')
            mood = 'urban and connected'
        elif state in ['TX', 'Texas']:
            scene_elements.append('proud cartoon armadillo under big starry Texas sky, bluebonnets blooming')
            mood = 'proud and expansive'
        elif state in ['WA', 'Washington']:
            scene_elements.append('thoughtful cartoon salmon leaping through misty waterfall, evergreen forest backdrop')
            mood = 'determined and fresh'
        elif state in ['OR', 'Oregon']:
            scene_elements.append('quirky cartoon beaver building by peaceful stream, moss-covered trees')
            mood = 'industrious and natural'
        else:
            scene_elements.append('friendly cartoon robin on fence post overlooking rolling countryside, gentle breeze')
            mood = 'grounded and hopeful'

    # Default emotive scene if nothing matched
    if not scene_elements:
        scene_elements.append('warm cartoon hedgehog curled up by window, soft rain outside, cup of tea nearby, peaceful contentment')
        mood = 'cozy and safe'

    # Meeting type color accents (subtle, not overwhelming)
    type_colors = {
        'AA': 'soft blue and warm gold accents',
        'NA': 'gentle green and teal accents',
        'Al-Anon': 'soft purple and lavender accents',
        'Other': 'warm peach and soft yellow accents',
    }
    colors = type_colors.get(meeting_type, type_colors['Other'])

    # Online meeting subtle modifier
    if is_online:
        scene_elements.append('with soft glowing connection lines in background')

    scene = ', '.join(scene_elements)

    # Build prompt with emotive guidance
    mood_guidance = f"Convey a {mood} feeling." if mood else ""

    prompt = f"{scene}, {colors}, {style}. {mood_guidance} No text, no words, no letters. Keep it simple and expressive. Safe for all audiences, family friendly."

    return prompt


def get_emotive_icon_for_meeting(meeting, colors):
    """Get the appropriate emotive icon based on meeting name keywords."""
    meeting_name = meeting.get('name', '')
    name_lower = meeting_name.lower() if meeting_name else ''

    # Check for emotive theme keywords
    emotive_keyword_map = {
        'speaker': ['speaker', 'speaking', 'talk', 'presentation', 'keynote', 'lecture'],
        'bloopers': ['blooper', 'fun', 'funny', 'laugh', 'comedy', 'humor', 'silly', 'goofy', 'oops'],
        'discussion': ['discussion', 'sharing', 'chat', 'conversation', 'story', 'stories'],
        'meditation': ['meditation', 'meditate', 'mindful', 'mindfulness', 'breathing', 'zen', 'reflect'],
        'celebration': ['celebration', 'celebrate', 'birthday', 'anniversary', 'milestone', 'achievement'],
        'newcomer': ['newcomer', 'welcome', 'introduction', 'intro', 'beginner', 'orientation'],
        'steps': ['step', 'steps', '12 step', 'twelve step'],
        'literature': ['literature', 'book', 'study', 'reading', 'big book', 'text', 'chapter'],
    }

    for theme, keywords in emotive_keyword_map.items():
        if any(keyword in name_lower for keyword in keywords):
            if theme in EMOTIVE_ICONS:
                return EMOTIVE_ICONS[theme].format(**colors)

    # Fall back to meeting type icon
    meeting_type = meeting.get('meetingType', 'AA')
    if meeting_type not in MEETING_TYPE_ICONS:
        meeting_type = 'Other'
    return MEETING_TYPE_ICONS[meeting_type].format(**colors)


def generate_svg_placeholder(meeting):
    """Generate an SVG placeholder thumbnail - instant, no API needed.

    Uses emotive character-based icons that match the meeting theme.
    """
    meeting_type = meeting.get('meetingType', 'AA')
    if meeting_type not in MEETING_TYPE_COLORS:
        meeting_type = 'Other'

    colors = MEETING_TYPE_COLORS[meeting_type]

    # Get appropriate emotive icon based on meeting name
    icon = get_emotive_icon_for_meeting(meeting, colors)

    # Use meeting hash for unique gradient angle
    meeting_hash = generate_meeting_hash(meeting)
    angle = int(meeting_hash[:2], 16) % 360

    # Generate unique pattern based on hash
    hash_int = int(meeting_hash, 16)
    pattern_opacity = 0.03 + (hash_int % 8) / 100  # Subtle pattern

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 100 75">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate({angle})">
      <stop offset="0%" style="stop-color:{colors['primary']};stop-opacity:1" />
      <stop offset="50%" style="stop-color:{colors['secondary']};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{colors['primary']};stop-opacity:0.9" />
    </linearGradient>
    <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="0.8" fill="white" opacity="{pattern_opacity}"/>
    </pattern>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0.3"/>
    </filter>
  </defs>
  <rect width="100" height="75" fill="url(#bg)"/>
  <rect width="100" height="75" fill="url(#dots)"/>
  <g filter="url(#soft)">
    {icon}
  </g>
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
