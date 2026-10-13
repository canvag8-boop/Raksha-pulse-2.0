import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Phone,
  UserCheck,
  X,
  PhoneCall,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Power,
  Edit2
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { playTactileClick } from '../utils/audio';

export default function ContactsModal({ isOpen, onClose }) {
  const { contacts, addContact, updateContact, deleteContact, telephonyStatus } = useEmergency();

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [phone, setPhone] = useState('+91 ');
  const [hasConsent, setHasConsent] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  // Phone validation with country code
  const validatePhone = (raw) => {
    const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');
    if (!cleaned.startsWith('+')) {
      return 'Phone number must include international country code starting with "+" (e.g. +91 98765 11223)';
    }
    const digits = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digits)) {
      return 'Please enter a valid international phone number (7-15 digits after country code)';
    }
    return null;
  };

  const handleOpenAdd = () => {
    playTactileClick();
    setEditingContactId(null);
    setName('');
    setRelationship('Mother');
    setPhone('+91 ');
    setHasConsent(true);
    setFormError('');
    setShowAddForm(true);
  };

  const handleOpenEdit = (contact) => {
    playTactileClick();
    setEditingContactId(contact.id);
    setName(contact.name);
    setRelationship(contact.relationship);
    setPhone(contact.phone);
    setHasConsent(contact.hasConsent !== false);
    setFormError('');
    setShowAddForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter contact full name');
      return;
    }

    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setFormError(phoneErr);
      return;
    }

    // Normalized phone
    const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');

    // Check duplicate phone
    const duplicate = contacts.find(
      c => c.id !== editingContactId && c.phone.replace(/[\s\-\(\)\.]/g, '') === cleanedPhone
    );
    if (duplicate) {
      setFormError(`Phone number is already assigned to ${duplicate.name}`);
      return;
    }

    if (!hasConsent) {
      setFormError('Emergency contact must have consented to receive emergency automated calls');
      return;
    }

    playTactileClick();

    if (editingContactId) {
      updateContact(editingContactId, {
        name: name.trim(),
        relationship,
        phone: cleanedPhone,
        hasConsent: true
      });
    } else {
      if (contacts.length >= 3) {
        setFormError('Maximum 3 emergency contacts supported for simultaneous emergency dialing');
        return;
      }
      addContact({
        name: name.trim(),
        relationship,
        phone: cleanedPhone,
        hasConsent: true,
        enabled: true
      });
    }

    setName('');
    setPhone('+91 ');
    setShowAddForm(false);
    setEditingContactId(null);
  };

  const toggleContactEnabled = (contact) => {
    playTactileClick();
    updateContact(contact.id, {
      enabled: contact.enabled === false ? true : false
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Emergency Call Contacts</h2>
              <p className="text-xs text-slate-400">3 trusted contacts dialed simultaneously during SOS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telephony Status Notice */}
        <div className="my-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${telephonyStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-medium">
              Outgoing Telephony Engine:
            </span>
            <span className="font-bold text-white">
              {telephonyStatus?.configured ? 'Twilio Voice (LIVE)' : 'Sandbox Mode'}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {contacts.length}/3 Configured
          </span>
        </div>

        {/* List of 3 Contacts */}
        <div className="my-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {contacts.map((c, idx) => {
            const isEnabled = c.enabled !== false;
            return (
              <div
                key={c.id}
                className={`p-3.5 rounded-2xl border transition ${
                  isEnabled
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                } flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                    isEnabled ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{c.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 font-semibold border border-purple-500/20">
                        {c.relationship}
                      </span>
                      {!isEnabled && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Calling Paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{c.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Toggle Active Switch */}
                  <button
                    onClick={() => toggleContactEnabled(c)}
                    className={`p-2 rounded-xl transition ${
                      isEnabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-800'
                    }`}
                    title={isEnabled ? 'Active (Tap to pause calls)' : 'Paused (Tap to enable calls)'}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
                    title="Edit contact"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      playTactileClick();
                      deleteContact(c.id);
                    }}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                    title="Remove contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {contacts.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-400">
              No emergency contacts added yet. Add up to 3 contacts below.
            </div>
          )}

          {contacts.length < 3 && !showAddForm && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                You currently have {contacts.length} of 3 emergency contacts configured. For optimal safety, configure all 3 contacts so the system dials 3 numbers simultaneously.
              </span>
            </div>
          )}
        </div>

        {/* Add/Edit Contact Form Modal Section */}
        {showAddForm ? (
          <form onSubmit={handleSave} className="p-4 rounded-2xl bg-slate-950/90 border border-rose-500/40 space-y-3 mb-4 animate-fade-in shadow-xl">
            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider block">
              {editingContactId ? 'Edit Emergency Contact' : `Add Contact #${contacts.length + 1} of 3`}
            </span>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="Full Name (e.g. Papa, Rohan, Dr. Shah)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Spouse">Spouse / Partner</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Close Friend">Close Friend</option>
                  <option value="Doctor">Doctor / Physician</option>
                  <option value="Neighbor">Neighbor</option>
                  <option value="Guardian">Guardian</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Phone (+Country Code)</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 11223"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </div>

            {/* Consent Agreement Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <input
                  type="checkbox"
                  checked={hasConsent}
                  onChange={(e) => setHasConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="leading-snug text-[11px]">
                  I confirm that this emergency contact has agreed to receive automated emergency voice calls and SMS alerts from RakshaPulse.
                </span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingContactId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow"
              >
                {editingContactId ? 'Update Contact' : 'Save Contact'}
              </button>
            </div>
          </form>
        ) : (
          contacts.length < 3 && (
            <button
              onClick={handleOpenAdd}
              className="w-full py-3 mb-4 rounded-2xl border border-dashed border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-rose-400" />
              <span>Add Emergency Contact ({contacts.length}/3)</span>
            </button>
          )
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            Contacts saved securely to local & server emergency database.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
