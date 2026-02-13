/**
 * Contour - World-Class 3D Terrain Explorer
 * Main Application Logic
 */

// ===========================================
// STATE
// ===========================================
const state = {
  scene: null,
  camera: null,
  renderer: null,
  terrain: null,
  sun: null,
  ambientLight: null,

  // Data
  fileId: null,
  bounds: null,
  textureB64: null,
  heightmapB64: null,
  currentLocation: null,
  elevationData: null,
  elevationMin: 0,
  elevationMax: 1000,

  // Textures
  colorTexture: null,
  heightmapTexture: null,
  satelliteTexture: null,

  // Camera
  cameraMode: "orbit",
  orbitAngle: 0,
  orbitRadius: 120,
  orbitPhi: Math.PI / 4,
  isDragging: false,
  lastMouse: { x: 0, y: 0 },
  keys: {},

  // Plane mode
  plane: null,
  planeModel: null,
  planeMode: false,
  planeAudio: null,

  // Time of day
  timeOfDay: "noon",

  // Search
  searchTimeout: null,

  // New Features
  satelliteMode: false,
  peaksVisible: false,
  peakMarkers: [],
  peakSprites: [],

  // Measurement
  measureMode: false,
  measurePoints: [],
  measureLine: null,
  measureLabels: [],

  // Tour Mode
  tourMode: false,
  tourPlaying: false,
  tourWaypoints: [],
  tourCurrentIndex: 0,
  tourProgress: 0,
  tourSpeed: 1,
  tourCurve: null,
  tourTargetCurve: null,
  tourDuration: 40,

  // Water/Flood Simulation
  waterPlane: null,
  waterLevel: 0,
  waterAnimating: false,
  waterTargetLevel: 0,

  // Advanced Fly Mode
  flySpeed: 5,
  flyAltitude: 20,
  terrainFollowing: false,

  // Video Recording
  isRecording: false,
  mediaRecorder: null,
  recordedChunks: [],
  recordingStartTime: null,
};

// Time of day lighting presets
const TIME_PRESETS = {
  dawn: {
    sunColor: 0xffaa77,
    ambientColor: 0x443355,
    ambientIntensity: 0.4,
    sunIntensity: 0.8,
    azimuth: 80,
    elevation: 15,
    bgColor: 0x1a1525,
  },
  noon: {
    sunColor: 0xffffff,
    ambientColor: 0x87ceeb,
    ambientIntensity: 0.5,
    sunIntensity: 1.2,
    azimuth: 135,
    elevation: 65,
    bgColor: 0x0a1628,
  },
  golden: {
    sunColor: 0xffcc44,
    ambientColor: 0x664422,
    ambientIntensity: 0.45,
    sunIntensity: 1.0,
    azimuth: 240,
    elevation: 25,
    bgColor: 0x1a1418,
  },
  sunset: {
    sunColor: 0xff6633,
    ambientColor: 0x442233,
    ambientIntensity: 0.35,
    sunIntensity: 0.9,
    azimuth: 260,
    elevation: 10,
    bgColor: 0x1a1020,
  },
  night: {
    sunColor: 0x4466aa,
    ambientColor: 0x111133,
    ambientIntensity: 0.25,
    sunIntensity: 0.3,
    azimuth: 180,
    elevation: 45,
    bgColor: 0x050510,
  },
};

// Famous places for quick start
const QUICK_START_PLACES = {
  everest: { name: "Mount Everest", lat: 27.9881, lon: 86.925 },
  "grand-canyon": { name: "Grand Canyon", lat: 36.0544, lon: -112.1401 },
  alps: { name: "Swiss Alps - Matterhorn", lat: 45.9763, lon: 7.6586 },
  fuji: { name: "Mount Fuji", lat: 35.3606, lon: 138.7274 },
};

// ===========================================
// INITIALIZATION
// ===========================================
function init() {
  const container = document.getElementById("container");

  // Scene
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x000000);

  // Camera
  state.camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000,
  );
  updateOrbitCamera();

  // Renderer
  state.renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(state.renderer.domElement);

  // Lighting
  state.ambientLight = new THREE.AmbientLight(0x87ceeb, 0.5);
  state.scene.add(state.ambientLight);

  state.sun = new THREE.DirectionalLight(0xffffff, 1.2);
  state.sun.position.set(-100, 150, 100);
  state.sun.target.position.set(0, 0, 0);
  state.scene.add(state.sun.target);

  state.sun.castShadow = true;
  state.sun.shadow.mapSize.width = 2048;
  state.sun.shadow.mapSize.height = 2048;
  state.sun.shadow.camera.left = -75;
  state.sun.shadow.camera.right = 75;
  state.sun.shadow.camera.top = 75;
  state.sun.shadow.camera.bottom = -75;
  state.sun.shadow.camera.near = 1;
  state.sun.shadow.camera.far = 400;
  state.sun.shadow.bias = 0;
  state.scene.add(state.sun);


  // Initialize plane audio
  state.planeAudio = new Audio("/static/assets/plane.mp3");
  state.planeAudio.loop = true;
  state.planeAudio.volume = 0.5;

  // Load plane model
  const gltfLoader = new THREE.GLTFLoader();
  gltfLoader.load("/static/assets/plane.glb", (gltf) => {
    state.plane = new THREE.Object3D();
    state.planeModel = gltf.scene;
    state.planeModel.scale.set(0.25, 0.25, 0.25);
    state.planeModel.rotation.y = Math.PI / 2;
    state.plane.add(state.planeModel);
    state.plane.visible = false;
    state.plane.rotation.order = "YXZ";
    state.scene.add(state.plane);
  });

  // Setup UI
  setupUI();
  loadFamousPlaces();

  // Start render loop
  animate();

  setStatus("Ready. Search a location or choose a famous place!");
}

// ===========================================
// UI SETUP
// ===========================================
// Helper for safe event listeners
function safeAddListener(id, event, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, handler);
  } else {
    console.warn(`Element '${id}' not found, skipping listener.`);
  }
}

// Helper to close mobile hamburger menu
function closeMobileMenu() {
  const controls = document.getElementById('controls');
  const overlay = document.getElementById('menu-overlay');
  const toggle = document.getElementById('menu-toggle');
  if (controls) controls.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  if (toggle) toggle.textContent = '☰';
}

// Detect mobile
function isMobile() {
  return window.innerWidth <= 768 || 'ontouchstart' in window;
}

// ==========================================
// VIRTUAL JOYSTICK (Mobile Fly Mode)
// ==========================================
function setupFlyTouchControls() {
  const flyControls = document.getElementById('fly-touch-controls');
  if (!flyControls) return;

  // Exit button
  const exitBtn = document.getElementById('fly-exit-mobile');
  if (exitBtn) {
    exitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFlyMode();
    });
  }

  // Setup each joystick
  setupJoystick('joystick-left', (dx, dy) => {
    // Left joystick: dx = turn (A/D), dy = pitch (W/S)
    const deadzone = 0.15;
    state.keys['KeyA'] = dx < -deadzone;
    state.keys['KeyD'] = dx > deadzone;
    state.keys['KeyW'] = dy < -deadzone;
    state.keys['KeyS'] = dy > deadzone;
  });

  setupJoystick('joystick-right', (dx, dy) => {
    // Right joystick: dy = altitude (Space/C), dx = speed (Shift/Ctrl)
    const deadzone = 0.15;
    state.keys['Space'] = dy < -deadzone;
    state.keys['KeyC'] = dy > deadzone;
    state.keys['ShiftLeft'] = dx > deadzone;
    state.keys['ControlLeft'] = dx < -deadzone;
  });
}

function setupJoystick(containerId, onMove) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const base = container.querySelector('.joystick-base');
  const thumb = container.querySelector('.joystick-thumb');
  if (!base || !thumb) return;

  let active = false;
  let touchId = null;
  const maxDist = 38; // Max pixels the thumb can move from center

  function getOffset(touch) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    return { dx, dy, normX: dx / maxDist, normY: dy / maxDist };
  }

  base.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (active) return;
    const touch = e.changedTouches[0];
    touchId = touch.identifier;
    active = true;
    thumb.classList.add('active');
    const { dx, dy, normX, normY } = getOffset(touch);
    thumb.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
    onMove(normX, normY);
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!active) return;
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchId) {
        e.preventDefault();
        const { dx, dy, normX, normY } = getOffset(touch);
        thumb.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
        onMove(normX, normY);
        break;
      }
    }
  }, { passive: false });

  const endTouch = (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchId) {
        active = false;
        touchId = null;
        thumb.classList.remove('active');
        thumb.style.transform = 'translate(0px, 0px)';
        onMove(0, 0); // Reset all keys for this joystick
        break;
      }
    }
  };

  document.addEventListener('touchend', endTouch);
  document.addEventListener('touchcancel', endTouch);
}

function showFlyTouchControls() {
  if (!isMobile()) return;
  const el = document.getElementById('fly-touch-controls');
  if (el) el.classList.remove('hidden');
  document.body.classList.add('fly-active');
}

