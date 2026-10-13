import React from 'react';
import { ShieldCheck, CheckCircle2, Zap, X, Watch, Clock } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { playTactileClick } from '../utils/audio';

export default function TestSosModal() {
  const { testAlertModal, setTestAlertModal } = useEmergency();

  if (!testAlertModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl text-center overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 bg-radial from-amber-500/10 to-transparent pointer-events-none" />

        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Watch className="w-7 h-7 animate-bounce" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider mb-2">
          <span>🧪 TEST MODE VERIFIED</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
          Hardware Button Signal Received!
        </h3>

        <p className="text-xs sm:text-sm text-slate-300 mb-5">
          The ESP8266 onboard inbuilt FLASH button successfully triggered the RakshaPulse endpoint on GPIO 0.
        </p>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2 mb-6">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Device ID:</span>
            <span className="font-mono font-bold text-white">{testAlertModal.deviceId || 'ESP8266_BAND_01'}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Trigger Source:</span>
            <span className="font-mono font-bold text-amber-400">{testAlertModal.source || 'ESP8266_WEARABLE'} (Inbuilt FLASH Button)</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Timestamp:</span>
            <span className="font-mono text-slate-300">
              {new Date(testAlertModal.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Emergency Dispatch:</span>
            <span className="text-emerald-400 font-bold">DISABLED (Safe Test Mode)</span>
          </div>
        </div>

        <button
          onClick={() => {
            playTactileClick();
            setTestAlertModal(null);
          }}
          className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
        >
          DISMISS TEST NOTIFICATION
        </button>
      </div>
    </div>
  );
}
