// RakshaPulse Hardware Backend Service (ES Module)
// Handles Arduino Hardware SOS requests (External Button), Heartbeats, Authentication, Rate Limiting, and SSE

import { createIncidentRecord } from './db.js';
import { initiateSimultaneousEmergencyCalls } from './telephonyService.js';
import { dispatchAutomaticFamilyAlerts } from './messagingService.js';

const DEFAULT_SECRET_KEY = process.env.VITE_WEARABLE_DEVICE_KEY || 'raksha_band_secret_key_2026';
const EXPECTED_DEVICE_ID = process.env.VITE_WEARABLE_DEVICE_ID || 'BAND001';

export const wearableState = {
  deviceId: EXPECTED_DEVICE_ID,
  lastSeen: 0,
  connected: false,
  lastSos: null,
  lastSosSource: null,
  recentEvents: []
};

// Connected Server-Sent Events (SSE) clients
const sseClients = new Set();

// Deduplication timestamp (prevent double triggers within 3 seconds)
let lastTriggerTime = 0;
const DEDUP_WINDOW_MS = 3000;

// Idempotency cache for client_event_id (retained across retries)
const processedClientEvents = new Map();

export function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Check if wearable is currently considered connected (heartbeat or trigger within 60 seconds)
export function isDeviceOnline() {
  return (Date.now() - wearableState.lastSeen) < 65000;
}

