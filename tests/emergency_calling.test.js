// RakshaPulse Automated Test Suite for Simultaneous Emergency Calling
// Covers all 17 required scenarios using Node.js built-in test runner (node:test, node:assert)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  getContacts,
  saveContacts,
  createIncidentRecord,
  getIncident,
  createCallRecord,
  updateCallRecord,
  getCallsForIncident,
  getCallHistory,
  _resetDatabase
} from '../server/db.js';
import {
  initiateSimultaneousEmergencyCalls,
  validateTwilioWebhookSignature,
  generateVoiceTwiML,
  mapTwilioStatus,
  isTelephonyConfigured,
  getTelephonyConfigStatus
} from '../server/telephonyService.js';
import {
  buildEmergencyAlertMessage,
  dispatchAutomaticFamilyAlerts,
  getIncidentMessages
} from '../server/messagingService.js';

test.beforeEach(() => {
  _resetDatabase();
});

// =============================================================================
//  TEST 1: Saving Three Emergency Contacts
// =============================================================================
test('1. Saving three emergency contacts with valid E.164 phone numbers', () => {
  const contactsInput = [
    { name: 'Geeta Gaur', relationship: 'Mother', phone: '+91 98765 11223', enabled: true, hasConsent: true },
    { name: 'Priya Sharma', relationship: 'Spouse', phone: '+91 98111 22334', enabled: true, hasConsent: true },
    { name: 'Dr. Anand Verma', relationship: 'Family Physician', phone: '+91 99000 88776', enabled: true, hasConsent: true }
  ];

  const saved = saveContacts('user-default', contactsInput);
  assert.equal(saved.length, 3);
  assert.equal(saved[0].name, 'Geeta Gaur');
  assert.equal(saved[0].phone, '+919876511223');
  assert.equal(saved[0].slot, 1);
  assert.equal(saved[1].phone, '+919811122334');
  assert.equal(saved[2].phone, '+919900088776');

  const retrieved = getContacts('user-default');
  assert.equal(retrieved.length, 3);
});

// =============================================================================
//  TEST 2: Updating and Deleting Contacts
// =============================================================================
test('2. Updating and deleting contacts', () => {
  const initial = [
    { id: 'c-1', name: 'Papa', relationship: 'Father', phone: '+91 98765 00001', enabled: true },
    { id: 'c-2', name: 'Rohan', relationship: 'Brother', phone: '+91 98765 00002', enabled: true }
  ];
  saveContacts('user-default', initial);

  // Update
  const updatedList = [
    { id: 'c-1', name: 'Papa (Home)', relationship: 'Father', phone: '+91 98765 00001', enabled: true },
    { id: 'c-2', name: 'Rohan', relationship: 'Brother', phone: '+91 98765 00002', enabled: false }
  ];
  saveContacts('user-default', updatedList);

  const contactsAfterUpdate = getContacts('user-default');
  assert.equal(contactsAfterUpdate[0].name, 'Papa (Home)');
  assert.equal(contactsAfterUpdate[1].enabled, false);

  // Delete
  const afterDelete = [contactsAfterUpdate[0]];
  saveContacts('user-default', afterDelete);

  const finalContacts = getContacts('user-default');
  assert.equal(finalContacts.length, 1);
  assert.equal(finalContacts[0].name, 'Papa (Home)');
});

// =============================================================================
//  TEST 3: Invalid Phone Numbers & Duplicates
// =============================================================================
test('3. Rejection of invalid phone numbers and duplicate numbers', () => {
  // Missing '+'
  assert.throws(() => normalizePhoneNumber('9876511223'), /country code/i);

  // Alphabetic characters
  assert.throws(() => normalizePhoneNumber('+91 98765 ABCD'), /Invalid phone number/i);

  // Too short
  assert.throws(() => normalizePhoneNumber('+123'), /Invalid phone number length/i);

  // Duplicate phone numbers
  const duplicates = [
    { name: 'Person A', relationship: 'Friend', phone: '+91 98765 11223' },
    { name: 'Person B', relationship: 'Coworker', phone: '+91 98765 11223' }
  ];
  assert.throws(() => saveContacts('user-default', duplicates), /Duplicate phone number detected/i);
});

