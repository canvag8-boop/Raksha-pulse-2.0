/**
 * RakshaPulse AI Emergency Understanding Engine
 * Parses natural language emergency descriptions into structured operational triage data.
 * Supports:
 * 1. Google Gemini API (when API Key is provided)
 * 2. High-precision local heuristic NLP triage engine (immediate, offline, zero-latency)
 */

export async function analyzeEmergencyDescription(text, apiKey = '') {
  const sanitizedText = (text || '').trim();
  if (!sanitizedText) {
    return getDefaultAnalysis();
  }

  // 1. Try Gemini API if an API key is available
  if (apiKey) {
    try {
      const response = await callGeminiAPI(sanitizedText, apiKey);
      if (response) return response;
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local AI engine:', err);
    }
  }

  // 2. Intelligent local emergency parsing engine
  return parseLocallyWithAIHeuristics(sanitizedText);
}

function getDefaultAnalysis() {
  return {
    emergencyType: 'General Emergency',
    severity: 'High',
    peopleCount: 1,
    injured: 'Unknown',
    injuryDetails: 'Not specified yet',
    requiredAssistance: ['Police / Rapid Response', 'Paramedics'],
    hazards: ['Unconfirmed caller status'],
    priorityScore: 7,
    triageCode: 'YELLOW',
    dispatcherSummary: 'Immediate emergency alert triggered. Awaiting voice/text details.',
    safetyInstructions: [
      'Stay in a safe location if possible.',
      'Keep your phone line open and battery saved.',
      'Signal responders with flash or sound when they arrive.'
    ]
  };
}

