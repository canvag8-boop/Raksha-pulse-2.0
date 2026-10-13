// RakshaPulse Cloud Telephony Service (Node.js ES Module)
// Handles simultaneous outgoing emergency calls via Twilio Voice / Sandbox Mode
// Manages concurrency, voice message TwiML generation, status callbacks, and SSE streaming

import crypto from 'crypto';
import {
  createCallRecord,
  updateCallRecord,
  getContacts,
  createIncidentRecord
} from './db.js';
import { broadcastSSE } from './wearableBackend.js';

// Environment configurations
// Determine if real telephony provider is active
export function isTelephonyConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  const phone = process.env.TWILIO_PHONE_NUMBER || '';
  return Boolean(
    sid &&
    token &&
    phone &&
    sid.startsWith('AC') &&
    sid !== 'AC_PLACEHOLDER_SID' &&
    sid !== 'AC_YOUR_TWILIO_ACCOUNT_SID_HERE'
  );
}

export function getTelephonyConfigStatus() {
  const configured = isTelephonyConfigured();
  const provider = process.env.TELEPHONY_PROVIDER || 'twilio';
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  const phone = process.env.TWILIO_PHONE_NUMBER || '';
  const baseUrl = process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || '';

  return {
    provider,
    configured,
    isTestMode: !configured || process.env.TELEPHONY_TEST_MODE === 'true',
    fromNumber: phone ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : null,
    accountSidConfigured: Boolean(sid && sid.startsWith('AC') && sid !== 'AC_YOUR_TWILIO_ACCOUNT_SID_HERE'),
    authConfigured: Boolean(token && token !== 'your_twilio_auth_token_here'),
    baseUrl: baseUrl || 'Local / Auto-detected'
  };
}

/**
 * Validates Twilio Webhook Signature (HMAC-SHA1)
 */
export function validateTwilioWebhookSignature(url, params, signature, authToken = TWILIO_AUTH_TOKEN) {
  if (!authToken || !signature) return false;

  // Twilio signature creation: URL + sorted param keys and their values
  let data = url;
  if (params && typeof params === 'object') {
    const keys = Object.keys(params).sort();
    for (const key of keys) {
      data += `${key}${params[key]}`;
    }
  }

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  return signature === expectedSignature;
}

/**
 * Generates TwiML Voice XML Response
 */