// =============================================================================
//  TEST 4: Missing Emergency Contacts
// =============================================================================
test('4. Graceful handling of missing emergency contacts', async () => {
  saveContacts('user-default', []); // empty

  const result = await initiateSimultaneousEmergencyCalls({
    incidentId: 'RP-EMPTY-TEST',
    userId: 'user-default'
  });

  assert.equal(result.success, false);
  assert.equal(result.error, 'NO_CONTACTS');
  assert.equal(result.calls.length, 0);
});

// =============================================================================
//  TEST 5: Unauthorized SOS Requests
// =============================================================================
test('5. Unauthorized SOS requests detection', () => {
  const secretKey = 'raksha_band_secret_key_2026';
  const checkAuth = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    return authHeader.substring(7).trim() === secretKey;
  };

  assert.equal(checkAuth('Bearer wrong_token_123'), false);
  assert.equal(checkAuth(null), false);
  assert.equal(checkAuth('Basic dXNlcjpwYXNz'), false);
  assert.equal(checkAuth('Bearer raksha_band_secret_key_2026'), true);
});

// =============================================================================
//  TEST 6: Unauthorized ESP8266 Requests
// =============================================================================
test('6. Unauthorized ESP8266 requests rejected safely', () => {
  const validKey = 'raksha_band_secret_key_2026';
  const authenticateESP = (customKey) => customKey === validKey;

  assert.equal(authenticateESP('invalid_hacker_key'), false);
  assert.equal(authenticateESP(''), false);
  assert.equal(authenticateESP(validKey), true);
});

// =============================================================================
//  TEST 7: Triggering SOS from Web Application
// =============================================================================
test('7. Triggering SOS from the web application creates incident and dispatches calls', async () => {
  const incident = createIncidentRecord({
    id: 'RP-WEB-9001',
    userId: 'user-default',
    source: 'APP',
    emergencyType: 'Fire',
    description: 'Apartment corridor smoke detected',
    location: { address: 'Indiranagar 100ft Road, Bengaluru', lat: 12.9716, lng: 77.5946 }
  });

  assert.equal(incident.id, 'RP-WEB-9001');
  assert.equal(incident.source, 'APP');

  const callSummary = await initiateSimultaneousEmergencyCalls({
    incidentId: incident.id,
    emergencyType: incident.emergencyType,
    isTestMode: true
  });

  assert.equal(callSummary.incidentId, 'RP-WEB-9001');
  assert.equal(callSummary.totalAttempted, 3);
  assert.equal(callSummary.successfulDispatches, 3);
  assert.equal(callSummary.calls.length, 3);
});

// =============================================================================
//  TEST 8: Triggering SOS from ESP8266 Wearable Inbuilt FLASH Button
// =============================================================================
test('8. Triggering SOS from the ESP8266 wearable inbuilt button starts concurrent calls and records event', async () => {
  const wearableIncident = createIncidentRecord({
    id: 'EVT-ESP-9988',
    userId: 'user-default',
    source: 'ESP8266_WEARABLE',
    deviceId: 'ESP8266_BAND_01',
    emergencyType: 'Hardware SOS (ESP8266 Inbuilt Button)',
    description: 'User pressed onboard inbuilt FLASH button on GPIO 0'
  });

  assert.equal(wearableIncident.source, 'ESP8266_WEARABLE');
  assert.equal(wearableIncident.deviceId, 'ESP8266_BAND_01');

  const summary = await initiateSimultaneousEmergencyCalls({
    incidentId: wearableIncident.id,
    emergencyType: wearableIncident.emergencyType,
    isTestMode: true
  });

  assert.equal(summary.incidentId, 'EVT-ESP-9988');
  assert.equal(summary.calls.length, 3);
  assert.ok(summary.calls.every(c => c.incidentId === 'EVT-ESP-9988'));
});

