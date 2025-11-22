const socket = io("http://localhost:3000"); // Connect to backend
let locations = {};
let map;
let markers = {};
let selected = null;

// ----------------------
// NEW FUNCTION ADDED
// Reverse Geocoding to auto-detect place name
// ----------------------
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.display_name || "Unnamed Place";
  } catch (err) {
    console.error(err);
    return "Unnamed Place";
  }
}

// Initialize the map
function initMap() {
  map = L.map("map").setView([12.9719, 77.5946], 16); // Default center
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map);

  // -----------------------------------------------
  // NEW FEATURE: ADD NEW LOCATIONS BY CLICKING MAP
  // (auto-detect name, save to backend, and add marker locally)
  // -----------------------------------------------
  map.on("click", async (e) => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    // Auto-detect name from map
    const autoName = await reverseGeocode(lat, lon);

    // Let user confirm / rename (prefilled with auto-detected name)
    const name = prompt("Enter location name:", autoName);
    if (!name) return;

    // Try to save to backend so update/manual/checkin will work for this place.
    // Backend route expected: POST /addLocation { name, lat, lng }
    try {
      await fetch("http://localhost:3000/addLocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, lat, lng: lon }),
      });
    } catch (err) {
      // Non-fatal: still create local marker so user sees it immediately
      console.warn("Failed to save new location to backend:", err);
    }

    // Add temporary location object locally (keeps your logic intact and allows immediate UI interaction)
    locations[name] = {
      name,
      coords: [lat, lon],
      wifiCount: 0,
      checkIns: 0,
      manual: 0,
      history: [],
      prediction: 0
    };

    const marker = L.circleMarker([lat, lon], {
      radius: 12,
      color: "blue",
      fillColor: "blue",
      fillOpacity: 0.6,
    }).addTo(map);

    markers[name] = marker;

    marker.on("click", () => onSelectLocation(name));
    updateMarker(name);
  });
}

// Return color based on crowd level
function colorForLevel(val) {
  if (val <= 10) return "green";
  if (val <= 30) return "orange";
  return "red";
}

// Add markers for each location
function addMarkers() {
  Object.keys(locations).forEach((key) => {
    const loc = locations[key];
    const marker = L.circleMarker(loc.coords, {
      radius: 12,
      color: "blue",
      fillColor: "blue",
      fillOpacity: 0.6,
    }).addTo(map);

    marker.on("click", () => onSelectLocation(key));
    markers[key] = marker;
    updateMarker(key);
  });
}

// Update marker color and popup
function updateMarker(key) {
  const loc = locations[key];
  const current =
    (loc.wifiCount || 0) + (loc.checkIns || 0) + (loc.manual || 0);
  const c = colorForLevel(current);
  const marker = markers[key];
  if (!marker) return;
  marker.setStyle({ color: c, fillColor: c, fillOpacity: 0.6 });
  marker.bindPopup(
    `<b>${loc.name}</b><br/>Count: ${current}<br/>Predicted (10m): ${loc.prediction || 0}`
  );
}

// Called when a marker is clicked
function onSelectLocation(key) {
  selected = key;
  const loc = locations[key];
  const current =
    (loc.wifiCount || 0) + (loc.checkIns || 0) + (loc.manual || 0);
  document.getElementById("title").innerText = loc.name;
  document.getElementById(
    "details"
  ).innerText = `WiFi: ${loc.wifiCount} | Check-ins: ${loc.checkIns} | Manual: ${loc.manual} | Current: ${current} | Predicted (10m): ${loc.prediction || 0}`;
  drawHistory(loc.history || []);
}

// Draw history chart
function drawHistory(history) {
  const c = document.getElementById("historyChart");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  if (!history || history.length === 0) return;
  const max = Math.max(...history, 1);
  const stepX = c.width / (history.length - 1 || 1);
  ctx.beginPath();
  history.forEach((v, i) => {
    const x = i * stepX;
    const y = c.height - (v / max) * c.height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// Fetch initial data from backend
fetch("http://localhost:3000/locations")
  .then((r) => r.json())
  .then((data) => {
    locations = data;
    Object.keys(locations).forEach((k) => (locations[k].prediction = 0));
    initMap();
    addMarkers();
  });

// Listen for live updates from backend
socket.on("init", (data) => {
  locations = data;
  Object.keys(locations).forEach((k) => (locations[k].prediction = 0));
  if (!map) initMap();
  if (Object.keys(markers).length === 0) addMarkers();
});

socket.on("update", ({ location, data, prediction }) => {
  locations[location] = data;
  locations[location].prediction = prediction;
  updateMarker(location);
  if (selected === location) onSelectLocation(location);
});

// Panel controls
document.getElementById("updateWifi").onclick = () => {
  if (!selected) return alert("Select a location first");
  const val = document.getElementById("wifiCount").value;
  fetch("http://localhost:3000/updateWifi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: selected, count: Number(val) }),
  });
};

document.getElementById("manualReport").onclick = () => {
  if (!selected) return alert("Select a location first");
  const val = document.getElementById("manualCount").value;
  fetch("http://localhost:3000/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: selected, density: Number(val) }),
  });
};

document.getElementById("checkin").onclick = () => {
  if (!selected) return alert("Select a location first");
  fetch("http://localhost:3000/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: selected }),
  });
};
