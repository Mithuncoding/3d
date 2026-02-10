"""
Contour - FastAPI Backend
World-Class 3D Terrain Explorer
"""

import os
import uuid
import shutil
import httpx
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from . import terrain
from . import gemini_client

# Load environment variables
load_dotenv()

# Setup paths
BASE_DIR = Path(__file__).parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Create FastAPI app
app = FastAPI(title="Contour", description="World-Class 3D Terrain Explorer")

# Serve frontend static files
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend"), name="static")


# Request models
class LocationInfoRequest(BaseModel):
    name: str
    lat: float
    lon: float


class BoundsRequest(BaseModel):
    north: float
    south: float
    east: float
    west: float


@app.get("/")
async def root():
    """Serve the stunning landing page."""
    return FileResponse(BASE_DIR / "frontend" / "landing.html")


@app.get("/app")
async def main_app():
    """Serve the main 3D terrain explorer app."""
    return FileResponse(BASE_DIR / "frontend" / "index.html")



@app.get("/api/search")
async def search_location(q: str = Query(..., min_length=2)):
    """
    Search for locations using Nominatim (OpenStreetMap) API.
    Free geocoding service - 1 request per second limit.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": q,
                    "format": "json",
                    "limit": 8,
                    "addressdetails": 1
                },
                headers={
                    "User-Agent": "Contour3DTerrainExplorer/1.0"
                },
                timeout=10.0
            )
            response.raise_for_status()
            results = response.json()
            
            # Transform results for frontend
            locations = []
            for r in results:
                locations.append({
                    "name": r.get("display_name", ""),
                    "lat": float(r.get("lat", 0)),
                    "lon": float(r.get("lon", 0)),
                    "type": r.get("type", ""),
                    "importance": r.get("importance", 0)
                })
            
            return JSONResponse({"success": True, "results": locations})
    except Exception as e:
        raise HTTPException(500, f"Search error: {str(e)}")


@app.get("/api/famous-places")
async def get_famous_places():
    """Return list of famous places for quick selection."""
    places = [
        {"name": "Mount Everest", "lat": 27.9881, "lon": 86.9250, "zoom": 12},
        {"name": "Grand Canyon", "lat": 36.0544, "lon": -112.1401, "zoom": 11},
        {"name": "Swiss Alps - Matterhorn", "lat": 45.9763, "lon": 7.6586, "zoom": 12},
        {"name": "Himalayan Range", "lat": 28.0025, "lon": 86.8528, "zoom": 10},
        {"name": "Mount Fuji", "lat": 35.3606, "lon": 138.7274, "zoom": 12},
        {"name": "Yosemite Valley", "lat": 37.7456, "lon": -119.5936, "zoom": 12},
        {"name": "Norwegian Fjords", "lat": 61.2176, "lon": 6.8359, "zoom": 11},
        {"name": "Machu Picchu", "lat": -13.1631, "lon": -72.5450, "zoom": 13},
        {"name": "Table Mountain, Cape Town", "lat": -33.9628, "lon": 18.4098, "zoom": 13},
        {"name": "Zhangjiajie, China", "lat": 29.3249, "lon": 110.4343, "zoom": 12},
        {"name": "Dolomites, Italy", "lat": 46.4102, "lon": 11.8440, "zoom": 11},
        {"name": "Iceland Highlands", "lat": 64.1466, "lon": -21.9426, "zoom": 10},
        {"name": "Kilimanjaro", "lat": -3.0674, "lon": 37.3556, "zoom": 11},
        {"name": "Patagonia", "lat": -50.9423, "lon": -73.4068, "zoom": 11},
        {"name": "Death Valley", "lat": 36.5054, "lon": -117.0794, "zoom": 11},
    ]
    return JSONResponse({"success": True, "places": places})


@app.get("/api/weather")
async def get_weather(lat: float, lon: float):
    """
    Get weather data using Open-Meteo API (free, no API key needed).
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
                    "timezone": "auto"
                },
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            
            current = data.get("current", {})
            
            # Weather code to description
            weather_codes = {
                0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
                45: "Foggy", 48: "Depositing rime fog",
                51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
                61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
                71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
                77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers",
                82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
                95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
            }
            
            weather_code = current.get("weather_code", 0)
            
            return JSONResponse({
                "success": True,
                "weather": {
                    "temperature": current.get("temperature_2m"),
                    "humidity": current.get("relative_humidity_2m"),
                    "wind_speed": current.get("wind_speed_10m"),
                    "wind_direction": current.get("wind_direction_10m"),
                    "condition": weather_codes.get(weather_code, "Unknown"),
                    "code": weather_code
                }
            })
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e),
            "weather": None
        })