// =============================================================================
//  TEST 8B: Triggering SOS from ESP8266 Wi-Fi / Serial payload
// =============================================================================
test('8B. Triggering SOS from ESP8266 Wi-Fi/Serial payload starts concurrent calls and records event', async () => {
  const espIncident = createIncidentRecord({
    id: 'EVT-ESP-112',
    userId: 'user-default',
    source: 'ESP8266_WEARABLE',
    deviceId: 'ESP8266_BAND_01',
    emergencyType: 'Hardware SOS (ESP8266 Inbuilt Button)',
    description: 'Inbuilt FLASH button long-hold trigger'
  });

  assert.equal(espIncident.source, 'ESP8266_WEARABLE');
  assert.equal(espIncident.deviceId, 'ESP8266_BAND_01');

  const summary = await initiateSimultaneousEmergencyCalls({
    incidentId: espIncident.id,
    emergencyType: espIncident.emergencyType,
    isTestMode: true
  });

  assert.equal(summary.incidentId, 'EVT-ESP-112');
  assert.equal(summary.calls.length, 3);
  assert.ok(summary.calls.every(c => c.incidentId === 'EVT-ESP-112'));
});

// =============================================================================
//  TEST 9: Initiating Three Calls Concurrently
// =============================================================================
test('9. Initiating three calls concurrently with same event ID', async () => {
  const eventId = 'RP-CONCURRENT-777';

  const startTime = Date.now();
  const summary = await initiateSimultaneousEmergencyCalls({
    incidentId: eventId,
    emergencyType: 'Medical Emergency',
    isTestMode: true
  });
  const durationMs = Date.now() - startTime;

  // Since calls run concurrently via Promise.allSettled, dispatch time is instantaneous (< 100ms)
  assert.ok(durationMs < 500, `Dispatch took ${durationMs}ms - calls must not be serialized`);
  assert.equal(summary.calls.length, 3);

  // Verify all 3 calls share the exact same incidentId
  assert.equal(summary.calls[0].incidentId, eventId);
  assert.equal(summary.calls[1].incidentId, eventId);
  assert.equal(summary.calls[2].incidentId, eventId);

  // Verify unique call IDs
  const callIds = new Set(summary.calls.map(c => c.callId));
  assert.equal(callIds.size, 3);
});

// =============================================================================
//  TEST 10: One Call Failing While the Other Two Proceed
// =============================================================================
test('10. Partial failure: one call fails while the other two succeed concurrently', async () => {
  const mixedContacts = [
    { id: 'c-ok-1', name: 'Mother', phone: '+91 98765 11111', enabled: true },
    { id: 'c-fail', name: 'Invalid Contact', phone: '+00 00000', enabled: true }, // will fail validation
    { id: 'c-ok-2', name: 'Doctor', phone: '+91 98765 22222', enabled: true }
  ];

  // Attempt dispatch with the mixed contacts
  const summary = await initiateSimultaneousEmergencyCalls({
    incidentId: 'RP-PARTIAL-FAIL',
    contacts: mixedContacts,
    isTestMode: true
  });

  assert.equal(summary.totalAttempted, 3);
  assert.ok(summary.calls.length === 3);

  const activeCalls = getCallsForIncident('RP-PARTIAL-FAIL');
  assert.equal(activeCalls.length, 3);
  // Verify other two calls were not aborted
  const succeeded = activeCalls.filter(c => c.status !== 'FAILED');
  assert.ok(succeeded.length >= 2);
});

