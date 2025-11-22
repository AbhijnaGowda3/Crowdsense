import { locations, addSample, predictNext, addNewLocation } from "./dataStore.js";

import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get('/locations', (req, res) => {
  res.json(locations);
});

function broadcast(loc) {
  const data = locations[loc];
  const prediction = predictNext(loc);
  io.emit('update', { location: loc, data, prediction });
}

app.post('/updateWifi', (req, res) => {
  const { location, count } = req.body;
  if (!locations[location]) return res.status(400).json({ error: 'Unknown location' });
  locations[location].wifiCount = Number(count);
  addSample(location);
  broadcast(location);
  res.json({ success: true });
});

app.post('/checkin', (req, res) => {
  const { location } = req.body;
  if (!locations[location]) return res.status(400).json({ error: 'Unknown location' });
  locations[location].checkIns = Number(locations[location].checkIns || 0) + 1;
  addSample(location);
  broadcast(location);
  res.json({ success: true });
});

app.post('/manual', (req, res) => {
  const { location, density } = req.body;
  if (!locations[location]) return res.status(400).json({ error: 'Unknown location' });
  locations[location].manual = Number(density);
  addSample(location);
  broadcast(location);
  res.json({ success: true });
});

app.post('/addLocation', (req, res) => {
  const { name, lat, lng } = req.body;
  if (!name || !lat || !lng)
      return res.status(400).json({ error: "Missing fields" });
  if (!locations[name]) {
      addNewLocation(name, [lat, lng]);
  }
  res.json({ success: true });
});

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.emit('init', locations);
});

// ==========================
// SIMULATED CHECK-INS WITH INDEPENDENT COLOR UPDATES
// ==========================

// Initialize all locations with 0 check-ins
Object.keys(locations).forEach(loc => {
    locations[loc].checkIns = 0;

    // Each location gets its own simulation interval (3-8 seconds)
    const randomInterval = Math.floor(Math.random() * 5000) + 3000;

    // Start simulation after 20 seconds delay
    setTimeout(() => {
        setInterval(() => {
            // Randomly decide users entering or leaving
            const change = Math.floor(Math.random() * 3) + 1; // 1-3 users
            const enterOrLeave = Math.random() < 0.6 ? 1 : -1; // 60% chance enter, 40% leave

            locations[loc].checkIns = Math.max((locations[loc].checkIns || 0) + change * enterOrLeave, 0);

            // Add sample & broadcast
            addSample(loc);
            const data = locations[loc];
            const prediction = predictNext(loc);
            io.emit('update', { location: loc, data, prediction });

            console.log(`${enterOrLeave === 1 ? "Entered" : "Left"} ${change} user(s) at ${loc}. Total: ${locations[loc].checkIns}`);
        }, randomInterval);
    }, 20000);
});

server.listen(3000,"0.0.0.0", () => console.log("Backend running on http://0.0.0.0:3000"));
