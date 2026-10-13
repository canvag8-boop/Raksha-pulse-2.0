import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Flame,
  HeartPulse,
  Car,
  Building2,
  Mic,
  MapPin,
  Wifi,
  WifiOff,
  Users,
  Settings,
  Radio,
  RefreshCw,
  Sparkles,
  PhoneCall,
  Volume2,
  AlertTriangle,
  Info,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Shield,
  CheckCircle2,
  Watch,
  KeyRound,
  User,
  Lock,
  LogOut,
  Cpu
} from 'lucide-react';
import { useEmergency } from './context/EmergencyContext';
import { useAuth } from './context/AuthContext';
import CountdownModal from './components/CountdownModal';
import EmergencyReportModal from './components/EmergencyReportModal';
import VoiceKeywordSentinel from './components/VoiceKeywordSentinel';
import FamilyAlertModal from './components/FamilyAlertModal';
import ContactsModal from './components/ContactsModal';
import SettingsModal from './components/SettingsModal';
import StatusTrackerView from './components/StatusTrackerView';
import ResponderDashboard from './components/ResponderDashboard';
import WearableStatusModal from './components/WearableStatusModal';
import TestSosModal from './components/TestSosModal';
import LocationModal from './components/LocationModal';
import VoiceAnnouncementBanner from './components/VoiceAnnouncementBanner';
import OfflineStatusBanner from './components/OfflineStatusBanner';
import AuthModal from './components/AuthModal';
import SecurityCheckModal from './components/SecurityCheckModal';
import SplashScreen from './components/SplashScreen';
import AuthScreen from './components/AuthScreen';
import { playTactileClick, testVoiceEngine } from './utils/audio';

