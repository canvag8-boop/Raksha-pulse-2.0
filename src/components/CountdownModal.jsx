import React from 'react';
import { AlertTriangle, X, Send, ShieldAlert, MapPin, Volume2, Heart } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';

export default function CountdownModal() {
  const { status, countdownSeconds, cancelCountdown, skipCountdownAndDispatch, currentLocation } = useEmergency();

  if (status !== 'COUNTDOWN') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/90 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-950 border-2 border-rose-500 rounded-3xl p-6 sm:p-8 shadow-2xl text-center overflow-hidden">
        {/* Urgent pulsing red glow */}
        <div className="absolute inset-0 bg-radial from-rose-600/30 to-transparent pointer-events-none animate-pulse" />

        <div className="flex items-center justify-center gap-2 text-rose-400 mb-2">
          <ShieldAlert className="w-6 h-6 animate-bounce" />
          <span className="text-xs font-black uppercase tracking-widest">EMERGENCY ACTIVATION INITIATED</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          TRANSMITTING SOS
        </h2>
        <p className="text-sm text-slate-300 mb-4">
          Dispatching emergency services and notifying emergency contacts in...
        </p>

        {/* Giant Countdown Circle */}
        <div className="relative mx-auto w-36 h-36 flex items-center justify-center my-2">
          <div className="absolute inset-0 rounded-full border-4 border-rose-500/30 animate-ping" />
          <div className="absolute inset-0 rounded-full border-4 border-rose-500 flex items-center justify-center">
            <span className="text-6xl font-black text-white font-mono tracking-tighter">
              {countdownSeconds}
            </span>
          </div>
        </div>

        {/* Voice & Heartbeat Indicator */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 text-[11px] font-bold text-rose-300 my-2">
          <Volume2 className="w-3.5 h-3.5 animate-pulse text-rose-400" />
          <span>Voice Guidance & Pulse Active</span>
        </div>

        {/* Auto Location Transmit Notice */}
        <div className="my-5 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-center gap-2">
          <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="line-clamp-1 font-medium">{currentLocation.address}</span>
        </div>

        {/* Action Buttons: Cancel vs Immediate Dispatch */}
        <div className="space-y-3">
          <button
            onClick={() => skipCountdownAndDispatch()}
            className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-base shadow-lg shadow-rose-600/50 flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <Send className="w-5 h-5" />
            <span>DISPATCH IMMEDIATELY</span>
          </button>

          <button
            onClick={cancelCountdown}
            className="w-full py-3.5 px-6 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <X className="w-5 h-5 text-rose-400" />
            <span>CANCEL (False Alarm)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
