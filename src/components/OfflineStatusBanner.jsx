/**
 * RakshaPulse Offline Status Banner
 * 
 * A subtle, non-intrusive banner that appears below the app header
 * to show connection & sync status. Uses smooth slide-down animations.
 * 
 * States:
 *   - Hidden when online and fully synced
 *   - "Offline Mode — changes saved locally" when disconnected
 *   - "Syncing..." with spinner when pushing queued changes
 *   - "All changes synced" briefly after successful sync
 *   - "X changes pending" when partially synced with failures
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CloudOff,
  Cloud
} from 'lucide-react';
import { useNetworkStatus } from '../utils/offlineHooks';

export default function OfflineStatusBanner() {
  const { isOnline, syncState, pendingCount, failedCount, triggerSync } = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    // Clear any existing hide timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    setDismissed(false);

    if (!isOnline) {
      // Always show when offline
      setVisible(true);
    } else if (syncState === 'SYNCING') {
      setVisible(true);
    } else if (syncState === 'SYNCED' || syncState === 'RECONNECTED') {
      // Show briefly then hide
      setVisible(true);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, 3000);
    } else if (syncState === 'PARTIAL' || syncState === 'ERROR') {
      setVisible(true);
    } else if (pendingCount > 0) {
      setVisible(true);
    } else {
      // IDLE and online — hide
      setVisible(false);
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isOnline, syncState, pendingCount]);

  if (!visible || dismissed) return null;

  // Determine banner content
  let bgClass, icon, text, showSyncButton = false, showDismiss = false;

  if (!isOnline) {
    bgClass = 'from-amber-950/90 to-amber-900/80 border-amber-700/50';
    icon = <WifiOff className="w-3.5 h-3.5 text-amber-300" />;
    text = (
      <span className="text-amber-100">
        <span className="font-bold">Offline Mode</span>
        <span className="text-amber-200/80 ml-1.5">— changes saved locally</span>
        {pendingCount > 0 && (
          <span className="text-amber-300/90 ml-1">
            ({pendingCount} pending)
          </span>
        )}
      </span>
    );
  } else if (syncState === 'SYNCING') {
    bgClass = 'from-blue-950/90 to-blue-900/80 border-blue-700/50';
    icon = <RefreshCw className="w-3.5 h-3.5 text-blue-300 animate-spin" />;
    text = (
      <span className="text-blue-100">
        <span className="font-bold">Syncing</span>
        <span className="text-blue-200/80 ml-1">
          — pushing {pendingCount} {pendingCount === 1 ? 'change' : 'changes'}...
        </span>
      </span>
    );
  } else if (syncState === 'SYNCED' || syncState === 'RECONNECTED') {
    bgClass = 'from-emerald-950/90 to-emerald-900/80 border-emerald-700/50';
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />;
    text = (
      <span className="text-emerald-100">
        <span className="font-bold">Back online</span>
        <span className="text-emerald-200/80 ml-1">— all changes synced</span>
      </span>
    );
    showDismiss = true;
  } else if (syncState === 'PARTIAL' || syncState === 'ERROR') {
    bgClass = 'from-orange-950/90 to-orange-900/80 border-orange-700/50';
    icon = <AlertTriangle className="w-3.5 h-3.5 text-orange-300" />;
    text = (
      <span className="text-orange-100">
        <span className="font-bold">Sync incomplete</span>
        <span className="text-orange-200/80 ml-1">
          — {failedCount > 0 ? `${failedCount} failed` : `${pendingCount} pending`}
        </span>
      </span>
    );
    showSyncButton = true;
  } else {
    // Pending items while online
    bgClass = 'from-slate-900/90 to-slate-800/80 border-slate-700/50';
    icon = <Cloud className="w-3.5 h-3.5 text-slate-400" />;
    text = (
      <span className="text-slate-200">
        {pendingCount} {pendingCount === 1 ? 'change' : 'changes'} waiting to sync
      </span>
    );
    showSyncButton = true;
  }

  return (
    <div
      className={`
        w-full px-4 py-2 border-b
        bg-gradient-to-r ${bgClass}
        flex items-center justify-center gap-2
        text-[11px] font-medium tracking-wide
        animate-[slideDown_0.3s_ease-out]
        z-30
      `}
      role="status"
      aria-live="polite"
    >
      {icon}
      {text}

      {showSyncButton && (
        <button
          onClick={() => triggerSync()}
          className="ml-2 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white/90 text-[10px] font-bold uppercase tracking-wider transition"
        >
          Retry
        </button>
      )}

      {showDismiss && (
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 text-white/50 hover:text-white/80 text-[10px] transition"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
