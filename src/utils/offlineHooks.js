/**
 * RakshaPulse Offline-Aware Network Hooks
 * 
 * React hooks that abstract away the offline/online complexity.
 * Components use these hooks to get sync status and the
 * connection state indicator data for the UI banner.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { onSyncStatusChange, initSyncManager, triggerManualSync } from './syncManager';
import { getSyncQueueStats } from './offlineDb';

/**
 * Hook: useNetworkStatus
 * 
 * Provides real-time connection status and sync state to any component.
 * 
 * Returns:
 *   - isOnline: boolean
 *   - syncState: 'IDLE' | 'SYNCING' | 'SYNCED' | 'OFFLINE' | 'RECONNECTED' | 'PARTIAL' | 'ERROR'
 *   - pendingCount: number of queued mutations
 *   - failedCount: number of permanently failed tasks
 *   - triggerSync: function to manually trigger sync
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState(navigator.onLine ? 'IDLE' : 'OFFLINE');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const cleanupRef = useRef(null);

  useEffect(() => {
    // Network listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync manager events
    const unsubscribe = onSyncStatusChange((status) => {
      if (status.state) setSyncState(status.state);
      if (typeof status.pendingCount === 'number') setPendingCount(status.pendingCount);
      if (typeof status.failedCount === 'number') setFailedCount(status.failedCount);
    });

    // Init the sync manager (only runs once globally)
    cleanupRef.current = initSyncManager();

    // Load initial queue stats
    getSyncQueueStats().then(stats => {
      setPendingCount(stats.pending);
      setFailedCount(stats.failed);
    }).catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  const triggerSync = useCallback(() => {
    return triggerManualSync();
  }, []);

  return {
    isOnline,
    syncState,
    pendingCount,
    failedCount,
    triggerSync
  };
}

/**
 * Hook: useOfflineReady
 * 
 * Simple boolean hook that tells a component whether the app
 * has finished initializing the offline database.
 */
export function useOfflineReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import('./offlineDb').then(db => {
      return db.openDatabase();
    }).then(() => {
      setReady(true);
    }).catch((err) => {
      console.warn('[useOfflineReady] IndexedDB unavailable:', err);
      // Still mark ready — app should work with localStorage fallback
      setReady(true);
    });
  }, []);

  return ready;
}
