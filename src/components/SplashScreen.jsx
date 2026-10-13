import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Radio, Zap, HeartPulse, ChevronRight } from 'lucide-react';
import { playHumanHeartbeat, playWakeChime, playTactileClick } from '../utils/audio';

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('INITIALIZING CRYPTOGRAPHIC VAULT...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Play intro sound safely
    try {
      playWakeChime();
    } catch (e) {
      console.debug('Audio play blocked:', e);
    }

    const tHeartbeat = setTimeout(() => {
      try {
        playHumanHeartbeat();
      } catch (e) {}
    }, 800);

    // Sequence stages
    const steps = [
      { at: 20, text: 'CALIBRATING GPS SENSORS & ACCELEROMETER...' },
      { at: 50, text: 'ESTABLISHING 256-BIT ENCRYPTED LIFELINE...' },
      { at: 75, text: 'ARMING RAKSHA EMERGENCY DISPATCH GRID...' },
      { at: 95, text: 'SYSTEM ARMED & VERIFIED · READY' }
    ];

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 2;
        const matchingStep = steps.find(s => next >= s.at && prev < s.at);
        if (matchingStep) {
          setStageText(matchingStep.text);
        }
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            handleFinish();
          }, 400);
          return 100;
        }
        return next;
      });
    }, 45);

    return () => {
      clearInterval(interval);
      clearTimeout(tHeartbeat);
    };
  }, []);

  const handleFinish = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  const handleSkip = () => {
    playTactileClick();
    handleFinish();
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6 select-none transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Animated Atmosphere Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-rose-600/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-red-600/15 blur-2xl animate-ping" />
      </div>

      {/* Top Header info */}
      <div className="w-full max-w-md flex items-center justify-between text-xs text-slate-400 z-10 pt-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="font-mono tracking-widest text-[11px] uppercase text-rose-300 font-bold">
            RakshaPulse v2.6
          </span>
        </div>
        <button
          onClick={handleSkip}
          className="px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] font-bold"
        >
          <span>Skip</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Center Cinematic Emblem Animation */}
      <div className="flex flex-col items-center justify-center my-auto z-10 text-center">
        <div className="relative flex items-center justify-center mb-8">
          {/* Radar Waves */}
          <div className="absolute w-56 h-56 rounded-full border border-rose-500/20 animate-ping duration-1000" />
          <div className="absolute w-44 h-44 rounded-full border border-rose-500/30 animate-pulse" />
          <div className="absolute w-36 h-36 rounded-full bg-rose-600/15 animate-pulse" />

          {/* Central Logo Shield */}
          <div className="relative z-10 w-28 h-28 rounded-3xl bg-gradient-to-br from-rose-500 via-rose-600 to-red-700 shadow-[0_0_50px_rgba(225,29,72,0.6)] border-2 border-rose-300/40 flex items-center justify-center transform hover:scale-105 transition duration-300">
            <Shield className="w-14 h-14 text-white drop-shadow-md animate-pulse" />
            <div className="absolute -bottom-2 px-3 py-0.5 rounded-full bg-slate-900 border border-rose-500/50 text-[10px] font-black uppercase tracking-widest text-rose-300 shadow-md">
              SOS ACTIVE
            </div>
          </div>
        </div>

        {/* Brand Title with Fade Up */}
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>RakshaPulse</span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold tracking-wider text-rose-300 uppercase">
            Personal Lifeline & Immediate Emergency Response
          </p>
        </div>
      </div>

      {/* Bottom Telemetry & Progress Bar */}
      <div className="w-full max-w-sm space-y-3 z-10 pb-6 text-center">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
          <span className="truncate max-w-[260px] text-left text-slate-300 font-semibold">{stageText}</span>
          <span className="text-rose-400 font-bold">{progress}%</span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 rounded-full transition-all duration-75 ease-out shadow-[0_0_12px_rgba(244,63,94,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[10px] text-slate-400 font-medium">
          Automated Emergency Dispatch · Verified E.164 Telephony · End-to-End Cryptography
        </p>
      </div>
    </div>
  );
}
