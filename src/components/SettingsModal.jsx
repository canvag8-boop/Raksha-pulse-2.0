import React, { useState } from 'react';
import { Settings, User, Mic, Key, Volume2, Wifi, Shield, X, Check, RefreshCw } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { playTactileClick } from '../utils/audio';

export default function SettingsModal({ isOpen, onClose }) {
  const {
    userProfile,
    setUserProfile,
    voiceKeyword,
    setVoiceKeyword,
    geminiApiKey,
    setGeminiApiKey,
    audioFeedbackEnabled,
    setAudioFeedbackEnabled,
    isOnline,
    connectionMode,
    setConnectionMode
  } = useEmergency();

  const [name, setName] = useState(userProfile.name || 'Kunal Gaur');
  const [phone, setPhone] = useState(userProfile.phone || '+91 98765 43210');
  const [medical, setMedical] = useState(userProfile.medicalConditions || 'Asthma (inhaler carried)');
  const [keyword, setKeyword] = useState(voiceKeyword || 'Raksha Help');
  const [apiKey, setApiKey] = useState(geminiApiKey || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    playTactileClick();

    setUserProfile({
      ...userProfile,
      name,
      phone,
      medicalConditions: medical
    });

    setVoiceKeyword(keyword.trim() || 'Raksha Help');
    setGeminiApiKey(apiKey.trim());

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose?.();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-800 text-rose-400 border border-slate-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">App Configuration & Profile</h2>
              <p className="text-xs text-slate-400">Emergency triggers & personal information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* User Profile */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-rose-400" />
              <span>Citizen Personal Profile</span>
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Your Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kunal Gaur"
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Critical Medical Info / Allergies</label>
              <input
                type="text"
                value={medical}
                onChange={(e) => setMedical(e.target.value)}
                placeholder="Asthma (inhaler carried), Blood Group: O+"
                className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Voice Keyword */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-rose-400" />
                <span>Emergency Voice Keyword</span>
              </span>
              <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Prototype Feature
              </span>
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. Raksha Help"
              className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-rose-500"
            />
            <p className="text-[11px] text-slate-400">
              When spoken aloud, RakshaPulse wakes and starts listening to your emergency statement.
            </p>
          </div>

          {/* AI Settings: Gemini API Key */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Key className="w-4 h-4 text-purple-400" />
                <span>Google Gemini API Key (Optional)</span>
              </span>
              <span className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Offline AI Active
              </span>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... (leave blank to use built-in AI triage engine)"
              className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-rose-500"
            />
            <p className="text-[11px] text-slate-400">
              RakshaPulse operates an instant local NLP emergency engine even without an API key or when offline.
            </p>
          </div>

          {/* Connection Simulator */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-xs font-bold text-white block">Connection Simulator</span>
                <span className="text-[11px] text-slate-400">Current: {connectionMode}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                playTactileClick();
                setConnectionMode(prev => prev.includes('Online') ? 'Offline (Mesh Fallback Active)' : 'Online (LTE/5G)');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Toggle Mode
            </button>
          </div>

          {/* Audio Feedback Toggle */}
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-300 font-medium">Spoken voice guidance & countdown beeps</span>
            </div>
            <input
              type="checkbox"
              checked={audioFeedbackEnabled}
              onChange={(e) => setAudioFeedbackEnabled(e.target.checked)}
              className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Configuration Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
