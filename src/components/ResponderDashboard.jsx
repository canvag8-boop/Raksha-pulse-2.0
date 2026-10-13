import React, { useState } from 'react';
import {
  ShieldAlert,
  Flame,
  HeartPulse,
  Truck,
  PhoneCall,
  MapPin,
  CheckCircle2,
  Clock,
  Radio,
  AlertTriangle,
  User,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  Sparkles,
  LifeBuoy
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import EmergencyMap from './EmergencyMap';
import { playTactileClick } from '../utils/audio';

export default function ResponderDashboard() {
  const {
    activeIncident,
    status,
    advanceStage,
    resolveEmergency,
    commitEmergencyReport,
    currentLocation,
    userProfile
  } = useEmergency();

  const [selectedUnit, setSelectedUnit] = useState('EMS-ALPHA-09');
  const [filterPriority, setFilterPriority] = useState('ALL');

  // If there's an active incident, use it; otherwise provide a realistic live queue
  const currentIncident = activeIncident || {
    id: 'RP-4821',
    displayTime: '10:04 AM',
    userName: userProfile?.name || 'Kunal Gaur',
    userPhone: userProfile?.phone || '+91 98765 43210',
    userMedical: userProfile?.medicalConditions || 'Asthma (inhaler carried)',
    location: currentLocation || {
      lat: 12.9716,
      lng: 77.5946,
      address: 'Indiranagar 100ft Road, Bengaluru, KA 560038'
    },
    emergencyType: 'Fire',
    severity: 'Critical',
    peopleCount: 4,
    injured: 'Yes',
    rawDescription: "There is a fire in my building. Four people are trapped and my brother is injured.",
    aiAnalysis: {
      emergencyType: 'Fire',
      severity: 'Critical',
      peopleCount: 4,
      injured: 'Yes',
      injuryDetails: 'Active burns and smoke inhalation risk',
      requiredAssistance: ['Fire Services (Engine)', 'Ambulance / Paramedics'],
      priorityScore: 10,
      triageCode: 'RED',
      dispatcherSummary: 'CRITICAL PRIORITY: Structure fire reported. 4 individuals trapped with verified injuries. Fire and medical response units dispatched simultaneously.',
      hazards: ['Smoke inhalation risk', 'Structural entrapment']
    },
    stage: status === 'IDLE' ? 'PENDING' : status,
    assignedResponder: {
      unitId: 'EMS-ALPHA-09',
      type: 'Rapid Response Ambulance & Fire Unit',
      vehicleNumber: 'KA-01-EQ-9191',
      driverName: 'Sgt. R. Kulkarni & Paramedic Team',
      contactPhone: '+91 99800 11200',
      currentDistanceKm: 2.1,
      etaMinutes: 5
    }
  };

  const handleDispatch = (newStage) => {
    playTactileClick();
    advanceStage(newStage);
  };

  const injectMockIncident = (type, desc, count, inj) => {
    playTactileClick();
    commitEmergencyReport({
      emergencyType: type,
      description: desc,
      peopleCount: count,
      injured: inj
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6 animate-fade-in">
      {/* Console Header Bar */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                DISPATCH CONSOLE
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                LIVE SYNC ACTIVE
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              RakshaPulse Emergency Command & Responder Dashboard
            </h1>
          </div>
        </div>

        {/* Quick Simulator Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Inject Test SOS:</span>
          <button
            onClick={() => injectMockIncident('Fire', "Fire in 4th floor flat. Four people trapped and my brother is injured.", 4, 'Yes')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-bold text-rose-400 border border-slate-700 transition"
          >
            🔥 Fire & Trapped
          </button>
          <button
            onClick={() => injectMockIncident('Traffic Accident', "Head on collision between bus and car, 3 passengers injured bleeding.", 3, 'Yes')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-bold text-amber-400 border border-slate-700 transition"
          >
            🚗 Highway Crash
          </button>
        </div>
      </div>

      {/* Main Grid: Left Queue, Right Tactical Incident Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Triage Queue (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Incidents Queue
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-black">
                {activeIncident ? '1 Active' : 'Idle'}
              </span>
            </div>

            {/* Incident Cards */}
            <div className="mt-3 space-y-2.5">
              <div className={`p-4 rounded-2xl border transition-all ${
                currentIncident.aiAnalysis?.triageCode === 'RED'
                  ? 'bg-rose-950/40 border-rose-500/50 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/30'
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                    <span className="text-xs font-mono font-bold text-rose-300">
                      #{currentIncident.id}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase">
                      PRIORITY 1 · {currentIncident.aiAnalysis?.severity || 'CRITICAL'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {currentIncident.displayTime || 'Just now'}
                  </span>
                </div>

                <div className="mt-2 text-sm font-black text-white flex items-center gap-1.5">
                  <span>{currentIncident.emergencyType} Emergency</span>
                </div>

                <div className="text-xs text-slate-300 mt-1 line-clamp-2 italic">
                  "{currentIncident.rawDescription}"
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{currentIncident.peopleCount} people affected</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-semibold text-[11px]">
                    Status: {currentIncident.stage || status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Unit Readiness Card */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 block mb-3">
              Fleet Readiness Near Citizen
            </span>
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">EMS-ALPHA-09 (ALS Ambulance)</span>
                  <span className="text-slate-400">1.8 km away · Indiranagar Hub</span>
                </div>
                <span className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold">
                  Ready
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">FIRE-TENDER-14 (Quick Response)</span>
                  <span className="text-slate-400">2.4 km away · Station 14</span>
                </div>
                <span className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold">
                  Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Incident Dispatch & AI Triage (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Top AI Structured Information - Directly matching requirement #4:
              Emergency: Fire
              Severity: Critical
              People: 4
              Injured: Yes
              Required assistance: Fire + Medical */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-black text-white">
                    AI Emergency Triage Extraction
                  </h2>
                  <p className="text-xs text-slate-400">Real-time LLM structured emergency analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black uppercase">
                  Triage: {currentIncident.aiAnalysis?.triageCode || 'RED'}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-white font-mono text-xs font-bold">
                  Priority: {currentIncident.aiAnalysis?.priorityScore || 10}/10
                </span>
              </div>
            </div>

            {/* Tactical Dispatch Summary */}
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 font-medium">
              <strong className="text-rose-400 block mb-0.5">DISPATCH TACTICAL SUMMARY:</strong>
              {currentIncident.aiAnalysis?.dispatcherSummary ||
                'CRITICAL: Fire emergency reported with multiple trapped individuals and injuries. Dual fire and medical dispatch necessary.'}
            </div>

            {/* Key Structured Spec Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Emergency
                </span>
                <span className="text-lg font-black text-white">
                  {currentIncident.aiAnalysis?.emergencyType || currentIncident.emergencyType}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Severity
                </span>
                <span className="text-lg font-black text-rose-400">
                  {currentIncident.aiAnalysis?.severity || currentIncident.severity}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  People
                </span>
                <span className="text-lg font-black text-white">
                  {currentIncident.aiAnalysis?.peopleCount || currentIncident.peopleCount}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Injured
                </span>
                <span className="text-lg font-black text-amber-400">
                  {currentIncident.aiAnalysis?.injured || currentIncident.injured}
                </span>
              </div>
            </div>

            {/* Required Assistance Units */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Required Assistance (AI Identified Units)
              </span>
              <div className="flex flex-wrap gap-2">
                {(currentIncident.aiAnalysis?.requiredAssistance || ['Fire Services (Engine)', 'Ambulance / Paramedics']).map((unit, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <span>🚨</span>
                    <span>{unit}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Caller Profile & Medical Info */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white font-bold text-sm">
                  {currentIncident.userName?.slice(0, 2) || 'KG'}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{currentIncident.userName}</div>
                  <div className="text-slate-400 font-mono">{currentIncident.userPhone}</div>
                </div>
              </div>

              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 block font-bold">Medical Notes:</span>
                <span className="text-rose-300 font-semibold">{currentIncident.userMedical || 'None recorded'}</span>
              </div>

              <a
                href={`tel:${currentIncident.userPhone}`}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-1.5 transition"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call Caller</span>
              </a>
            </div>
          </div>

          {/* Tactical Map with Caller GPS & Dispatch Route */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500" />
                <span className="text-sm font-bold text-white">Live Incident GPS & Route</span>
              </div>
              <span className="text-xs text-slate-400">
                {currentIncident.location?.address}
              </span>
            </div>

            <EmergencyMap
              location={currentIncident.location}
              responderLocation={{
                lat: (currentIncident.location?.lat || 12.9716) + 0.008,
                lng: (currentIncident.location?.lng || 77.5946) + 0.006,
                eta: `${currentIncident.assignedResponder?.etaMinutes || 4} mins`
              }}
              height="280px"
            />

            {/* Responder Dispatch Action Buttons */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Dispatch Unit Status:</span>
                <span className="text-xs text-slate-400">Current Citizen Stage: <strong>{currentIncident.stage || status}</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleDispatch('RESPONDING')}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition active:scale-95"
                >
                  <Truck className="w-4 h-4" />
                  <span>Dispatch Unit (Help Responding)</span>
                </button>

                <button
                  onClick={() => handleDispatch('RESOLVED')}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Mark Resolved</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