function hideFlyTouchControls() {
  const el = document.getElementById('fly-touch-controls');
  if (el) el.classList.add('hidden');
  document.body.classList.remove('fly-active');
  // Reset all virtual keys
  ['KeyA','KeyD','KeyW','KeyS','Space','KeyC','ShiftLeft','ControlLeft'].forEach(k => {
    state.keys[k] = false;
  });
}

function setupUI() {
  setupWelcomeModal();
  setupSearch();
  setupFlyTouchControls();

  // Famous places dropdown
  safeAddListener("famous-places", "change", (e) => {
    const place = e.target.value;
    if (place) {
      const data = JSON.parse(place);
      loadLocationTerrain(data.name, data.lat, data.lon);
    }
  });

  // Mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  const menuOverlay = document.getElementById('menu-overlay');
  const controls = document.getElementById('controls');

  if (menuToggle && controls && menuOverlay) {
    menuToggle.addEventListener('click', () => {
      controls.classList.toggle('active');
      menuOverlay.classList.toggle('active');
      // Toggle hamburger icon to X
      menuToggle.textContent = controls.classList.contains('active') ? '✕' : '☰';
    });

    menuOverlay.addEventListener('click', () => {
      closeMobileMenu();
    });
  }

  // Auto-close mobile menu when an action button is tapped
  document.querySelectorAll('.action-btn, .time-card, .quick-start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Quick Actions
  safeAddListener("fly-btn", "click", toggleFlyMode);
  safeAddListener("tour-btn", "click", toggleTourMode);
  safeAddListener("measure-btn", "click", toggleMeasureMode);
  safeAddListener("satellite-btn", "click", toggleSatelliteMode);
  safeAddListener("screenshot-btn", "click", takeScreenshot);
  safeAddListener("voice-btn", "click", toggleVoiceChat);
  safeAddListener("ai-info-btn", "click", showAIInfo);

  // Tour controls
  safeAddListener("tour-close", "click", () => exitTourMode());
  safeAddListener("tour-play", "click", () => playTour());
  safeAddListener("tour-pause", "click", () => pauseTour());
  safeAddListener("tour-restart", "click", () => restartTour());
  safeAddListener("tour-mp4", "click", () => recordTour());

  const tourSpeed = document.getElementById("tour-speed");
  if (tourSpeed) {
    tourSpeed.addEventListener("input", (e) => {
      state.tourSpeed = parseFloat(e.target.value);
      const val = document.getElementById("tour-speed-val");
      if (val) val.textContent = state.tourSpeed + "×";
    });
  }

  // Measure controls
  document.getElementById("measure-close")
    .addEventListener("click", () => exitMeasureMode());
  document
    .getElementById("measure-clear")
    .addEventListener("click", () => clearMeasurePoints());
  document.getElementById("profile-close").addEventListener("click", () => {
    document.getElementById("elevation-profile").classList.add("hidden");
  });

  // Record Video
  // record-btn removed from UI

  // Himalaya Explorer
  document
    .getElementById("himalaya-btn")
    .addEventListener("click", openHimalayaExplorer);
  document
    .getElementById("himalaya-close")
    .addEventListener("click", closeHimalayaExplorer);

  // Share View removed from UI

  // Time presets
  document.querySelectorAll(".time-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".time-card")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setTimeOfDay(btn.dataset.time);
    });
  });

  // Terrain sliders
  const exagSlider = document.getElementById("exag");
  exagSlider.addEventListener("input", () => {
    document.getElementById("exag-val").textContent = exagSlider.value + "×";
    if (state.terrain && state.heightmapTexture) {
      createTerrain();
    }
  });

  const rotSlider = document.getElementById("rotation");
  rotSlider.addEventListener("input", () => {
    document.getElementById("rotation-val").textContent = rotSlider.value + "%";
  });

  // Water level controls
  const waterSlider = document.getElementById("water-level");
  waterSlider.addEventListener("input", () => {
    const level = parseInt(waterSlider.value);
    document.getElementById("water-level-val").textContent = level + "%";
    state.waterLevel = level;
    updateWaterPlane();
  });

  document
    .getElementById("water-animate")
    .addEventListener("click", toggleWaterAnimation);
  document.getElementById("water-reset").addEventListener("click", resetWater);

  // Collapsible sections
  document.querySelectorAll("h3.collapsible").forEach((header) => {
    header.addEventListener("click", () => {
      header.classList.toggle("open");
      const content = header.nextElementSibling;
      content.classList.toggle("hidden");
    });
  });

  // File upload
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  });

  // Bounds inputs
  ["north", "south", "east", "west"].forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      if (!state.bounds) state.bounds = {};
      state.bounds[id] = parseFloat(e.target.value);
    });
  });

  document
    .getElementById("extract-bounds-btn")
    .addEventListener("click", extractBoundsWithGemini);
  document.getElementById("fetch-dem-btn").addEventListener("click", fetchDEM);

  // Location panel close
  document
    .getElementById("close-location-panel")
    .addEventListener("click", () => {
      document.getElementById("location-panel").classList.add("hidden");
    });

  // Mouse controls
  setupMouseControls();

  // Keyboard
  document.addEventListener("keydown", (e) => (state.keys[e.code] = true));
  document.addEventListener("keyup", (e) => (state.keys[e.code] = false));

  // Resize
  window.addEventListener("resize", () => {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setupWelcomeModal() {
  const modal = document.getElementById("welcome-modal");
  const closeBtn = document.getElementById("welcome-close");

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Quick start buttons
  document.querySelectorAll(".quick-start-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const placeKey = btn.dataset.place;
      const place = QUICK_START_PLACES[placeKey];
      if (place) {
        modal.style.display = "none";
        loadLocationTerrain(place.name, place.lat, place.lon);
      }
    });
  });
}

function setupSearch() {
  const searchInput = document.getElementById("location-search");
  const suggestions = document.getElementById("search-suggestions");

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    clearTimeout(state.searchTimeout);

    if (query.length < 2) {
      suggestions.classList.add("hidden");
      return;
    }

    state.searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
        );
        const data = await response.json();

        if (data.success && data.results.length > 0) {
          suggestions.innerHTML = data.results
            .map(
              (r) => `
                        <div class="suggestion-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${escapeHtml(r.name)}">
                            <div class="name">${escapeHtml(r.name.split(",")[0])}</div>
                            <div class="type">${escapeHtml(r.name.split(",").slice(1).join(",").trim())}</div>
                        </div>
                    `,
            )
            .join("");
          suggestions.classList.remove("hidden");

          suggestions.querySelectorAll(".suggestion-item").forEach((item) => {
            item.addEventListener("click", () => {
              const name = item.dataset.name;
              const lat = parseFloat(item.dataset.lat);
              const lon = parseFloat(item.dataset.lon);
              searchInput.value = name.split(",")[0];
              suggestions.classList.add("hidden");
              loadLocationTerrain(name, lat, lon);
            });
          });
        } else {
          suggestions.classList.add("hidden");
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 300);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
      suggestions.classList.add("hidden");
    }
  });

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const firstItem = suggestions.querySelector(".suggestion-item");
      if (firstItem) firstItem.click();
    }
  });
}