export function generateVoiceTwiML({ callerName = 'Kunal Gaur', emergencyType = 'Emergency SOS', locationAddress = '' }) {
  const safeName = callerName.replace(/[<>&'"]/g, '');
  const safeType = emergencyType.replace(/[<>&'"]/g, '');
  const locSnippet = locationAddress ? ` Near ${locationAddress.replace(/[<>&'"]/g, '').slice(0, 80)}.` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    Emergency alert. Your registered emergency contact, ${safeName}, has triggered an emergency SOS distress alert and may need immediate assistance.
    Emergency type: ${safeType}.${locSnippet}
    Please check the emergency location notification sent to your phone and contact them immediately.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Aditi" language="en-IN">
    Repeating: ${safeName} has activated RakshaPulse Emergency SOS. Please verify their safety.
  </Say>
</Response>`.trim();
}

/**
 * Low-level dispatch of a single call via Twilio Voice API
 */
async function dispatchSingleTwilioCall({ toPhone, callId, incidentId, callerName, emergencyType, locationAddress }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const fromPhone = process.env.TWILIO_PHONE_NUMBER || '';
  const baseUrl = process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || '';

  const twimlUrl = `${baseUrl}/api/telephony/voice-twiml?incidentId=${encodeURIComponent(incidentId)}&caller=${encodeURIComponent(callerName)}&type=${encodeURIComponent(emergencyType)}`;
  const statusCallbackUrl = `${baseUrl}/api/telephony/status-callback?callId=${encodeURIComponent(callId)}&incidentId=${encodeURIComponent(incidentId)}`;

  const formData = new URLSearchParams();
  formData.append('To', toPhone);
  formData.append('From', fromPhone);
  formData.append('Url', twimlUrl);
  formData.append('StatusCallback', statusCallbackUrl);
  formData.append('StatusCallbackEvent', 'initiated');
  formData.append('StatusCallbackEvent', 'ringing');
  formData.append('StatusCallbackEvent', 'answered');
  formData.append('StatusCallbackEvent', 'completed');
  formData.append('StatusCallbackMethod', 'POST');

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message || `Twilio call failed with HTTP ${response.status}`);
  }

  return {
    providerCallSid: body.sid,
    status: mapTwilioStatus(body.status)
  };
}

/**
 * Map Twilio call statuses to unified RakshaPulse status codes
 */
export function mapTwilioStatus(rawStatus) {
  if (!rawStatus) return 'QUEUED';
  const s = rawStatus.toLowerCase();
  switch (s) {
    case 'queued': return 'QUEUED';
    case 'initiated': return 'INITIATED';
    case 'ringing': return 'RINGING';
    case 'in-progress':
    case 'answered': return 'IN_PROGRESS';
    case 'completed': return 'COMPLETED';
    case 'busy': return 'BUSY';
    case 'no-answer': return 'NO_ANSWER';
    case 'failed': return 'FAILED';
    case 'canceled': return 'CANCELED';
    default: return s.toUpperCase();
  }
}

/**
 * Simulate call lifecycle in sandbox / test mode
 * Moves realistically: QUEUED -> RINGING -> IN_PROGRESS -> COMPLETED
 */
function scheduleSimulatedCallLifecycle(callId, incidentId) {
  // 1. Ringing after 1.5s
  setTimeout(() => {
    const updated = updateCallRecord(callId, {
      status: 'RINGING',
      statusDetails: 'Simulated telephone network: phone is ringing'
    });
    if (updated) {
      broadcastSSE({
        type: 'EMERGENCY_CALL_UPDATE',
        incidentId,
        call: updated
      });
    }
  }, 1500);

  // 2. In-Progress (Answered) after 4s
  setTimeout(() => {
    const updated = updateCallRecord(callId, {
      status: 'IN_PROGRESS',
      statusDetails: 'Simulated recipient answered call; automated voice message playing'
    });
    if (updated) {
      broadcastSSE({
        type: 'EMERGENCY_CALL_UPDATE',
        incidentId,
        call: updated
      });
    }
  }, 4000);

  // 3. Completed after 10s
  setTimeout(() => {
    const updated = updateCallRecord(callId, {
      status: 'COMPLETED',
      duration: 12,
      statusDetails: 'Automated voice message finished; call disconnected safely'
    });
    if (updated) {
      broadcastSSE({
        type: 'EMERGENCY_CALL_UPDATE',
        incidentId,
        call: updated
      });
    }
  }, 10000);
}

/**
 * MAIN FUNCTION: Dispatches 3 SIMULTANEOUS OUTGOING EMERGENCY CALLS
 * Fired when user presses SOS in web app OR when ESP8266 wearable sends trigger.
 */
export async function initiateSimultaneousEmergencyCalls({
  incidentId,
  userId = 'user-default',
  callerName = 'Kunal Gaur',
  emergencyType = 'Immediate Assistance',
  location = null,
  contacts = null,
  isTestMode = false
}) {
  const configured = isTelephonyConfigured();
  const effectiveTestMode = isTestMode || !configured || process.env.TELEPHONY_TEST_MODE === 'true';

  // Retrieve user's contacts if not passed in
  const targetContacts = contacts || getContacts(userId);
  const activeContacts = targetContacts.filter(c => c.enabled !== false);

  if (activeContacts.length === 0) {
    return {
      success: false,
      error: 'NO_CONTACTS',
      message: 'No active emergency contacts configured to call.',
      incidentId,
      calls: []
    };
  }

  console.log(`[TELEPHONY] 🚨 Initiating SIMULTANEOUS emergency calls to ${activeContacts.length} contacts for Incident #${incidentId}`);
  if (effectiveTestMode) {
    console.log(`[TELEPHONY] ℹ️ Operating in Sandbox / Test Mode (Configured: ${configured})`);
  }

  // 1. Pre-register call records in database with status QUEUED
  const callRecords = activeContacts.map((contact, index) => {
    const callId = `CALL-${incidentId}-${index + 1}-${Date.now()}`;
    return createCallRecord({
      callId,
      incidentId,
      userId,
      contactId: contact.id,
      contactName: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      provider: configured ? 'twilio' : 'sandbox',
      status: 'QUEUED',
      isTestMode: effectiveTestMode
    });
  });

  // Broadcast initial QUEUED state to web app clients
  broadcastSSE({
    type: 'EMERGENCY_CALLS_INITIATED',
    incidentId,
    timestamp: new Date().toISOString(),
    isTestMode: effectiveTestMode,
    configured,
    calls: callRecords
  });

  // 2. Dispatch calls CONCURRENTLY using Promise.allSettled
  // "Do not wait for the first call to finish before initiating the other two"
  // "Handle individual call failures without preventing the other contacts from being called"
  const callPromises = callRecords.map(async (record) => {
    try {
      if (configured && !effectiveTestMode) {
        // Real Twilio API Call
        const result = await dispatchSingleTwilioCall({
          toPhone: record.phone,
          callId: record.callId,
          incidentId,
          callerName,
          emergencyType,
          locationAddress: location?.address || ''
        });

        const updated = updateCallRecord(record.callId, {
          status: result.status,
          providerCallSid: result.providerCallSid,
          statusDetails: 'Call successfully dispatched to Twilio'
        });

        broadcastSSE({
          type: 'EMERGENCY_CALL_UPDATE',
          incidentId,
          call: updated
        });

        return { success: true, callId: record.callId, providerCallSid: result.providerCallSid, status: result.status };
      } else {
        // Test / Sandbox Mode with simulated Call SID and lifecycle
        const mockSid = `CA_MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const updated = updateCallRecord(record.callId, {
          status: 'INITIATED',
          providerCallSid: mockSid,
          statusDetails: 'Simulated call initiated (Sandbox Mode)'
        });

        broadcastSSE({
          type: 'EMERGENCY_CALL_UPDATE',
          incidentId,
          call: updated
        });

        scheduleSimulatedCallLifecycle(record.callId, incidentId);

        return { success: true, callId: record.callId, providerCallSid: mockSid, status: 'INITIATED' };
      }
    } catch (err) {
      console.error(`[TELEPHONY] ❌ Error dialing contact ${record.contactName} (${record.phone}):`, err.message);

      const updated = updateCallRecord(record.callId, {
        status: 'FAILED',
        failureReason: err.message,
        statusDetails: `Dispatch error: ${err.message}`
      });

      broadcastSSE({
        type: 'EMERGENCY_CALL_UPDATE',
        incidentId,
        call: updated
      });

      return { success: false, callId: record.callId, error: err.message, status: 'FAILED' };
    }
  });

  const results = await Promise.allSettled(callPromises);

  const summary = {
    incidentId,
    totalAttempted: callRecords.length,
    successfulDispatches: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
    failedDispatches: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
    isTestMode: effectiveTestMode,
    configured,
    calls: callRecords
  };

  return summary;
}