export function handleWearableRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  // 1. SSE Stream: GET /api/sos/events
  if (pathname === '/api/sos/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send immediate sync status
    res.write(`data: ${JSON.stringify({
      type: 'INIT',
      connected: isDeviceOnline(),
      deviceId: wearableState.deviceId,
      lastSeen: wearableState.lastSeen,
      lastSos: wearableState.lastSos,
      lastSosSource: wearableState.lastSosSource,
      recentEvents: wearableState.recentEvents.slice(0, 5)
    })}\n\n`);

    sseClients.add(res);

    // Keepalive ping every 20 seconds
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
    return true;
  }

  // 2. Status check: GET /api/wearable/status
  if (pathname === '/api/wearable/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      connected: isDeviceOnline(),
      deviceId: wearableState.deviceId,
      lastSeen: wearableState.lastSeen,
      lastSos: wearableState.lastSos,
      lastSosSource: wearableState.lastSosSource,
      recentEvents: wearableState.recentEvents.slice(0, 10)
    }));
    return true;
  }

  // Helper to read JSON request body
  const readJsonBody = (callback) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e5) req.destroy();
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        callback(null, parsed);
      } catch (err) {
        callback(err, null);
      }
    });
  };

  // Authenticate device token
  const authenticate = () => {
    const authHeader = req.headers['authorization'] || '';
    const customHeader = req.headers['x-device-key'] || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    const validKey = process.env.VITE_WEARABLE_DEVICE_KEY || DEFAULT_SECRET_KEY;
    return token === validKey;
  };

  // 3. Heartbeat endpoint: POST /api/wearable/heartbeat
  if (pathname === '/api/wearable/heartbeat' && req.method === 'POST') {
    readJsonBody((err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
      }

      if (!authenticate()) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid device authentication' }));
      }

      wearableState.lastSeen = Date.now();
      wearableState.connected = true;
      if (data.device_id) wearableState.deviceId = data.device_id;

      broadcastSSE({
        type: 'WEARABLE_STATUS',
        connected: true,
        deviceId: wearableState.deviceId,
        lastSeen: wearableState.lastSeen,
        rssi: data.rssi || null
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Heartbeat acknowledged',
        device_id: wearableState.deviceId,
        timestamp: new Date().toISOString()
      }));
    });
    return true;
  }

  // 4. Hardware SOS Trigger: POST /api/sos/wearable OR POST /api/sos/arduino
  if ((pathname === '/api/sos/wearable' || pathname === '/api/sos/arduino') && req.method === 'POST') {
    readJsonBody((err, data) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
      }

      // Security check
      if (!authenticate()) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          error: 'Unauthorized: Missing or invalid device authorization key'
        }));
      }

      const source = data.source || 'ESP8266_WEARABLE';
      const deviceId = data.device_id || data.deviceId || wearableState.deviceId || 'ESP8266_BAND_01';
      const eventType = data.event || 'SOS';
      const isTestMode = data.test_mode === true || data.testMode === true || eventType === 'TEST_SOS';
      const now = Date.now();

      const clientEventId = data.client_event_id || data.clientEventId;
      if (clientEventId && processedClientEvents.has(clientEventId)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          status: 'duplicate_ignored',
          message: 'SOS request already acknowledged (idempotent retry)',
          device_id: deviceId,
          event_id: processedClientEvents.get(clientEventId),
          mode: isTestMode ? 'test' : 'production'
        }));
      }

      // Deduplication check: ignore if received within 3 seconds
      if (now - lastTriggerTime < DEDUP_WINDOW_MS && !isTestMode) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          status: 'duplicate_ignored',
          message: 'SOS request ignored due to active cooldown window',
          device_id: deviceId,
          mode: isTestMode ? 'test' : 'production'
        }));
      }

      lastTriggerTime = now;
      wearableState.lastSeen = now;
      wearableState.connected = true;
      wearableState.deviceId = deviceId;
      wearableState.lastSos = new Date().toISOString();
      wearableState.lastSosSource = source;

      const isArduino = source.includes('ARDUINO') || source.includes('NANO') || source.includes('UNO');
      const deviceLabel = isArduino
        ? (source.includes('UNO') ? 'Arduino Uno Wearable (External Button)' : 'Arduino Nano Wearable (External Button)')
        : 'ESP8266 Wearable Band (Inbuilt FLASH Button)';
      const emergencyLabel = isArduino
        ? 'Hardware SOS (Arduino External Button)'
        : 'Hardware SOS (ESP8266 Inbuilt Button)';

      const eventRecord = {
        id: `EVT-${Date.now().toString().slice(-6)}`,
        deviceId,
        source,
        deviceType: deviceLabel,
        eventType,
        isTest: isTestMode,
        timestamp: wearableState.lastSos,
        rawPayload: data
      };

      if (clientEventId) {
        processedClientEvents.set(clientEventId, eventRecord.id);
        if (processedClientEvents.size > 200) {
          const firstKey = processedClientEvents.keys().next().value;
          processedClientEvents.delete(firstKey);
        }
      }

      wearableState.recentEvents.unshift(eventRecord);
      if (wearableState.recentEvents.length > 50) wearableState.recentEvents.pop();

      // Persist incident in database
      createIncidentRecord({
        id: eventRecord.id,
        source,
        deviceId,
        emergencyType: emergencyLabel,
        description: isArduino
          ? `Emergency alert triggered via ${deviceLabel} (${deviceId}). Wearer pressed external push button on Pin D2.`
          : `Emergency alert triggered via ESP8266 (${deviceId}). Wearer pressed onboard inbuilt FLASH button on GPIO 0.`,
        timestamp: wearableState.lastSos
      });

      // Automatically initiate simultaneous calls to all 3 registered emergency contacts!
      initiateSimultaneousEmergencyCalls({
        incidentId: eventRecord.id,
        emergencyType: emergencyLabel,
        callerName: 'Kunal Gaur',
        isTestMode
      }).catch(callErr => {
        console.error('[HARDWARE API] Telephony call dispatch error:', callErr);
      });

      // Automatically dispatch SMS & WhatsApp messages with exact location to family contacts!
      dispatchAutomaticFamilyAlerts({
        incidentId: eventRecord.id,
        callerName: 'Kunal Gaur',
        emergencyType: emergencyLabel,
        severity: 'Critical',
        source,
        deviceId,
        isTestMode
      }).catch(msgErr => {
        console.error('[HARDWARE API] Messaging dispatch error:', msgErr);
      });

      // Broadcast to all open web application instances via SSE
      broadcastSSE({
        type: isTestMode ? 'WEARABLE_TEST_SOS' : 'WEARABLE_SOS',
        deviceId,
        source,
        deviceType: deviceLabel,
        event: eventType,
        isTest: isTestMode,
        timestamp: wearableState.lastSos,
        eventId: eventRecord.id
      });

      console.log(`[HARDWARE API] 🚨 ${isTestMode ? 'TEST SOS' : 'EMERGENCY SOS'} from ${deviceLabel} [${deviceId}] at ${wearableState.lastSos} -> 3 simultaneous emergency calls + SMS & WhatsApp location dispatched`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: isTestMode ? 'TEST SOS received - no live emergency units dispatched' : 'SOS activated and 3 emergency contacts called',
        device_id: deviceId,
        source,
        event_id: eventRecord.id,
        test_mode: isTestMode,
        mode: isTestMode ? 'test' : 'production',
        timestamp: wearableState.lastSos
      }));
    });
    return true;
  }

  return false;
}
