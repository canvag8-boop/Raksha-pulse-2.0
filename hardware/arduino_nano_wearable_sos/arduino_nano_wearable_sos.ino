/*
  =============================================================================
  RakshaPulse Arduino Nano Wearable Emergency SOS Firmware
  =============================================================================
  Target Board: Arduino Nano (ATmega328P, 5V / 3.3V) / Arduino Uno / Pro Mini
  Primary Trigger: External Tactile Momentary Push Button
  
  WIRING DIAGRAM:
  ---------------------------------------------------------------------------
  Arduino Nano Pin D2  ─── [ Tactile Button Leg 1 ]
  Arduino Nano Pin GND ─── [ Tactile Button Leg 2 ]
  (Uses internal INPUT_PULLUP — NO external resistors required!)
  
  OPTIONAL PERIPHERALS:
  - Onboard Status LED : Digital Pin 13 (Built-in)
  - Optional Buzzer    : Digital Pin 4 (Active 5V Piezo Sounder (+) to D4, (-) to GND)
  
  BEHAVIOR & SAFETY PROTOCOLS:
  1. Internal Pullup: Pin D2 is held HIGH (5V) by ATmega internal pullup resistor.
  2. Button Press: When pressed, Pin D2 connects to GND and reads LOW.
  3. Hold Verification: Must be held continuously for 2.0 seconds (2000 ms)
     to prevent accidental triggers or pocket bumps.
  4. Software Debounce: 50 ms mechanical chatter filter.
  5. Emergency Dispatch:
     - Emits structured JSON distress packet over USB Serial (115200 baud).
     - Directly triggers RakshaPulse Web Serial API & Backend Lifeline Gateway.
     - Automatically fires:
       a) 3 Simultaneous Emergency Voice Calls to family contacts.
       b) Automatic SMS with exact GPS coordinates, address & Google Maps pin.
       c) Automatic WhatsApp alert with live location link to family numbers.
  6. Idempotency: Generates unique clientEventId ("EVT-NANO-XXXXX") per trigger.
  =============================================================================
*/

// =============================================================================
//  PIN CONFIGURATIONS
// =============================================================================
const int PIN_EXTERNAL_BUTTON = 2;   // Digital Pin D2 (External push button, Active LOW)
const int PIN_STATUS_LED      = 13;  // Digital Pin D13 (Arduino Nano onboard LED)
const int PIN_BUZZER          = 4;   // Digital Pin D4 (Optional Piezo Buzzer)

// =============================================================================
//  CONFIGURATION CONSTANTS
// =============================================================================
const char* DEVICE_ID         = "NANO_BAND_01";
const unsigned long HOLD_MS   = 2000; // 2.0 seconds deliberate continuous hold required
const unsigned long DEBOUNCE  = 50;   // 50ms mechanical debounce window
const unsigned long HEARTBEAT = 15000;// 15s telemetry heartbeat to verify USB connection

// Set to true for safe local testing (no real phone carrier charges in sandbox)
// Set to false for live production emergency dispatch
const bool TEST_MODE          = false;

// =============================================================================
//  STATE MACHINE DEFINITION
// =============================================================================
enum ButtonState {
  STATE_IDLE,
  STATE_DEBOUNCING,
  STATE_HOLD_COUNTDOWN,
  STATE_TRIGGERED,
  STATE_WAIT_RELEASE
};

ButtonState currentState = STATE_IDLE;
unsigned long pressStartTime   = 0;
unsigned long lastDebounceTime = 0;
bool lastButtonReading         = HIGH;
unsigned long lastHeartbeat    = 0;
unsigned int triggerCounter    = 0;

// =============================================================================
//  HELPER FUNCTIONS: FEEDBACK & AUDIO
// =============================================================================

void beepBuzzer(unsigned int freqHz, unsigned long durationMs) {
  // Beep on optional buzzer pin if connected
  tone(PIN_BUZZER, freqHz, durationMs);
}

void flashLed(int times, unsigned long delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(delayMs);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(delayMs);
  }
}

// =============================================================================
//  EMERGENCY SOS DISPATCH ROUTINE
// =============================================================================

void dispatchEmergencySos() {
  triggerCounter++;
  
  // High-intensity alarm sequence on onboard LED & Buzzer
  digitalWrite(PIN_STATUS_LED, HIGH);
  beepBuzzer(1500, 300);

  // Generate unique event ID
  char clientEventId[32];
  snprintf(clientEventId, sizeof(clientEventId), "EVT-NANO-%u-%lu", triggerCounter, millis());

  // 1. Human-readable debug output for Arduino IDE Serial Monitor
  Serial.println(F("\n========================================================"));
  Serial.println(F("🚨 [EMERGENCY] EXTERNAL BUTTON HELD FOR 2.0s -> SOS ACTIVATED!"));
  Serial.println(F("📍 DISPATCHING EXACT GPS LOCATION VIA SMS & WHATSAPP..."));
  Serial.println(F("📞 DIALING 3 REGISTERED FAMILY CONTACTS SIMULTANEOUSLY..."));
  Serial.println(F("========================================================"));

  // 2. Structured JSON payload for RakshaPulse Web Serial API & Node.js backend
  Serial.print(F("{\"event\":\"SOS\",\"deviceId\":\""));
  Serial.print(DEVICE_ID);
  Serial.print(F("\",\"source\":\"ARDUINO_NANO_WEARABLE\",\"button\":\"EXTERNAL_BUTTON\",\"pressType\":\"LONG_HOLD_2S\",\"clientEventId\":\""));
  Serial.print(clientEventId);
  Serial.print(F("\",\"testMode\":"));
  Serial.print(TEST_MODE ? "true" : "false");
  Serial.print(F(",\"timestamp\":"));
  Serial.print(millis());
  Serial.print(F(",\"autoDispatch\":{\"sms\":true,\"whatsapp\":true,\"location\":true"));
  Serial.println(F("}}"));

  // Strobe LED to confirm transmission
  flashLed(5, 80);
  digitalWrite(PIN_STATUS_LED, HIGH); // Remain lit until button released
}

