import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  PhoneCall,
  Volume2,
  VolumeX,
  Share2,
  MapPin,
  Users,
  HeartPulse,
  Flame,
  LifeBuoy,
  XCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import EmergencyMap from './EmergencyMap';
import SimultaneousCallsCard from './SimultaneousCallsCard';
import { playTactileClick, speakCalmGuidance, stopSpeaking } from '../utils/audio';

const TRACKING_STEPS = [
  { id: 'REPORTED', label: 'Emergency Reported', description: 'Signal received by RakshaPulse network' },
  { id: 'AI_ANALYSED', label: 'AI Analysed', description: 'Triage priority & required units categorized' },
  { id: 'PENDING', label: 'Response Pending', description: 'Matching closest emergency responder unit' },
  { id: 'RESPONDING', label: 'Help Responding', description: 'Unit dispatched and en route to your GPS location' },
  { id: 'RESOLVED', label: 'Resolved', description: 'Incident handled and scene secured' }
];

export default function StatusTrackerView({ onOpenFamilyAlerts, onOpenContacts }) {
  const {
    activeIncident,
    status,
    advanceStage,
    resolveEmergency,
    resetAllToSafe,
    audioFeedbackEnabled,
    setAudioFeedbackEnabled
  } = useEmergency();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (!activeIncident && status === 'IDLE') {
    return null;
  }

  const incident = activeIncident || {
    id: 'RP-8821',
    emergencyType: 'Fire',
    severity: 'Critical',
    peopleCount: 4,
    injured: 'Yes',
    location: {
      lat: 12.9716,
      lng: 77.5946,
      address: 'Indiranagar 100ft Road, Bengaluru'
    },
    aiAnalysis: {
      emergencyType: 'Fire',
      severity: 'Critical',
      peopleCount: 4,
      injured: 'Yes',
      requiredAssistance: ['Fire Services (Engine)', 'Ambulance / Paramedics'],
      safetyInstructions: [
        'Stay low to the floor where air is cleaner and cooler.',
        'Cover nose and mouth with a damp cloth if available.',
        'Do NOT use elevators. Check door handles for heat before opening.'
      ]
    },
    stage: status,
    assignedResponder: {
      unitId: 'EMS-ALPHA-09',
      type: 'Rapid Response Ambulance & Fire Unit',
      vehicleNumber: 'KA-01-EQ-9191',
      driverName: 'Sgt. R. Kulkarni & Paramedic Team',
      contactPhone: '+91 99800 11200',
      currentDistanceKm: 1.8,
      etaMinutes: 4
    }
  };

  const currentStage = incident.stage || status || 'REPORTED';

  // Determine active step index
  const getStepIndex = (st) => {
    switch (st) {
      case 'REPORTED': return 0;
      case 'AI_ANALYSED': return 1;
      case 'PENDING': return 2;
      case 'RESPONDING': return 3;
      case 'RESOLVED': return 4;
      default: return 1;
    }
  };

  const activeIndex = getStepIndex(currentStage);

  const toggleVoiceAdvice = () => {
    playTactileClick();
    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
    } else {
      const instructions = incident.aiAnalysis?.safetyInstructions?.join('. ') ||
        'Help is responding. Stay calm and in a safe place.';
      speakCalmGuidance(instructions);
      setIsPlayingAudio(true);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 space-y-5 animate-fade-in">
      {/* Top Banner: Calm High-Readability Emergency State */}
      <div className={`p-5 sm:p-6 rounded-3xl border shadow-2xl transition-all ${
        currentStage === 'RESOLVED'
          ? 'bg-emerald-950/40 border-emerald-500/40'
          : currentStage === 'RESPONDING'
          ? 'bg-rose-950/30 border-rose-500/40'
          : 'bg-slate-900 border-slate-700'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              currentStage === 'RESOLVED'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
            }`}>
              {currentStage === 'RESOLVED' ? (
                <ShieldCheck className="w-7 h-7" />
              ) : (
                <ShieldAlert className="w-7 h-7" />
              )}
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-rose-400">
                  INCIDENT #{incident.id || 'RP-LIVE'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-medium">
                  {incident.displayTime || 'Just now'}
                </span>
                {incident.source === 'ESP8266_WEARABLE' || incident.source === 'ARDUINO_UNO' || incident.source === 'ARDUINO_NANO' ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-1 animate-pulse">
                    <span>🔘 ESP8266 Band (Inbuilt Button)</span>
                    <span className="font-mono text-white">({incident.deviceId || 'ESP8266_BAND_01'})</span>
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 font-mono">
                    Source: App
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                {currentStage === 'RESOLVED'
                  ? 'Emergency Incident Resolved'
                  : currentStage === 'RESPONDING'
                  ? 'Help Is On The Way'
                  : 'Emergency Tracking Active'}
              </h1>
            </div>
          </div>

          {/* Quick Audio Guidance & Family Alert Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleVoiceAdvice}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition ${
                isPlayingAudio
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Voice Safety Guidance"
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isPlayingAudio ? 'Stop Voice' : 'Voice Advice'}</span>
            </button>

            <button
              onClick={onOpenFamilyAlerts}
              className="p-2.5 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold flex items-center gap-2 transition"
              title="View Family Alerts"
            >
              <Users className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Family Notified</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🗺️ 6. Emergency Status Step Tracker:
          Emergency Reported ✓
          ↓
          AI Analysed ✓
          ↓
          Response Pending
          ↓
          Help Responding
          ↓
          Resolved */}
      <div className="p-5 sm:p-7 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">
          Live Dispatch Progress
        </h2>

        {/* Desktop / Tablet Horizontal Timeline */}
        <div className="hidden md:grid grid-cols-5 gap-2 relative">
          {TRACKING_STEPS.map((step, idx) => {
            const isDone = idx < activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <div key={step.id} className="flex flex-col items-center text-center relative group">
                {/* Connecting horizontal line */}
                {idx < TRACKING_STEPS.length - 1 && (
                  <div
                    className={`absolute top-5 left-1/2 w-full h-1 -z-0 transition-colors ${
                      idx < activeIndex ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  />
                )}

                {/* Step Icon Badge */}
                <div
                  className={`w-10 h-10 rounded-2xl z-10 flex items-center justify-center font-bold text-sm transition-all shadow-md ${
                    isDone
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : isCurrent
                      ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/60'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>

                <div className="mt-3">
                  <div className={`text-xs font-bold ${
                    isDone
                      ? 'text-emerald-400'
                      : isCurrent
                      ? 'text-white font-extrabold'
                      : 'text-slate-500'
                  }`}>
                    {step.label} {isDone ? '✓' : ''}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 px-1">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Vertical Timeline */}
        <div className="md:hidden space-y-4 relative pl-4 border-l-2 border-slate-800 ml-2">
          {TRACKING_STEPS.map((step, idx) => {
            const isDone = idx < activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <div key={step.id} className="relative flex items-start gap-3.5">
                <div
                  className={`-ml-[25px] w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow ${
                    isDone
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : isCurrent
                      ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>

                <div className="pt-0.5">
                  <div className={`text-sm font-bold ${
                    isDone ? 'text-emerald-400' : isCurrent ? 'text-white font-black' : 'text-slate-500'
                  }`}>
                    {step.label} {isDone ? '✓' : ''}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Prototype Advance Stage Bar (for demo presentation) */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>Prototype stage simulator:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { playTactileClick(); advanceStage('AI_ANALYSED'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                currentStage === 'AI_ANALYSED' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              2. AI Analysed
            </button>
            <button
              onClick={() => { playTactileClick(); advanceStage('PENDING'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                currentStage === 'PENDING' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              3. Response Pending
            </button>
            <button
              onClick={() => { playTactileClick(); advanceStage('RESPONDING'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                currentStage === 'RESPONDING' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              4. Help Responding
            </button>
            <button
              onClick={() => { playTactileClick(); resolveEmergency(); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                currentStage === 'RESOLVED' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              5. Resolved
            </button>
          </div>
        </div>
      </div>

      {/* 📞 Simultaneous Outgoing Emergency Phone Calls (3 Contacts) */}
      <SimultaneousCallsCard incidentId={incident.id} onOpenContacts={onOpenContacts} />

      {/* Grid: 🤖 AI Emergency Understanding & Responder Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 🤖 4. AI Emergency Understanding Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  AI Emergency Understanding
                </h3>
                <p className="text-[11px] text-slate-400">Structured Triage Extraction</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              incident.aiAnalysis?.severity === 'Critical'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {incident.aiAnalysis?.severity || incident.severity || 'Critical'}
            </span>
          </div>

          {/* Structured specs matching the user prompt:
              Emergency: Fire
              Severity: Critical
              People: 4
              Injured: Yes
              Required assistance: Fire + Medical */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Emergency
              </span>
              <span className="text-base font-black text-white">
                {incident.aiAnalysis?.emergencyType || incident.emergencyType || 'Fire'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Severity
              </span>
              <span className="text-base font-black text-rose-400">
                {incident.aiAnalysis?.severity || incident.severity || 'Critical'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                People Affected
              </span>
              <span className="text-base font-black text-white">
                {incident.aiAnalysis?.peopleCount || incident.peopleCount || 4}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Injured
              </span>
              <span className="text-base font-black text-amber-400">
                {incident.aiAnalysis?.injured || incident.injured || 'Yes'}
              </span>
            </div>

            <div className="col-span-2 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Required Assistance
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {(incident.aiAnalysis?.requiredAssistance || ['Fire Services', 'Medical / Paramedics']).map((req, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <span>🚑</span>
                    <span>{req}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* User's Original Speech / Description Transcript */}
          {incident.rawDescription && (
            <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                User Speech / Input Transcript
              </span>
              <p className="text-xs text-slate-300 italic">
                "{incident.rawDescription}"
              </p>
            </div>
          )}

          {/* Actionable First Aid / Safety Guidance */}
          {incident.aiAnalysis?.safetyInstructions && (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <LifeBuoy className="w-4 h-4 text-rose-400" />
                  <span>What To Do While Responders Arrive</span>
                </span>
                <button
                  onClick={toggleVoiceAdvice}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isPlayingAudio ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isPlayingAudio ? 'Stop Audio' : 'Speak Guidance'}</span>
                </button>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                {incident.aiAnalysis.safetyInstructions.map((inst, i) => (
                  <li key={i} className="leading-relaxed">{inst}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* First Responder & Map Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Truck className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Responder Dispatch
                </h3>
                <p className="text-[11px] text-slate-400">Active Units Assigned</p>
              </div>
            </div>
            {currentStage === 'RESPONDING' && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black animate-pulse">
                ETA: ~{incident.assignedResponder?.etaMinutes || 4} MINS
              </span>
            )}
          </div>

          {/* Responder Vehicle Details */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">
                  {incident.assignedResponder?.unitId || 'EMS-ALPHA-09'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  En Route
                </span>
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {incident.assignedResponder?.type || 'Rapid Response Ambulance & Fire'}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Vehicle: {incident.assignedResponder?.vehicleNumber || 'KA-01-EQ-9191'}
              </div>
            </div>

            <a
              href={`tel:${incident.assignedResponder?.contactPhone || '112'}`}
              className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition shrink-0"
            >
              <PhoneCall className="w-4 h-4" />
              <span className="hidden sm:inline">Call Unit</span>
            </a>
          </div>

          {/* Interactive Tactical Map */}
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <EmergencyMap
              location={incident.location}
              responderLocation={{
                lat: (incident.location?.lat || 12.9716) + 0.008,
                lng: (incident.location?.lng || 77.5946) + 0.006,
                eta: `${incident.assignedResponder?.etaMinutes || 4} mins`
              }}
              height="240px"
            />
          </div>

          {/* Location details */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5 text-xs">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-300 block">Incident Coordinates:</span>
              <span className="text-slate-400 line-clamp-1">{incident.location?.address}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Emergency Controls */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white">Emergency Status Controls</h4>
          <p className="text-xs text-slate-400">If you are in safety or this was resolved, mark safe below.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {showCancelConfirm ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                No, Keep Active
              </button>
              <button
                onClick={() => {
                  playTactileClick();
                  resetAllToSafe();
                }}
                className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Yes, Cancel SOS
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex-1 sm:flex-initial py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Cancel / False Alarm</span>
              </button>

              <button
                onClick={() => {
                  playTactileClick();
                  resolveEmergency();
                }}
                className="flex-1 sm:flex-initial py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Mark as Resolved</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
