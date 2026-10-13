// RakshaPulse Embedded Data Access & Persistence Layer
// Persists contacts, incidents, and telephony calls to server/data/store.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data/store.json');

// Default initial state
const DEFAULT_STATE = {
  users: {
    'user-default': {
      id: 'user-default',
      name: 'Kunal Gaur',
      phone: '+919876543210',
      bloodGroup: 'O+',
      medicalConditions: 'Asthma (inhaler carried)',
      homeAddress: 'Connaught Place, New Delhi'
    }
  },
  contacts: [
    {
      id: 'contact-1',
      userId: 'user-default',
      name: 'Geeta Gaur',
      relationship: 'Mother',
      phone: '+919876511223',
      enabled: true,
      hasConsent: true,
      slot: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: 'contact-2',
      userId: 'user-default',
      name: 'Priya Sharma',
      relationship: 'Spouse',
      phone: '+919811122334',
      enabled: true,
      hasConsent: true,
      slot: 2,
      createdAt: new Date().toISOString()
    },
    {
      id: 'contact-3',
      userId: 'user-default',
      name: 'Dr. Anand Verma',
      relationship: 'Family Physician',
      phone: '+919900088776',
      enabled: true,
      hasConsent: true,
      slot: 3,
      createdAt: new Date().toISOString()
    }
  ],
  incidents: [],
  calls: []
};

// In-memory cache synced with disk
let dbCache = null;

function loadDatabase() {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      dbCache = JSON.parse(raw);
    } else {
      dbCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
      persistDatabase();
    }
  } catch (err) {
    console.error('[DB] Error loading database file, falling back to defaults:', err);
    dbCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  return dbCache;
}

function persistDatabase() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error saving database file:', err);
  }
}

/**
 * Validates and normalizes phone number to E.164-compatible format (+CountryCodeDigits)
 * Accepts: "+91 98765 11223", "+919876511223", "+1 (555) 123-4567", etc.
 */
export function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Phone number must be a non-empty string');
  }

  // Strip spaces, dashes, parentheses
  const cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '');

  if (!cleaned.startsWith('+')) {
    throw new Error('Phone number must include international country code starting with "+" (e.g. +91...)');
  }

  // Must only contain + and digits, 7 to 15 digits total after +
  const digits = cleaned.slice(1);
  if (!/^\d{7,15}$/.test(digits)) {
    throw new Error('Invalid phone number length or non-digit characters. Expected E.164 format (e.g. +919876511223)');
  }

  return cleaned;
}

// ==========================================
//  CONTACTS CRUD
// ==========================================

export function getContacts(userId = 'user-default') {
  const db = loadDatabase();
  return (db.contacts || []).filter(c => c.userId === userId);
}

export function saveContacts(userId = 'user-default', contactsList) {
  if (!Array.isArray(contactsList)) {
    throw new Error('Contacts must be provided as an array');
  }

  if (contactsList.length > 3) {
    throw new Error('A maximum of 3 emergency contacts is supported');
  }

  // Validate each contact
  const seenPhones = new Set();
  const validated = contactsList.map((c, index) => {
    if (!c.name || typeof c.name !== 'string' || !c.name.trim()) {
      throw new Error(`Contact #${index + 1} must have a valid name`);
    }

    const normPhone = normalizePhoneNumber(c.phone);
    if (seenPhones.has(normPhone)) {
      throw new Error(`Duplicate phone number detected: ${normPhone}. All contacts must have unique numbers.`);
    }
    seenPhones.add(normPhone);

    return {
      id: c.id || `contact-${Date.now()}-${index}`,
      userId,
      name: c.name.trim(),
      relationship: (c.relationship || 'Emergency Contact').trim(),
      phone: normPhone,
      enabled: c.enabled !== false, // default true
      hasConsent: c.hasConsent !== false, // user confirmed consent
      slot: index + 1,
      updatedAt: new Date().toISOString()
    };
  });

  const db = loadDatabase();
  // Filter out existing contacts for this user and replace
  db.contacts = (db.contacts || []).filter(c => c.userId !== userId).concat(validated);
  persistDatabase();

  return validated;
}

