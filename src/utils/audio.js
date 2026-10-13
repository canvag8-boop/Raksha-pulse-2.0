// Web Audio API Synthesizer & Speech Synthesis (Zero external audio file dependencies)

let audioCtx = null;
let voicesLoaded = false;
let availableVoices = [];

// Initialize voices safely for Chrome, Safari, Firefox, Edge
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const updateVoices = () => {
    availableVoices = window.speechSynthesis.getVoices() || [];
    if (availableVoices.length > 0) {
      voicesLoaded = true;
    }
  };
  updateVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }
}

// Global active utterances reference to prevent Chromium garbage collection bug (Issue 338305)
if (typeof window !== 'undefined') {
  window._activeSpeechUtterances = window._activeSpeechUtterances || [];
}

export function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Announcement listeners for on-screen live voice subtitles/captions
let announcementListeners = [];
let latestAnnouncement = '';

export function subscribeToVoiceAnnouncements(listener) {
  announcementListeners.push(listener);
  if (latestAnnouncement) {
    try { listener(latestAnnouncement); } catch (e) {}
  }
  return () => {
    announcementListeners = announcementListeners.filter(l => l !== listener);
  };
}

function broadcastVoiceAnnouncement(text) {
  latestAnnouncement = text;
  announcementListeners.forEach(fn => {
    try { fn(text); } catch (e) {}
  });
}

// Unlock audio context and SpeechSynthesis safely on first user touch/click
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      getAudioContext();
      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    } catch (e) {
      console.debug('Audio unlock:', e);
    }
  };
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

// Crisp tactile feedback click
export function playTactileClick() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    console.debug('Audio click ignored:', e);
  }
}

// Realistic human heartbeat "thump-thump" pulse sound
export function playHumanHeartbeat() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // First beat (lub)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(75, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Second beat (dub) - slightly higher and shorter
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(90, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(40, now + 0.24);
    gain2.gain.setValueAtTime(0.4, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.24);
  } catch (e) {
    console.debug('Heartbeat sound error:', e);
  }
}

// Gentle 2-tone "ding-dong" wake chime when "Raksha Help" is recognized
export function playWakeChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2 (higher note)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15); // A5
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.debug('Wake chime error:', e);
  }
}

// Countdown beep for urgent cancel window
export function playCountdownBeep(isFinal = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isFinal ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isFinal ? 960 : 660, now);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.3 : 0.15));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isFinal ? 0.3 : 0.15));
  } catch (e) {
    console.debug('Beep error:', e);
  }
}

// Emergency siren alert tone (pulsing dual tone)
let sirenOsc = null;
let sirenGain = null;
let sirenInterval = null;

export function startEmergencySiren() {
  try {
    const ctx = getAudioContext();
    if (!ctx || sirenOsc) return;
    
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'sawtooth';
    sirenGain.gain.setValueAtTime(0.18, ctx.currentTime);
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
    
    let high = false;
    sirenInterval = setInterval(() => {
      if (sirenOsc && ctx) {
        high = !high;
        sirenOsc.frequency.setTargetAtTime(high ? 880 : 650, ctx.currentTime, 0.08);
      }
    }, 280);
  } catch (e) {
    console.debug('Siren start error:', e);
  }
}

export function stopEmergencySiren() {
  try {
    if (sirenInterval) {
      clearInterval(sirenInterval);
      sirenInterval = null;
    }
    if (sirenOsc) {
      sirenOsc.stop();
      sirenOsc.disconnect();
      sirenOsc = null;
    }
    if (sirenGain) {
      sirenGain.disconnect();
      sirenGain = null;
    }
  } catch (e) {
    console.debug('Siren stop error:', e);
  }
}

// ============================================================================
// STAGE-SPECIFIC SOUND EFFECTS (Emergency Lifecycle)
// ============================================================================

// 1. Stage 1: EMERGENCY REPORTED — High-Urgency Dual Beacon Alert
export function playEmergencyReportedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Beep 1 (High tone)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1174, now + 0.15); // D6
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Beep 2 (Second urgent pulse)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(880, now + 0.18);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.35); // E6
    gain2.gain.setValueAtTime(0.3, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.4);
  } catch (e) {
    console.debug('Reported sound error:', e);
  }
}

// 2. Stage 2: AI ANALYSED — Futuristic Arpeggiated Triage Chime
export function playAiAnalysedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch (e) {
    console.debug('AI Analysed sound error:', e);
  }
}

// 3. Stage 3: RESPONSE PENDING — Dispatch Telemetry & Radio Squawk
export function playResponsePendingSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Chirp 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(750, now);
    osc1.frequency.linearRampToValueAtTime(1200, now + 0.08);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Chirp 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(900, now + 0.14);
    osc2.frequency.linearRampToValueAtTime(1400, now + 0.22);
    gain2.gain.setValueAtTime(0.25, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.26);
  } catch (e) {
    console.debug('Pending sound error:', e);
  }
}

// 4. Stage 4: HELP RESPONDING — Ambulance/Emergency Vehicle Siren Burst
export function playHelpRespondingSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Siren burst (High - Low - High - Low)
    const tones = [
      { freq: 760, duration: 0.15 },
      { freq: 980, duration: 0.15 },
      { freq: 760, duration: 0.15 },
      { freq: 980, duration: 0.25 }
    ];

    let t = now;
    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(tone.freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + tone.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + tone.duration);
      t += tone.duration;
    });
  } catch (e) {
    console.debug('Help responding sound error:', e);
  }
}

