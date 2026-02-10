# 🌍 Contour - 3D Terrain Explorer

**Transform any location on Earth into a stunning, explorable 3D terrain with real satellite imagery, flood simulation, and cinematic tours.**

Built with 💖 by **Mithun**

---

## ✨ Features

### 🛰️ Satellite Imagery

- Real satellite textures from ESRI World Imagery
- Automatic loading for photorealistic terrains

### 🌊 Flood Simulation

- Animated water level rising from lowest elevation
- Shows real-time altitude and flooded area percentage
- Watch water fill valleys like a real flood!

### 🎬 Cinematic Tour Mode

- AI-generated scenic camera paths
- Smooth camera interpolation
- Adjustable speed (0.5× to 2×)
- Perfect for showcasing landscapes

### 📍 Peak Markers

- Automatic detection of mountain peaks
- Floating labels with names and elevations
- Data from OpenStreetMap

### 📏 Measurement Tools

- Click-to-measure distances
- Elevation profile visualization
- Shows gain/loss statistics

### ✈️ Advanced Fly Mode

- WASD flight controls
- Speed up (Shift) / Slow down (Ctrl)
- Altitude controls (Space/C)
- Terrain collision avoidance

### 🔍 Smart Search

- Search any location worldwide
- Quick-start famous places
- Real-time weather data

### 🎤 Voice Tour Guide

- Talk to Gemini AI about the terrain
- Real-time voice conversation
- Context-aware responses

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/Mithuncoding/contour.git
cd contour

# Setup
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# Install & Run
uv sync
uv run python run.py
```

Open http://localhost:8000

---

## 🎮 Controls

| Mode      | Control | Action         |
| --------- | ------- | -------------- |
| **Orbit** | Drag    | Rotate view    |
| **Orbit** | Scroll  | Zoom in/out    |
| **Fly**   | WASD    | Pitch and turn |
| **Fly**   | Shift   | Speed up       |
| **Fly**   | Ctrl    | Slow down      |
| **Fly**   | Space   | Climb          |
| **Fly**   | C       | Descend        |

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JS + Three.js
- **Backend**: FastAPI + Python
- **Elevation**: AWS Terrain Tiles
- **Satellite**: ESRI World Imagery
- **Peaks**: OpenStreetMap Overpass API
- **AI**: Google Gemini API

---

## 📁 Project Structure

```
contour/
├── backend/
│   ├── main.py           # FastAPI routes & endpoints
│   ├── terrain.py        # GeoTIFF processing
│   └── gemini_client.py  # Gemini API integration
├── frontend/
│   ├── index.html        # Main UI
│   ├── app.js            # Three.js scene & features
│   ├── voice.js          # Voice chat module
│   └── style.css         # Styling
└── run.py                # Entry point
```

---

## 🌟 APIs Used (All Free)

| API                    | Purpose            |
| ---------------------- | ------------------ |
| AWS Terrain Tiles      | Elevation data     |
| ESRI World Imagery     | Satellite textures |
| OpenStreetMap Overpass | Peak data          |
| Open-Meteo             | Weather data       |
| Nominatim              | Location search    |
| Google Gemini          | AI features        |

---

## 📸 Screenshots

Coming soon...

---

## 🙏 Credits

- Elevation: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
- Satellite: [ESRI World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)
- 3D Engine: [Three.js](https://threejs.org/)
- AI: [Google Gemini](https://ai.google.dev/)

---

<p align="center">
  Built with 💖 by <strong>Mithun</strong>
</p>