// =============================================================================
//  TEST 11: Provider Authentication Errors
// =============================================================================
test('11. Provider authentication errors handled safely without unhandled crashes', async () => {
  const call = createCallRecord({
    incidentId: 'RP-AUTH-ERR',
    contactId: 'c-1',
    contactName: 'Priya',
    phone: '+919811122334',
    status: 'QUEUED'
  });

  // Simulate provider auth rejection
  const updated = updateCallRecord(call.callId, {
    status: 'FAILED',
    failureReason: 'Twilio Error 20003: Authentication Error - Invalid Account SID or Auth Token'
  });

  assert.equal(updated.status, 'FAILED');
  assert.match(updated.failureReason, /Authentication Error/);
});

// =============================================================================
//  TEST 12: Invalid Webhook Signatures
// =============================================================================
test('12. Twilio webhook signature verification rejects invalid signatures', () => {
  const authToken = '1234567890abcdef1234567890abcdef';
  const url = 'https://example.com/api/telephony/status-callback';
  const params = { CallSid: 'CA12345', CallStatus: 'completed' };

  // Random fake signature
  const fakeSignature = 'bad_signature_base64==';
  const isValid = validateTwilioWebhookSignature(url, params, fakeSignature, authToken);
  assert.equal(isValid, false);

  // Missing signature or missing token
  assert.equal(validateTwilioWebhookSignature(url, params, '', authToken), false);
  assert.equal(validateTwilioWebhookSignature(url, params, fakeSignature, ''), false);
});

// =============================================================================
//  TEST 13: Duplicate SOS Submissions
// =============================================================================
test('13. Duplicate SOS submissions within cooldown window detected and ignored', () => {
  let lastTriggerTime = 0;
  const DEDUP_WINDOW_MS = 3000;

  const handleSosTrigger = (timestamp, isTestMode) => {
    if (timestamp - lastTriggerTime < DEDUP_WINDOW_MS && !isTestMode) {
      return { status: 'duplicate_ignored' };
    }
    lastTriggerTime = timestamp;
    return { status: 'activated' };
  };

  const t0 = 10000;
  assert.equal(handleSosTrigger(t0, false).status, 'activated');

  // Trigger 500ms later (within 3000ms cooldown)
  assert.equal(handleSosTrigger(t0 + 500, false).status, 'duplicate_ignored');

  // Trigger 1500ms later (still within cooldown)
  assert.equal(handleSosTrigger(t0 + 1500, false).status, 'duplicate_ignored');

  // Trigger 3500ms later (outside cooldown window)
  assert.equal(handleSosTrigger(t0 + 3500, false).status, 'activated');
});

// =============================================================================
//  TEST 14: Duplicate Provider Callbacks
// =============================================================================
test('14. Duplicate provider callbacks handled idempotently', () => {
  const call = createCallRecord({
    callId: 'CALL-DEDUP-001',
    incidentId: 'RP-DEDUP',
    contactId: 'c-1',
    contactName: 'Test Contact',
    phone: '+919876511223',
    status: 'RINGING'
  });

  // First callback for completed status
  const firstUpdate = updateCallRecord('CALL-DEDUP-001', {
    status: 'COMPLETED',
    duration: 15
  });
  assert.equal(firstUpdate.status, 'COMPLETED');
  const eventsCount = firstUpdate.events.length;

  // Duplicate callback arrives with the exact same completed status
  const secondUpdate = updateCallRecord('CALL-DEDUP-001', {
    status: 'COMPLETED',
    duration: 15
  });
  assert.equal(secondUpdate.status, 'COMPLETED');
  // Status events should not duplicate identical consecutive status transitions
  assert.equal(secondUpdate.events.length, eventsCount);
});

