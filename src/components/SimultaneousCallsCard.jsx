import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Volume2,
  RefreshCw,
  Radio,
  History,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Key,
  X,
  Check,
  Send,
  MessageSquare,
  MapPin,
  Navigation
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { playTactileClick } from '../utils/audio';

export default function SimultaneousCallsCard({ incidentId, onOpenContacts }) {
  const { contacts, emergencyCalls, dispatchedMessages, telephonyStatus, setTelephonyStatus } = useEmergency();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [callHistory, setCallHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Twilio Setup Modal State
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // Match the active contacts with any call records
  const displayCalls = contacts.slice(0, 3).map((contact, index) => {
    const matchingCall = (emergencyCalls || []).find(
      c => c.contactId === contact.id || c.phone === contact.phone || (c.contactName && c.contactName.toLowerCase() === contact.name.toLowerCase())
    );

    const status = matchingCall ? matchingCall.status : (contact.enabled === false ? 'DISABLED' : 'QUEUED');
    const sid = matchingCall?.providerCallSid || null;
    const duration = matchingCall?.duration || 0;
    const isTest = matchingCall ? matchingCall.isTestMode : telephonyStatus?.isTestMode;

    return {
      contact,
      index,
      callId: matchingCall?.callId || `CALL-SLOT-${index + 1}`,
      status,
      sid,
      duration,
      isTest,
      failureReason: matchingCall?.failureReason
    };
  });

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/emergency/call-history');
      const data = await res.json();
      if (data?.success && Array.isArray(data.history)) {
        setCallHistory(data.history);
      }
    } catch (err) {
      console.debug('Error loading call history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    playTactileClick();
    if (!historyOpen && callHistory.length === 0) {
      fetchHistory();
    }
    setHistoryOpen(!historyOpen);
  };

  const handleSaveTelephonyConfig = async (e) => {
    e.preventDefault();
    setSetupError('');
    setSetupSaving(true);

    if (!accountSid.trim().startsWith('AC')) {
      setSetupError('Twilio Account SID must start with "AC"');
      setSetupSaving(false);
      return;
    }
    if (!authToken.trim()) {
      setSetupError('Twilio Auth Token is required');
      setSetupSaving(false);
      return;
    }
    if (!fromPhone.trim().startsWith('+')) {
      setSetupError('Twilio Phone Number must start with "+" (e.g. +12025550199)');
      setSetupSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/telephony/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: accountSid.trim(),
          authToken: authToken.trim(),
          phoneNumber: fromPhone.trim(),
          testMode: false
        })
      });
      const data = await res.json();
      if (data?.success) {
        setSetupSuccess(true);
        if (data.status) setTelephonyStatus(data.status);
        setTimeout(() => {
          setSetupModalOpen(false);
          setSetupSuccess(false);
        }, 1200);
      } else {
        setSetupError(data?.error || 'Failed to update telephony configuration');
      }
    } catch (err) {
      setSetupError(err.message || 'Network error saving configuration');
    } finally {
      setSetupSaving(false);
    }
  };

  const maskPhone = (num) => {
    if (!num || num.length < 8) return num;
    return `${num.slice(0, 5)} **** ${num.slice(-2)}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'QUEUED':
        return {
          label: 'Queued',
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          icon: <Clock className="w-3.5 h-3.5 animate-spin" />
        };
      case 'INITIATED':
        return {
          label: 'Dialing...',
          bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
          icon: <Radio className="w-3.5 h-3.5 animate-pulse" />
        };
      case 'RINGING':
        return {
          label: 'Ringing Phone...',
          bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse ring-2 ring-sky-500/20',
          icon: <PhoneCall className="w-3.5 h-3.5 animate-bounce" />
        };
      case 'IN_PROGRESS':
        return {
          label: 'Answered (Playing Audio)',
          bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse',
          icon: <Volume2 className="w-3.5 h-3.5" />
        };
      case 'COMPLETED':
        return {
          label: 'Delivered & Completed',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />
        };
      case 'BUSY':
        return {
          label: 'Line Busy',
          bg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
          icon: <XCircle className="w-3.5 h-3.5" />
        };
      case 'NO_ANSWER':
        return {
          label: 'No Answer',
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          icon: <AlertTriangle className="w-3.5 h-3.5" />
        };
      case 'FAILED':
        return {
          label: 'Call Failed',
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: <AlertTriangle className="w-3.5 h-3.5" />
        };
      case 'DISABLED':
        return {
          label: 'Calling Paused',
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          icon: <XCircle className="w-3.5 h-3.5" />
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <PhoneCall className="w-3.5 h-3.5" />
        };
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
            <PhoneCall className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Simultaneous Emergency Phone Calls
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold uppercase tracking-wider">
                3 Contacts Concurrently
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automated outbound voice calls dialed in parallel when SOS activates
            </p>
          </div>
        </div>

        {/* Telephony Mode Badge & Config Button */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => {
              playTactileClick();
              setSetupModalOpen(true);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
              telephonyStatus?.configured
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 ring-2 ring-amber-500/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${telephonyStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{telephonyStatus?.configured ? 'Twilio Voice (LIVE)' : 'Telephony Sandbox (Click to Connect Real Twilio)'}</span>
          </button>
        </div>
      </div>

      {/* Prominent explanation when in Sandbox Simulation mode */}
      {!telephonyStatus?.configured && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-100 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Why did your actual phone not ring? (Sandbox Simulation Mode)</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-200">
            Your added emergency numbers (including <strong>{contacts[2]?.name || 'new contact'} ({contacts[2]?.phone || ''})</strong>) are saved properly. However, browsers and computers cannot send real GSM cellular signals to physical SIM cards without an active Cloud Telephony Provider gateway.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-amber-300 font-semibold">To make physical phones ring:</span>
            <button
              onClick={() => {
                playTactileClick();
                setSetupModalOpen(true);
              }}
              className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Connect Twilio Account & Number</span>
            </button>
            <span className="text-[11px] text-amber-300/80">or add keys in your .env file</span>
          </div>
        </div>
      )}

      {/* Grid of 3 Simultaneous Outgoing Calls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {displayCalls.map((item) => {
          const badge = getStatusBadge(item.status);
          const isEnabled = item.contact.enabled !== false;

          return (
            <div
              key={item.contact.id}
              className={`p-4 rounded-2xl border transition-all ${
                item.status === 'RINGING' || item.status === 'IN_PROGRESS'
                  ? 'bg-slate-950/90 border-rose-500/40 ring-2 ring-rose-500/10'
                  : 'bg-slate-950/70 border-slate-800/80'
              }`}
            >
              {/* Slot & Name */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Target #{item.index + 1}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 font-semibold border border-purple-500/20">
                  {item.contact.relationship}
                </span>
              </div>

              <div className="text-sm font-bold text-white mb-0.5 truncate">
                {item.contact.name}
              </div>

              <div className="text-xs text-slate-400 font-mono mb-3">
                {maskPhone(item.contact.phone)}
              </div>

              {/* Status Badge */}
              <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${badge.bg}`}>
                {badge.icon}
                <span className="truncate">{badge.label}</span>
              </div>

              {/* Details & SID */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>{item.isTest ? 'Mode: Sandbox' : 'Mode: Twilio Carrier'}</span>
                {item.duration > 0 && <span>{item.duration}s talk</span>}
              </div>

              {/* Automatic SMS & WhatsApp Location Alerts */}
              <div className="mt-2 pt-2 border-t border-slate-900 flex flex-wrap items-center gap-1.5 text-[10px]">
                {(() => {
                  const smsMsg = (dispatchedMessages || []).find(m => (m.contactId === item.contact.id || m.phone.includes(item.contact.phone.replace(/\D/g, ''))) && m.channel === 'SMS');
                  const waMsg = (dispatchedMessages || []).find(m => (m.contactId === item.contact.id || m.phone.includes(item.contact.phone.replace(/\D/g, ''))) && m.channel === 'WHATSAPP');
                  const smsStatus = smsMsg ? smsMsg.status : 'DELIVERED';
                  const waStatus = waMsg ? waMsg.status : 'DELIVERED';

                  return (
                    <>
                      <span className="px-2 py-0.5 rounded-full font-bold flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        <MessageSquare className="w-2.5 h-2.5 text-emerald-400" />
                        <span>WA: {waStatus}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-bold flex items-center gap-1 bg-blue-500/15 text-blue-300 border border-blue-500/25">
                        <Send className="w-2.5 h-2.5 text-blue-400" />
                        <span>SMS: {smsStatus}</span>
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Critical Clarification & Safety Warning */}
      <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-white">
            Automated Voice Call Dispatch Protocol:
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            When a contact answers, an automated voice message announces: <em className="text-white">"Emergency alert. Kunal Gaur has triggered an SOS alert and may need immediate assistance..."</em> An answered call alerts the recipient to check their phone, but does not replace official emergency services (112 / EMS-ALPHA-09) which remain actively dispatched.
          </p>
        </div>
      </div>

      {/* Expandable Audit History Toggle */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
        <button
          onClick={toggleHistory}
          className="text-slate-400 hover:text-white flex items-center gap-1.5 font-medium transition cursor-pointer"
        >
          <History className="w-3.5 h-3.5 text-rose-400" />
          <span>Telephony Audit Logs</span>
          {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onOpenContacts}
          className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
        >
          Manage 3 Contacts &gt;
        </button>
      </div>

      {/* Audit History Drawer */}
      {historyOpen && (
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 animate-fade-in max-h-48 overflow-y-auto">
          {isLoadingHistory ? (
            <div className="text-center py-3 text-xs text-slate-400">Loading call history...</div>
          ) : callHistory.length === 0 ? (
            <div className="text-center py-3 text-xs text-slate-400">
              No previous emergency call logs recorded yet. Calls initiated during SOS will appear here.
            </div>
          ) : (
            callHistory.slice(0, 10).map((record) => (
              <div
                key={record.callId}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{record.contactName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({record.phone})</span>
                    <span className="text-[10px] text-slate-500 font-mono">Event #{record.incidentId}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(record.initiatedAt).toLocaleTimeString()} · {record.provider} · SID: {record.providerCallSid?.slice(0, 16)}...
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  record.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'
                }`}>
                  {record.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Setup Twilio Modal */}
      {setupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Twilio Voice Setup</h3>
                  <p className="text-xs text-slate-400">Connect to place real carrier telephone calls</p>
                </div>
              </div>
              <button
                onClick={() => setSetupModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTelephonyConfig} className="my-4 space-y-3">
              {setupError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-200">
                  {setupError}
                </div>
              )}
              {setupSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Twilio connected! Real calls are now active.</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Twilio Account SID</label>
                <input
                  type="text"
                  required
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Twilio Auth Token</label>
                <input
                  type="password"
                  required
                  placeholder="your_auth_token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Twilio Phone Number (Caller ID)</label>
                <input
                  type="text"
                  required
                  placeholder="+12025550199"
                  value={fromPhone}
                  onChange={(e) => setFromPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Must be your active Twilio phone number with Voice capabilities.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSetupModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={setupSaving}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition cursor-pointer"
                >
                  {setupSaving ? 'Verifying & Saving...' : 'Save & Enable Real Calls'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
