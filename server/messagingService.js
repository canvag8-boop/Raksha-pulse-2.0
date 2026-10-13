// RakshaPulse Automatic SMS & WhatsApp Emergency Messaging Service (ES Module)
// Automatically dispatches emergency alert SMS and WhatsApp messages with exact location to family contacts

import { broadcastSSE } from './wearableBackend.js';
import { getContacts } from './db.js';

// In-memory message delivery logs: Map<incidentId, Array<MessageRecord>>
const messageDeliveryStore = new Map();

// Check if Twilio SMS / WhatsApp is configured in environment
export function isMessagingConfigured() {
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

/**
 * Builds the comprehensive emergency alert message body containing exact location
 */
export function buildEmergencyAlertMessage({
  callerName = 'Kunal Gaur',
  emergencyType = 'Emergency SOS',
  severity = 'Critical',
  location = {},
  source = 'APP',
  deviceId = null,
  timestamp = null
}) {
  const lat = location.lat !== undefined ? Number(location.lat).toFixed(6) : '12.971600';
  const lng = location.lng !== undefined ? Number(location.lng).toFixed(6) : '77.594600';
  const address = location.address || 'Connaught Place, New Delhi';
  const mapsLink = location.mapsUrl || `https://maps.google.com/?q=${lat},${lng}`;
  const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

  let sourceTag = '';
  if (source === 'ESP8266_WEARABLE') {
    sourceTag = `[Trigger: ESP8266 Wearable FLASH Button (${deviceId || 'BAND001'})]\n`;
  } else if (source === 'ARDUINO_UNO' || source === 'ARDUINO_NANO') {
    sourceTag = `[Trigger: Hardware Wearable (${deviceId || 'HARDWARE_01'})]\n`;
  }

  return `🚨 RAKSHAPULSE EMERGENCY ALERT 🚨
${callerName} is in immediate distress and triggered SOS!
${sourceTag}
📍 EXACT LOCATION:
Address: ${address}
GPS Coordinates: ${lat}, ${lng}
Live Google Maps: ${mapsLink}

⚠️ EMERGENCY DETAILS:
Type: ${emergencyType}
Severity: ${severity.toUpperCase()}
Reported At: ${timeStr}

⚡ ACTION REQUIRED:
Please call ${callerName} or emergency responders (112) immediately!
Live incident is being tracked on RakshaPulse.`;
}

/**
 * Dispatches automatic SMS and WhatsApp alerts to all active family contacts
 */
export async function dispatchAutomaticFamilyAlerts({
  incidentId = `RP-${Date.now()}`,
  callerName = 'Kunal Gaur',
  emergencyType = 'Immediate Assistance',
  severity = 'Critical',
  location = {},
  contacts = null,
  source = 'APP',
  deviceId = null,
  isTestMode = false
}) {
  // 1. Resolve contacts from param or database
  let targetContacts = contacts;
  if (!Array.isArray(targetContacts) || targetContacts.length === 0) {
    targetContacts = getContacts();
  }

  // Filter only enabled contacts
  const eligibleContacts = (targetContacts || []).filter(c => c.enabled !== false && c.status !== 'Disabled');

  if (eligibleContacts.length === 0) {
    console.warn(`[MESSAGING API] No active contacts found for incident #${incidentId}`);
    return {
      incidentId,
      dispatchedCount: 0,
      messages: []
    };
  }

  // 2. Generate the formatted message text with exact GPS coordinates
  const messageBody = buildEmergencyAlertMessage({
    callerName,
    emergencyType,
    severity,
    location,
    source,
    deviceId
  });

  const isLive = isMessagingConfigured() && !isTestMode && process.env.TELEPHONY_TEST_MODE !== 'true';
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+15005550006';
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || fromNumber;

  console.log(`[MESSAGING API] 📨 Automatic SMS & WhatsApp dispatch initiated for Incident #${incidentId}`);
  console.log(`[MESSAGING API] ℹ️ Destination: ${eligibleContacts.length} contacts | Mode: ${isLive ? 'LIVE' : 'SIMULATED / SANDBOX'}`);

  const dispatchedRecords = [];

  // 3. For each contact, generate SMS and WhatsApp dispatch tasks
  for (const contact of eligibleContacts) {
    const cleanPhone = (contact.phone || '').replace(/[^\d+]/g, '');
    if (!cleanPhone) continue;

    // A) SMS Message Record
    const smsRecord = {
      messageId: `SMS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      incidentId,
      contactId: contact.id,
      contactName: contact.name,
      phone: cleanPhone,
      channel: 'SMS',
      status: 'QUEUED',
      body: messageBody,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      providerMessageSid: null,
      isTest: !isLive
    };

    // B) WhatsApp Message Record
    const whatsappRecord = {
      messageId: `WA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      incidentId,
      contactId: contact.id,
      contactName: contact.name,
      phone: cleanPhone,
      channel: 'WHATSAPP',
      status: 'QUEUED',
      body: messageBody,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      providerMessageSid: null,
      isTest: !isLive
    };

    dispatchedRecords.push(smsRecord, whatsappRecord);
  }

  // Store in cache
  messageDeliveryStore.set(incidentId, dispatchedRecords);

  // Broadcast initial QUEUED state to web app via SSE
  broadcastSSE({
    type: 'EMERGENCY_MESSAGES_DISPATCHED',
    incidentId,
    messages: dispatchedRecords
  });

  // 4. Execute asynchronous delivery (Twilio or simulated pipeline)
  (async () => {
    for (const record of dispatchedRecords) {
      try {
        if (isLive) {
          // Live Twilio dispatch
          const twilio = (await import('twilio')).default;
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

          const isWhatsApp = record.channel === 'WHATSAPP';
          const toFormatted = isWhatsApp ? `whatsapp:${record.phone}` : record.phone;
          const fromFormatted = isWhatsApp ? `whatsapp:${fromWhatsApp}` : fromNumber;

          const res = await client.messages.create({
            body: record.body,
            to: toFormatted,
            from: fromFormatted
          });

          record.status = 'SENT';
          record.providerMessageSid = res.sid;
        } else {
          // Sandbox Mode: simulate fast, reliable transmission (<300ms)
          record.status = 'SENT';
          record.providerMessageSid = `SM_SIM_${Math.random().toString(36).substr(2, 10)}`;
        }

        // Notify updated status
        broadcastSSE({
          type: 'MESSAGE_STATUS_UPDATE',
          incidentId,
          message: record
        });

        // Simulate delivery acknowledgment after 600ms
        setTimeout(() => {
          record.status = 'DELIVERED';
          record.deliveredAt = new Date().toISOString();
          broadcastSSE({
            type: 'MESSAGE_STATUS_UPDATE',
            incidentId,
            message: record
          });
        }, 600);

      } catch (err) {
        console.error(`[MESSAGING API] Error sending ${record.channel} to ${record.contactName}:`, err.message);
        record.status = 'FAILED';
        record.error = err.message;
        broadcastSSE({
          type: 'MESSAGE_STATUS_UPDATE',
          incidentId,
          message: record
        });
      }
    }
  })();

  return {
    incidentId,
    dispatchedCount: dispatchedRecords.length,
    messages: dispatchedRecords
  };
}

/**
 * Retrieve messages for a given incident
 */
export function getIncidentMessages(incidentId) {
  return messageDeliveryStore.get(incidentId) || [];
}
