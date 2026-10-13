import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentGPSLocation, formatGoogleMapsLink, getStoredLocation } from '../utils/geo';
import { analyzeEmergencyDescription } from '../utils/aiEmergencyParser';
import {
  playWakeChime,
  playCountdownBeep,
  playTactileClick,
  startEmergencySiren,
  stopEmergencySiren,
  speakCalmGuidance,
  speakHumanVoice,
  playHumanHeartbeat,
  playStageAudio,
  playAlertSentSound,
  playEmergencyReportedSound,
  playAiAnalysedSound,
  playResponsePendingSound,
  playHelpRespondingSound,
  playResolvedSound,
  triggerHaptic
} from '../utils/audio';
import {
  openDatabase,
  getAllContacts as idbGetContacts,
  setAllContacts as idbSetContacts,
  saveIncident as idbSaveIncident,
  saveProfile as idbSaveProfile,
  getProfile as idbGetProfile,
  saveSetting as idbSaveSetting,
  getSetting as idbGetSetting,
  enqueueSyncTask
} from '../utils/offlineDb';

const EmergencyContext = createContext(null);

const STORAGE_KEYS = {
  CONTACTS: 'raksha_emergency_contacts',
  KEYWORD: 'raksha_voice_keyword',
  API_KEY: 'raksha_gemini_api_key',
  USER_PROFILE: 'raksha_user_profile',
  ACTIVE_INCIDENT: 'raksha_active_incident'
};

const DEFAULT_CONTACTS = [
  { id: '1', name: 'Geeta Gaur', relationship: 'Mother', phone: '+91 98765 11223', alertTypes: ['WhatsApp', 'SMS'], status: 'Active' },
  { id: '2', name: 'Priya Sharma', relationship: 'Spouse', phone: '+91 98111 22334', alertTypes: ['WhatsApp', 'SMS', 'Call'], status: 'Active' },
  { id: '3', name: 'Dr. Anand Verma', relationship: 'Family Physician', phone: '+91 99000 88776', alertTypes: ['SMS'], status: 'Active' }
];

const DEFAULT_PROFILE = {
  name: 'Kunal Gaur',
  phone: '+91 98765 43210',
  bloodGroup: 'O+',
  medicalConditions: 'Asthma (inhaler carried)',
  homeAddress: 'Connaught Place, New Delhi'
};

