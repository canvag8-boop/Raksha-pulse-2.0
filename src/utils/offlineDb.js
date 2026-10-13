/**
 * RakshaPulse Offline-First Local Database (IndexedDB)
 * 
 * Provides a persistent, structured local store for all critical app data.
 * All reads/writes go here first — the sync queue pushes changes to the
 * remote server when connectivity is restored.
 * 
 * Stores:
 *   - contacts       — emergency contacts (max 3)
 *   - incidents      — emergency incident records
 *   - profile        — user profile data
 *   - settings       — app settings (keyword, API key, audio prefs)
 *   - syncQueue      — pending mutations to push to server
 */

const DB_NAME = 'raksha_pulse_offline';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Opens (or creates) the IndexedDB database.
 * Returns a promise that resolves with the IDBDatabase instance.
 */
export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Contacts store — keyed by contact id
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'id' });
      }

      // Incidents store — keyed by incident id
      if (!db.objectStoreNames.contains('incidents')) {
        const incStore = db.createObjectStore('incidents', { keyPath: 'id' });
        incStore.createIndex('by_timestamp', 'timestamp', { unique: false });
      }

      // Profile store — single record keyed by id
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }

      // Settings store — key-value pairs
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Sync Queue — ordered mutations pending server push
      if (!db.objectStoreNames.contains('syncQueue')) {
        const sqStore = db.createObjectStore('syncQueue', { keyPath: 'queueId', autoIncrement: true });
        sqStore.createIndex('by_timestamp', 'createdAt', { unique: false });
        sqStore.createIndex('by_status', 'status', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // Handle unexpected close (e.g. browser clearing storage)
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[OfflineDB] Failed to open database:', event.target.error);
      reject(event.target.error);
    };
  });
}

// =============================================
//  Generic helpers
// =============================================

async function getStore(storeName, mode = 'readonly') {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// =============================================
//  CONTACTS
// =============================================

/** Get all locally stored contacts */
export async function getAllContacts() {
  const store = await getStore('contacts');
  return promisifyRequest(store.getAll());
}

/** Replace all contacts in local store (bulk set) */
export async function setAllContacts(contactsArray) {
  const db = await openDatabase();
  const tx = db.transaction('contacts', 'readwrite');
  const store = tx.objectStore('contacts');

  // Clear existing and write fresh set
  store.clear();
  for (const contact of contactsArray) {
    store.put({ ...contact, _localUpdatedAt: Date.now() });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Upsert a single contact */
export async function putContact(contact) {
  const store = await getStore('contacts', 'readwrite');
  return promisifyRequest(store.put({ ...contact, _localUpdatedAt: Date.now() }));
}

/** Delete a single contact by id */
export async function deleteContactById(id) {
  const store = await getStore('contacts', 'readwrite');
  return promisifyRequest(store.delete(id));
}

// =============================================
//  INCIDENTS
// =============================================

/** Save an incident record locally */
export async function saveIncident(incident) {
  const store = await getStore('incidents', 'readwrite');
  return promisifyRequest(
    store.put({ ...incident, _localUpdatedAt: Date.now() })
  );
}

/** Get all incidents (newest first) */
export async function getAllIncidents() {
  const store = await getStore('incidents');
  const all = await promisifyRequest(store.getAll());
  return all.sort((a, b) => (b._localUpdatedAt || 0) - (a._localUpdatedAt || 0));
}

/** Get a single incident by ID */
export async function getIncidentById(id) {
  const store = await getStore('incidents');
  return promisifyRequest(store.get(id));
}

// =============================================
//  PROFILE
// =============================================

/** Save the user profile locally */
export async function saveProfile(profile) {
  const store = await getStore('profile', 'readwrite');
  return promisifyRequest(
    store.put({ id: 'user-default', ...profile, _localUpdatedAt: Date.now() })
  );
}

/** Get the user profile */
export async function getProfile() {
  const store = await getStore('profile');
  return promisifyRequest(store.get('user-default'));
}

// =============================================
//  SETTINGS (key-value)
// =============================================

/** Save a setting */
export async function saveSetting(key, value) {
  const store = await getStore('settings', 'readwrite');
  return promisifyRequest(store.put({ key, value, _localUpdatedAt: Date.now() }));
}

/** Get a setting */
export async function getSetting(key) {
  const store = await getStore('settings');
  const record = await promisifyRequest(store.get(key));
  return record?.value ?? null;
}

// =============================================
//  SYNC QUEUE
// =============================================

/**
 * Enqueue a mutation for background sync.
 * 
 * @param {Object} entry
 * @param {string} entry.type        — e.g. 'SAVE_CONTACTS', 'CREATE_INCIDENT', 'TRIGGER_CALLS'
 * @param {string} entry.endpoint    — server URL path
 * @param {string} entry.method      — HTTP method
 * @param {Object} entry.payload     — JSON body to send
 * @param {number} [entry.retries]   — retry count (default 0)
 */
export async function enqueueSyncTask(entry) {
  const store = await getStore('syncQueue', 'readwrite');
  const task = {
    ...entry,
    status: 'PENDING',       // PENDING | IN_PROGRESS | COMPLETED | FAILED
    retries: entry.retries || 0,
    maxRetries: entry.maxRetries || 5,
    createdAt: Date.now(),
    lastAttemptAt: null,
    errorMessage: null
  };
  return promisifyRequest(store.add(task));
}

/** Get all pending sync tasks (oldest first) */
export async function getPendingSyncTasks() {
  const db = await openDatabase();
  const tx = db.transaction('syncQueue', 'readonly');
  const index = tx.objectStore('syncQueue').index('by_status');
  const pending = await promisifyRequest(index.getAll('PENDING'));
  const failed = await promisifyRequest(index.getAll('FAILED'));
  // Merge and sort by creation time
  return [...pending, ...failed]
    .filter(t => t.retries < t.maxRetries)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Update a sync task's status */
export async function updateSyncTask(queueId, updates) {
  const store = await getStore('syncQueue', 'readwrite');
  const existing = await promisifyRequest(store.get(queueId));
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  return promisifyRequest(store.put(updated));
}

/** Remove completed tasks older than `maxAgeMs` */
export async function cleanupCompletedTasks(maxAgeMs = 24 * 60 * 60 * 1000) {
  const db = await openDatabase();
  const tx = db.transaction('syncQueue', 'readwrite');
  const store = tx.objectStore('syncQueue');
  const all = await promisifyRequest(store.getAll());
  const cutoff = Date.now() - maxAgeMs;

  for (const task of all) {
    if (task.status === 'COMPLETED' && task.createdAt < cutoff) {
      store.delete(task.queueId);
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get sync queue stats for UI display */
export async function getSyncQueueStats() {
  const store = await getStore('syncQueue');
  const all = await promisifyRequest(store.getAll());

  return {
    total: all.length,
    pending: all.filter(t => t.status === 'PENDING').length,
    inProgress: all.filter(t => t.status === 'IN_PROGRESS').length,
    failed: all.filter(t => t.status === 'FAILED').length,
    completed: all.filter(t => t.status === 'COMPLETED').length
  };
}