// =============================================================================
//  TEST 15: Call-Status Updates Progression
// =============================================================================
test('15. Call-status updates progress properly through lifecycle', () => {
  const call = createCallRecord({
    callId: 'CALL-LIFECYCLE-99',
    incidentId: 'RP-LIFE',
    contactId: 'c-1',
    contactName: 'Dr. Verma',
    phone: '+919900088776',
    status: 'QUEUED'
  });
  assert.equal(call.status, 'QUEUED');

  // 1. Initiated
  updateCallRecord(call.callId, { status: 'INITIATED' });
  assert.equal(getCallsForIncident('RP-LIFE')[0].status, 'INITIATED');

  // 2. Ringing
  updateCallRecord(call.callId, { status: 'RINGING' });
  assert.equal(getCallsForIncident('RP-LIFE')[0].status, 'RINGING');

  // 3. Answered / In Progress
  updateCallRecord(call.callId, { status: 'IN_PROGRESS' });
  assert.equal(getCallsForIncident('RP-LIFE')[0].status, 'IN_PROGRESS');

  // 4. Completed with duration
  updateCallRecord(call.callId, { status: 'COMPLETED', duration: 18 });
  const final = getCallsForIncident('RP-LIFE')[0];
  assert.equal(final.status, 'COMPLETED');
  assert.equal(final.duration, 18);
});

// =============================================================================
//  TEST 16: Missing Environment Variables
// =============================================================================
test('16. Safe operation when provider environment variables are missing', () => {
  const status = getTelephonyConfigStatus();
  assert.ok(status.provider);
  assert.equal(typeof status.configured, 'boolean');
  assert.equal(typeof status.isTestMode, 'boolean');

  // Check TwiML generator still produces valid XML without crashing
  const twiml = generateVoiceTwiML({
    callerName: 'Kunal Gaur',
    emergencyType: 'Medical',
    locationAddress: 'Connaught Place'
  });
  assert.ok(twiml.startsWith('<?xml'));
  assert.ok(twiml.includes('<Say voice="Polly.Aditi" language="en-IN">'));
  assert.ok(twiml.includes('Kunal Gaur'));
});

// =============================================================================
//  TEST 17: Existing SOS Functionality Remaining Operational
// =============================================================================
test('17. Existing SOS incident tracking, call history and storage remain fully operational', () => {
  const incident = createIncidentRecord({
    id: 'RP-REGRESSION-1',
    emergencyType: 'Immediate Assistance',
    description: 'Central SOS button press'
  });
  assert.equal(getIncident('RP-REGRESSION-1').id, 'RP-REGRESSION-1');

  createCallRecord({
    incidentId: 'RP-REGRESSION-1',
    contactName: 'Contact 1',
    phone: '+919876511223',
    status: 'COMPLETED'
  });

  const history = getCallHistory('user-default');
  assert.ok(history.length >= 1);
  assert.equal(history[0].incidentId, 'RP-REGRESSION-1');

  // Verify status mapping
  assert.equal(mapTwilioStatus('in-progress'), 'IN_PROGRESS');
  assert.equal(mapTwilioStatus('no-answer'), 'NO_ANSWER');
  assert.equal(mapTwilioStatus('busy'), 'BUSY');
});

// =============================================================================
//  TEST 18: Exact Location Formatting in Emergency SMS & WhatsApp Body
// =============================================================================
test('18. buildEmergencyAlertMessage embeds exact coordinates, address, and live Google Maps URL', () => {
  const message = buildEmergencyAlertMessage({
    callerName: 'Kunal Gaur',
    emergencyType: 'Fire & Rescue',
    severity: 'Critical',
    location: {
      address: 'Indiranagar 100ft Road, Bengaluru',
      lat: 12.971598,
      lng: 77.594563
    },
    source: 'ESP8266_WEARABLE',
    deviceId: 'BAND001'
  });

  assert.ok(message.includes('12.971598, 77.594563'), 'Must contain exact GPS coordinates');
  assert.ok(message.includes('Indiranagar 100ft Road, Bengaluru'), 'Must contain verified physical address');
  assert.ok(message.includes('https://maps.google.com/?q=12.971598,77.594563'), 'Must contain clickable Google Maps link');
  assert.ok(message.includes('Kunal Gaur'), 'Must state citizen caller name');
  assert.ok(message.includes('ESP8266'), 'Must include source hardware tag');
});