export function EmergencyProvider({ children }) {
  // 0. Offline DB initialization flag
  const offlineDbReady = useRef(false);

  // 1. Connection & Location
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionMode, setConnectionMode] = useState('Online (LTE/5G)'); // 'Online' | 'Offline' | 'Mesh P2P'
  const [currentLocation, setCurrentLocation] = useState(() => getStoredLocation());
  const [isLocating, setIsLocating] = useState(false);

  // 2. Settings & Profile
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONTACTS);
      return saved ? JSON.parse(saved) : DEFAULT_CONTACTS;
    } catch {
      return DEFAULT_CONTACTS;
    }
  });

  const [voiceKeyword, setVoiceKeyword] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.KEYWORD) || 'Raksha Help';
  });

  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || import.meta.env.VITE_GEMINI_API_KEY || '';
  });

  // 3. Audio & Voice Sentinel State
  const [isSentinelActive, setIsSentinelActive] = useState(false);
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true);

  // 4. Emergency Incident State
  // Statuses: 'IDLE' | 'COUNTDOWN' | 'REPORTING' | 'ANALYZING' | 'REPORTED' | 'AI_ANALYSED' | 'PENDING' | 'RESPONDING' | 'RESOLVED'
  const [status, setStatus] = useState('IDLE');
  const [activeIncident, setActiveIncident] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_INCIDENT);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const countdownTimerRef = useRef(null);
  const syncChannelRef = useRef(null);

  // 5. Wearable Hardware Status & Alert State
  const [wearableStatus, setWearableStatus] = useState({
    connected: false,
    deviceId: 'BAND001',
    lastSeen: null,
    lastSosTime: null,
    lastSosSource: null,
    recentEvents: []
  });
  const [testAlertModal, setTestAlertModal] = useState(null);

  // 6. Simultaneous Emergency Calls State & Telephony Status
  const [emergencyCalls, setEmergencyCalls] = useState([]);
  const [telephonyStatus, setTelephonyStatus] = useState({
    configured: false,
    isTestMode: true,
    provider: 'twilio',
    fromNumber: null
  });

  // 7. Automatic SMS & WhatsApp Family Alerts State
  const [dispatchedMessages, setDispatchedMessages] = useState([]);

  // Initialize network & GPS listeners + Offline DB hydration
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionMode('Online (LTE/5G)');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionMode('Offline (Mesh Fallback Active)');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial GPS location
    refreshLocation();

    // Hydrate from IndexedDB (offline-first: local data loads first)
    (async () => {
      try {
        await openDatabase();
        offlineDbReady.current = true;

        // Hydrate contacts from IDB if available
        const idbContacts = await idbGetContacts();
        if (idbContacts && idbContacts.length > 0) {
          setContacts(idbContacts);
        } else {
          // First run: seed IDB from localStorage
          const lsContacts = localStorage.getItem(STORAGE_KEYS.CONTACTS);
          if (lsContacts) {
            const parsed = JSON.parse(lsContacts);
            await idbSetContacts(parsed);
          }
        }

        // Hydrate profile from IDB
        const idbProfile = await idbGetProfile();
        if (idbProfile) {
          const { id, _localUpdatedAt, ...profileData } = idbProfile;
          if (profileData.name) setUserProfile(profileData);
        } else {
          // First run: seed IDB from localStorage
          const lsProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
          if (lsProfile) {
            await idbSaveProfile(JSON.parse(lsProfile));
          }
        }

        // Hydrate settings from IDB
        const idbKeyword = await idbGetSetting('voiceKeyword');
        if (idbKeyword) setVoiceKeyword(idbKeyword);

        const idbApiKey = await idbGetSetting('geminiApiKey');
        if (idbApiKey) setGeminiApiKey(idbApiKey);

      } catch (err) {
        console.debug('[OfflineDB] Hydration fallback to localStorage:', err);
      }
    })();

    // Cross-tab broadcast channel for dispatcher live sync
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('raksha_pulse_sync');
        syncChannelRef.current = bc;
        bc.onmessage = (event) => {
          if (event.data?.type === 'UPDATE_STATUS') {
            setStatus(event.data.status);
            if (event.data.incident) {
              setActiveIncident(event.data.incident);
            }
          }
        };
      }
    } catch (e) {
      console.debug('BroadcastChannel error:', e);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncChannelRef.current) syncChannelRef.current.close();
    };
  }, []);

  // Connect to Wearable Backend SSE Stream (/api/sos/events)
  useEffect(() => {
    let eventSource = null;
    let reconnectTimer = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/sos/events');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT') {
              setWearableStatus(prev => ({
                ...prev,
                connected: data.connected || false,
                deviceId: data.deviceId || prev.deviceId,
                lastSeen: data.lastSeen,
                lastSosTime: data.lastSos,
                lastSosSource: data.lastSosSource,
                recentEvents: data.recentEvents || []
              }));
            } else if (data.type === 'WEARABLE_STATUS') {
              setWearableStatus(prev => ({
                ...prev,
                connected: data.connected,
                deviceId: data.deviceId || prev.deviceId,
                lastSeen: data.lastSeen || Date.now()
              }));
            } else if (data.type === 'WEARABLE_SOS') {
              // 🚨 Hardware SOS Trigger received from ESP8266 (inbuilt FLASH button)
              const hardwareSource = data.source || 'ESP8266_WEARABLE';
              const devId = data.deviceId || 'ESP8266_BAND_01';
              setWearableStatus(prev => ({
                ...prev,
                connected: true,
                deviceId: devId,
                lastSeen: Date.now(),
                lastSosTime: data.timestamp,
                lastSosSource: hardwareSource
              }));

              playHumanHeartbeat();
              speakHumanVoice("ESP8266 Wearable SOS activated! Inbuilt emergency button pressed. Transmitting distress alert now.");

              // Trigger existing SOS emergency reporting workflow immediately
              commitEmergencyReport({
                emergencyType: 'Hardware SOS (ESP8266 Inbuilt Button)',
                description: `Emergency alert triggered via ESP8266 (${devId}). Wearer pressed onboard inbuilt FLASH button on GPIO 0.`,
                peopleCount: 1,
                injured: 'Unknown',
                source: hardwareSource,
                deviceId: devId
              });
            } else if (data.type === 'WEARABLE_TEST_SOS') {
              // 🧪 Safe Test Mode SOS Trigger received
              const devId = data.deviceId || 'ESP8266_BAND_01';
              const hardwareSource = data.source || 'ESP8266_WEARABLE';
              setWearableStatus(prev => ({
                ...prev,
                connected: true,
                deviceId: devId,
                lastSeen: Date.now(),
                lastSosTime: data.timestamp,
                lastSosSource: hardwareSource
              }));
              playCountdownBeep(true);
              speakHumanVoice("ESP8266 wearable hardware test verified. Inbuilt FLASH button signal confirmed.");
              setTestAlertModal({
                deviceId: devId,
                timestamp: data.timestamp || new Date().toISOString(),
                source: hardwareSource,
                testMode: true
              });
            } else if (data.type === 'EMERGENCY_CALLS_INITIATED') {
              if (Array.isArray(data.calls)) {
                setEmergencyCalls(data.calls);
              }
            } else if (data.type === 'EMERGENCY_CALL_UPDATE') {
              if (data.call) {
                setEmergencyCalls(prev => {
                  if (!prev || prev.length === 0) return [data.call];
                  const idx = prev.findIndex(c => c.callId === data.call.callId || (c.providerCallSid && c.providerCallSid === data.call.providerCallSid));
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], ...data.call };
                    return copy;
                  }
                  return [...prev, data.call];
                });
              }
            } else if (data.type === 'EMERGENCY_MESSAGES_DISPATCHED') {
              if (Array.isArray(data.messages)) {
                setDispatchedMessages(data.messages);
              }
            } else if (data.type === 'MESSAGE_STATUS_UPDATE') {
              if (data.message) {
                setDispatchedMessages(prev => {
                  if (!prev || prev.length === 0) return [data.message];
                  const idx = prev.findIndex(m => m.messageId === data.message.messageId);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = { ...copy[idx], ...data.message };
                    return copy;
                  }
                  return [...prev, data.message];
                });
              }
            }
          } catch (err) {
            console.debug('Error parsing SSE event:', err);
          }
        };

        eventSource.onerror = () => {
          setWearableStatus(prev => ({ ...prev, connected: false }));
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimer = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.warn('SSE connection init error:', err);
      }
    };

    connectSSE();

    // Initial sync of emergency contacts and telephony configuration from backend
    fetch('/api/contacts')
      .then(res => res.json())
      .then(data => {
        if (data?.success && Array.isArray(data.contacts) && data.contacts.length > 0) {
          setContacts(data.contacts);
        }
      })
      .catch(err => console.debug('Contacts API sync fallback to localStorage:', err));

    fetch('/api/telephony/config-status')
      .then(res => res.json())
      .then(cfg => {
        if (cfg) setTelephonyStatus(cfg);
      })
      .catch(err => console.debug('Telephony config API check fallback:', err));

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // Sync to localStorage AND IndexedDB (dual-write for resilience)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    if (offlineDbReady.current) {
      idbSetContacts(contacts).catch(() => {});
    }
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
    if (offlineDbReady.current) {
      idbSaveProfile(userProfile).catch(() => {});
    }
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KEYWORD, voiceKeyword);
    if (offlineDbReady.current) {
      idbSaveSetting('voiceKeyword', voiceKeyword).catch(() => {});
    }
  }, [voiceKeyword]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, geminiApiKey);
    if (offlineDbReady.current) {
      idbSaveSetting('geminiApiKey', geminiApiKey).catch(() => {});
    }
  }, [geminiApiKey]);

  useEffect(() => {
    if (activeIncident) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_INCIDENT, JSON.stringify(activeIncident));
      if (offlineDbReady.current) {
        idbSaveIncident(activeIncident).catch(() => {});
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_INCIDENT);
    }
  }, [activeIncident]);

  // Refresh GPS
  const refreshLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await getCurrentGPSLocation();
      setCurrentLocation(loc);
    } catch (err) {
      console.warn('GPS location fetch error:', err);
    } finally {
      setIsLocating(false);
    }
  };

  // Immediate "I NEED HELP" one-tap trigger with 5s cancel countdown
  const triggerInstantEmergency = (customPreset = null) => {
    triggerHaptic([300, 150, 300]);
    playTactileClick();
    playHumanHeartbeat();
    
    // Switch to countdown state so user has 5 seconds to cancel accidental taps
    setStatus('COUNTDOWN');
    setCountdownSeconds(5);

    if (audioFeedbackEnabled) {
      speakHumanVoice("5");
    }

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    let currentCount = 5;
    countdownTimerRef.current = setInterval(() => {
      currentCount -= 1;
      setCountdownSeconds(currentCount);

      if (currentCount > 0) {
        playCountdownBeep(false);
        playHumanHeartbeat();
        if (audioFeedbackEnabled) {
          speakHumanVoice(String(currentCount));
        }
      } else {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        playCountdownBeep(true);
        if (audioFeedbackEnabled) {
          speakHumanVoice("Emergency SOS activated! Dispatching help.");
        }
        // Dispatch emergency
        commitEmergencyReport({
          emergencyType: customPreset?.type || 'Immediate Assistance',
          description: customPreset?.description || 'Emergency SOS triggered via Central Instant Access Button. Citizen in distress.',
          peopleCount: customPreset?.peopleCount || 1,
          injured: customPreset?.injured || 'Unknown'
        });
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    stopEmergencySiren();
    setStatus('IDLE');
    if (audioFeedbackEnabled) {
      speakHumanVoice('Emergency cancelled. System armed and safe.');
    }
  };

  // Skip countdown and report immediately
  const skipCountdownAndDispatch = (customPreset = null) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (audioFeedbackEnabled) {
      speakHumanVoice('Emergency alert dispatched immediately!');
    }
    commitEmergencyReport({
      emergencyType: customPreset?.type || 'Immediate Assistance',
      description: customPreset?.description || 'Instant emergency report triggered directly by user.',
      peopleCount: customPreset?.peopleCount || 1,
      injured: customPreset?.injured || 'Unknown'
    });
  };

  // Full Emergency Commit & AI Analysis Flow
  const commitEmergencyReport = async (reportData) => {
    triggerHaptic([400, 200, 400]);

    const incidentId = `RP-${Math.floor(1000 + Math.random() * 9000)}`;
    const mapsLink = formatGoogleMapsLink(currentLocation.lat, currentLocation.lng);

    // Initial incident in Stage 1: REPORTED
    const initialIncident = {
      id: incidentId,
      source: reportData?.source || 'APP',
      deviceId: reportData?.deviceId || null,
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      userName: userProfile.name,
      userPhone: userProfile.phone,
      userMedical: userProfile.medicalConditions,
      location: currentLocation,
      mapsUrl: mapsLink,
      rawDescription: reportData?.description || 'Emergency SOS signal dispatched.',
      emergencyType: reportData?.emergencyType || 'Immediate Assistance',
      peopleCount: reportData?.peopleCount || 1,
      injured: reportData?.injured || 'Unknown',
      stage: 'REPORTED', // Stage 1
      familyAlerts: [],
      assignedResponder: {
        unitId: 'EMS-ALPHA-09',
        type: 'Rapid Response Ambulance & Rescue Unit',
        vehicleNumber: 'KA-01-EQ-9191',
        driverName: 'Sgt. R. Kulkarni & Paramedic Team',
        contactPhone: '+91 99800 11200',
        currentDistanceKm: 2.4,
        etaMinutes: 6
      }
    };

    setActiveIncident(initialIncident);
    setStatus('REPORTED');

    // 📞 Trigger Simultaneous Emergency Phone Calls to all 3 registered contacts
    // Offline-aware: try direct fetch first, queue for sync if offline
    const callPayload = {
      incidentId,
      source: reportData?.source || 'APP',
      deviceId: reportData?.deviceId || null,
      callerName: userProfile.name,
      emergencyType: reportData?.emergencyType || 'Immediate Assistance',
      description: reportData?.description || 'Emergency SOS signal dispatched.',
      location: currentLocation,
      contacts,
      isTestMode: reportData?.isTest === true
    };

    if (navigator.onLine) {
      fetch('/api/emergency/trigger-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callPayload)
      })
        .then(res => res.json())
        .then(resp => {
          if (resp?.callSummary?.calls) {
            setEmergencyCalls(resp.callSummary.calls);
          }
          if (resp?.messageSummary?.messages) {
            setDispatchedMessages(resp.messageSummary.messages);
          }
        })
        .catch(err => {
          console.warn('Emergency call initiation failed, queuing for sync:', err);
          enqueueSyncTask({
            type: 'TRIGGER_CALLS',
            endpoint: '/api/emergency/trigger-calls',
            method: 'POST',
            payload: callPayload
          }).catch(() => {});
        });
    } else {
      // Offline: queue the call trigger for when connectivity restores
      enqueueSyncTask({
        type: 'TRIGGER_CALLS',
        endpoint: '/api/emergency/trigger-calls',
        method: 'POST',
        payload: callPayload
      }).catch(() => {});
    }

    // 🔊 STAGE 1 SOUND & VOICE: Emergency Reported
    if (audioFeedbackEnabled) {
      playStageAudio('REPORTED', initialIncident);
    }

    // Advance to Stage 2 (AI Analysed) after 2 seconds
    setTimeout(async () => {
      let analysis = {
        emergencyType: initialIncident.emergencyType,
        severity: 'Critical',
        peopleCount: initialIncident.peopleCount,
        injured: initialIncident.injured,
        requiredAssistance: ['Emergency Responders', 'Ambulance']
      };

      try {
        const parsed = await analyzeEmergencyDescription(reportData?.description, geminiApiKey);
        if (parsed) {
          analysis = { ...analysis, ...parsed };
        }
      } catch (err) {
        console.warn('AI analysis fallback:', err);
      }

      // Build Family Alert payloads
      const isWearable = reportData?.source === 'ESP8266_WEARABLE' || reportData?.source === 'ARDUINO_UNO' || reportData?.source === 'ARDUINO_NANO';
      const sourceTag = isWearable ? `[Trigger: ESP8266 Inbuilt FLASH Button (${reportData.deviceId || 'ESP8266_BAND_01'})]\n` : '';
      const familyAlertMessage = `⚠️ Emergency Alert\n${userProfile.name} may be in danger.\n${sourceTag}Location: ${currentLocation.address} (${mapsLink})\nEmergency: ${analysis.emergencyType}\nSeverity: ${analysis.severity}\nTime: ${new Date().toLocaleTimeString()}\nPlease try contacting them immediately.`;

      const generatedAlerts = contacts.map(c => ({
        contactId: c.id,
        contactName: c.name,
        relationship: c.relationship,
        phone: c.phone,
        message: familyAlertMessage,
        exactLocation: {
          address: currentLocation.address,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          mapsUrl: mapsLink
        },
        smsStatus: 'Delivered',
        whatsappStatus: 'Delivered',
        whatsappUrl: `https://wa.me/${c.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(familyAlertMessage)}`,
        smsUrl: `sms:${c.phone}?body=${encodeURIComponent(familyAlertMessage)}`,
        sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deliveryStatus: 'Delivered'
      }));

      const updatedIncident = {
        ...initialIncident,
        emergencyType: analysis.emergencyType,
        severity: analysis.severity,
        peopleCount: analysis.peopleCount,
        injured: analysis.injured,
        aiAnalysis: analysis,
        familyAlerts: generatedAlerts,
        stage: 'AI_ANALYSED' // Stage 2
      };

      setActiveIncident(updatedIncident);
      setStatus('AI_ANALYSED');

      // 🔊 STAGE 2 SOUND & VOICE: AI Analysed
      if (audioFeedbackEnabled) {
        playStageAudio('AI_ANALYSED', updatedIncident);
      }

      // Broadcast sync
      if (syncChannelRef.current) {
        syncChannelRef.current.postMessage({
          type: 'UPDATE_STATUS',
          status: 'AI_ANALYSED',
          incident: updatedIncident
        });
      }

      // Automatically advance to Stage 3: Response Pending after 4 seconds
      setTimeout(() => {
        advanceStage('PENDING');
      }, 4000);

    }, 2200);
  };

  const advanceStage = (newStage) => {
    let incidentSnapshot = null;

    setActiveIncident(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        stage: newStage
      };
      if (newStage === 'RESPONDING') {
        updated.assignedResponder = {
          ...updated.assignedResponder,
          etaMinutes: Math.max(1, (updated.assignedResponder?.etaMinutes || 5) - 2),
          currentDistanceKm: Math.max(0.4, (updated.assignedResponder?.currentDistanceKm || 2.4) - 0.8)
        };
      }
      incidentSnapshot = updated;
      return updated;
    });

    setStatus(newStage);

    // 🔊 STAGES 3, 4, 5 SOUND & VOICE TRIGGER
    if (audioFeedbackEnabled) {
      playStageAudio(newStage, incidentSnapshot || activeIncident);
    }

    if (syncChannelRef.current) {
      syncChannelRef.current.postMessage({
        type: 'UPDATE_STATUS',
        status: newStage,
        incident: activeIncident
      });
    }
  };

  const resolveEmergency = () => {
    advanceStage('RESOLVED');
    stopEmergencySiren();
    setTimeout(() => {
      setStatus('IDLE');
      setActiveIncident(null);
      setEmergencyCalls([]);
    }, 3000);
  };

  const resetAllToSafe = () => {
    stopEmergencySiren();
    setStatus('IDLE');
    setActiveIncident(null);
    setEmergencyCalls([]);
  };

  // Contacts CRUD with offline-first persistence
  // Pattern: update local state + IDB immediately, then sync to server via queue
  const syncContactsToServer = useCallback(async (contactsList) => {
    const payload = { contacts: contactsList };
    if (navigator.onLine) {
      try {
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        // Network failed — queue for background sync
        await enqueueSyncTask({
          type: 'SAVE_CONTACTS',
          endpoint: '/api/contacts',
          method: 'POST',
          payload
        }).catch(() => {});
      }
    } else {
      // Offline — queue for background sync
      await enqueueSyncTask({
        type: 'SAVE_CONTACTS',
        endpoint: '/api/contacts',
        method: 'POST',
        payload
      }).catch(() => {});
    }
  }, []);

  const addContact = async (newContact) => {
    const contact = {
      id: `contact-${Date.now()}`,
      status: 'Active',
      enabled: true,
      hasConsent: true,
      alertTypes: ['WhatsApp', 'SMS', 'Call'],
      ...newContact
    };
    const updated = [...contacts, contact].slice(0, 3);
    setContacts(updated);
    await syncContactsToServer(updated);
  };

  const updateContact = async (id, updatedFields) => {
    const updated = contacts.map(c => c.id === id ? { ...c, ...updatedFields } : c);
    setContacts(updated);
    await syncContactsToServer(updated);
  };

  const deleteContact = async (id) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    await syncContactsToServer(updated);
  };

  const saveAllContacts = async (newContactsList) => {
    setContacts(newContactsList);
    await syncContactsToServer(newContactsList);
    return { success: true };
  };

  return (
    <EmergencyContext.Provider
      value={{
        isOnline,
        connectionMode,
        setConnectionMode,
        currentLocation,
        setCurrentLocation,
        isLocating,
        refreshLocation,
        userProfile,
        setUserProfile,
        contacts,
        addContact,
        updateContact,
        deleteContact,
        saveAllContacts,
        emergencyCalls,
        setEmergencyCalls,
        dispatchedMessages,
        setDispatchedMessages,
        telephonyStatus,
        setTelephonyStatus,
        voiceKeyword,
        setVoiceKeyword,
        geminiApiKey,
        setGeminiApiKey,
        isSentinelActive,
        setIsSentinelActive,
        audioFeedbackEnabled,
        setAudioFeedbackEnabled,
        status,
        setStatus,
        activeIncident,
        setActiveIncident,
        countdownSeconds,
        triggerInstantEmergency,
        cancelCountdown,
        skipCountdownAndDispatch,
        commitEmergencyReport,
        advanceStage,
        resolveEmergency,
        resetAllToSafe,
        wearableStatus,
        setWearableStatus,
        testAlertModal,
        setTestAlertModal
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}

export function useEmergency() {
  const context = useContext(EmergencyContext);
  if (!context) {
    throw new Error('useEmergency must be used within an EmergencyProvider');
  }
  return context;
}
