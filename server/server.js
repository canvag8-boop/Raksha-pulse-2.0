// RakshaPulse Standalone Backend Server (Node.js ES Module)
// Run with `node server/server.js`

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load .env file into process.env if present
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.debug('Error loading .env file:', e);
}

import { handleWearableRequest } from './wearableBackend.js';
import { handleTelephonyRequest } from './telephonyRoutes.js';
import { getTelephonyConfigStatus } from './telephonyService.js';

const PORT = process.env.PORT || 5000;
const DIST_DIR = path.join(__dirname, '../dist');

const server = http.createServer(async (req, res) => {
  // 1. Wearable & Telephony API endpoints
  if (req.url.startsWith('/api/')) {
    let handled = handleWearableRequest(req, res);
    if (handled) return;
    handled = await handleTelephonyRequest(req, res);
    if (handled) return;
  }

  // 2. Serve static files from dist/ if built
  if (fs.existsSync(DIST_DIR)) {
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  const telStatus = getTelephonyConfigStatus();
  console.log(`=======================================================`);
  console.log(`🛡️  RakshaPulse Hardware & Telephony Server is running!`);
  console.log(`🌐  Local URL:          http://localhost:${PORT}`);
  console.log(`🔘  ESP8266 Wearable:   Wi-Fi HTTP / USB Serial / http://<YOUR_LAN_IP>:${PORT}/api/sos/wearable`);
  console.log(`🔘  Hardware Button:    Inbuilt FLASH Button on GPIO 0 (D3)`);
  console.log(`📞  Telephony:          ${telStatus.configured ? 'Twilio Voice (LIVE)' : 'Sandbox / Test Mode'}`);
  if (telStatus.fromNumber) console.log(`📱  Caller ID:          ${telStatus.fromNumber}`);
  console.log(`🔑  Device Key:         ${process.env.VITE_WEARABLE_DEVICE_KEY || 'raksha_band_secret_key_2026'}`);
  console.log(`=======================================================`);
});
