import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Play, CheckCircle2 } from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../utils/voiceRecognition';
import { playWakeChime, playTactileClick, triggerHaptic, speakHumanVoice } from '../utils/audio';

export default function VoiceKeywordSentinel({ isOpen, onClose, onKeywordTriggered }) {
  const { voiceKeyword, commitEmergencyReport } = useEmergency();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [stage, setStage] = useState('keyword_wait'); // 'keyword_wait' | 'dictating' | 'ready_to_send'
  const [errorMessage, setErrorMessage] = useState('');
  const recognizerRef = useRef(null);

  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    if (isOpen) {
      startListeningEngine();
    } else {
      stopListeningEngine();
      setStage('keyword_wait');
      setTranscript('');
      setErrorMessage('');
    }

    return () => {
      stopListeningEngine();
    };
  }, [isOpen]);

  const startListeningEngine = () => {
    setErrorMessage('');
    if (!supported) {
      setErrorMessage('Browser Speech API not supported in this browser. Use simulated voice triggers below.');
      return;
    }

    try {
      const rec = createSpeechRecognizer({
        keyword: voiceKeyword,
        onKeywordDetected: () => {
          playWakeChime();
          triggerHaptic([200, 100, 200]);
          speakHumanVoice("Raksha Help keyword detected. Listening for emergency details.");
          setStage('dictating');
        },
        onTranscriptChange: (text) => {
          setTranscript(text);
        },
        onFinalTranscript: (text) => {
          setTranscript(text);
          if (text.length > 5) {
            setStage('ready_to_send');
          }
        },
        onError: (err) => {
          setErrorMessage(err);
        },
        onStateChange: (mode) => {
          setIsListening(mode !== 'idle');
        }
      });

      recognizerRef.current = rec;
      rec.startSentinel();
      setIsListening(true);
    } catch (e) {
      console.warn('Speech engine start failed:', e);
    }
  };

  const stopListeningEngine = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    setIsListening(false);
  };

  // Simulate saying the voice keyword + emergency description (for flawless presentation)
  const simulateVoicePrompt = (textToSimulate) => {
    playTactileClick();
    setStage('dictating');
    playWakeChime();
    speakHumanVoice("Raksha Help keyword detected.");
    setTranscript('Listening: "Raksha Help" detected...');

    setTimeout(() => {
      setTranscript(textToSimulate);
      speakHumanVoice(textToSimulate);
      setStage('ready_to_send');
    }, 1200);
  };

  const handleSendReport = () => {
    playTactileClick();
    stopListeningEngine();
    onClose?.();
    commitEmergencyReport({
      emergencyType: 'Voice Emergency Report',
      description: transcript || "I'm trapped in a building. There are three people with me and one is injured.",
      peopleCount: 4,
      injured: 'Yes'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Prototype Header Banner */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Mic className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg">Voice Keyword Sentinel</h3>
              <p className="text-xs text-rose-300/80">Prototyped Voice Activation Feature</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Prototype OS limitations notice */}
        <div className="my-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong>Prototype Notice:</strong> Background/hands-free wake-word detection has mobile OS restrictions. This screen demonstrates how RakshaPulse wakes on keyword detection and captures emergency speech for AI triage.
          </p>
        </div>

        {/* Central Audio Waveform & Status */}
        <div className="my-6 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800/80 border-2 border-rose-500/50 shadow-lg relative mb-4">
            <div className={`absolute inset-0 rounded-full bg-rose-500/20 ${isListening ? 'animate-ping' : ''}`} />
            <Mic className={`w-10 h-10 ${stage === 'dictating' ? 'text-rose-400 animate-bounce' : 'text-slate-300'}`} />
          </div>

          <div className="text-sm font-semibold text-slate-300 mb-1">
            {stage === 'keyword_wait' && (
              <span>Say out loud: <strong className="text-rose-400 text-base">"{voiceKeyword}"</strong></span>
            )}
            {stage === 'dictating' && (
              <span className="text-amber-300 animate-pulse">Keyword detected! Describe your situation now...</span>
            )}
            {stage === 'ready_to_send' && (
              <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Ready for AI Analysis
              </span>
            )}
          </div>

          {/* Sound wave bars */}
          <div className="flex items-center justify-center gap-1.5 h-10 my-3">
            <div className="w-1.5 bg-rose-500 rounded-full wave-bar-1" />
            <div className="w-1.5 bg-rose-500 rounded-full wave-bar-2" />
            <div className="w-1.5 bg-rose-500 rounded-full wave-bar-3" />
            <div className="w-1.5 bg-rose-500 rounded-full wave-bar-4" />
            <div className="w-1.5 bg-rose-500 rounded-full wave-bar-5" />
            <div className="w-1.5 bg-rose-500 rounded-full wave-bar-6" />
          </div>

          {/* Live Transcript Bubble */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-left min-h-[85px] max-h-36 overflow-y-auto">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Live Speech Transcript
            </span>
            <p className="text-sm text-slate-100 font-medium italic">
              {transcript || (stage === 'keyword_wait' ? `Waiting for voice wake-keyword "${voiceKeyword}"...` : 'Listening for your speech...')}
            </p>
          </div>
        </div>

        {/* Quick Simulation Scenarios (Guarantees seamless demo even in silence or restricted mic) */}
        <div className="space-y-2 mb-6">
          <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
            <span>Instant Voice Scenarios (Click to test):</span>
            <span className="text-rose-400 text-[11px]">One-click demo</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => simulateVoicePrompt("I'm trapped in a building. There are three people with me and one is injured.")}
              className="text-left p-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-xs text-slate-200 transition flex items-center justify-between group active:scale-[0.98]"
            >
              <div>
                <span className="font-semibold text-rose-300 block">🔥 Trapped in Building (Spec Example)</span>
                <span className="text-slate-400 line-clamp-1">"I'm trapped in a building. There are three people with me and one is injured."</span>
              </div>
              <Play className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition shrink-0 ml-2" />
            </button>

            <button
              onClick={() => simulateVoicePrompt("Major car collision on the flyover. Two passengers injured, bleeding from head, car is smoking.")}
              className="text-left p-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-xs text-slate-200 transition flex items-center justify-between group active:scale-[0.98]"
            >
              <div>
                <span className="font-semibold text-amber-300 block">🚗 Traffic Accident with Injuries</span>
                <span className="text-slate-400 line-clamp-1">"Major car collision on flyover. Two passengers injured..."</span>
              </div>
              <Play className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition shrink-0 ml-2" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            disabled={!transcript}
            onClick={handleSendReport}
            className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg ${
              transcript
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Send to AI Triage</span>
          </button>
        </div>
      </div>
    </div>
  );
}
