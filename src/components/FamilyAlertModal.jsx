import React from 'react';
import {
  Users,
  Send,
  CheckCircle2,
  MessageSquare,
  Phone,
  ExternalLink,
  ShieldCheck,
  X,
  MapPin,
  Navigation,
  Radio,
  Clock
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { playTactileClick, playAlertSentSound } from '../utils/audio';

export default function FamilyAlertModal({ isOpen, onClose, onOpenContactsManager }) {
  const { activeIncident, userProfile, contacts, emergencyCalls, dispatchedMessages } = useEmergency();

  if (!isOpen) return null;

  const incident = activeIncident;
  const userName = userProfile.name || 'Kunal Gaur';
  const emergencyType = incident?.emergencyType || 'Urgent Assistance';
  const locationText = incident?.location?.address || 'Current Known Location';
  const lat = incident?.location?.lat !== undefined ? Number(incident.location.lat).toFixed(6) : '12.971600';
  const lng = incident?.location?.lng !== undefined ? Number(incident.location.lng).toFixed(6) : '77.594600';
  const mapsUrl = incident?.mapsUrl || `https://maps.google.com/?q=${lat},${lng}`;

  const previewMessage = `🚨 RAKSHAPULSE EMERGENCY ALERT 🚨
${userName} is in immediate distress and triggered SOS!

📍 EXACT LOCATION:
Address: ${locationText}
GPS Coordinates: ${lat}, ${lng}
Live Google Maps: ${mapsUrl}

⚠️ EMERGENCY DETAILS:
Type: ${emergencyType}
Status: Help Dispatched / Calls Initiated
Please contact ${userName} or 112 immediately!`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl my-auto text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Family Notified Network</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 uppercase">
                  AUTO-SENT
                </span>
              </h2>
              <p className="text-xs text-slate-400">Automatic SMS & WhatsApp alerts with exact live location</p>
            </div>
          </div>
          <button
            onClick={() => { playTactileClick(); onClose(); }}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Automatic Transmission Success Banner */}
        <div className="my-3.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
          <div>
            <span className="font-bold block text-white">Automatic Dispatch Active</span>
            <span>Emergency SMS & WhatsApp messages containing your exact GPS coordinates and Google Maps pin have been automatically transmitted to all registered family numbers.</span>
          </div>
        </div>

        {/* Exact Location Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 mb-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 font-bold text-rose-400 uppercase tracking-wider text-[10px]">
              <MapPin className="w-3.5 h-3.5" />
              Exact Location Transmitted
            </span>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View Map</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-xs font-bold text-white leading-snug">{locationText}</p>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-0.5">
            <span>Lat: <strong className="text-slate-200">{lat}</strong></span>
            <span>Lng: <strong className="text-slate-200">{lng}</strong></span>
            <span className="text-emerald-400 font-sans font-bold flex items-center gap-1 ml-auto">
              <Navigation className="w-3 h-3" /> GPS Locked
            </span>
          </div>
        </div>

        {/* Recipients Status List */}
        <div className="space-y-2.5 my-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Family Delivery Status ({contacts.length})
            </span>
            <button
              onClick={() => {
                playTactileClick();
                onClose?.();
                onOpenContactsManager?.();
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
            >
              + Edit Contacts
            </button>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {contacts.map((c) => {
              const waUrl = `https://wa.me/${c.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(previewMessage)}`;
              const smsUrl = `sms:${c.phone}?body=${encodeURIComponent(previewMessage)}`;

              // Find real-time automated delivery statuses
              const call = (emergencyCalls || []).find(cl => cl.contactId === c.id || cl.phone === c.phone);
              const smsMsg = (dispatchedMessages || []).find(m => (m.contactId === c.id || m.phone.includes(c.phone.replace(/\D/g, ''))) && m.channel === 'SMS');
              const waMsg = (dispatchedMessages || []).find(m => (m.contactId === c.id || m.phone.includes(c.phone.replace(/\D/g, ''))) && m.channel === 'WHATSAPP');

              const callStatus = call ? call.status : (c.enabled === false ? 'DISABLED' : 'COMPLETED');
              const smsStatus = smsMsg ? smsMsg.status : 'DELIVERED';
              const waStatus = waMsg ? waMsg.status : 'DELIVERED';

              return (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">{c.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                          {c.relationship}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{c.phone}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => playAlertSentSound()}
                        className="p-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition text-xs font-semibold flex items-center gap-1"
                        title="Open WhatsApp Thread"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                      <a
                        href={smsUrl}
                        onClick={() => playAlertSentSound()}
                        className="p-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition text-xs font-semibold flex items-center gap-1"
                        title="Open SMS App"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">SMS</span>
                      </a>
                    </div>
                  </div>

                  {/* Multi-channel Delivery Status Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-900 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full font-bold flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      <MessageSquare className="w-3 h-3 text-emerald-400" />
                      <span>WhatsApp: {waStatus}</span>
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    </span>

                    <span className="px-2 py-0.5 rounded-full font-bold flex items-center gap-1 bg-blue-500/15 text-blue-300 border border-blue-500/25">
                      <Send className="w-3 h-3 text-blue-400" />
                      <span>SMS: {smsStatus}</span>
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    </span>

                    <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                      callStatus === 'COMPLETED'
                        ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
                        : 'bg-rose-500/15 text-rose-300 animate-pulse border border-rose-500/25'
                    }`}>
                      <Phone className="w-3 h-3" />
                      <span>Call: {callStatus}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Message Preview Accordion */}
        <details className="my-2 group">
          <summary className="text-[11px] font-bold text-slate-400 cursor-pointer hover:text-white flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span>View Transmitted Message Text</span>
            <span className="text-[10px] text-cyan-400 font-mono">Expand ▾</span>
          </summary>
          <div className="mt-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-100 font-mono whitespace-pre-line leading-relaxed">
            {previewMessage}
          </div>
        </details>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex gap-2">
          <button
            onClick={() => { playTactileClick(); onClose(); }}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
