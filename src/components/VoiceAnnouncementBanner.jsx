import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Sparkles, RotateCcw } from 'lucide-react';
import { subscribeToVoiceAnnouncements, testVoiceEngine, replayLastVoiceAnnouncement, playTactileClick } from '../utils/audio';

export default function VoiceAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState('');
  const [visible, setVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToVoiceAnnouncements((text) => {
      if (!text) return;
      setAnnouncement(text);
      setVisible(true);
      setIsPlaying(true);

      const hideTimer = setTimeout(() => {
        setIsPlaying(false);
      }, 4000);

      const dismissTimer = setTimeout(() => {
        setVisible(false);
      }, 9000);

      return () => {
        clearTimeout(hideTimer);
        clearTimeout(dismissTimer);
      };
    });

    return unsubscribe;
  }, []);

  const handleTestVoice = () => {
    playTactileClick();
    testVoiceEngine();
  };

  const handleReplay = () => {
    playTactileClick();
    replayLastVoiceAnnouncement();
  };

  return (
    <>
      {/* Floating Live Voice Announcement Banner */}
      {visible && announcement && (
        <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-xl animate-bounce-short pointer-events-auto">
          <div className="bg-slate-900/95 backdrop-blur-md border-2 border-rose-500/50 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-rose-950/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Animated Soundwave bars */}
              <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <div className="flex items-end gap-0.5 h-4">
                  <span className={`w-1 bg-rose-400 rounded-full transition-all ${isPlaying ? 'h-3 animate-pulse' : 'h-1.5'}`} />
                  <span className={`w-1 bg-rose-400 rounded-full transition-all ${isPlaying ? 'h-4 animate-ping' : 'h-2.5'}`} />
                  <span className={`w-1 bg-rose-400 rounded-full transition-all ${isPlaying ? 'h-2 animate-pulse' : 'h-1'}`} />
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1">
                  <span>📢 Spoken Voice Announcement</span>
                </div>
                <p className="text-xs font-bold text-white line-clamp-2 leading-tight mt-0.5">
                  "{announcement}"
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleReplay}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                title="Replay Voice Announcement"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Replay</span>
              </button>

              <button
                onClick={() => setVisible(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