export default function App() {
  // App Lifecycle Stages: 'splash' -> 'auth' -> 'main' (SOS button page)
  const [appStage, setAppStage] = useState('splash');
  const {
    isOnline,
    connectionMode,
    currentLocation,
    isLocating,
    refreshLocation,
    userProfile,
    setUserProfile,
    contacts,
    voiceKeyword,
    status,
    activeIncident,
    triggerInstantEmergency,
    wearableStatus
  } = useEmergency();

  const {
    currentUser,
    isAuthenticated,
    openLogin,
    openSignUp,
    logout,
    setIsSecurityModalOpen
  } = useAuth();

  // Sync authenticated user info into emergency profile
  useEffect(() => {
    if (currentUser) {
      setUserProfile(prev => ({
        ...prev,
        name: currentUser.name || prev.name,
        phone: currentUser.helpNumber || prev.phone,
        bloodGroup: currentUser.bloodGroup || prev.bloodGroup,
        medicalConditions: currentUser.medicalConditions || prev.medicalConditions
      }));
    }
  }, [currentUser, setUserProfile]);

  // Active View Mode: 'citizen' or 'responder'
  const [currentView, setCurrentView] = useState('citizen');

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportInitialType, setReportInitialType] = useState('Fire');
  const [isVoiceSentinelOpen, setIsVoiceSentinelOpen] = useState(false);
  const [isFamilyAlertOpen, setIsFamilyAlertOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isWearableModalOpen, setIsWearableModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Check if an emergency is in progress (any state other than IDLE or COUNTDOWN)
  const isEmergencyActive = status !== 'IDLE' && status !== 'COUNTDOWN';

  const handleOpenReportWithCategory = (category) => {
    playTactileClick();
    setReportInitialType(category);
    setIsReportModalOpen(true);
  };

  // 1. Stage 1: Animated Opening Splash on App Start
  if (appStage === 'splash') {
    return <SplashScreen onComplete={() => setAppStage('auth')} />;
  }

  // 2. Stage 2: Dedicated Full-Screen Sign Up & Login Page
  if (appStage === 'auth') {
    return (
      <>
        <AuthScreen onContinueToSos={() => setAppStage('main')} />
        <SecurityCheckModal />
      </>
    );
  }

  // 3. Stage 3: The Main SOS Button Page & Emergency Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Mark & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 font-black text-xl tracking-tight border border-rose-400/30">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-lg tracking-tight">RakshaPulse</span>
                <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold uppercase tracking-wider">
                  Lifeline Network
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Immediate Emergency Response & Personal Safety
              </p>
            </div>
          </div>

          {/* Dual View Mode Switcher + Settings */}
          <div className="flex items-center gap-2">
            {/* View Switcher: Citizen App vs Responder Dashboard */}
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex items-center gap-1 text-xs">
              <button
                onClick={() => { playTactileClick(); setCurrentView('citizen'); }}
                className={`py-1.5 px-3 rounded-xl font-bold transition flex items-center gap-1.5 ${
                  currentView === 'citizen'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📱</span>
                <span className="hidden md:inline">Citizen App</span>
              </button>

              <button
                onClick={() => { playTactileClick(); setCurrentView('responder'); }}
                className={`py-1.5 px-3 rounded-xl font-bold transition flex items-center gap-1.5 relative ${
                  currentView === 'responder'
                    ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🚑</span>
                <span className="hidden md:inline">Responder Dashboard</span>
                {activeIncident && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping ml-0.5" />
                )}
              </button>
            </div>

            {/* Security Audit & Features Checker Button */}
            <button
              onClick={() => { playTactileClick(); setIsSecurityModalOpen(true); }}
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-emerald-400 hover:text-white transition flex items-center gap-1.5 shadow-sm"
              title="Check All Security Features & Diagnostics"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline text-xs font-bold text-slate-300">Security Check</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden sm:inline" />
            </button>

            {/* Authentication Widget (Sign In / Sign Up / User Info) */}
            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-2.5 py-1.5">
                <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-[11px] flex items-center justify-center shadow-sm">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden md:block text-left text-[11px] leading-tight">
                  <span className="font-bold text-white block truncate max-w-[85px]">
                    {currentUser.name}
                  </span>
                  <span className="text-slate-400 font-mono text-[9px] block">
                    {currentUser.helpNumber || ''}
                  </span>
                </div>
                <button
                  onClick={() => { playTactileClick(); logout(); setAppStage('auth'); }}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Sign Out & Return to Login"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { playTactileClick(); setAppStage('auth'); }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
                <button
                  onClick={() => { playTactileClick(); setAppStage('auth'); }}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition flex items-center gap-1 shadow-sm"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            {/* Replay Starting App Animation */}
            <button
              onClick={() => { playTactileClick(); setAppStage('splash'); }}
              className="p-2 sm:px-2.5 sm:py-2 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-rose-400 hover:text-white transition flex items-center gap-1.5 shadow-sm"
              title="Replay Starting Intro Animation"
            >
              <Sparkles className="w-4 h-4 text-rose-400" />
              <span className="hidden xl:inline text-xs font-bold text-slate-300">Intro</span>
            </button>

            {/* Voice Announcement Test Button */}
            <button
              onClick={() => testVoiceEngine()}
              className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-rose-400 hover:text-white transition hidden md:flex items-center gap-1.5"
              title="Test Spoken Human Voice Announcement"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden lg:inline text-xs font-bold text-slate-300">Voice Test</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => { playTactileClick(); setIsSettingsModalOpen(true); }}
              className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition"
              title="Settings & Profile"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Offline/Sync Status Indicator Banner */}
      <OfflineStatusBanner />

      {/* Live Spoken Voice Subtitle & Announcement Banner */}
      <VoiceAnnouncementBanner />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start">
        {currentView === 'responder' ? (
          /* RESPONDER DASHBOARD VIEW */
          <ResponderDashboard />
        ) : isEmergencyActive ? (
          /* ACTIVE EMERGENCY STATUS TRACKING SCREEN (Requirement 6) */
          <StatusTrackerView
            onOpenFamilyAlerts={() => setIsFamilyAlertOpen(true)}
            onOpenContacts={() => setIsContactsModalOpen(true)}
          />
        ) : (
          /* 🏠 1. HOME SCREEN — IMMEDIATE ACCESS */
          <div className="max-w-xl w-full mx-auto px-4 py-4 sm:py-6 flex flex-col justify-between flex-1 space-y-6">
            {/* Top Greeting & Status Indicator:
                - 🔴 Current emergency/status indicator */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold block">
                  Personal Lifeline
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Hello, {userProfile.name?.split(' ')[0] || 'Kunal'}
                </h2>
              </div>

              {/* 🔴 Current Emergency / Status Indicator */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <span className="text-xs font-bold text-slate-200">System Safe & Armed</span>
              </div>
            </div>

            {/* Guest Sign-In / Register Prompt Banner */}
            {!isAuthenticated && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Sign In or Create Account</p>
                    <p className="text-[11px] text-slate-400">Sync verified emergency contacts & medical profile</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => { playTactileClick(); setAppStage('auth'); }}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => { playTactileClick(); setAppStage('auth'); }}
                    className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition shadow-sm"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            )}

            {/* 🎙️ 2. Emergency Voice Keyword Prototype Banner */}
            <div
              onClick={() => { playTactileClick(); setIsVoiceSentinelOpen(true); }}
              className="group cursor-pointer p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-purple-950/30 border border-rose-500/30 hover:border-rose-500/60 shadow-lg transition active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Mic className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Emergency Voice Trigger
                    </span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Prototype
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Say <strong className="text-rose-400">"{voiceKeyword}"</strong> for hands-free AI voice dispatch
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition shrink-0" />
            </div>

            {/* THE PROMINENT CENTER EMERGENCY BUTTON */}
            <div className="my-auto py-6 flex flex-col items-center justify-center text-center">
              <div className="relative flex items-center justify-center mb-6">
                {/* Radar rings */}
                <div className="absolute w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-rose-600/15 animate-ping pointer-events-none" />
                <div className="absolute w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-rose-600/20 animate-pulse pointer-events-none" />

                {/* Main Prominent "I NEED HELP" Button */}
                <button
                  id="sosCentralButton"
                  onClick={() => triggerInstantEmergency()}
                  aria-label="I Need Help - Instant Emergency Button"
                  className="relative z-10 w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-b from-rose-500 to-red-700 hover:from-rose-400 hover:to-red-600 active:scale-95 text-white shadow-[0_0_50px_rgba(225,29,72,0.5)] border-4 border-rose-300/40 flex flex-col items-center justify-center transition-transform duration-150 select-none cursor-pointer focus:outline-none focus:ring-8 focus:ring-rose-500/30"
                >
                  <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 text-white/95 mb-1.5 drop-shadow-md" />
                  <span className="text-xl sm:text-2xl font-black tracking-wider leading-tight text-white drop-shadow">
                    I NEED<br />HELP
                  </span>
                  <span className="text-[10px] font-bold tracking-widest text-rose-100 uppercase mt-1 opacity-90">
                    TAP FOR SOS
                  </span>
                </button>
              </div>

              <p className="text-xs text-slate-400 font-medium">
                Tap button to activate instant SOS · 5-second cancel countdown protects against accidental taps
              </p>

              {/* Categorized Quick Emergency Chips */}
              <div className="grid grid-cols-4 gap-2 w-full mt-6">
                <button
                  onClick={() => handleOpenReportWithCategory('Fire')}
                  className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-xs font-bold text-slate-200 flex flex-col items-center gap-1 transition active:scale-95"
                >
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span>Fire</span>
                </button>
                <button
                  onClick={() => handleOpenReportWithCategory('Medical')}
                  className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/40 text-xs font-bold text-slate-200 flex flex-col items-center gap-1 transition active:scale-95"
                >
                  <HeartPulse className="w-5 h-5 text-rose-400" />
                  <span>Medical</span>
                </button>
                <button
                  onClick={() => handleOpenReportWithCategory('Traffic Accident')}
                  className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-orange-500/40 text-xs font-bold text-slate-200 flex flex-col items-center gap-1 transition active:scale-95"
                >
                  <Car className="w-5 h-5 text-orange-400" />
                  <span>Accident</span>
                </button>
                <button
                  onClick={() => handleOpenReportWithCategory('Trapped / Collapse')}
                  className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-yellow-500/40 text-xs font-bold text-slate-200 flex flex-col items-center gap-1 transition active:scale-95"
                >
                  <Building2 className="w-5 h-5 text-yellow-400" />
                  <span>Trapped</span>
                </button>
              </div>
            </div>

            {/* Status Information Grid:
                - 📍 Current location
                - 📡 Connection status
                - 🔘 Arduino (External Button on Pin D2)
                - 👨‍👩‍👧 Emergency contacts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              {/* 📍 Current Location */}
              <div
                onClick={() => { playTactileClick(); setIsLocationModalOpen(true); }}
                className="cursor-pointer p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/30 text-left transition group"
              >
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px]">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>Location</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playTactileClick();
                      refreshLocation();
                    }}
                    title="Refresh Location"
                  >
                    <RefreshCw className={`w-3 h-3 group-hover:rotate-180 transition-transform ${isLocating ? 'animate-spin text-rose-400' : ''}`} />
                  </button>
                </div>
                <div className="text-xs font-bold text-white truncate" title={currentLocation.address}>
                  {currentLocation.address}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  GPS ±{currentLocation.accuracy || 10}m
                </div>
              </div>

              {/* 📡 Connection Status */}
              <div
                onClick={() => { playTactileClick(); setIsSettingsModalOpen(true); }}
                className="cursor-pointer p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-left transition"
              >
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px]">
                    {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
                    <span>Connection</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {connectionMode}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Mesh Failover Ready
                </div>
              </div>

              {/* 🔘 Hardware Button Status (ESP8266 Inbuilt Button) */}
              <div
                onClick={() => { playTactileClick(); setIsWearableModalOpen(true); }}
                className="cursor-pointer p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/30 text-left transition group"
              >
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px]">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ESP8266 Band</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${wearableStatus.connected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                </div>
                <div className="text-xs font-bold text-white truncate flex items-center justify-between">
                  <span>Inbuilt FLASH Button</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    wearableStatus.connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {wearableStatus.connected ? 'ONLINE' : 'STANDBY'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {wearableStatus.lastSosTime
                    ? `Last SOS: ${new Date(wearableStatus.lastSosTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Inbuilt FLASH (GPIO 0)'}
                </div>
              </div>

              {/* 👨‍👩‍👧 Emergency Contacts */}
              <div
                onClick={() => { playTactileClick(); setIsContactsModalOpen(true); }}
                className="cursor-pointer p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-left transition group"
              >
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[10px]">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Contacts</span>
                  </div>
                  <span className="text-[10px] text-purple-400 font-bold group-hover:underline">Manage</span>
                </div>
                <div className="text-xs font-bold text-white">
                  {contacts.length} Trusted
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {contacts.map(c => c.name.split(' ')[0]).join(', ')}
                </div>
              </div>
            </div>

            {/* Secondary Action: Detailed Report (Voice / Text) */}
            <div className="pt-2 text-center">
              <button
                onClick={() => { playTactileClick(); setIsReportModalOpen(true); }}
                className="text-xs text-slate-400 hover:text-white font-semibold py-2 px-4 rounded-xl hover:bg-slate-900 transition inline-flex items-center gap-1.5"
              >
                <span>Report detailed emergency with voice or text</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info / Prototype Clarification */}
      <footer className="py-2.5 px-4 text-center text-[11px] text-slate-400 border-t border-slate-900 bg-slate-950">
        RakshaPulse Emergency Response Prototype · In live emergency dial 112
      </footer>

      {/* ALL INTERACTIVE MODALS */}
      {/* 1. Countdown Cancel Buffer */}
      <CountdownModal />

      {/* 2. Detailed Emergency Report Modal (Voice / Text / Type / Injuries / People / Auto GPS) */}
      <EmergencyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialType={reportInitialType}
      />

      {/* 3. Voice Keyword Sentinel (Hands-Free "Raksha Help" Detection & AI Extraction) */}
      <VoiceKeywordSentinel
        isOpen={isVoiceSentinelOpen}
        onClose={() => setIsVoiceSentinelOpen(false)}
      />

      {/* 4. Family & Friends Alert Modal (Requirement 5) */}
      <FamilyAlertModal
        isOpen={isFamilyAlertOpen}
        onClose={() => setIsFamilyAlertOpen(false)}
        onOpenContactsManager={() => setIsContactsModalOpen(true)}
      />

      {/* 5. Emergency Contacts Manager */}
      <ContactsModal
        isOpen={isContactsModalOpen}
        onClose={() => setIsContactsModalOpen(false)}
      />

      {/* 6. Settings & Profile Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* 7. Wearable Hardware Status Modal */}
      <WearableStatusModal
        isOpen={isWearableModalOpen}
        onClose={() => setIsWearableModalOpen(false)}
      />

      {/* 8. Safe Test Mode Alert Notification Modal */}
      <TestSosModal />

      {/* 9. Location Manager Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      {/* 10. Authentication Modal (Sign In / Sign Up) */}
      <AuthModal />

      {/* 11. Interactive Security Features Center & Diagnostics */}
      <SecurityCheckModal />
    </div>
  );
}