// 5. Stage 5: RESOLVED — Soothing Harmonic Bell Chime
export function playResolvedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [349.23, 440.00, 523.25, 698.46]; // F4, A4, C5, F5 (Harmonious F Major)

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.05;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.2);
    });
  } catch (e) {
    console.debug('Resolved sound error:', e);
  }
}

// Alert Sent Sound (WhatsApp / SMS Family Alert Transmission)
export function playAlertSentSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now);
    osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {
    console.debug('Alert sent sound error:', e);
  }
}

// Master Stage Audio Trigger (Plays unique chime + natural human voice)
export function playStageAudio(stage, incidentDetails = {}) {
  switch (stage) {
    case 'REPORTED':
      playEmergencyReportedSound();
      speakHumanVoice("Emergency reported! Incident signal received by RakshaPulse response network.", { delay: 350 });
      break;

    case 'AI_ANALYSED':
      playAiAnalysedSound();
      const type = incidentDetails?.emergencyType || 'Critical Incident';
      speakHumanVoice(`AI analysis complete. Emergency classified as ${type}. Prioritizing dispatch.`, { delay: 400 });
      break;

    case 'PENDING':
      playResponsePendingSound();
      speakHumanVoice("Response pending. Matching closest emergency responder unit.", { delay: 300 });
      break;

    case 'RESPONDING':
      playHelpRespondingSound();
      const unit = incidentDetails?.assignedResponder?.unitId || 'EMS-ALPHA-09';
      speakHumanVoice(`Help responding! Unit ${unit} has been dispatched and is en route to your location. Estimated arrival in 4 minutes.`, { delay: 750 });
      break;

    case 'RESOLVED':
      playResolvedSound();
      speakHumanVoice("Emergency incident resolved. Responders standing down. You are safe.", { delay: 400 });
      break;

    default:
      break;
  }
}

// Find best natural human voice
function getBestHumanVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Try Indian English or Hindi
  const indianVoice = voices.find(v => v.lang === 'en-IN' || v.name.includes('India') || v.name.includes('Rishi') || v.name.includes('Kavya'));
  if (indianVoice) return indianVoice;

  // 2. Try Natural / Google / Premium voices
  const naturalVoice = voices.find(v =>
    v.lang.startsWith('en') &&
    (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Siri') || v.name.includes('Karen'))
  );
  if (naturalVoice) return naturalVoice;

  // 3. Any English voice
  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  if (englishVoice) return englishVoice;

  return voices[0];
}

// Human Voice Text-to-Speech (Reliable & Resilient)
export function speakHumanVoice(text, options = {}) {
  if (typeof window === 'undefined' || !text) return;

  // 1. Broadcast to on-screen live voice subtitle banner
  broadcastVoiceAnnouncement(text);

  if (!('speechSynthesis' in window)) {
    console.debug('SpeechSynthesis not available in this environment');
    return;
  }

  try {
    // If paused, unpause immediately
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    if (options.interrupt === true) {
      window.speechSynthesis.cancel();
    }

    const runSpeak = () => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.text = text;
        utterance.rate = options.rate || 0.95;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume !== undefined ? options.volume : 1.0;

        const bestVoice = getBestHumanVoice();
        if (bestVoice) {
          utterance.voice = bestVoice;
        }

        // Retain reference so garbage collector does not silence mid-sentence (Chromium issue 338305)
        window._activeSpeechUtterances = window._activeSpeechUtterances || [];
        window._activeSpeechUtterances.push(utterance);

        utterance.onend = () => {
          window._activeSpeechUtterances = (window._activeSpeechUtterances || []).filter(u => u !== utterance);
          if (options.onEnd) options.onEnd();
        };

        utterance.onerror = (err) => {
          window._activeSpeechUtterances = (window._activeSpeechUtterances || []).filter(u => u !== utterance);
          console.debug('Utterance speech error:', err);
        };

        window.speechSynthesis.speak(utterance);

        // Chrome on Android background recovery
        setTimeout(() => {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }, 50);

      } catch (err) {
        console.debug('Speech speak error:', err);
      }
    };

    if (options.delay) {
      setTimeout(runSpeak, options.delay);
    } else {
      runSpeak();
    }

  } catch (e) {
    console.debug('Speech synthesis outer error:', e);
  }
}

// Interactive test voice announcement
export function testVoiceEngine() {
  playTactileClick();
  const testPhrase = "RakshaPulse spoken human voice announcement is active and verified.";
  speakHumanVoice(testPhrase, { interrupt: true, rate: 1.0 });
  return testPhrase;
}

// Replay last announcement
export function replayLastVoiceAnnouncement() {
  playTactileClick();
  if (latestAnnouncement) {
    speakHumanVoice(latestAnnouncement, { interrupt: true });
  } else {
    testVoiceEngine();
  }
}

// Backward-compatible alias for speakHumanVoice
export const speakCalmGuidance = (text) => speakHumanVoice(text, { rate: 0.95 });

export function stopSpeaking() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window._activeSpeechUtterances = [];
    }
  } catch (e) {
    console.debug('Stop speaking error:', e);
  }
}

// Tactile haptic vibration for mobile phones
export function triggerHaptic(pattern = [200, 100, 200]) {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    console.debug('Haptics not supported:', e);
  }
}