// =============================================================================
//  SETUP INITIALIZATION
// =============================================================================

void setup() {
  // Initialize USB Serial communication at 115200 baud
  Serial.begin(115200);
  while (!Serial && millis() < 1500) {
    ; // Wait for serial port connection
  }

  // Configure Pin Modes
  // INPUT_PULLUP enables the internal 20k pull-up resistor (no external resistor needed!)
  pinMode(PIN_EXTERNAL_BUTTON, INPUT_PULLUP);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  // Initial power-on indication
  digitalWrite(PIN_STATUS_LED, LOW);
  flashLed(3, 100);
  beepBuzzer(880, 150);

  Serial.println(F("---------------------------------------------------------"));
  Serial.println(F("🛡️ RakshaPulse Arduino Nano SOS Controller Initialized"));
  Serial.print(F("📌 Hardware: Arduino Nano | Device ID: "));
  Serial.println(DEVICE_ID);
  Serial.println(F("🔘 External Push Button Pin: D2 (Active LOW with INPUT_PULLUP)"));
  Serial.println(F("⏱️ Required Hold Duration: 2.0 Seconds (2000 ms)"));
  Serial.println(F("📲 Automatic Dispatch: SMS & WhatsApp with Exact Location"));
  Serial.println(F("---------------------------------------------------------"));

  // Emit ready status JSON
  Serial.print(F("{\"event\":\"DEVICE_READY\",\"deviceId\":\""));
  Serial.print(DEVICE_ID);
  Serial.print(F("\",\"source\":\"ARDUINO_NANO_WEARABLE\",\"status\":\"ARMED\""));
  Serial.println(F("}"));
}

// =============================================================================
//  MAIN LOOP: NON-BLOCKING STATE MACHINE
// =============================================================================

void loop() {
  unsigned long now = millis();
  int reading = digitalRead(PIN_EXTERNAL_BUTTON);

  // Check if button state changed (noise filtering)
  if (reading != lastButtonReading) {
    lastDebounceTime = now;
  }

  // Periodic telemetry heartbeat every 15s to verify active USB link
  if (currentState == STATE_IDLE && (now - lastHeartbeat >= HEARTBEAT)) {
    lastHeartbeat = now;
    Serial.print(F("{\"event\":\"HEARTBEAT\",\"deviceId\":\""));
    Serial.print(DEVICE_ID);
    Serial.print(F("\",\"source\":\"ARDUINO_NANO_WEARABLE\",\"status\":\"OK\",\"uptimeMs\":"));
    Serial.print(now);
    Serial.println(F("}"));
  }

  // Check if signal has remained stable longer than debounce threshold
  if ((now - lastDebounceTime) > DEBOUNCE) {
    switch (currentState) {
      
      // 1. Waiting for button press
      case STATE_IDLE:
        if (reading == LOW) { // Button pressed (Pin D2 pulled to GND)
          pressStartTime = now;
          currentState = STATE_HOLD_COUNTDOWN;
          digitalWrite(PIN_STATUS_LED, HIGH);
          beepBuzzer(600, 60); // Initial click beep
          Serial.println(F("ℹ️ Button press detected. Hold for 2.0s to confirm SOS..."));
        }
        break;

      // 2. Monitoring 2.0 second continuous hold
      case STATE_HOLD_COUNTDOWN:
        if (reading == LOW) {
          unsigned long elapsed = now - pressStartTime;
          
          // Progressive blink & audio clicks while holding
          if (elapsed % 300 < 50) {
            digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
            if (elapsed > 1000) {
              beepBuzzer(1000 + (elapsed / 2), 30);
            }
          }

          // Reached 2.0 seconds continuous hold!
          if (elapsed >= HOLD_MS) {
            currentState = STATE_TRIGGERED;
            dispatchEmergencySos();
            currentState = STATE_WAIT_RELEASE;
          }
        } else {
          // Button released before 2.0s reached -> cancel (false alarm prevention)
          currentState = STATE_IDLE;
          digitalWrite(PIN_STATUS_LED, LOW);
          noTone(PIN_BUZZER);
          Serial.println(F("✓ Released before 2.0s -> SOS cancelled (False alarm avoided)."));
        }
        break;

      // 3. Waiting for physical button release after trigger
      case STATE_WAIT_RELEASE:
        if (reading == HIGH) { // Button released
          currentState = STATE_IDLE;
          digitalWrite(PIN_STATUS_LED, LOW);
          noTone(PIN_BUZZER);
          Serial.println(F("🛡️ Button released. System rearmed and ready."));
        }
        break;

      default:
        currentState = STATE_IDLE;
        break;
    }
  }

  lastButtonReading = reading;
}