@app.post("/api/location-info")
async def get_location_info(request: LocationInfoRequest):
    """
    Get AI-generated information about a location using Gemini.
    """
    try:
        info = await gemini_client.generate_location_info(
            request.name, request.lat, request.lon
        )
        return JSONResponse({"success": True, "info": info})
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e),
            "info": {
                "title": request.name,
                "description": "Explore this terrain in 3D.",
                "facts": [],
                "highlights": []
            }
        })


@app.post("/api/upload")
async def upload_map(file: UploadFile = File(...)):
    """
    Upload a map file (GeoTIFF or image).
    Returns texture and bounds (if GeoTIFF).
    """
    # Validate file type
    allowed_extensions = {".tif", ".tiff", ".jpg", ".jpeg", ".png", ".webp"}
    ext = Path(file.filename).suffix.lower()
    
    if ext not in allowed_extensions:
        raise HTTPException(400, f"Invalid file type. Allowed: {allowed_extensions}")
    
    # Save file
    file_id = str(uuid.uuid4())[:8]
    save_path = UPLOADS_DIR / f"{file_id}{ext}"
    
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Process based on file type
    try:
        if ext in {".tif", ".tiff"}:
            # GeoTIFF - extract bounds and texture
            data = terrain.extract_geotiff_data(str(save_path))
            return JSONResponse({
                "success": True,
                "file_id": file_id,
                "bounds": data["bounds"],
                "texture_b64": data["texture_b64"],
                "width": data["width"],
                "height": data["height"],
                "has_bounds": True,
            })
        else:
            # Regular image - just extract texture
            data = terrain.extract_from_image(str(save_path))
            return JSONResponse({
                "success": True,
                "file_id": file_id,
                "texture_b64": data["texture_b64"],
                "width": data["width"],
                "height": data["height"],
                "has_bounds": False,
            })
    except Exception as e:
        raise HTTPException(500, f"Processing error: {str(e)}")


@app.post("/api/extract-bounds")
async def extract_bounds(file_id: str):
    """
    Use Gemini to extract bounds from an uploaded image.
    """
    # Find the file
    files = list(UPLOADS_DIR.glob(f"{file_id}.*"))
    if not files:
        raise HTTPException(404, "File not found")
    
    file_path = files[0]
    
    try:
        bounds = await gemini_client.extract_bounds_from_image(str(file_path))
        return JSONResponse({
            "success": True,
            "bounds": bounds
        })
    except Exception as e:
        raise HTTPException(500, f"Gemini error: {str(e)}")


@app.post("/api/narrate")
async def narrate(location_info: dict, features: list[str] = []):
    """
    Generate narration for current flyover position.
    """
    try:
        narration = await gemini_client.generate_narration(location_info, features)
        return JSONResponse({
            "success": True,
            "narration": narration
        })
    except Exception as e:
        raise HTTPException(500, f"Gemini error: {str(e)}")


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "gemini": gemini_client.HAS_GEMINI}


