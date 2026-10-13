/**
 * RakshaPulse Voice Keyword & Emergency Speech Recognition Engine
 * Uses Web Speech API with fallback simulation controls.
 */

export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
}

export function createSpeechRecognizer({
  keyword = 'Raksha Help',
  onKeywordDetected,
  onTranscriptChange,
  onFinalTranscript,
  onError,
  onStateChange
}) {
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return {
      isSupported: false,
      startSentinel: () => onError?.('Speech recognition is not supported in this browser.'),
      startDictation: () => onError?.('Speech recognition is not supported in this browser.'),
      stop: () => {}
    };
  }

  let recognition = new SpeechRecognitionClass();
  let mode = 'idle'; // 'idle' | 'sentinel' | 'dictation'
  let isManuallyStopped = false;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  const normalizedKeyword = keyword.toLowerCase().trim();

  recognition.onstart = () => {
    onStateChange?.(mode);
  };

  recognition.onresult = (event) => {
    let interimText = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcriptPiece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcriptPiece;
      } else {
        interimText += transcriptPiece;
      }
    }

    const currentText = (finalText + ' ' + interimText).trim().toLowerCase();

    // Mode 1: Sentinel keyword listening
    if (mode === 'sentinel') {
      const keywordTriggered =
        currentText.includes(normalizedKeyword) ||
        currentText.includes('raksha') ||
        currentText.includes('emergency help') ||
        currentText.includes('i need help');

      if (keywordTriggered) {
        mode = 'dictation';
        onKeywordDetected?.();
        // Clear and restart for capturing user emergency explanation
        try {
          recognition.abort();
          setTimeout(() => {
            if (!isManuallyStopped) {
              mode = 'dictation';
              recognition.start();
            }
          }, 300);
        } catch (e) {
          console.debug(e);
        }
      }
      return;
    }

    // Mode 2: Dictating emergency explanation
    if (mode === 'dictation') {
      const spoken = (finalText + ' ' + interimText).trim();
      onTranscriptChange?.(spoken);
      if (finalText.trim()) {
        onFinalTranscript?.(finalText.trim());
      }
    }
  };

  recognition.onerror = (err) => {
    console.warn('Speech recognition error:', err.error);
    if (err.error === 'not-allowed') {
      onError?.('Microphone access blocked. Please check browser permissions.');
    } else if (err.error !== 'no-speech') {
      onError?.(`Speech recognition: ${err.error}`);
    }
  };

  recognition.onend = () => {
    // If in sentinel or dictation and not manually stopped, re-arm
    if (!isManuallyStopped && (mode === 'sentinel' || mode === 'dictation')) {
      try {
        recognition.start();
      } catch (e) {
        // Ignored
      }
    } else {
      mode = 'idle';
      onStateChange?.('idle');
    }
  };

  return {
    isSupported: true,
    startSentinel: () => {
      isManuallyStopped = false;
      mode = 'sentinel';
      try {
        recognition.start();
      } catch (e) {
        // Already active
      }
    },
    startDictation: () => {
      isManuallyStopped = false;
      mode = 'dictation';
      try {
        recognition.start();
      } catch (e) {
        // Already active
      }
    },
    stop: () => {
      isManuallyStopped = true;
      mode = 'idle';
      try {
        recognition.stop();
      } catch (e) {
        // Ignored
      }
    }
  };
}