async function loadFamousPlaces() {
  try {
    const response = await fetch("/api/famous-places");
    const data = await response.json();

    if (data.success) {
      const select = document.getElementById("famous-places");
      data.places.forEach((p) => {
        const option = document.createElement("option");
        option.value = JSON.stringify(p);
        option.textContent = p.name;
        select.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Failed to load famous places:", err);
  }
}

// ===========================================
// LOCATION LOADING
// ===========================================
async function loadLocationTerrain(name, lat, lon) {
  state.currentLocation = { name, lat, lon };

  const size = 0.15;
  state.bounds = {
    north: lat + size,
    south: lat - size,
    east: lon + size,
    west: lon - size,
  };

  showLoading("Loading terrain for " + name + "...");
  setStatus(`Loading ${name}...`, "loading");

  document.getElementById("coords").classList.remove("hidden");
  document.getElementById("coord-lat").textContent = `Lat: ${lat.toFixed(4)}°`;
  document.getElementById("coord-lon").textContent = `Lon: ${lon.toFixed(4)}°`;

  try {
    await fetchDEM();

    // Auto-load satellite imagery (default realistic view)
    setStatus("Loading satellite imagery...", "loading");
    await loadSatelliteTexture();
    state.satelliteMode = true;
    const satBtn = document.getElementById("satellite-btn");
    satBtn.classList.add("satellite-on");
    satBtn.querySelector("span:last-child").textContent = "Terrain";

    // Reset water level
    state.waterLevel = 0;
    if (document.getElementById("water-level")) {
      document.getElementById("water-level").value = 0;
      document.getElementById("water-level-val").textContent = "0%";
    }
    updateWaterPlane();

    Promise.all([
      loadLocationInfo(name, lat, lon),
      loadWeather(lat, lon),
    ]).catch(console.error);

    document.getElementById("welcome-modal").style.display = "none";
    hideLoading();
    setStatus(`${name} loaded with satellite imagery`, "success");
  } catch (err) {
    hideLoading();
    setStatus("Error: " + err.message, "error");
  }
}

async function loadLocationInfo(name, lat, lon) {
  try {
    const response = await fetch("/api/location-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, lat, lon }),
    });
    const data = await response.json();

    if (data.success && data.info) {
      const panel = document.getElementById("location-panel");
      document.getElementById("location-title").textContent =
        data.info.title || name;
      document.getElementById("location-description").textContent =
        data.info.description || "";

      const factsContainer = document.getElementById("location-facts");
      if (data.info.facts && data.info.facts.length > 0) {
        factsContainer.innerHTML = data.info.facts
          .map((f) => `<div class="fact">${escapeHtml(f)}</div>`)
          .join("");
      } else {
        factsContainer.innerHTML = "<p>No facts available.</p>";
      }

      // New Fields
      const highlightsContainer = document.getElementById("location-highlights");
      if (data.info.highlights && data.info.highlights.length > 0) {
        highlightsContainer.innerHTML = data.info.highlights
          .map((h) => `<span class="highlight-tag">${escapeHtml(h)}</span>`)
          .join("");
      } else {
        highlightsContainer.innerHTML = "";
      }

      document.getElementById("location-elevation").textContent = 
        data.info.elevation_info || "Elevation data unavailable.";
      
      document.getElementById("location-best-time").textContent = 
        data.info.best_time || "Best time to visit info unavailable.";

      const funFactBox = document.getElementById("location-fun-fact");
      if (data.info.fun_fact) {
        funFactBox.querySelector("p").textContent = data.info.fun_fact;
        funFactBox.classList.remove("hidden");
      } else {
        funFactBox.classList.add("hidden");
      }

      panel.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Location info error:", err);
  }
}

async function loadWeather(lat, lon) {
  try {
    const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    const data = await response.json();

    if (data.success && data.weather) {
      const w = data.weather;
      document.getElementById("weather-temp").textContent =
        `${Math.round(w.temperature)}°C`;
      document.getElementById("weather-condition").textContent = w.condition;
      document.getElementById("weather-wind").textContent =
        `💨 ${w.wind_speed} km/h`;
      document.getElementById("weather-humidity").textContent =
        `💧 ${w.humidity}%`;
      document.getElementById("weather-info").classList.remove("hidden");
    }
  } catch (err) {
    console.error("Weather error:", err);
  }
}

// ===========================================
// TIME OF DAY
// ===========================================
function setTimeOfDay(time) {
  state.timeOfDay = time;
  const preset = TIME_PRESETS[time];

  state.sun.color.setHex(preset.sunColor);
  state.sun.intensity = preset.sunIntensity;
  state.ambientLight.color.setHex(preset.ambientColor);
  state.ambientLight.intensity = preset.ambientIntensity;

  const distance = 206;
  const azimuthRad = (preset.azimuth * Math.PI) / 180;
  const elevationRad = (preset.elevation * Math.PI) / 180;

  state.sun.position.set(
    distance * Math.cos(elevationRad) * Math.cos(azimuthRad),
    distance * Math.sin(elevationRad),
    distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
  );

  state.scene.background = new THREE.Color(preset.bgColor);
  setStatus(`Time: ${time}`, "success");
}

// ===========================================
// SCREENSHOT
// ===========================================
function takeScreenshot() {
  const controls = document.getElementById("controls");
  const searchBar = document.getElementById("search-bar");
  const locationPanel = document.getElementById("location-panel");
  const info = document.getElementById("info");

  controls.style.display = "none";
  searchBar.style.display = "none";
  locationPanel.style.display = "none";
  info.style.display = "none";

  state.renderer.render(state.scene, state.camera);
  const dataUrl = state.renderer.domElement.toDataURL("image/png");

  controls.style.display = "";
  searchBar.style.display = "";
  locationPanel.style.display = "";
  info.style.display = "";

  const link = document.createElement("a");
  link.download = `contour-${state.currentLocation?.name || "terrain"}-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();

  setStatus("Screenshot saved!", "success");
}

async function showAIInfo() {
  if (!state.currentLocation) {
    setStatus("Load a location first", "error");
    return;
  }

  const btn = document.getElementById("ai-info-btn");
  btn.disabled = true;

  try {
    await loadLocationInfo(
      state.currentLocation.name,
      state.currentLocation.lat,
      state.currentLocation.lon,
    );
    document.getElementById("location-panel").classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// ===========================================
// MOUSE CONTROLS
// ===========================================
function setupMouseControls() {
  const canvas = state.renderer.domElement;

  canvas.addEventListener("mousedown", (e) => {
    if (state.cameraMode === "orbit") {
      state.isDragging = true;
      state.lastMouse = { x: e.clientX, y: e.clientY };
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (state.cameraMode === "orbit" && state.isDragging) {
      const dx = e.clientX - state.lastMouse.x;
      const dy = e.clientY - state.lastMouse.y;
      state.orbitAngle += dx * 0.01;
      state.orbitPhi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.1, state.orbitPhi + dy * 0.01),
      );
      state.lastMouse = { x: e.clientX, y: e.clientY };
      updateOrbitCamera();
    }
  });

  canvas.addEventListener("mouseup", () => (state.isDragging = false));
  canvas.addEventListener("mouseleave", () => (state.isDragging = false));

  canvas.addEventListener("wheel", (e) => {
    if (state.cameraMode === "orbit") {
      state.orbitRadius = Math.max(
        20,
        Math.min(300, state.orbitRadius + e.deltaY * 0.1),
      );
      updateOrbitCamera();
    }
  });

  // =========================================
  // TOUCH CONTROLS (Mobile)
  // =========================================
  let lastTouchDist = 0;
  let lastTouch = { x: 0, y: 0 };
  let isTouching = false;

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (state.cameraMode === "orbit") {
      if (e.touches.length === 1) {
        // Single finger → orbit
        isTouching = true;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        // Two fingers → pinch zoom
        isTouching = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (state.cameraMode === "orbit") {
      if (e.touches.length === 1 && isTouching) {
        // Swipe → orbit
        const dx = e.touches[0].clientX - lastTouch.x;
        const dy = e.touches[0].clientY - lastTouch.y;
        state.orbitAngle += dx * 0.008;
        state.orbitPhi = Math.max(
          0.1,
          Math.min(Math.PI / 2 - 0.1, state.orbitPhi + dy * 0.008),
        );
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        updateOrbitCamera();
      } else if (e.touches.length === 2) {
        // Pinch → zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = lastTouchDist - dist;
        state.orbitRadius = Math.max(
          20,
          Math.min(300, state.orbitRadius + delta * 0.5),
        );
        lastTouchDist = dist;
        updateOrbitCamera();
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchend", () => {
    isTouching = false;
  });
}

// ===========================================
// TERRAIN
// ===========================================
function createTerrain() {
  if (state.terrain) {
    state.scene.remove(state.terrain);
    state.terrain.geometry.dispose();
    state.terrain.material.dispose();
  }

  const size = 100;
  const segments = 256;
  const exag = parseFloat(document.getElementById("exag").value);

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

  if (state.heightmapTexture) {
    applyHeightmapToGeometry(geometry, state.heightmapTexture, exag);
  }

  let material;
  if (state.colorTexture) {
    material = new THREE.MeshStandardMaterial({
      map: state.colorTexture,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    applyTerrainColors(geometry);
  }

  state.terrain = new THREE.Mesh(geometry, material);
  state.terrain.rotation.x = -Math.PI / 2;
  state.terrain.castShadow = true;
  state.terrain.receiveShadow = true;
  state.scene.add(state.terrain);
}

function applyHeightmapToGeometry(geometry, heightmapTexture, scale) {
  const img = heightmapTexture.image;
  if (!img) return;

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);

  const positions = geometry.attributes.position;
  const width = Math.sqrt(positions.count);

  for (let i = 0; i < positions.count; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const u = x / (width - 1);
    const v = y / (width - 1);
    const px = Math.floor(u * (img.width - 1));
    const py = Math.floor(v * (img.height - 1));
    const idx = (py * img.width + px) * 4;
    const height = imgData.data[idx] / 255;
    positions.setZ(i, height * scale);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

function applyTerrainColors(geometry) {
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i++) {
    const height = positions.getZ(i);
    const normalizedHeight = Math.min(1, Math.max(0, height / 30));

    let r, g, b;
    if (normalizedHeight < 0.2) {
      r = 0.15 + normalizedHeight * 0.3;
      g = 0.35 + normalizedHeight * 0.25;
      b = 0.15;
    } else if (normalizedHeight < 0.5) {
      const t = (normalizedHeight - 0.2) / 0.3;
      r = 0.21 + t * 0.35;
      g = 0.4 - t * 0.15;
      b = 0.15 + t * 0.1;
    } else if (normalizedHeight < 0.75) {
      const t = (normalizedHeight - 0.5) / 0.25;
      r = 0.56 - t * 0.16;
      g = 0.45 - t * 0.15;
      b = 0.25 + t * 0.25;
    } else {
      const t = (normalizedHeight - 0.75) / 0.25;
      r = 0.6 + t * 0.35;
      g = 0.6 + t * 0.35;
      b = 0.65 + t * 0.3;
    }

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// ===========================================
// DEM FETCHING
// ===========================================
async function fetchDEM() {
  if (!state.bounds) {
    setStatus("Set bounds first", "error");
    return;
  }

  const { north, south, east, west } = state.bounds;
  const zoom = 11;

  showLoading("Fetching elevation tiles...");
  setStatus("Fetching DEM...", "loading");

  try {
    const minTile = latLonToTile(north, west, zoom);
    const maxTile = latLonToTile(south, east, zoom);

    const xMin = Math.min(minTile.x, maxTile.x);
    const xMax = Math.max(minTile.x, maxTile.x);
    const yMin = Math.min(minTile.y, maxTile.y);
    const yMax = Math.max(minTile.y, maxTile.y);

    const tileSize = 256;
    const width = (xMax - xMin + 1) * tileSize;
    const height = (yMax - yMin + 1) * tileSize;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const totalTiles = (xMax - xMin + 1) * (yMax - yMin + 1);
    let loadedTiles = 0;

    const tilePromises = [];
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
        tilePromises.push(
          loadImage(url)
            .then((img) => {
              loadedTiles++;
              updateProgress((loadedTiles / totalTiles) * 100);
              return {
                img,
                x: (x - xMin) * tileSize,
                y: (y - yMin) * tileSize,
              };
            })
            .catch(() => null),
        );
      }
    }

    const tiles = await Promise.all(tilePromises);

    let loaded = 0;
    for (const tile of tiles) {
      if (tile?.img) {
        ctx.drawImage(tile.img, tile.x, tile.y);
        loaded++;
      }
    }

    if (loaded === 0) throw new Error("No tiles loaded");

    const imageData = ctx.getImageData(0, 0, width, height);
    const elevation = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      elevation[i] = r * 256 + g + b / 256 - 32768;
    }

    let eMin = Infinity,
      eMax = -Infinity;
    for (const e of elevation) {
      if (e > 0) {
        eMin = Math.min(eMin, e);
        eMax = Math.max(eMax, e);
      }
    }

    const hmCanvas = document.createElement("canvas");
    hmCanvas.width = width;
    hmCanvas.height = height;
    const hmCtx = hmCanvas.getContext("2d");
    const hmData = hmCtx.createImageData(width, height);

    for (let i = 0; i < width * height; i++) {
      let val = 0;
      if (elevation[i] > 0 && eMax > eMin) {
        val = ((elevation[i] - eMin) / (eMax - eMin)) * 255;
      }
      hmData.data[i * 4] = val;
      hmData.data[i * 4 + 1] = val;
      hmData.data[i * 4 + 2] = val;
      hmData.data[i * 4 + 3] = 255;
    }
    hmCtx.putImageData(hmData, 0, 0);

    const tileBoundsNW = tileToLatLon(xMin, yMin, zoom);
    const tileBoundsSE = tileToLatLon(xMax + 1, yMax + 1, zoom);

    const cropX =
      ((west - tileBoundsNW.lon) / (tileBoundsSE.lon - tileBoundsNW.lon)) *
      width;
    const cropY =
      ((tileBoundsNW.lat - north) / (tileBoundsNW.lat - tileBoundsSE.lat)) *
      height;
    const cropW =
      ((east - west) / (tileBoundsSE.lon - tileBoundsNW.lon)) * width;
    const cropH =
      ((north - south) / (tileBoundsNW.lat - tileBoundsSE.lat)) * height;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = 512;
    finalCanvas.height = 512;
    finalCanvas
      .getContext("2d")
      .drawImage(hmCanvas, cropX, cropY, cropW, cropH, 0, 0, 512, 512);

    state.heightmapTexture = new THREE.CanvasTexture(finalCanvas);
    state.colorTexture = null;
    createTerrain();

    hideLoading();
    setStatus(
      `Loaded: ${eMin.toFixed(0)}m - ${eMax.toFixed(0)}m elevation`,
      "success",
    );
    document.getElementById("coord-alt").textContent =
      `Alt: ${eMin.toFixed(0)}-${eMax.toFixed(0)}m`;
  } catch (err) {
    hideLoading();
    setStatus("DEM Error: " + err.message, "error");
    console.error(err);
  }
}

function latLonToTile(lat, lon, z) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, z));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, z),
  );
  return { x, y };
}

function tileToLatLon(x, y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lon: (x / Math.pow(2, z)) * 360 - 180,
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ===========================================
// FILE UPLOAD
// ===========================================
async function uploadFile(file) {
  showLoading("Uploading...");
  setStatus("Uploading...", "loading");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Upload failed");
    }

    const data = await response.json();

    state.fileId = data.file_id;
    state.textureB64 = data.texture_b64;

    document.getElementById("file-info").classList.remove("hidden");
    document.getElementById("file-name").textContent = file.name;

    if (data.has_bounds) {
      state.bounds = data.bounds;
      document.getElementById("file-bounds").textContent = "Georeferenced";
      document.getElementById("bounds-section").classList.add("hidden");
    } else {
      document.getElementById("file-bounds").textContent = "No bounds";
      document.getElementById("bounds-section").classList.remove("hidden");
    }

    loadTexture(data.texture_b64);
    document.getElementById("fetch-dem-btn").classList.remove("hidden");

    hideLoading();
    setStatus(`Loaded: ${data.width}×${data.height}px`, "success");
  } catch (err) {
    hideLoading();
    setStatus("Error: " + err.message, "error");
    console.error(err);
  }
}

function loadTexture(base64) {
  const loader = new THREE.TextureLoader();
  state.colorTexture = loader.load("data:image/jpeg;base64," + base64, () => {
    createTerrain();
  });
}

async function extractBoundsWithGemini() {
  if (!state.fileId) {
    setStatus("Upload a file first", "error");
    return;
  }

  showLoading("Extracting bounds with Gemini...");
  setStatus("Analyzing map...", "loading");

  try {
    const response = await fetch(
      `/api/extract-bounds?file_id=${state.fileId}`,
      { method: "POST" },
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to extract bounds");
    }

    const data = await response.json();
    state.bounds = data.bounds;

    document.getElementById("north").value = data.bounds.north.toFixed(4);
    document.getElementById("south").value = data.bounds.south.toFixed(4);
    document.getElementById("east").value = data.bounds.east.toFixed(4);
    document.getElementById("west").value = data.bounds.west.toFixed(4);

    hideLoading();
    setStatus("Bounds extracted", "success");
  } catch (err) {
    hideLoading();
    setStatus("Gemini error: " + err.message, "error");
    console.error(err);
  }
}

// ===========================================
// CAMERA
// ===========================================
function updateOrbitCamera() {
  state.camera.position.x =
    state.orbitRadius * Math.sin(state.orbitPhi) * Math.cos(state.orbitAngle);
  state.camera.position.y = state.orbitRadius * Math.cos(state.orbitPhi);
  state.camera.position.z =
    state.orbitRadius * Math.sin(state.orbitPhi) * Math.sin(state.orbitAngle);
  state.camera.lookAt(0, 0, 0);
}

function getGeoPosition() {
  if (!state.bounds) return null;
  const pos = state.planeMode ? state.plane.position : state.camera.position;
  const terrainSize = 100;
  const u = (pos.x + terrainSize / 2) / terrainSize;
  const v = (pos.z + terrainSize / 2) / terrainSize;
  const lat =
    state.bounds.north - v * (state.bounds.north - state.bounds.south);
  const lon = state.bounds.west + u * (state.bounds.east - state.bounds.west);
  const altitude = Math.max(0, pos.y * 50);
  return { lat, lon, altitude };
}

function toggleFlyMode() {
  state.cameraMode = state.cameraMode === "orbit" ? "fly" : "orbit";
  const btn = document.getElementById("fly-btn");

  if (state.cameraMode === "fly") {
    state.planeMode = true;
    if (state.plane) {
      state.plane.visible = true;
      state.plane.position.set(0, 20, 0);
      state.plane.rotation.set(0, 0, 0);
    }
    if (state.planeAudio) {
      state.planeAudio.currentTime = 0;
      state.planeAudio.play().catch(() => {});
    }
    btn.classList.add("active");
    btn.querySelector("span:last-child").textContent = "Exit Fly";
    showFlyTouchControls();
  } else {
    state.planeMode = false;
    if (state.plane) state.plane.visible = false;
    if (state.planeAudio) state.planeAudio.pause();
    btn.classList.remove("active");
    btn.querySelector("span:last-child").textContent = "Fly Mode";
    hideFlyTouchControls();
    updateOrbitCamera();
  }
}

async function toggleVoiceChat() {
  const btn = document.getElementById("voice-btn");
  const status = document.getElementById("voice-status");

  if (VoiceChat.isActive()) {
    VoiceChat.stop();
    btn.classList.remove("active");
    btn.querySelector("span:last-child").textContent = "AI Chat";
    status.classList.add("hidden");
    if (state.planeAudio) state.planeAudio.muted = false;
  } else {
    try {
      btn.disabled = true;
      btn.querySelector("span:last-child").textContent = "Connecting...";

      const resp = await fetch("/api/gemini-key");
      if (!resp.ok) throw new Error("Failed to get API key");
      const { key } = await resp.json();

      const mapName = state.currentLocation?.name || "terrain";
      VoiceChat.init(key, mapName, state.bounds, getGeoPosition);
      await VoiceChat.start();

      btn.classList.add("active");
      btn.querySelector("span:last-child").textContent = "Stop Voice";
      btn.disabled = false;
      status.classList.remove("hidden");
      if (state.planeAudio) state.planeAudio.muted = true;
    } catch (err) {
      console.error("Voice chat error:", err);
      setStatus("Voice chat failed: " + err.message, "error");
      btn.querySelector("span:last-child").textContent = "AI Chat";
      btn.disabled = false;
    }
  }
}

// ===========================================
// ANIMATION
// ===========================================
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  if (state.cameraMode === "orbit" && !state.isDragging) {
    const speed = parseFloat(document.getElementById("rotation").value) / 100;
    state.orbitAngle += 0.003 * speed;
    updateOrbitCamera();
  }

  if (state.cameraMode === "fly" && state.planeMode && state.plane) {
    const turnSpeed = 1.2;
    const pitchSpeed = 0.8;
    const forwardSpeed = state.flySpeed || 5;
    const bankAngle = 0.5;
    const minAltitude = 8; // Minimum height above terrain

    // Turn controls
    if (state.keys["KeyA"]) state.plane.rotation.y += turnSpeed * delta;
    if (state.keys["KeyD"]) state.plane.rotation.y -= turnSpeed * delta;
    if (state.keys["KeyW"]) state.plane.rotation.x -= pitchSpeed * delta;
    if (state.keys["KeyS"]) state.plane.rotation.x += pitchSpeed * delta;

    // Speed controls
    if (state.keys["ShiftLeft"] || state.keys["ShiftRight"]) {
      state.flySpeed = Math.min(15, (state.flySpeed || 5) + 5 * delta);
    }
    if (state.keys["ControlLeft"] || state.keys["ControlRight"]) {
      state.flySpeed = Math.max(2, (state.flySpeed || 5) - 5 * delta);
    }

    // Altitude controls
    if (state.keys["Space"]) state.plane.position.y += 15 * delta;
    if (state.keys["KeyC"]) state.plane.position.y -= 10 * delta;

    // Banking
    let targetBank = 0;
    if (state.keys["KeyA"]) targetBank = bankAngle;
    if (state.keys["KeyD"]) targetBank = -bankAngle;
    state.plane.rotation.z = THREE.MathUtils.lerp(
      state.plane.rotation.z,
      targetBank,
      0.15,
    );

    // Movement
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(state.plane.quaternion);
    state.plane.position.addScaledVector(direction, forwardSpeed * delta);

    const pos = state.plane.position;

    // Get terrain height at current position
    if (state.terrain) {
      const raycaster = new THREE.Raycaster();
      raycaster.set(
        new THREE.Vector3(pos.x, 100, pos.z),
        new THREE.Vector3(0, -1, 0),
      );
      const intersects = raycaster.intersectObject(state.terrain);
      if (intersects.length > 0) {
        const terrainHeight = intersects[0].point.y;
        const minY = terrainHeight + minAltitude;

        // Force plane to stay above terrain
        if (pos.y < minY) {
          pos.y = THREE.MathUtils.lerp(pos.y, minY, 0.2);
        }
      }
    }

    // Bounds check
    const bounds = 55;
    if (Math.abs(pos.x) > bounds || Math.abs(pos.z) > bounds) {
      state.plane.position.set(0, 25, 0);
      state.plane.rotation.set(0, 0, 0);
      state.flySpeed = 5;
    }

    // Camera follow
    const cameraOffset = new THREE.Vector3(0, 4, 10);
    cameraOffset.applyQuaternion(state.plane.quaternion);
    state.camera.position.copy(state.plane.position).add(cameraOffset);
    state.camera.lookAt(state.plane.position);
  }

  // Tour mode camera update
  if (state.cameraMode === "tour") {
    updateTour(delta);
  }

  state.renderer.render(state.scene, state.camera);
}

// ===========================================
// UTILITIES
// ===========================================
function setStatus(msg, type = "") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = type;
}

function showLoading(text) {
  document.getElementById("loading-text").textContent = text;
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("loading").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loading").classList.add("hidden");
}

function updateProgress(percent) {
  document.getElementById("progress-bar").style.width = `${percent}%`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===========================================
// SATELLITE MODE
// ===========================================
async function toggleSatelliteMode() {
  const btn = document.getElementById("satellite-btn");
  state.satelliteMode = !state.satelliteMode;

  if (state.satelliteMode) {
    btn.classList.add("satellite-on");
    btn.querySelector("span:last-child").textContent = "Terrain";
    setStatus("Loading satellite imagery...", "loading");
    await loadSatelliteTexture();
    setStatus("Satellite view enabled", "success");
  } else {
    btn.classList.remove("satellite-on");
    btn.querySelector("span:last-child").textContent = "Satellite";
    state.satelliteTexture = null;
    createTerrain();
    setStatus("Terrain view enabled", "success");
  }
}

async function loadSatelliteTexture() {
  if (!state.bounds) return;

  const { north, south, east, west } = state.bounds;
  const zoom = 13;

  const minTile = latLonToTile(north, west, zoom);
  const maxTile = latLonToTile(south, east, zoom);

  const xMin = Math.min(minTile.x, maxTile.x);
  const xMax = Math.max(minTile.x, maxTile.x);
  const yMin = Math.min(minTile.y, maxTile.y);
  const yMax = Math.max(minTile.y, maxTile.y);

  const tileSize = 256;
  const width = (xMax - xMin + 1) * tileSize;
  const height = (yMax - yMin + 1) * tileSize;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Fetch satellite tiles
  const tilePromises = [];
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const url = `/api/satellite-tile?z=${zoom}&x=${x}&y=${y}`;
      tilePromises.push(
        loadImage(url)
          .then((img) => ({
            img,
            x: (x - xMin) * tileSize,
            y: (y - yMin) * tileSize,
          }))
          .catch(() => null),
      );
    }
  }

  const tiles = await Promise.all(tilePromises);
  for (const tile of tiles) {
    if (tile?.img) ctx.drawImage(tile.img, tile.x, tile.y);
  }

  // Crop to bounds
  const tileBoundsNW = tileToLatLon(xMin, yMin, zoom);
  const tileBoundsSE = tileToLatLon(xMax + 1, yMax + 1, zoom);

  const cropX =
    ((west - tileBoundsNW.lon) / (tileBoundsSE.lon - tileBoundsNW.lon)) * width;
  const cropY =
    ((tileBoundsNW.lat - north) / (tileBoundsNW.lat - tileBoundsSE.lat)) *
    height;
  const cropW = ((east - west) / (tileBoundsSE.lon - tileBoundsNW.lon)) * width;
  const cropH =
    ((north - south) / (tileBoundsNW.lat - tileBoundsSE.lat)) * height;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = 1024;
  finalCanvas.height = 1024;
  finalCanvas
    .getContext("2d")
    .drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, 1024, 1024);

  state.satelliteTexture = new THREE.CanvasTexture(finalCanvas);
  state.colorTexture = state.satelliteTexture;
  createTerrain();
}

// ===========================================
// PEAK MARKERS
// ===========================================
async function togglePeaks() {
  const btn = document.getElementById("peaks-btn");
  state.peaksVisible = !state.peaksVisible;

  if (state.peaksVisible) {
    btn.classList.add("peaks-on");
    btn.querySelector("span:last-child").textContent = "Hide Peaks";
    await loadPeaks();
  } else {
    btn.classList.remove("peaks-on");
    btn.querySelector("span:last-child").textContent = "Peaks";
    clearPeakMarkers();
  }
}

async function loadPeaks() {
  if (!state.bounds) {
    setStatus("Load terrain first", "error");
    return;
  }

  setStatus("Loading peak data...", "loading");

  try {
    const response = await fetch("/api/peaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.bounds),
    });
    const data = await response.json();

    if (data.success && data.peaks.length > 0) {
      clearPeakMarkers();
      for (const peak of data.peaks) {
        addPeakMarker(peak.name, peak.lat, peak.lon, peak.elevation);
      }
      setStatus(`Loaded ${data.peaks.length} peaks`, "success");
    } else {
      setStatus("No peaks found in this area", "warning");
    }
  } catch (err) {
    setStatus("Failed to load peaks", "error");
    console.error(err);
  }
}

function addPeakMarker(name, lat, lon, elevation) {
  if (!state.bounds || !state.terrain) return;

  const { north, south, east, west } = state.bounds;
  const terrainSize = 100;

  const u = (lon - west) / (east - west);
  const v = (north - lat) / (north - south);
  const x = (u - 0.5) * terrainSize;
  const z = (v - 0.5) * terrainSize;

  // Get height at position using raycaster
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(state.terrain);
  const y = intersects.length > 0 ? intersects[0].point.y + 2 : 10;

  // Create marker sprite
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 128, 12);
  ctx.fill();

  // Border
  ctx.strokeStyle = "#4ecdc4";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pin icon
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(30, 45, 12, 0, Math.PI * 2);
  ctx.fill();

  // Name
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 24px Inter, sans-serif";
  ctx.fillText(name.substring(0, 18), 50, 50);

  // Elevation
  if (elevation) {
    ctx.fillStyle = "#4ecdc4";
    ctx.font = "20px Inter, sans-serif";
    ctx.fillText(`${Math.round(elevation)}m`, 50, 85);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(12, 6, 1);
  sprite.userData = { name, elevation, lat, lon };

  state.scene.add(sprite);
  state.peakSprites.push(sprite);
}

function clearPeakMarkers() {
  for (const sprite of state.peakSprites) {
    state.scene.remove(sprite);
  }
  state.peakSprites = [];
}

// ===========================================
// MEASUREMENT TOOLS
// ===========================================
function toggleMeasureMode() {
  const btn = document.getElementById("measure-btn");
  state.measureMode = !state.measureMode;

  if (state.measureMode) {
    btn.classList.add("measuring");
    btn.querySelector("span:last-child").textContent = "Cancel";
    document.getElementById("measure-panel").classList.remove("hidden");
    state.renderer.domElement.style.cursor = "crosshair";
    state.renderer.domElement.addEventListener("click", onMeasureClick);
    setStatus("Click terrain to place measurement points", "success");
  } else {
    exitMeasureMode();
  }
}

function exitMeasureMode() {
  const btn = document.getElementById("measure-btn");
  state.measureMode = false;
  btn.classList.remove("measuring");
  btn.querySelector("span:last-child").textContent = "Measure";
  document.getElementById("measure-panel").classList.add("hidden");
  document.getElementById("elevation-profile").classList.add("hidden");
  state.renderer.domElement.style.cursor = "grab";
  state.renderer.domElement.removeEventListener("click", onMeasureClick);
  clearMeasurePoints();
}

function onMeasureClick(event) {
  if (!state.measureMode || !state.terrain) return;

  const rect = state.renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, state.camera);
  const intersects = raycaster.intersectObject(state.terrain);

  if (intersects.length > 0) {
    const point = intersects[0].point.clone();
    state.measurePoints.push(point);

    // Add visual marker
    const markerGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x4ecdc4 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.copy(point);
    state.scene.add(marker);
    state.measureLabels.push(marker);

    if (state.measurePoints.length === 2) {
      calculateMeasurement();
    } else if (state.measurePoints.length > 2) {
      // Reset on third click
      clearMeasurePoints();
      state.measurePoints.push(point);
      const newMarker = new THREE.Mesh(markerGeo, markerMat);
      newMarker.position.copy(point);
      state.scene.add(newMarker);
      state.measureLabels.push(newMarker);
    }
  }
}

function clearMeasurePoints() {
  state.measurePoints = [];
  for (const marker of state.measureLabels) {
    state.scene.remove(marker);
  }
  state.measureLabels = [];
  if (state.measureLine) {
    state.scene.remove(state.measureLine);
    state.measureLine = null;
  }
  document.getElementById("measure-distance").textContent = "0 km";
  document.getElementById("measure-elevation-gain").textContent = "+0 m";
  document.getElementById("measure-elevation-loss").textContent = "-0 m";
  document.getElementById("elevation-profile").classList.add("hidden");
}

function calculateMeasurement() {
  const p1 = state.measurePoints[0];
  const p2 = state.measurePoints[1];

  // Draw line between points
  const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x4ecdc4,
    linewidth: 3,
  });
  state.measureLine = new THREE.Line(lineGeo, lineMat);
  state.scene.add(state.measureLine);

  // Calculate 3D distance
  const distance3D = p1.distanceTo(p2);

  // Convert to real-world distance (roughly)
  const realDistance = (distance3D / 100) * 30; // Assuming ~30km terrain size
  document.getElementById("measure-distance").textContent =
    realDistance.toFixed(2) + " km";

  // Calculate elevation change
  const elevationDiff = p2.y - p1.y;
  const realElevation = elevationDiff * 50; // Scale factor for elevation

  if (realElevation >= 0) {
    document.getElementById("measure-elevation-gain").textContent =
      "+" + Math.round(realElevation) + " m";
    document.getElementById("measure-elevation-loss").textContent = "-0 m";
  } else {
    document.getElementById("measure-elevation-gain").textContent = "+0 m";
    document.getElementById("measure-elevation-loss").textContent =
      Math.round(realElevation) + " m";
  }

  // Draw elevation profile
  drawElevationProfile(p1, p2);
}

function drawElevationProfile(p1, p2) {
  const canvas = document.getElementById("elevation-canvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Sample elevation along the line
  const samples = 50;
  const elevations = [];
  const raycaster = new THREE.Raycaster();

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = p1.x + (p2.x - p1.x) * t;
    const z = p1.z + (p2.z - p1.z) * t;

    raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
    const intersects = raycaster.intersectObject(state.terrain);
    const elev = intersects.length > 0 ? intersects[0].point.y : 0;
    elevations.push(elev);
  }

  // Find min/max
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const range = maxElev - minElev || 1;

  // Draw gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(78, 205, 196, 0.2)");
  gradient.addColorStop(1, "rgba(78, 205, 196, 0.02)");

  // Draw filled area
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * width;
    const y = height - ((elevations[i] - minElev) / range) * (height - 20) - 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * width;
    const y = height - ((elevations[i] - minElev) / range) * (height - 20) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#4ecdc4";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Update stats
  const realMin = minElev * 50 + state.elevationMin;
  const realMax = maxElev * 50 + state.elevationMin;
  document.getElementById("profile-min").textContent =
    `Min: ${Math.round(realMin)}m`;
  document.getElementById("profile-max").textContent =
    `Max: ${Math.round(realMax)}m`;

  document.getElementById("elevation-profile").classList.remove("hidden");
}

// ===========================================
// TOUR MODE
// ===========================================
async function toggleTourMode() {
    const btn = document.getElementById("tour-btn");

    if (state.tourMode) {
        exitTourMode();
    } else {
        btn.classList.add("touring");
        btn.querySelector("span:last-child").textContent = "Exit Tour";
        state.tourMode = true;
        document.getElementById("tour-controls").classList.remove("hidden");

        // Generate or use default waypoints
        await generateTourWaypoints();
        
        // Setup the smooth path
        setupTourPath();
        
        setStatus("Tour ready - press Play to begin", "success");
    }
}

function setupTourPath() {
    if (!state.tourWaypoints || state.tourWaypoints.length < 2) return;

    const positions = state.tourWaypoints.map(wp => new THREE.Vector3(...wp.position));
    const targets = state.tourWaypoints.map(wp => new THREE.Vector3(...wp.target));

    // Create smooth curves
    state.tourCurve = new THREE.CatmullRomCurve3(positions, true, 'catmullrom', 0.5);
    state.tourTargetCurve = new THREE.CatmullRomCurve3(targets, true, 'catmullrom', 0.5);
}

function exitTourMode() {
  const btn = document.getElementById("tour-btn");
  btn.classList.remove("touring");
  btn.querySelector("span:last-child").textContent = "Tour Mode";
  state.tourMode = false;
  state.tourPlaying = false;
  document.getElementById("tour-controls").classList.add("hidden");
  document.getElementById("tour-play").classList.remove("hidden");
  document.getElementById("tour-pause").classList.add("hidden");
  document.getElementById("tour-progress-bar").style.width = "0%";
  state.cameraMode = "orbit";
  updateOrbitCamera();
}

async function generateTourWaypoints() {
  if (!state.bounds) {
    state.tourWaypoints = getDefaultWaypoints();
    return;
  }

  try {
    setStatus("Generating scenic tour...", "loading");
    const response = await fetch("/api/tour-waypoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.bounds),
    });
    const data = await response.json();

    if (data.success && data.waypoints.length > 0) {
      state.tourWaypoints = data.waypoints;
    } else {
      state.tourWaypoints = getDefaultWaypoints();
    }
  } catch (err) {
    console.error("Tour waypoints error:", err);
    state.tourWaypoints = getDefaultWaypoints();
  }
}

function getDefaultWaypoints() {
  return [
    { position: [0, 50, 40], target: [0, 0, 0], duration: 6 },
    { position: [30, 35, 30], target: [0, 5, 0], duration: 6 },
    { position: [20, 25, -35], target: [0, 5, 0], duration: 6 },
    { position: [-30, 30, -20], target: [0, 10, 0], duration: 6 },
  ];
}

function playTour() {
  if (state.tourWaypoints.length === 0) return;

  state.tourPlaying = true;
  state.cameraMode = "tour";
  document.getElementById("tour-play").classList.add("hidden");
  document.getElementById("tour-pause").classList.remove("hidden");
  setStatus("Tour playing...", "success");
}

function pauseTour() {
  state.tourPlaying = false;
  document.getElementById("tour-play").classList.remove("hidden");
  document.getElementById("tour-pause").classList.add("hidden");
}

function restartTour() {
  state.tourCurrentIndex = 0;
  state.tourProgress = 0;
  document.getElementById("tour-progress-bar").style.width = "0%";
  playTour();
}

function recordTour() {
    state.tourCurrentIndex = 0;
    state.tourProgress = 0;
    document.getElementById('tour-progress-bar').style.width = '0%';
    
    // Start recording
    startRecording();
    
    // Start tour
    playTour();
}

function updateTour(delta) {
    if (!state.tourPlaying || !state.tourCurve || !state.tourTargetCurve) return;

    // Increment progress based on total duration (40s)
    state.tourProgress += delta / state.tourDuration;

    if (state.tourProgress >= 1) {
        state.tourProgress = 0;
        
        // Tour completed, loop or stop
        pauseTour();
        setStatus("Tour completed! Saving video...", "success");

        // Auto-stop recording if active
        if (state.isRecording) {
            stopRecording();
        }
        return;
    }

    // Sample points from the curves
    const pos = state.tourCurve.getPoint(state.tourProgress);
    const target = state.tourTargetCurve.getPoint(state.tourProgress);

    state.camera.position.copy(pos);
    state.camera.lookAt(target);

    // Update progress bar
    document.getElementById("tour-progress-bar").style.width = (state.tourProgress * 100) + "%";
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ===========================================
// WATER/FLOOD SIMULATION
// ===========================================
function createWaterPlane() {
  // Remove existing water plane if any
  if (state.waterPlane) {
    state.scene.remove(state.waterPlane);
  }

  const waterGeo = new THREE.PlaneGeometry(120, 120, 1, 1);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a6eaa,
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });

  state.waterPlane = new THREE.Mesh(waterGeo, waterMat);
  state.waterPlane.rotation.x = -Math.PI / 2;
  state.waterPlane.position.y = -5;
  state.waterPlane.receiveShadow = true;
  state.waterPlane.visible = false; // Hidden until slider is used
  state.scene.add(state.waterPlane);
}

function updateWaterPlane() {
  if (!state.waterPlane) {
    createWaterPlane();
  }

  // Only show water when level > 0
  state.waterPlane.visible = state.waterLevel > 0;

  // Calculate water height based on elevation range
  const exag = parseFloat(document.getElementById("exag").value);
  const minHeight = 0;
  const maxHeight = exag * 0.8; // Max water at 80% of terrain height

  const waterHeight = minHeight + (state.waterLevel / 100) * maxHeight;
  state.waterPlane.position.y = waterHeight - 1;

  // Update water material opacity based on level
  state.waterPlane.material.opacity = 0.6 + (state.waterLevel / 100) * 0.2;

  // Calculate flooded area and altitude
  const realAltitude = Math.round(
    state.elevationMin +
      (state.waterLevel / 100) * (state.elevationMax - state.elevationMin),
  );
  document.getElementById("water-alt").textContent =
    `Altitude: ${realAltitude}m`;

  // Estimate flooded area (rough calculation)
  const floodedArea = Math.min(100, Math.round(state.waterLevel * 0.7));
  document.getElementById("water-area").textContent = `Area: ~${floodedArea}%`;

  // Change water color based on depth
  if (state.waterLevel < 30) {
    state.waterPlane.material.color.setHex(0x60a5fa); // Light blue
  } else if (state.waterLevel < 60) {
    state.waterPlane.material.color.setHex(0x3b82f6); // Medium blue
  } else {
    state.waterPlane.material.color.setHex(0x1e40af); // Deep blue
  }
}

function toggleWaterAnimation() {
  const btn = document.getElementById("water-animate");

  if (state.waterAnimating) {
    // Stop animation
    state.waterAnimating = false;
    btn.classList.remove("animating");
    btn.textContent = "▶️ Animate Flood";
  } else {
    // Start animation
    state.waterAnimating = true;
    state.waterLevel = 0;
    btn.classList.add("animating");
    btn.textContent = "⏸️ Stop";
    animateFlood();
  }
}

function animateFlood() {
  if (!state.waterAnimating) return;

  state.waterLevel += 0.5; // Smooth increment

  if (state.waterLevel >= 100) {
    state.waterLevel = 100;
    state.waterAnimating = false;
    const btn = document.getElementById("water-animate");
    btn.classList.remove("animating");
    btn.textContent = "▶️ Animate Flood";
    setStatus("Flood simulation complete!", "success");
  }

  // Update UI
  const slider = document.getElementById("water-level");
  slider.value = state.waterLevel;
  document.getElementById("water-level-val").textContent =
    Math.round(state.waterLevel) + "%";
  updateWaterPlane();

  if (state.waterAnimating) {
    requestAnimationFrame(animateFlood);
  }
}

function resetWater() {
  state.waterAnimating = false;
  state.waterLevel = 0;

  const slider = document.getElementById("water-level");
  slider.value = 0;
  document.getElementById("water-level-val").textContent = "0%";

  const btn = document.getElementById("water-animate");
  btn.classList.remove("animating");
  btn.textContent = "▶️ Animate Flood";

  if (state.waterPlane) {
    state.waterPlane.visible = false;
  }
  updateWaterPlane();
  setStatus("Water level reset", "success");
}

// ===========================================
// IMPROVED FLY MODE
// ===========================================
function updateFlyMode(delta) {
  if (!state.planeMode || !state.plane) return;

  const turnSpeed = 1.5;
  const pitchSpeed = 1.0;
  const baseSpeed = state.flySpeed;
  const bankAngle = 0.6;

  // Controls
  if (state.keys["KeyA"]) state.plane.rotation.y += turnSpeed * delta;
  if (state.keys["KeyD"]) state.plane.rotation.y -= turnSpeed * delta;
  if (state.keys["KeyW"]) state.plane.rotation.x -= pitchSpeed * delta;
  if (state.keys["KeyS"]) state.plane.rotation.x += pitchSpeed * delta;

  // Speed controls
  if (state.keys["ShiftLeft"])
    state.flySpeed = Math.min(15, state.flySpeed + 5 * delta);
  if (state.keys["ControlLeft"])
    state.flySpeed = Math.max(2, state.flySpeed - 5 * delta);

  // Altitude controls
  if (state.keys["Space"]) state.plane.position.y += 10 * delta;
  if (state.keys["KeyC"]) state.plane.position.y -= 10 * delta;

  // Banking effect
  let targetBank = 0;
  if (state.keys["KeyA"]) targetBank = bankAngle;
  if (state.keys["KeyD"]) targetBank = -bankAngle;
  state.plane.rotation.z = THREE.MathUtils.lerp(
    state.plane.rotation.z,
    targetBank,
    0.1,
  );

  // Move forward
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(state.plane.quaternion);
  state.plane.position.addScaledVector(direction, baseSpeed * delta);

  // Terrain following (auto altitude adjustment)
  if (state.terrainFollowing && state.terrain) {
    const raycaster = new THREE.Raycaster();
    raycaster.set(
      new THREE.Vector3(state.plane.position.x, 100, state.plane.position.z),
      new THREE.Vector3(0, -1, 0),
    );
    const intersects = raycaster.intersectObject(state.terrain);
    if (intersects.length > 0) {
      const terrainHeight = intersects[0].point.y;
      const targetAlt = terrainHeight + state.flyAltitude;
      state.plane.position.y = THREE.MathUtils.lerp(
        state.plane.position.y,
        targetAlt,
        0.05,
      );
    }
  }

  // Bounds and collision check
  const pos = state.plane.position;
  const bounds = 55;
  let shouldReset = Math.abs(pos.x) > bounds || Math.abs(pos.z) > bounds;

  if (!shouldReset && state.terrain) {
    const raycaster = new THREE.Raycaster();
    raycaster.set(
      new THREE.Vector3(pos.x, 100, pos.z),
      new THREE.Vector3(0, -1, 0),
    );
    const intersects = raycaster.intersectObject(state.terrain);
    if (intersects.length > 0 && pos.y < intersects[0].point.y + 1) {
      shouldReset = true;
    }
  }

  if (shouldReset) {
    state.plane.position.set(0, 25, 0);
    state.plane.rotation.set(0, 0, 0);
    state.flySpeed = 5;
  }

  // Camera follow
  const cameraOffset = new THREE.Vector3(0, 4, 10);
  cameraOffset.applyQuaternion(state.plane.quaternion);
  state.camera.position.copy(state.plane.position).add(cameraOffset);
  state.camera.lookAt(state.plane.position);
}

// ===========================================
// VIDEO RECORDING
// ===========================================
const HIMALAYA_PEAKS = [
  {
    name: "Mount Everest",
    lat: 27.9881,
    lon: 86.925,
    elevation: 8849,
    rank: 1,
  },
  { name: "K2", lat: 35.8808, lon: 76.5155, elevation: 8611, rank: 2 },
  {
    name: "Kangchenjunga",
    lat: 27.7025,
    lon: 88.1475,
    elevation: 8586,
    rank: 3,
  },
  { name: "Lhotse", lat: 27.9617, lon: 86.933, elevation: 8516, rank: 4 },
  { name: "Makalu", lat: 27.8897, lon: 87.0886, elevation: 8485, rank: 5 },
  { name: "Cho Oyu", lat: 28.0942, lon: 86.6608, elevation: 8188, rank: 6 },
  { name: "Dhaulagiri", lat: 28.6983, lon: 83.4875, elevation: 8167, rank: 7 },
  { name: "Manaslu", lat: 28.55, lon: 84.5594, elevation: 8163, rank: 8 },
  {
    name: "Nanga Parbat",
    lat: 35.2378,
    lon: 74.5891,
    elevation: 8126,
    rank: 9,
  },
  {
    name: "Annapurna I",
    lat: 28.5956,
    lon: 83.8203,
    elevation: 8091,
    rank: 10,
  },
  {
    name: "Gasherbrum I",
    lat: 35.7242,
    lon: 76.6963,
    elevation: 8080,
    rank: 11,
  },
  { name: "Broad Peak", lat: 35.8122, lon: 76.5653, elevation: 8051, rank: 12 },
  {
    name: "Gasherbrum II",
    lat: 35.7586,
    lon: 76.6533,
    elevation: 8035,
    rank: 13,
  },
  {
    name: "Shishapangma",
    lat: 28.3525,
    lon: 85.7797,
    elevation: 8027,
    rank: 14,
  },
  {
    name: "Gyachung Kang",
    lat: 28.0978,
    lon: 86.7422,
    elevation: 7952,
    rank: 15,
  },
  {
    name: "Namcha Barwa",
    lat: 29.6375,
    lon: 95.0617,
    elevation: 7782,
    rank: 28,
  },
  { name: "Nanda Devi", lat: 30.3733, lon: 79.9742, elevation: 7816, rank: 23 },
  { name: "Kamet", lat: 30.9208, lon: 79.5917, elevation: 7756, rank: 29 },
  { name: "Trisul", lat: 30.31, lon: 79.73, elevation: 7120, rank: "NA" },
  {
    name: "Ama Dablam",
    lat: 27.8614,
    lon: 86.8614,
    elevation: 6812,
    rank: "Iconic",
  },
];

function getDefaultWaypoints() {
    // 40 Seconds - Smooth Cinematic Tour (Strictly inside bounds)
    // Map is roughly 100x100 (-50 to 50). Keeping camera within -45 to 45.
    return [
        { position: [0, 50, 45], target: [0, 0, 0] },     // Start High, Inside Edge
        { position: [40, 40, 30], target: [0, 5, 0] },    // Right Corner, Mid Height
        { position: [30, 25, -30], target: [5, 8, -5] },  // Deep Inside, Zoom In
        { position: [-30, 30, -30], target: [0, 5, 0] },  // Left Side, Smooth Pan
        { position: [-45, 45, 20], target: [0, 0, 0] },   // Left Corner, Pull Up
        { position: [0, 50, 45], target: [0, 0, 0] }      // Complete Loop
    ];
}

function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  const canvas = state.renderer.domElement;
  // 60 FPS for ultra-smooth video (as requested)
  const stream = canvas.captureStream(60); 

  // Prioritize MP4 (H.264) -> WebM (VP9) -> WebM (Default)
  let mimeType = "video/webm";
  if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) {
    mimeType = "video/mp4;codecs=avc1";
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    mimeType = "video/webm;codecs=vp9";
  }

  try {
    state.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 15000000 // 15 Mbps for supreme quality
    });
    state.recordedChunks = [];
    state.recordingStartTime = Date.now();

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        state.recordedChunks.push(e.data);
      }
    };

    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const link = document.createElement('a');
      link.download = `contour-${state.currentLocation?.name || 'terrain'}-${Date.now()}.${ext}`;
      link.href = url;
      link.click();
      
      URL.revokeObjectURL(url);
      setStatus('Video saved!', 'success');
    };

    state.mediaRecorder.start(100); // Collect data every 100ms
    state.isRecording = true;

    // ENTER CINEMATIC MODE
    document.body.classList.add("cinematic-mode");

    // Add ESC listener to stop
    const stopOnEsc = (e) => {
      if (e.key === "Escape") {
        stopRecording();
        document.removeEventListener("keydown", stopOnEsc);
      }
    };
    document.addEventListener("keydown", stopOnEsc);

    // Update UI (Hidden in cinematic mode, but state is kept)
    const btn = document.getElementById("record-btn");
    btn.classList.add("recording");
    btn.querySelector("span:last-child").textContent = "Stop (Esc)";
    document.getElementById("recording-indicator").classList.remove("hidden");

    // Start timer
    updateRecordingTime();

    // Show fleeting message before UI disappears
    setStatus("Recording started! Press ESC to stop", "success");
  } catch (err) {
    console.error("Recording error:", err);
    setStatus("Recording not supported", "error");
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;

    // EXIT CINEMATIC MODE
    document.body.classList.remove("cinematic-mode");

    // Update UI
    const btn = document.getElementById("record-btn");
    btn.classList.remove("recording");
    btn.querySelector("span:last-child").textContent = "Record Video";
    document.getElementById("recording-indicator").classList.add("hidden");
  }
}

function updateRecordingTime() {
  if (!state.isRecording) return;

  const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  document.getElementById("recording-time").textContent =
    `REC ${minutes}:${seconds.toString().padStart(2, "0")}`;

  requestAnimationFrame(updateRecordingTime);
}

// ===========================================
// HIMALAYA EXPLORER
// ===========================================
function openHimalayaExplorer() {
  const modal = document.getElementById("himalaya-modal");
  const grid = document.getElementById("himalaya-peaks-grid");

  // Populate peaks
  grid.innerHTML = HIMALAYA_PEAKS.map(
    (peak) => `
        <div class="himalaya-peak-card" data-lat="${peak.lat}" data-lon="${peak.lon}" data-name="${peak.name}">
            <div class="peak-name">${peak.name}</div>
            <div class="peak-elevation">${peak.elevation.toLocaleString()}m</div>
            <div class="peak-rank">${typeof peak.rank === "number" ? "#" + peak.rank + " Highest" : peak.rank}</div>
        </div>
    `,
  ).join("");

  // Add click handlers
  grid.querySelectorAll(".himalaya-peak-card").forEach((card) => {
    card.addEventListener("click", () => {
      const lat = parseFloat(card.dataset.lat);
      const lon = parseFloat(card.dataset.lon);
      const name = card.dataset.name;

      closeHimalayaExplorer();
      loadLocationTerrain(name, lat, lon);
    });
  });

  modal.classList.remove("hidden");
}

function closeHimalayaExplorer() {
  document.getElementById("himalaya-modal").classList.add("hidden");
}

// ===========================================
// SHARE VIEW
// ===========================================
function shareView() {
  const params = new URLSearchParams();

  // Add location info
  if (state.currentLocation) {
    params.set('loc', state.currentLocation.name || '');
    params.set('lat', state.currentLocation.lat?.toFixed(4) || '');
    params.set('lon', state.currentLocation.lon?.toFixed(4) || '');
  }

  // Add camera state
  params.set('a', state.orbitAngle.toFixed(2));
  params.set('p', state.orbitPhi.toFixed(2));
  params.set('r', state.orbitRadius.toFixed(0));
  params.set('t', state.timeOfDay);

  const url = `${window.location.origin}/app?${params.toString()}`;

  // Copy to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      setStatus('🔗 Link copied to clipboard!', 'success');
    });
  } else {
    // Fallback
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    setStatus('🔗 Link copied to clipboard!', 'success');
  }
}

function loadSharedView() {
  const params = new URLSearchParams(window.location.search);

  // Restore camera state
  if (params.has('a')) state.orbitAngle = parseFloat(params.get('a'));
  if (params.has('p')) state.orbitPhi = parseFloat(params.get('p'));
  if (params.has('r')) state.orbitRadius = parseFloat(params.get('r'));
  if (params.has('t')) setTimeOfDay(params.get('t'));

  updateOrbitCamera();

  // Load location if shared
  const name = params.get('loc');
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));

  if (name && !isNaN(lat) && !isNaN(lon)) {
    setTimeout(() => {
      loadLocationTerrain(name, lat, lon);
      setStatus(`📍 Loaded shared view: ${name}`, 'success');
    }, 500);
  }
}

// ===========================================
// START
// ===========================================
init();
loadSharedView();