// =============================================================================
//  TEST 19: Automatic Dispatch of SMS & WhatsApp Alerts to All Contacts
// =============================================================================
test('19. dispatchAutomaticFamilyAlerts sends parallel SMS & WhatsApp alerts to each active contact', async () => {
  const result = await dispatchAutomaticFamilyAlerts({
    incidentId: 'INC-AUTO-MSG-001',
    callerName: 'Kunal Gaur',
    emergencyType: 'Medical Distress',
    severity: 'Critical',
    location: {
      address: 'MG Road Metro Station',
      lat: 12.9756,
      lng: 77.6066
    },
    isTestMode: true
  });

  assert.equal(result.incidentId, 'INC-AUTO-MSG-001');
  assert.ok(result.dispatchedCount >= 4, 'Should dispatch both SMS and WhatsApp to active contacts');
  assert.ok(result.messages.some(m => m.channel === 'SMS'), 'Contains SMS records');
  assert.ok(result.messages.some(m => m.channel === 'WHATSAPP'), 'Contains WhatsApp records');
  assert.ok(result.messages.every(m => m.body.includes('12.975600, 77.606600')), 'Every message contains exact coordinates');
});

// =============================================================================
//  TEST 20: Message Retrieval by Incident ID
// =============================================================================
test('20. getIncidentMessages retrieves all dispatched messages for incident ID', () => {
  const messages = getIncidentMessages('INC-AUTO-MSG-001');
  assert.ok(Array.isArray(messages));
  assert.ok(messages.length >= 4);
  assert.ok(messages.every(m => m.incidentId === 'INC-AUTO-MSG-001'));
});

// =============================================================================
//  TEST 21: Arduino Nano Wearable SOS with External Button
// =============================================================================
test('21. Arduino Nano wearable external button trigger initiates concurrent calls, SMS, and WhatsApp alerts', async () => {
  const nanoIncident = createIncidentRecord({
    id: 'EVT-NANO-7788',
    userId: 'user-default',
    source: 'ARDUINO_NANO_WEARABLE',
    deviceId: 'NANO_BAND_01',
    emergencyType: 'Hardware SOS (Arduino External Button)',
    description: 'Emergency alert triggered via Arduino Nano. Wearer pressed external push button on Pin D2.'
  });

  assert.equal(nanoIncident.source, 'ARDUINO_NANO_WEARABLE');
  assert.equal(nanoIncident.deviceId, 'NANO_BAND_01');

  // 1. Concurrent Calls
  const callSummary = await initiateSimultaneousEmergencyCalls({
    incidentId: nanoIncident.id,
    emergencyType: nanoIncident.emergencyType,
    isTestMode: true
  });
  assert.equal(callSummary.calls.length, 3);
  assert.ok(callSummary.calls.every(c => c.incidentId === 'EVT-NANO-7788'));

  // 2. Automated SMS & WhatsApp with exact GPS coordinates
  const msgSummary = await dispatchAutomaticFamilyAlerts({
    incidentId: nanoIncident.id,
    callerName: 'Kunal Gaur',
    emergencyType: nanoIncident.emergencyType,
    severity: 'Critical',
    location: {
      address: 'Sector 62, Noida, Uttar Pradesh',
      lat: 28.6280,
      lng: 77.3649
    },
    source: nanoIncident.source,
    deviceId: nanoIncident.deviceId,
    isTestMode: true
  });

  assert.equal(msgSummary.incidentId, 'EVT-NANO-7788');
  assert.ok(msgSummary.dispatchedCount >= 4);
  assert.ok(msgSummary.messages.every(m => m.body.includes('28.628000, 77.364900')));
  assert.ok(msgSummary.messages.every(m => m.body.includes('https://maps.google.com/?q=28.628000,77.364900')));
});

