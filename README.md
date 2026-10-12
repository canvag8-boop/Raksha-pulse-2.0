# RakshaPulse (रक्षा पल्स) — Emergency Response & Safety Network

RakshaPulse is an emergency response and personal safety web application designed for fast, accessible, and high-readability emergency reporting. It combines voice keyword detection, GPS auto-location, AI emergency triage, family alerts, and a real-time responder dispatch dashboard.

---

## 🌟 Core Features

### 🏠 1. Home Screen — Immediate Access
- **Prominent "I NEED HELP" Button**: Pulsing radar rings, large accessible touch target, 5-second cancel countdown to avoid accidental activations.
- **📍 Current Location**: Live GPS coordinates with reverse geocoded street-level address and manual refresh.
- **📡 Connection Status**: Real-time connection indicator (LTE/5G vs. simulated Mesh failover).
- **👨‍👩‍👧 Emergency Contacts**: Quick summary of armed contacts with 1-tap management.
- **🔴 Status Indicator**: High-contrast, calm "System Safe & Armed" badge.
- **Categorized Emergency Chips**: One-tap quick presets for Fire, Medical, Accident, and Trapped.

### 🎙️ 2. Emergency Voice Keyword Prototype
- **Custom Wake Keyword**: Listens for **"Raksha Help"** (customizable in Settings).
- **Voice-to-Text Transcription**: Web Speech API (`SpeechRecognition`) with audio visualizer and ding-dong chime.
- **Hands-Free Speech Analysis**: Converts spoken descriptions into structured incident reports.
- **Prototype Mode**: Includes sample one-click voice scenarios (e.g., *"I'm trapped in a building. There are three people with me and one is injured."*) to guarantee seamless demonstration even in noisy environments or restricted browsers.

### 🚨 3. Emergency Reporting
- **Multi-Modal Reporting**: Text, Voice dictation, or Central SOS button.
- **Captured Fields**: Emergency type, incident description, affected people count, injury status, and automatic GPS location.

### 🤖 4. AI Emergency Understanding
Converts raw user speech/text into structured emergency information:
- **Emergency**: Fire / Medical / Traffic Accident / Trapped
- **Severity**: Critical / High / Moderate (P1 to P3)
- **People Affected**: e.g., 4
- **Injuries**: Yes / No (with injury details)
- **Required Assistance**: Fire Services + Medical / Paramedics
- **Tactical Dispatch Summary & Hazards**: Identified risks like smoke inhalation, structural collapse.
- **Dual AI Engine**: Built-in intelligent offline heuristic NLP triage engine + optional Google Gemini 1.5 Flash API key integration.

### 👨‍👩‍👧 5. Family & Friends Alert Network
- Pre-configured trusted contacts (Name, Relationship, Phone).
- Automated emergency message generation:
  ```text
  ⚠️ Emergency Alert
  Kunal may be in danger.
  Location: Indiranagar 100ft Road, Bengaluru (https://maps.google.com/...)
  Emergency: Fire
  Please try contacting them immediately.
  ```
- Direct 1-tap WhatsApp (`wa.me`) and SMS (`sms:`) links with simulated delivery confirmation.

### 🗺️ 6. Emergency Status Tracking Screen
Follows the exact 5-step emergency sequence:
1. **Emergency Reported ✓**
2. **AI Analysed ✓**
3. **Response Pending**
4. **Help Responding**
5. **Resolved**
- Large text, clear icons, and calm guidance.
- Live tactical Google Maps (Hybrid/Satellite SDK) with emergency beacon, real building & terrain surroundings, hospital/fire station landmarks, and dispatched responder vehicle route.
- First Responder Card with vehicle number, paramedic name, contact link, and live ETA countdown.
- Audio speech guidance (synthesizer reads calm first-aid advice aloud).
- Cancel / Resolve controls.

### 🚑 7. Responder Command & Dispatch Dashboard
- Toggle between **Citizen App** and **Responder Dashboard** from the top bar.
- Real-time synchronization of emergency incidents between Citizen and Responder views.
- Responder actions: Dispatch Unit, advance to *Help Responding*, or mark *Resolved*.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Icons**: Lucide React
- **Maps**: Google Maps JavaScript API SDK (Hybrid & Satellite high-res view, custom tactical emergency markers)
- **Speech & Audio**: Web Speech API (`webkitSpeechRecognition`), Web Audio API Synthesizer, Web SpeechSynthesis API
- **AI Triage**: Built-in Rule/Heuristic NLP Engine + Google Gemini API (optional)

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
npm run preview
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
# Rakshak-emergency-help