@app.get("/api/gemini-key")
async def get_gemini_key():
    """Return Gemini API key for client-side Live API (demo only - not production safe)."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(500, "GEMINI_API_KEY not configured")
    return {"key": key}


@app.post("/api/peaks")
async def get_peaks(request: BoundsRequest):
    """
    Get mountain peaks within bounds using OpenStreetMap Overpass API (free).
    Returns peaks with name and elevation.
    """
    try:
        # Overpass query for natural=peak within bounding box
        query = f"""
        [out:json][timeout:25];
        (
          node["natural"="peak"]({request.south},{request.west},{request.north},{request.east});
        );
        out body;
        """
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            peaks = []
            for element in data.get("elements", []):
                tags = element.get("tags", {})
                # Prefer English name, fallback to default name
                name = tags.get("name:en") or tags.get("name", "")
                if name:  # Only include named peaks
                    elevation = tags.get("ele", "")
                    try:
                        elevation = float(elevation) if elevation else None
                    except ValueError:
                        elevation = None
                    
                    peaks.append({
                        "name": name,
                        "lat": element.get("lat"),
                        "lon": element.get("lon"),
                        "elevation": elevation
                    })
            
            # Sort by elevation (highest first), limit to top 20
            peaks.sort(key=lambda x: x.get("elevation") or 0, reverse=True)
            peaks = peaks[:20]
            
            return JSONResponse({"success": True, "peaks": peaks})
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e),
            "peaks": []
        })


@app.get("/api/satellite-tile")
async def get_satellite_tile(z: int, x: int, y: int):
    """
    Proxy satellite/aerial imagery tiles from free sources.
    Uses ESRI World Imagery (free for visualization).
    """
    try:
        # ESRI World Imagery - free for visualization
        tile_url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                tile_url,
                headers={"User-Agent": "Contour3DTerrainExplorer/1.0"},
                timeout=15.0
            )
            response.raise_for_status()
            
            from fastapi.responses import Response
            return Response(
                content=response.content,
                media_type="image/jpeg"
            )
    except Exception as e:
        raise HTTPException(500, f"Tile fetch error: {str(e)}")


@app.post("/api/tour-waypoints")
async def generate_tour_waypoints(request: BoundsRequest):
    """
    Generate scenic tour waypoints using AI.
    Creates a cinematic camera path over the terrain.
    """
    try:
        # Use Gemini to generate interesting tour waypoints
        prompt = f"""You are a cinematographer planning a scenic drone flight over terrain.
        
Bounding box: North={request.north:.4f}, South={request.south:.4f}, East={request.east:.4f}, West={request.west:.4f}

Generate 6 waypoints for a cinematic camera tour. Each waypoint should have:
- A position (x, y, z) where x/z are -50 to 50 terrain units and y is altitude 15-60
- A look-at target (x, y, z)
- Duration in seconds (3-8 seconds per segment)

Return ONLY a JSON array like:
[
  {{"position": [x, y, z], "target": [x, y, z], "duration": 5}},
  ...
]

Create a varied, interesting path that:
1. Starts high with a wide view
2. Swoops down near interesting terrain features  
3. Does a dramatic reveal at the end
4. Varies altitude and viewing angles
"""
        
        if gemini_client.HAS_GEMINI:
            client = gemini_client.get_client()
            response = await client.aio.models.generate_content(
                model=gemini_client.MODEL_NAME,
                contents=[prompt]
            )
            
            import json
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            try:
                waypoints = json.loads(text.strip())
                return JSONResponse({"success": True, "waypoints": waypoints})
            except json.JSONDecodeError:
                pass
        
        # Fallback: generate default scenic path
        default_waypoints = [
            {"position": [0, 50, 40], "target": [0, 0, 0], "duration": 5},
            {"position": [30, 35, 30], "target": [0, 5, 0], "duration": 6},
            {"position": [40, 20, 0], "target": [10, 10, -10], "duration": 5},
            {"position": [20, 25, -35], "target": [0, 5, 0], "duration": 6},
            {"position": [-30, 30, -20], "target": [0, 10, 0], "duration": 5},
            {"position": [0, 45, 35], "target": [0, 0, 0], "duration": 6}
        ]
        
        return JSONResponse({"success": True, "waypoints": default_waypoints})
    except Exception as e:
        return JSONResponse({
            "success": False,
            "error": str(e),
            "waypoints": []
        })

