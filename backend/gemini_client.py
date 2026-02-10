"""
Gemini API client for terrain explorer features
"""

import os
import base64
from pathlib import Path

# Try to import Gemini SDK
try:
    from google import genai
    from google.genai import types
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False
    print("Warning: google-genai not installed. Gemini features disabled.")

# Model to use - latest Gemini 3 Flash (Preview)
MODEL_NAME = "gemini-3-flash-preview"


def get_client():
    """Get configured Gemini client."""
    if not HAS_GEMINI:
        raise RuntimeError("google-genai package required")
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment")
    
    return genai.Client(api_key=api_key)


async def extract_bounds_from_image(image_path: str) -> dict:
    """
    Use Gemini to extract geographic bounds from a map image.
    
    Returns: {"north": float, "south": float, "east": float, "west": float}
    """
    client = get_client()
    
    with open(image_path, "rb") as f:
        image_data = f.read()
    
    ext = Path(image_path).suffix.lower()
    mime_type = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    
    prompt = """Analyze this topographic map and extract the geographic bounding box.

Look for:
- Latitude/longitude markings on the map borders
- Graticule lines (grid lines showing coordinates)
- Any coordinate text visible on the map

Return ONLY a JSON object in this exact format, no other text:
{"north": 22.5, "south": 21.5, "east": -159.0, "west": -160.0}

Use decimal degrees. West longitudes are negative. Be as precise as possible."""

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=[
            types.Part.from_bytes(data=image_data, mime_type=mime_type),
            prompt
        ]
    )
    
    # Parse JSON from response
    import json
    text = response.text.strip()
    
    # Handle markdown code blocks
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    return json.loads(text.strip())


async def generate_narration(location_info: dict, visible_features: list[str]) -> str:
    """
    Generate a short narration for the current view during flyover.
    
    Args:
        location_info: {"lat": float, "lon": float, "elevation": float}
        visible_features: List of feature names visible in current view
    
    Returns: Narration text (1-2 sentences)
    """
    client = get_client()
    
    prompt = f"""You are a knowledgeable tour guide narrating a scenic flyover.

Current position: {location_info.get('lat', 'unknown')}°N, {location_info.get('lon', 'unknown')}°W
Elevation: {location_info.get('elevation', 'unknown')}m
Visible features: {', '.join(visible_features) if visible_features else 'general terrain'}

Generate a brief, engaging narration (1-2 sentences) about what the viewer is seeing.
Focus on interesting geographic, historical, or natural facts.
Be conversational and enthusiastic but not over the top."""

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt]
    )
    
    return response.text.strip()


async def generate_location_info(location_name: str, lat: float, lon: float) -> dict:
    """
    Generate comprehensive, engaging information about a location using Gemini.
    
    Returns: {"title": str, "description": str, "facts": list[str], "highlights": list[str]}
    """
    client = get_client()
    
    prompt = f"""You are a world-class geographic expert, historian, and travel writer. Create comprehensive, engaging information about this location.

Location: {location_name}
Coordinates: {lat:.4f}°, {lon:.4f}°

Generate rich, fascinating content that would appear in a premium travel documentary or National Geographic article.

Return a JSON object with:
{{
    "title": "Official/common name, include alt names if famous (e.g., 'Mount Everest (Sagarmatha / Chomolungma)')",
    "description": "4-6 sentence vivid, engaging description that paints a picture of this place. Include sensory details, what makes it special, and why people are drawn here.",
    "facts": [
        "🏔️ [Geology/Geography fact with specific numbers]",
        "📜 [Historical fact with dates and names]", 
        "🌍 [Global significance or records]",
        "🦅 [Wildlife or ecosystem fact]",
        "👥 [Cultural or human interest fact]",
        "⚡ [Surprising or mind-blowing fact]"
    ],
    "highlights": [
        "🎯 [Must-see feature or viewpoint]",
        "📸 [Best photo opportunity]",
        "🚶 [Notable trail or route]"
    ],
    "elevation_info": "Detailed terrain description - elevation range, notable peaks, valleys, geological formations",
    "best_time": "Best time to visit and why",
    "fun_fact": "One fascinating fact that most people don't know"
}}

Make it educational, inspiring, and memorable. Use emojis for facts/highlights. Only return the JSON."""

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt]
    )
    
    import json
    text = response.text.strip()
    
    # Handle markdown code blocks
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return {
            "title": location_name,
            "description": "Explore this fascinating terrain in 3D. This location offers unique geographic features waiting to be discovered.",
            "facts": ["🌍 Loading detailed information..."],
            "highlights": [],
            "elevation_info": "",
            "best_time": "",
            "fun_fact": ""
        }

