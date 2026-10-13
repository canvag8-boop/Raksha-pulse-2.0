import React, { useState } from 'react';
import {
  Flame,
  HeartPulse,
  Car,
  ShieldAlert,
  Building2,
  AlertTriangle,
  Mic,
  MapPin,
  RefreshCw,
  Send,
  Users,
  CheckCircle,
  HelpCircle,
  X
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { createSpeechRecognizer } from '../utils/voiceRecognition';
import { playTactileClick } from '../utils/audio';

const EMERGENCY_TYPES = [
  { id: 'Fire', label: 'Fire', icon: Flame, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'Medical', label: 'Medical', icon: HeartPulse, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  { id: 'Traffic Accident', label: 'Accident', icon: Car, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  { id: 'Trapped / Collapse', label: 'Trapped', icon: Building2, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  { id: 'Assault / Threat', label: 'Security', icon: ShieldAlert, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { id: 'General Emergency', label: 'Other SOS', icon: AlertTriangle, color: 'text-red-400 bg-red-500/10 border-red-500/30' },
];

export default function EmergencyReportModal({ isOpen, onClose, initialType = 'Fire' }) {
  const { currentLocation, refreshLocation, isLocating, commitEmergencyReport } = useEmergency();

  const [emergencyType, setEmergencyType] = useState(initialType);
  const [description, setDescription] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [injured, setInjured] = useState('Unsure');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  if (!isOpen) return null;

  const handleVoiceDictation = () => {
    playTactileClick();
    if (isVoiceRecording) {
      setIsVoiceRecording(false);
      return;
    }

    setIsVoiceRecording(true);
    const recognizer = createSpeechRecognizer({
      onTranscriptChange: (text) => {
        setDescription(text);
      },
      onFinalTranscript: (text) => {
        setDescription(text);
        setIsVoiceRecording(false);
      },
      onError: () => {
        setIsVoiceRecording(false);
      }
    });
    recognizer.startDictation();
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    playTactileClick();
    onClose?.();

    commitEmergencyReport({
      emergencyType,
      description: description || `Emergency: ${emergencyType}. Affected people: ${peopleCount}. Injuries: ${injured}.`,
      peopleCount,
      injured
    });
  };

  // Quick preset fills
  const setQuickExample = (type, desc, count, inj) => {
    playTactileClick();
    setEmergencyType(type);
    setDescription(desc);
    setPeopleCount(count);
    setInjured(inj);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Report Emergency</h2>
              <p className="text-xs text-slate-400">Transmits location & info directly to dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 sm:space-y-5">
          {/* 1. Emergency Type Select */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              1. Type of Emergency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EMERGENCY_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = emergencyType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      playTactileClick();
                      setEmergencyType(t.id);
                    }}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 ${
                      isSelected
                        ? 'border-rose-500 bg-rose-500/20 text-white shadow-lg shadow-rose-500/10'
                        : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. What Happened + Voice dictation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                2. What Happened (Speak or Type)
              </label>
              <button
                type="button"
                onClick={handleVoiceDictation}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                  isVoiceRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-800 text-rose-400 hover:bg-slate-750 border border-slate-700'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isVoiceRecording ? 'Listening...' : 'Voice Dictate'}</span>
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. There is a fire in my building. Four people are trapped and my brother is injured."
              rows={3}
              className="w-full rounded-2xl bg-slate-950 border border-slate-700/80 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
            />

            {/* Quick Demo Fill Buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 self-center mr-1">Quick Scenarios:</span>
              <button
                type="button"
                onClick={() => setQuickExample('Fire', 'Fire in building, four people trapped, brother injured', 4, 'Yes')}
                className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700"
              >
                🔥 Fire (Trapped & Injured)
              </button>
              <button
                type="button"
                onClick={() => setQuickExample('Traffic Accident', 'Severe highway accident, 2 vehicles collided, driver bleeding', 2, 'Yes')}
                className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700"
              >
                🚗 Car Crash
              </button>
            </div>
          </div>

          {/* 3. Number of People Affected & Injuries */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* People count */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>People Affected</span>
              </label>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-lg font-bold text-white flex items-center justify-center transition active:scale-95"
                >
                  -
                </button>
                <span className="text-xl font-black text-white font-mono px-4">
                  {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
                </span>
                <button
                  type="button"
                  onClick={() => setPeopleCount(peopleCount + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-lg font-bold text-white flex items-center justify-center transition active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            {/* Injuries toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Injuries?
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {['Yes', 'No', 'Unsure'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      playTactileClick();
                      setInjured(val);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                      injured === val
                        ? val === 'Yes'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-slate-700 text-white'
                        : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Location Auto GPS */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-start gap-2.5 overflow-hidden">
              <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  GPS Auto-Location (No typing needed)
                </div>
                <p className="text-xs text-white font-medium truncate max-w-xs sm:max-w-md">
                  {currentLocation.address}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshLocation}
              disabled={isLocating}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0 ml-2"
              title="Refresh GPS"
            >
              <RefreshCw className={`w-4 h-4 ${isLocating ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-base shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              <Send className="w-5 h-5" />
              <span>TRANSMIT EMERGENCY REPORT</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
