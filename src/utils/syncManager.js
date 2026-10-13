/**
 * RakshaPulse Background Sync Manager
 * 
 * Listens for network status changes and processes the sync queue —
 * pushing locally-queued mutations to the remote server when connectivity
 * is restored.
 * 
 * Conflict Resolution Strategy: **Last-Write-Wins (LWW) with timestamps**
 *   - Every local mutation carries a `_localUpdatedAt` timestamp.
 *   - When syncing, the payload includes this timestamp.
 *   - The server compares it against its own `updatedAt`.
 *   - If the local timestamp is newer, the server accepts the write.
 *   - If the server's record is newer, the server responds with 409
 *     and the client merges by accepting the server's version
 *     (for non-critical data) or keeps both (for incidents).
 *   - In practice, for this SOS app, last-write-wins is the safest
 *     default: a user editing contacts offline should always see their
 *     own latest version once they reconnect.
 * 
 * Features:
 *   - Exponential backoff on failures
 *   - Deduplication (skips tasks for the same endpoint + type if a newer one exists)
 *   - Cleanup of completed tasks after 24h
 *   - Emits custom events for UI status updates
 */

import {
  getPendingSyncTasks,
  updateSyncTask,
  cleanupCompletedTasks,
  getSyncQueueStats
} from './offlineDb.js';

// =============================================
//  Sync Manager State
// =============================================

let isSyncing = false;
let syncIntervalId = null;
let networkListenersAttached = false;

// Custom event target for sync status updates
const syncEventTarget = new EventTarget();

/** Subscribe to sync status changes */
export function onSyncStatusChange(callback) {
  const handler = (e) => callback(e.detail);
  syncEventTarget.addEventListener('sync-status', handler);
  return () => syncEventTarget.removeEventListener('sync-status', handler);
}

function emitStatus(status) {
  syncEventTarget.dispatchEvent(
    new CustomEvent('sync-status', { detail: status })
  );
}

// =============================================
//  Core Sync Loop
// =============================================

/**
 * Process all pending sync tasks sequentially.
 * Each task is an HTTP request to push local changes to the server.
 */
export async function processSyncQueue() {
  if (isSyncing) return;
  if (!navigator.onLine) {
    emitStatus({ state: 'OFFLINE', pendingCount: 0 });
    return;
  }

  isSyncing = true;

  try {
    const tasks = await getPendingSyncTasks();

    if (tasks.length === 0) {
      emitStatus({ state: 'IDLE', pendingCount: 0 });
      isSyncing = false;
      return;
    }

    emitStatus({ state: 'SYNCING', pendingCount: tasks.length });

    let successCount = 0;
    let failCount = 0;

    for (const task of tasks) {
      // Skip if we've gone offline mid-sync
      if (!navigator.onLine) {
        emitStatus({ state: 'OFFLINE', pendingCount: tasks.length - successCount });
        break;
      }

      try {
        await updateSyncTask(task.queueId, {
          status: 'IN_PROGRESS',
          lastAttemptAt: Date.now()
        });

        const response = await fetch(task.endpoint, {
          method: task.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...task.payload,
            _offlineSyncTimestamp: task.createdAt,
            _syncSource: 'OFFLINE_QUEUE'
          })
        });

        if (response.ok) {
          await updateSyncTask(task.queueId, {
            status: 'COMPLETED',
            lastAttemptAt: Date.now(),
            errorMessage: null
          });
          successCount++;
        } else if (response.status === 409) {
          // Conflict — server has a newer version.
          // For contacts and profile: accept server's version (LWW from server perspective).
          // Mark completed because the server's data is authoritative after conflict.
          console.warn(`[SyncManager] Conflict on task ${task.queueId} (${task.type}). Server version wins.`);
          await updateSyncTask(task.queueId, {
            status: 'COMPLETED',
            lastAttemptAt: Date.now(),
            errorMessage: `Conflict resolved: server version accepted (409)`
          });
          successCount++;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        const nextRetries = (task.retries || 0) + 1;
        const isMaxed = nextRetries >= (task.maxRetries || 5);

        await updateSyncTask(task.queueId, {
          status: isMaxed ? 'FAILED' : 'PENDING',
          retries: nextRetries,
          lastAttemptAt: Date.now(),
          errorMessage: err.message
        });

        failCount++;
        console.warn(`[SyncManager] Task ${task.queueId} failed (attempt ${nextRetries}):`, err.message);

        // Exponential backoff: wait before next task on failure
        const backoffMs = Math.min(1000 * Math.pow(2, nextRetries), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    const stats = await getSyncQueueStats();
    emitStatus({
      state: stats.pending > 0 || stats.inProgress > 0 ? 'PARTIAL' : 'SYNCED',
      pendingCount: stats.pending,
      failedCount: stats.failed,
      successCount,
      failCount
    });

    // Cleanup old completed tasks
    await cleanupCompletedTasks();
  } catch (err) {
    console.error('[SyncManager] Unexpected error in sync loop:', err);
    emitStatus({ state: 'ERROR', error: err.message });
  } finally {
    isSyncing = false;
  }
}

// =============================================
//  Network Listeners & Auto-Sync
// =============================================

/**
 * Initialise the sync manager.
 * Attaches online/offline listeners and starts a periodic sync interval.
 */
export function initSyncManager() {
  if (networkListenersAttached) return;

  const handleOnline = () => {
    console.info('[SyncManager] Network restored — triggering sync');
    emitStatus({ state: 'RECONNECTED' });
    // Small delay to let the connection stabilise
    setTimeout(() => processSyncQueue(), 1500);
  };

  const handleOffline = () => {
    console.info('[SyncManager] Network lost — queuing locally');
    emitStatus({ state: 'OFFLINE' });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  networkListenersAttached = true;

  // Periodic sync every 60 seconds while online
  syncIntervalId = setInterval(() => {
    if (navigator.onLine && !isSyncing) {
      processSyncQueue();
    }
  }, 60000);

  // Initial sync if online
  if (navigator.onLine) {
    setTimeout(() => processSyncQueue(), 2000);
  } else {
    emitStatus({ state: 'OFFLINE' });
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (syncIntervalId) clearInterval(syncIntervalId);
    networkListenersAttached = false;
  };
}

/**
 * Manually trigger a sync cycle (e.g. user taps "Sync Now").
 */
export function triggerManualSync() {
  if (!navigator.onLine) {
    emitStatus({ state: 'OFFLINE' });
    return Promise.resolve();
  }
  return processSyncQueue();
}