// ==========================================
//  INCIDENT OPERATIONS
// ==========================================

export function createIncidentRecord(data) {
  const db = loadDatabase();
  const incidentId = data.id || `RP-${Math.floor(1000 + Math.random() * 9000)}`;

  const record = {
    id: incidentId,
    userId: data.userId || 'user-default',
    source: data.source || 'APP', // 'APP' | 'ESP8266_WEARABLE'
    deviceId: data.deviceId || null,
    emergencyType: data.emergencyType || 'Immediate Assistance',
    description: data.description || 'Emergency SOS triggered',
    location: data.location || null,
    status: data.status || 'REPORTED',
    createdAt: data.timestamp || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.incidents.unshift(record);
  if (db.incidents.length > 100) db.incidents.pop();
  persistDatabase();

  return record;
}

export function getIncident(incidentId) {
  const db = loadDatabase();
  return db.incidents.find(inc => inc.id === incidentId) || null;
}

export function updateIncidentStatus(incidentId, status) {
  const db = loadDatabase();
  const inc = db.incidents.find(i => i.id === incidentId);
  if (inc) {
    inc.status = status;
    inc.updatedAt = new Date().toISOString();
    persistDatabase();
  }
  return inc;
}

// ==========================================
//  TELEPHONY CALL RECORDS
// ==========================================

export function createCallRecord(callData) {
  const db = loadDatabase();
  const callRecord = {
    callId: callData.callId || `CALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    incidentId: callData.incidentId,
    userId: callData.userId || 'user-default',
    contactId: callData.contactId,
    contactName: callData.contactName,
    phone: callData.phone,
    relationship: callData.relationship || 'Emergency Contact',
    provider: callData.provider || 'twilio',
    providerCallSid: callData.providerCallSid || null,
    status: callData.status || 'QUEUED', // QUEUED, INITIATED, RINGING, IN_PROGRESS, COMPLETED, BUSY, NO_ANSWER, FAILED, CANCELED
    duration: callData.duration || 0,
    failureReason: callData.failureReason || null,
    isTestMode: !!callData.isTestMode,
    initiatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [
      {
        status: callData.status || 'QUEUED',
        timestamp: new Date().toISOString(),
        details: 'Call created in system'
      }
    ]
  };

  db.calls.unshift(callRecord);
  if (db.calls.length > 200) db.calls.pop();
  persistDatabase();

  return callRecord;
}

export function updateCallRecord(callIdOrSid, updateFields) {
  const db = loadDatabase();
  const call = db.calls.find(c => c.callId === callIdOrSid || c.providerCallSid === callIdOrSid);
  if (!call) return null;

  if (updateFields.status && updateFields.status !== call.status) {
    call.events.push({
      status: updateFields.status,
      timestamp: new Date().toISOString(),
      details: updateFields.statusDetails || `Status changed to ${updateFields.status}`
    });
    call.status = updateFields.status;
  }

  if (updateFields.providerCallSid) call.providerCallSid = updateFields.providerCallSid;
  if (updateFields.duration !== undefined) call.duration = updateFields.duration;
  if (updateFields.failureReason) call.failureReason = updateFields.failureReason;
  call.updatedAt = new Date().toISOString();

  persistDatabase();
  return call;
}

export function getCallsForIncident(incidentId) {
  const db = loadDatabase();
  return db.calls.filter(c => c.incidentId === incidentId);
}

export function getCallHistory(userId = 'user-default', limit = 50) {
  const db = loadDatabase();
  return db.calls
    .filter(c => !userId || c.userId === userId)
    .slice(0, limit);
}

// Reset helper for tests
export function _resetDatabase() {
  dbCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
  persistDatabase();
}
