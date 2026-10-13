// RakshaPulse Telephony & Emergency Contacts API Router
// Dispatches simultaneous outgoing calls, handles webhooks, and manages contacts

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getContacts,
  saveContacts,
  getCallsForIncident,
  getCallHistory,
  updateCallRecord,
  createIncidentRecord
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  initiateSimultaneousEmergencyCalls,
  generateVoiceTwiML,
  mapTwilioStatus,
  validateTwilioWebhookSignature,
  getTelephonyConfigStatus
} from './telephonyService.js';
import {
  dispatchAutomaticFamilyAlerts,
  getIncidentMessages
} from './messagingService.js';
import { broadcastSSE } from './wearableBackend.js';

// Helper to read JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2e5) req.destroy();
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(new Error('Malformed JSON'));
      }
    });
  });
}

// Helper to parse urlencoded body (Twilio webhooks)
function parseFormBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2e5) req.destroy();
    });
    req.on('end', () => {
      const params = {};
      const pairs = body.split('&');
      for (const pair of pairs) {
        if (!pair) continue;
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
      }
      resolve(params);
    });
  });
}

export async function handleTelephonyRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Key, X-Twilio-Signature');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  // 1. GET /api/telephony/config-status
  if (pathname === '/api/telephony/config-status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getTelephonyConfigStatus()));
    return true;
  }

  // 1b. POST /api/telephony/config (Update provider credentials)
  if (pathname === '/api/telephony/config' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (body.accountSid) process.env.TWILIO_ACCOUNT_SID = body.accountSid.trim();
      if (body.authToken) process.env.TWILIO_AUTH_TOKEN = body.authToken.trim();
      if (body.phoneNumber) process.env.TWILIO_PHONE_NUMBER = body.phoneNumber.trim();
      if (body.baseUrl) process.env.APP_BASE_URL = body.baseUrl.trim();
      if (body.testMode !== undefined) process.env.TELEPHONY_TEST_MODE = String(body.testMode);

      // Persist to .env file
      try {
        const envFile = path.join(__dirname, '../.env');
        let content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf-8') : '';
        const setEnvVar = (k, v) => {
          const re = new RegExp(`^${k}=.*$`, 'm');
          if (re.test(content)) {
            content = content.replace(re, `${k}=${v}`);
          } else {
            content += `\n${k}=${v}`;
          }
        };
        if (body.accountSid) setEnvVar('TWILIO_ACCOUNT_SID', body.accountSid.trim());
        if (body.authToken) setEnvVar('TWILIO_AUTH_TOKEN', body.authToken.trim());
        if (body.phoneNumber) setEnvVar('TWILIO_PHONE_NUMBER', body.phoneNumber.trim());
        if (body.baseUrl) setEnvVar('APP_BASE_URL', body.baseUrl.trim());
        if (body.testMode !== undefined) setEnvVar('TELEPHONY_TEST_MODE', String(body.testMode));
        fs.writeFileSync(envFile, content.trim() + '\n', 'utf-8');
      } catch (err) {
        console.warn('Could not write to .env file:', err);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Telephony configuration updated successfully',
        status: getTelephonyConfigStatus()
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // 2. GET /api/contacts
  if (pathname === '/api/contacts' && req.method === 'GET') {
    const userId = url.searchParams.get('userId') || 'user-default';
    const contacts = getContacts(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, contacts }));
    return true;
  }

  // 3. POST /api/contacts
  if (pathname === '/api/contacts' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const userId = body.userId || 'user-default';
      const contacts = body.contacts || [];

      const saved = saveContacts(userId, contacts);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Emergency contacts saved successfully',
        contacts: saved
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // 4. POST /api/emergency/trigger-calls (From web app SOS button)
  if (pathname === '/api/emergency/trigger-calls' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const incidentId = body.incidentId || `RP-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create incident record in DB if not already present
      createIncidentRecord({
        id: incidentId,
        userId: body.userId || 'user-default',
        source: body.source || 'APP',
        emergencyType: body.emergencyType || 'Immediate Assistance',
        description: body.description || 'Emergency SOS triggered',
        location: body.location || null
      });

      // Dispatch 3 simultaneous outgoing calls
      const callSummary = await initiateSimultaneousEmergencyCalls({
        incidentId,
        userId: body.userId || 'user-default',
        callerName: body.callerName || 'Kunal Gaur',
        emergencyType: body.emergencyType || 'Immediate Assistance',
        location: body.location || null,
        contacts: body.contacts || null,
        isTestMode: body.isTestMode === true
      });

      // Automatically dispatch SMS & WhatsApp messages with exact location to all family contacts!
      const messageSummary = await dispatchAutomaticFamilyAlerts({
        incidentId,
        callerName: body.callerName || 'Kunal Gaur',
        emergencyType: body.emergencyType || 'Immediate Assistance',
        severity: body.severity || 'Critical',
        location: body.location || null,
        contacts: body.contacts || null,
        source: body.source || 'APP',
        deviceId: body.deviceId || null,
        isTestMode: body.isTestMode === true
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: `Dispatched ${callSummary.totalAttempted} calls and ${messageSummary.dispatchedCount} SMS/WhatsApp alerts`,
        incidentId,
        callSummary,
        messageSummary
      }));
    } catch (err) {
      console.error('[API] Error in /api/emergency/trigger-calls:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // 4b. POST /api/emergency/dispatch-messages (Automatic SMS & WhatsApp dispatch)
  if (pathname === '/api/emergency/dispatch-messages' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const incidentId = body.incidentId || `RP-${Date.now()}`;

      const messageSummary = await dispatchAutomaticFamilyAlerts({
        incidentId,
        callerName: body.callerName || 'Kunal Gaur',
        emergencyType: body.emergencyType || 'Immediate Assistance',
        severity: body.severity || 'Critical',
        location: body.location || null,
        contacts: body.contacts || null,
        source: body.source || 'APP',
        deviceId: body.deviceId || null,
        isTestMode: body.isTestMode === true
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        incidentId,
        messageSummary
      }));
    } catch (err) {
      console.error('[API] Error in /api/emergency/dispatch-messages:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return true;
  }

  // 4c. GET /api/emergency/messages/:incidentId (Retrieve SMS & WhatsApp statuses)
  if (pathname.startsWith('/api/emergency/messages/') && req.method === 'GET') {
    const incidentId = pathname.replace('/api/emergency/messages/', '').trim();
    const messages = getIncidentMessages(incidentId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, incidentId, messages }));
    return true;
  }

  // 5. GET /api/emergency/calls/:incidentId
  if (pathname.startsWith('/api/emergency/calls/') && req.method === 'GET') {
    const incidentId = pathname.replace('/api/emergency/calls/', '').trim();
    const calls = getCallsForIncident(incidentId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, incidentId, calls }));
    return true;
  }

  // 6. GET /api/emergency/call-history
  if (pathname === '/api/emergency/call-history' && req.method === 'GET') {
    const userId = url.searchParams.get('userId') || 'user-default';
    const history = getCallHistory(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, history }));
    return true;
  }

  // 7. POST /api/telephony/status-callback (Twilio status webhook)
  if (pathname === '/api/telephony/status-callback' && req.method === 'POST') {
    try {
      const formParams = await parseFormBody(req);
      const queryCallId = url.searchParams.get('callId');
      const queryIncidentId = url.searchParams.get('incidentId');

      const callSid = formParams.CallSid;
      const rawStatus = formParams.CallStatus;
      const duration = formParams.CallDuration ? parseInt(formParams.CallDuration, 10) : undefined;
      const unifiedStatus = mapTwilioStatus(rawStatus);

      console.log(`[TELEPHONY WEBHOOK] Call ${callSid || queryCallId} status: ${rawStatus} -> ${unifiedStatus}`);

      const targetId = queryCallId || callSid;
      const updated = updateCallRecord(targetId, {
        status: unifiedStatus,
        providerCallSid: callSid,
        duration,
        statusDetails: `Twilio status update: ${rawStatus}`
      });

      if (updated) {
        broadcastSSE({
          type: 'EMERGENCY_CALL_UPDATE',
          incidentId: queryIncidentId || updated.incidentId,
          call: updated
        });
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } catch (err) {
      console.error('[TELEPHONY WEBHOOK ERROR]:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Webhook processing error');
    }
    return true;
  }

  // 8. ALL /api/telephony/voice-twiml (Twilio voice response XML)
  if (pathname === '/api/telephony/voice-twiml') {
    const callerName = url.searchParams.get('caller') || 'Kunal Gaur';
    const emergencyType = url.searchParams.get('type') || 'Emergency SOS';
    const location = url.searchParams.get('loc') || '';

    const xml = generateVoiceTwiML({
      callerName,
      emergencyType,
      locationAddress: location
    });

    res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(xml);
    return true;
  }

  return false;
}