// Call Google Gemini Flash API for deep parsing
async function callGeminiAPI(text, apiKey) {
  const prompt = `You are RakshaPulse's mission-critical Emergency Dispatch AI.
Analyze this emergency transcript:
"${text}"

Return ONLY valid JSON in this exact structure with no markdown backticks:
{
  "emergencyType": "Fire" | "Medical" | "Traffic Accident" | "Assault / Threat" | "Trapped / Collapse" | "Natural Disaster" | "Other",
  "severity": "Critical" | "High" | "Moderate" | "Low",
  "peopleCount": <number>,
  "injured": "Yes" | "No" | "Unsure",
  "injuryDetails": "<short description of injuries, or None detected>",
  "requiredAssistance": ["<e.g. Fire Services, Ambulance / Paramedics, Police, Search & Rescue>"],
  "hazards": ["<e.g. Smoke inhalation, Spreading flames, Traffic hazard>"],
  "priorityScore": <integer 1 to 10>,
  "triageCode": "RED" | "YELLOW" | "GREEN",
  "dispatcherSummary": "<Clear 1-sentence tactical summary for first responders>",
  "safetyInstructions": ["<Actionable step 1 for victim>", "<Actionable step 2 for victim>", "<Actionable step 3 for victim>"]
}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API returned status ${res.status}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (rawText) {
    const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleaned);
  }
  throw new Error('Empty Gemini response');
}

// Robust offline/local NLP emergency parser
export function parseLocallyWithAIHeuristics(text) {
  const lower = text.toLowerCase();

  // 1. Emergency Type Detection
  let emergencyType = 'General Emergency';
  let requiredAssistance = ['Paramedics / Ambulance', 'Emergency Services'];

  const fireMatches = lower.match(/\b(fire|flames|smoke|burning|explosion|gas leak|cylinder blast)\b/);
  const medicalMatches = lower.match(/\b(heart attack|cardiac|stroke|bleeding|unconscious|fainted|seizure|breathing|asthma|fracture|broken bone|chest pain|overdose|vomiting)\b/);
  const accidentMatches = lower.match(/\b(accident|crash|collision|hit and run|car crash|bike accident|pedestrian hit|run over)\b/);
  const assaultMatches = lower.match(/\b(attack|assault|stabbed|shot|gun|robbery|thief|intruder|harassment|stalking|danger|weapon|knife|kidnap)\b/);
  const trappedMatches = lower.match(/\b(trapped|stuck|collapse|rubble|elevator|locked in|under debris|flood|water rising|landslide)\b/);

  if (fireMatches) {
    emergencyType = 'Fire';
    requiredAssistance = ['Fire Dept (Engine)', 'Ambulance / Paramedics'];
  } else if (trappedMatches) {
    emergencyType = 'Trapped / Collapse';
    requiredAssistance = ['Search & Rescue', 'Fire & Disaster Team', 'Ambulance'];
  } else if (accidentMatches) {
    emergencyType = 'Traffic Accident';
    requiredAssistance = ['Ambulance / Paramedics', 'Traffic Police', 'Rescue Cutter'];
  } else if (assaultMatches) {
    emergencyType = 'Assault / Security Threat';
    requiredAssistance = ['Police Rapid Action Force', 'Ambulance'];
  } else if (medicalMatches) {
    emergencyType = 'Medical';
    requiredAssistance = ['Paramedics / ALS Ambulance'];
  }

  // 2. People Count Extraction
  let peopleCount = 1;
  const numWords = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };

  const peopleRegex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(people|persons|of us|victims|passengers|family members|trapped)/;
  const peopleMatch = lower.match(peopleRegex);
  if (peopleMatch) {
    const val = peopleMatch[1];
    peopleCount = isNaN(val) ? (numWords[val] || 1) : parseInt(val, 10);
  } else if (lower.includes('alone') || lower.includes('just me') || lower.includes('myself')) {
    peopleCount = 1;
  } else if (lower.includes('brother') || lower.includes('mother') || lower.includes('father') || lower.includes('friend') || lower.includes('wife')) {
    peopleCount = 2;
  }

  // 3. Injuries
  let injured = 'No';
  let injuryDetails = 'No reported physical injuries yet';

  const injuryKeywords = ['injured', 'hurt', 'bleeding', 'burned', 'burns', 'unconscious', 'broken', 'wound', 'cannot breathe', 'head injury'];
  const hasInjuries = injuryKeywords.some(kw => lower.includes(kw));

  if (hasInjuries) {
    injured = 'Yes';
    if (lower.includes('burned') || lower.includes('burn')) injuryDetails = 'Burns reported';
    else if (lower.includes('unconscious')) injuryDetails = 'Person unconscious / unresponsive';
    else if (lower.includes('bleeding')) injuryDetails = 'Active bleeding reported';
    else if (lower.includes('broken') || lower.includes('fracture')) injuryDetails = 'Suspected bone fractures';
    else injuryDetails = 'Physical injuries reported on scene';

    // Ensure medical assistance is added if not already
    if (!requiredAssistance.some(a => a.toLowerCase().includes('ambulance') || a.toLowerCase().includes('medical'))) {
      requiredAssistance.push('Ambulance / Paramedics');
    }
  }

  // 4. Severity Assessment
  let severity = 'High';
  let priorityScore = 8;
  let triageCode = 'YELLOW';

  const isCritical = lower.includes('trapped') ||
                     lower.includes('fire') ||
                     lower.includes('unconscious') ||
                     lower.includes('not breathing') ||
                     lower.includes('explosion') ||
                     lower.includes('gun') ||
                     lower.includes('severe') ||
                     (injured === 'Yes' && peopleCount > 2);

  if (isCritical) {
    severity = 'Critical';
    priorityScore = 10;
    triageCode = 'RED';
  } else if (lower.includes('minor') || lower.includes('safe for now') || lower.includes('precaution')) {
    severity = 'Moderate';
    priorityScore = 5;
    triageCode = 'GREEN';
  }

  // 5. Hazards
  const hazards = [];
  if (lower.includes('smoke') || emergencyType === 'Fire') hazards.push('Smoke inhalation risk');
  if (lower.includes('trapped') || lower.includes('collapse')) hazards.push('Structural entrapment');
  if (lower.includes('gas')) hazards.push('Flammable gas buildup');
  if (lower.includes('traffic') || lower.includes('highway') || emergencyType === 'Traffic Accident') hazards.push('Secondary highway collision risk');
  if (lower.includes('weapon') || lower.includes('assault')) hazards.push('Potential active threat');
  if (hazards.length === 0) hazards.push('Scene hazards unverified');

  // 6. Tactical Dispatcher Summary
  const dispatcherSummary = `${severity.toUpperCase()} PRIORITY: ${emergencyType} reported with ~${peopleCount} person(s) affected. Injured: ${injured} (${injuryDetails}). Dispatched: ${requiredAssistance.join(' + ')}.`;

  // 7. Safety instructions for the citizen
  const safetyInstructions = getSafetyAdvice(emergencyType);

  return {
    emergencyType,
    severity,
    peopleCount,
    injured,
    injuryDetails,
    requiredAssistance,
    hazards,
    priorityScore,
    triageCode,
    dispatcherSummary,
    safetyInstructions
  };
}

function getSafetyAdvice(type) {
  switch (type) {
    case 'Fire':
      return [
        'Stay low to the floor where air is cleaner and cooler.',
        'Cover your mouth and nose with a damp cloth if available.',
        'Do NOT use elevators. Check door handles for heat before opening.'
      ];
    case 'Trapped / Collapse':
      return [
        'Protect your head and vital organs with debris or your arms.',
        'Tap rhythmically on pipes or walls rather than shouting to preserve oxygen.',
        'Cover your mouth with clothing to prevent inhaling dust and debris.'
      ];
    case 'Medical':
      return [
        'Keep the patient calm, warm, and lying still.',
        'Do not give anything to eat or drink if unconscious or having surgery.',
        'If bleeding, apply direct steady pressure with a clean cloth.'
      ];
    case 'Traffic Accident':
      return [
        'Move away from moving traffic if safely able to do so.',
        'Do not move seriously injured persons unless there is imminent fire hazard.',
        'Turn on hazard lights to alert oncoming motorists.'
      ];
    case 'Assault / Security Threat':
      return [
        'Move to a well-lit, populated, or lockable secure room.',
        'Keep phone on silent if in hiding, but maintain connection.',
        'Note physical descriptions of suspects when safe to observe.'
      ];
    default:
      return [
        'Stay in your current safe location.',
        'Keep your phone line free so responders can reach you.',
        'If safe, turn on your phone flashlight to signal responders.'
      ];
  }
}
