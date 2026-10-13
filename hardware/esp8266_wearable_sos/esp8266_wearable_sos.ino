/*
  =============================================================================
  RakshaPulse ESP8266 Wearable Emergency SOS Firmware
  =============================================================================
  Target Board: ESP8266 NodeMCU (ESP-12E / ESP-12F) / Wemos D1 Mini
  Primary Trigger: Onboard Inbuilt "FLASH" Push Button (GPIO 0 / Pin D3)
  
  KEY SPECIFICATIONS & BEHAVIOR:
  - Button Trigger: GPIO 0 (Onboard FLASH button, reads LOW when pressed)
  - Press Duration: Must be held continuously for ~2.0 seconds (2000ms)
  - Debounce: 50ms software filter
  - State Machine: IDLE -> PRESSED -> DEBOUNCING -> HELD_2_SEC -> SENDING ->
                   WAIT_FOR_RELEASE -> REARM
  - Transmission: HTTP POST to verified backend endpoint (/api/sos/wearable)
  - Telemetry: Parallel JSON over USB Serial (115200 baud) for browser Web Serial
  - Idempotency: Unique client_event_id retained across network retries
  - Non-blocking: Wi-Fi reconnection runs asynchronously without stalling button checks
  - Offline Queue: Pending SOS event retained safely in memory if Wi-Fi drops
  - Safe Test Mode: TEST_MODE flag switchable (true = test mode / false = live 911 dispatch)
  =============================================================================
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

// =============================================================================
//  CONFIGURATION SECTION
// =============================================================================

// 1. Wi-Fi Credentials (Configure with your local Wi-Fi SSID & Password)
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// 2. Verified Backend SOS Endpoint (Replace with your server IP / domain)
// Local dev default: http://<LAN_IP>:3001/api/sos/wearable
const char* SOS_API_URL = "http://192.168.1.7:3001/api/sos/wearable";

// 3. Device Identification
// If set to "AUTO", will dynamically append ESP.getChipId() -> e.g., "BAND_A1B2C3"
const char* DEVICE_ID = "BAND001";

// 4. Device Authentication Credential (Bearer Token)
const char* DEVICE_API_KEY = "raksha_band_secret_key_2026";

// 5. Safe Mode Selection
// true  = Safe Test Mode (Backend logs test incident, NO real phone calls dispatched)
// false = Production Mode (Dispatches real simultaneous emergency calls)
const bool TEST_MODE = true;

// =============================================================================
//  HARDWARE PIN ASSIGNMENTS
// =============================================================================

// On ESP8266 NodeMCU, the INBUILT FLASH button is hardwired to GPIO 0 (D3 pin)
const int PIN_INBUILT_BUTTON = 0;   // GPIO 0 (FLASH Button, Active LOW)
const int PIN_STATUS_LED     = 2;   // GPIO 2 / D4 (Onboard Blue LED, Active LOW)
const int PIN_OPTIONAL_BUZZER= 14;  // GPIO 14 / D5 (Optional 5V piezo sounder)

// =============================================================================
//  TIMING & THRESHOLD CONSTANTS
// =============================================================================

const unsigned long DEBOUNCE_MS         = 50;     // 50ms debounce threshold
const unsigned long HOLD_TRIGGER_MS     = 2000;   // 2.0 seconds deliberate continuous hold
const unsigned long HTTP_TIMEOUT_MS     = 6000;   // 6.0 seconds HTTP request timeout
const unsigned long WIFI_RETRY_INTERVAL = 10000;  // 10s between non-blocking Wi-Fi reconnect attempts
const unsigned long HEARTBEAT_INTERVAL  = 20000;  // 20s telemetry heartbeat

// =============================================================================
//  BUTTON STATE MACHINE DEFINITION
// =============================================================================

enum ButtonState {
  STATE_IDLE,
  STATE_DEBOUNCING,
  STATE_HELD_CHECK,
  STATE_TRIGGERED,
  STATE_WAIT_FOR_RELEASE
};

ButtonState currentState = STATE_IDLE;

// Timing tracking
unsigned long pressStartTime     = 0;
unsigned long lastDebounceTime   = 0;
bool lastPinReading              = HIGH;
unsigned long lastWiFiRetryTime  = 0;
unsigned long lastHeartbeatTime  = 0;

// Pending Event Store (Retained in RAM if network drops during hold)
struct PendingEvent {
  bool hasPending;
  char eventId[32];
  unsigned long timestamp;
  int retryAttempts;
};

PendingEvent pendingSos = { false, "", 0, 0 };

// Cached effective device identifier
char effectiveDeviceId[32];

// =============================================================================
//  HELPER FUNCTIONS: DEVICE ID & STATUS LED
// =============================================================================

void initializeDeviceId() {
  if (strcmp(DEVICE_ID, "AUTO") == 0 || strlen(DEVICE_ID) == 0) {
    snprintf(effectiveDeviceId, sizeof(effectiveDeviceId), "BAND_%06X", ESP.getChipId());
  } else {
    strncpy(effectiveDeviceId, DEVICE_ID, sizeof(effectiveDeviceId) - 1);
  }
}

void setLed(bool on) {
  // ESP8266 onboard LED is Active LOW
  digitalWrite(PIN_STATUS_LED, on ? LOW : HIGH);
}

void flashLed(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    setLed(true);
    delay(delayMs);
    setLed(false);
    delay(delayMs);
  }
}

// =============================================================================
//  NON-BLOCKING WI-FI MANAGEMENT
// =============================================================================

void checkWiFiConnection() {
  if (strcmp(WIFI_SSID, "YOUR_WIFI_NAME") == 0) {
    // Unconfigured Wi-Fi placeholder - operate in USB Serial mode
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastWiFiRetryTime >= WIFI_RETRY_INTERVAL) {
      lastWiFiRetryTime = now;
      Serial.println(F("[WIFI] Re-associating with Wi-Fi network (non-blocking)..."));
      WiFi.reconnect();
    }
  }
}

// =============================================================================
//  HTTP SOS DISPATCH IMPLEMENTATION
// =============================================================================

bool sendSosHttpRequest(const char* clientEventId, bool isTest) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[HTTP ERR] Cannot send SOS: Wi-Fi is disconnected."));
    return false;
  }

  WiFiClient client;
  HTTPClient http;

  Serial.println(F("--------------------------------------------------"));
  Serial.print(F("[HTTP] Dispatched to: ")); Serial.println(SOS_API_URL);
  Serial.print(F("[HTTP] Client Event ID: ")); Serial.println(clientEventId);
  Serial.print(F("[HTTP] Operating Mode: ")); Serial.println(isTest ? "TEST_MODE" : "LIVE_PRODUCTION");

  if (!http.begin(client, SOS_API_URL)) {
    Serial.println(F("[HTTP ERR] Failed to initialize HTTP client connection."));
    return false;
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_API_KEY);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  // Construct JSON payload compliant with backend contract
  String payload = "{";
  payload += "\"device_id\":\"" + String(effectiveDeviceId) + "\",";
  payload += "\"source\":\"ESP8266_WEARABLE\",";
  payload += "\"event\":\"" + String(isTest ? "TEST_SOS" : "SOS") + "\",";
  payload += "\"client_event_id\":\"" + String(clientEventId) + "\",";
  payload += "\"button\":\"INBUILT_FLASH\",";
  payload += "\"test_mode\":" + String(isTest ? "true" : "false") + ",";
  payload += "\"uptime_ms\":" + String(millis()) + ",";
  payload += "\"vcc_mv\":" + String(ESP.getVcc());
  payload += "}";

  Serial.print(F("[HTTP] Payload: ")); Serial.println(payload);

  int httpCode = http.POST(payload);
  bool isAcknowledged = false;

  if (httpCode > 0) {
    Serial.print(F("[HTTP] Server Response Code: ")); Serial.println(httpCode);
    String responseBody = http.getString();
    Serial.print(F("[HTTP] Response Body: ")); Serial.println(responseBody);

    // Verify positive acknowledgment (200 OK or 201 Created and success flag)
    if ((httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) &&
        (responseBody.indexOf("\"success\":true") >= 0 || responseBody.indexOf("duplicate_ignored") >= 0)) {
      isAcknowledged = true;
      Serial.println(F("✓ [HTTP SUCCESS] Emergency request accepted and acknowledged by backend!"));
    } else {
      Serial.println(F("⚠️ [HTTP WARN] Server returned error or rejected payload."));
    }
  } else {
    Serial.print(F("✗ [HTTP ERR] POST failed, error: "));
    Serial.println(http.errorToString(httpCode).c_str());
  }

  http.end();
  return isAcknowledged;
}

// =============================================================================
//  SOS ACTION TRIGGER (PARALLEL SERIAL + HTTP + OFFLINE QUEUE)
// =============================================================================

void executeSosTrigger() {
  Serial.println(F("\n🚨🚨🚨 ========================================== 🚨🚨🚨"));
  Serial.println(F("🚨 EMERGENCY BUTTON ACTIVATED: INBUILT FLASH HELD FOR 2.0s!"));
  Serial.println(F("🚨🚨🚨 ========================================== 🚨🚨🚨"));

  // Generate unique idempotent Client Event ID based on ChipID and timestamp
  char eventId[32];
  snprintf(eventId, sizeof(eventId), "EVT-%06X-%lu", ESP.getChipId(), millis());

  // 1. Immediately emit JSON packet over USB Serial for browser Web Serial API
  Serial.print(F("{\"event\":\"SOS\",\"deviceId\":\""));
  Serial.print(effectiveDeviceId);
  Serial.print(F("\",\"source\":\"ESP8266_WEARABLE\",\"button\":\"INBUILT_FLASH\",\"clientEventId\":\""));
  Serial.print(eventId);
  Serial.print(F("\",\"testMode\":"));
  Serial.print(TEST_MODE ? "true" : "false");
  Serial.print(F(",\"timestamp\":"));
  Serial.print(millis());
  Serial.println(F("}"));

  // 2. Dispatch HTTP POST over Wi-Fi
  bool delivered = false;
  if (WiFi.status() == WL_CONNECTED) {
    setLed(true); // Solid ON during HTTP dispatch
    delivered = sendSosHttpRequest(eventId, TEST_MODE);
    setLed(false);
  } else {
    Serial.println(F("⚠️ [OFFLINE] Wi-Fi currently disconnected. Retaining pending event in RAM..."));
  }

  // 3. Handle Delivery Status & Offline Retention
  if (delivered) {
    flashLed(4, 80); // 4 quick flashes = success
    pendingSos.hasPending = false;
  } else {
    // Retain pending event safely in memory to retry when connection recovers
    pendingSos.hasPending = true;
    strncpy(pendingSos.eventId, eventId, sizeof(pendingSos.eventId) - 1);
    pendingSos.timestamp = millis();
    pendingSos.retryAttempts = 1;
    Serial.println(F("ℹ️ [QUEUE] Event queued in RAM. Idempotency key preserved for retries."));
  }
}

// =============================================================================
//  PROCESS PENDING RETRIES
// =============================================================================

void processPendingQueue() {
  if (!pendingSos.hasPending) return;

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("[QUEUE] Re-attempting delivery of pending SOS event..."));
    bool delivered = sendSosHttpRequest(pendingSos.eventId, TEST_MODE);
    if (delivered) {
      Serial.println(F("✓ [QUEUE] Pending event successfully delivered and cleared!"));
      pendingSos.hasPending = false;
      flashLed(3, 100);
    } else {
      pendingSos.retryAttempts++;
      Serial.print(F("⚠️ [QUEUE] Retry failed (attempt "));
      Serial.print(pendingSos.retryAttempts);
      Serial.println(F("). Will retry in next interval."));
    }
  }
}

// =============================================================================
//  HEARTBEAT TELEMETRY (EVERY 20 SECONDS)
// =============================================================================

void sendPeriodicHeartbeat() {
  Serial.print(F("{\"event\":\"HEARTBEAT\",\"deviceId\":\""));
  Serial.print(effectiveDeviceId);
  Serial.print(F("\",\"source\":\"ESP8266_WEARABLE\",\"wifi\":"));
  Serial.print(WiFi.status() == WL_CONNECTED ? "true" : "false");
  Serial.print(F(",\"pendingQueue\":"));
  Serial.print(pendingSos.hasPending ? "true" : "false");
  Serial.print(F(",\"testMode\":"));
  Serial.print(TEST_MODE ? "true" : "false");
  Serial.print(F(",\"state\":\""));
  Serial.print(currentState == STATE_IDLE ? "IDLE_ARMED" : "ACTIVE");
  Serial.println(F("\"}"));
}

// =============================================================================
//  SETUP ROUTINE
// =============================================================================

void setup() {
  // Initialize Serial Monitor
  Serial.begin(115200);
  delay(150);

  // Configure Effective Device ID
  initializeDeviceId();

  // Configure Pins
  // Pin GPIO 0 (Inbuilt FLASH Button) with internal pull-up resistor
  pinMode(PIN_INBUILT_BUTTON, INPUT_PULLUP);

  // Status LED (GPIO 2, Active LOW)
  pinMode(PIN_STATUS_LED, OUTPUT);
  setLed(false); // Initially OFF

  pinMode(PIN_OPTIONAL_BUZZER, OUTPUT);
  digitalWrite(PIN_OPTIONAL_BUZZER, LOW);

  // Startup Banner
  Serial.println(F("\n========================================================"));
  Serial.println(F("🛡️ RakshaPulse ESP8266 Wearable SOS Controller v2.0"));
  Serial.print(F("🆔 Device ID:       ")); Serial.println(effectiveDeviceId);
  Serial.print(F("🔘 Inbuilt Button:  GPIO 0 / Pin D3 (Active LOW)")); Serial.println();
  Serial.print(F("⏱️ Required Hold:   2.0 seconds continuous press")); Serial.println();
  Serial.print(F("🔒 Mode:            ")); Serial.println(TEST_MODE ? "TEST_MODE (Safe Testing)" : "PRODUCTION (LIVE CALLS)");
  Serial.print(F("🌐 Backend Target:  ")); Serial.println(SOS_API_URL);
  Serial.println(F("========================================================"));

  // Initialize Wi-Fi
  if (strcmp(WIFI_SSID, "YOUR_WIFI_NAME") != 0) {
    Serial.print(F("[WIFI] Connecting to: ")); Serial.println(WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 8000) {
      delay(250);
      setLed(!digitalRead(PIN_STATUS_LED)); // Blink while connecting
      Serial.print(F("."));
    }

    if (WiFi.status() == WL_CONNECTED) {
      setLed(false);
      Serial.println(F("\n✓ [WIFI] Connected successfully!"));
      Serial.print(F("[WIFI] Local IP Address: ")); Serial.println(WiFi.localIP());
    } else {
      setLed(false);
      Serial.println(F("\n⚠️ [WIFI] Not connected within 8s. Running in non-blocking mode."));
    }
  } else {
    Serial.println(F("ℹ️ Note: WIFI_SSID is set to placeholder. Serial Web Serial mode active."));
  }

  // Double flash indicating system is armed
  flashLed(2, 120);
  Serial.println(F("🛡️ System Armed: Ready to detect 2.0s press on FLASH button.\n"));
}

// =============================================================================
//  MAIN LOOP: RELIABLE STATE MACHINE
// =============================================================================

void loop() {
  unsigned long now = millis();

  // 1. Non-blocking Wi-Fi health check
  checkWiFiConnection();

  // 2. Retry pending event if network just reconnected
  if (pendingSos.hasPending && now - pendingSos.timestamp >= 5000) {
    processPendingQueue();
  }

  // 3. Periodic telemetry heartbeat
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    sendPeriodicHeartbeat();
    lastHeartbeatTime = now;
  }

  // 4. Read Raw Button State (GPIO 0 is LOW when pressed)
  int reading = digitalRead(PIN_INBUILT_BUTTON);

  // State Machine Execution
  switch (currentState) {
    // -------------------------------------------------------------------------
    // STATE 1: IDLE (Waiting for button press)
    // -------------------------------------------------------------------------
    case STATE_IDLE:
      if (reading == LOW) {
        // Potential press detected - start debouncing
        lastDebounceTime = now;
        currentState = STATE_DEBOUNCING;
      }
      break;

    // -------------------------------------------------------------------------
    // STATE 2: DEBOUNCING (Ensuring press is stable >= 50ms)
    // -------------------------------------------------------------------------
    case STATE_DEBOUNCING:
      if (reading == HIGH) {
        // Noise or glitch - return to IDLE
        currentState = STATE_IDLE;
      } else if (now - lastDebounceTime >= DEBOUNCE_MS) {
        // Valid, stable press confirmed!
        pressStartTime = now;
        currentState = STATE_HELD_CHECK;
        Serial.println(F("[BTN] Button press detected. Monitoring for 2.0s hold..."));
      }
      break;

    // -------------------------------------------------------------------------
    // STATE 3: HELD_CHECK (Verifying continuous hold for 2.0s)
    // -------------------------------------------------------------------------
    case STATE_HELD_CHECK:
      if (reading == HIGH) {
        // Released BEFORE 2.0 seconds hold completed
        unsigned long heldDuration = now - pressStartTime;
        Serial.print(F("[BTN] Button released early after "));
        Serial.print(heldDuration);
        Serial.println(F("ms (< 2000ms threshold). SOS cancelled."));
        setLed(false);
        currentState = STATE_IDLE;
      } else {
        unsigned long heldDuration = now - pressStartTime;

        // Visual feedback during hold: Blink faster as hold progresses
        if (heldDuration > 300) {
          int blinkInterval = (heldDuration < 1200) ? 150 : 60;
          setLed(((now / blinkInterval) % 2) == 0);
        }

        // HELD FOR >= 2000ms! Trigger SOS!
        if (heldDuration >= HOLD_TRIGGER_MS) {
          setLed(true); // Solid ON
          executeSosTrigger();
          currentState = STATE_TRIGGERED;
        }
      }
      break;

    // -------------------------------------------------------------------------
    // STATE 4: TRIGGERED (SOS dispatched - wait for release before rearming)
    // -------------------------------------------------------------------------
    case STATE_TRIGGERED:
      // Prevent repeated requests while user continues to hold button
      if (reading == HIGH) {
        lastDebounceTime = now;
        currentState = STATE_WAIT_FOR_RELEASE;
      }
      break;

    // -------------------------------------------------------------------------
    // STATE 5: WAIT_FOR_RELEASE (Debounce release to avoid chatter re-trigger)
    // -------------------------------------------------------------------------
    case STATE_WAIT_FOR_RELEASE:
      if (reading == HIGH && (now - lastDebounceTime >= DEBOUNCE_MS)) {
        setLed(false);
        Serial.println(F("[BTN] Button released. System safely rearmed and ready.\n"));
        currentState = STATE_IDLE;
      }
      break;
  }

  // Handle incoming Serial commands (for USB interactive testing)
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.equalsIgnoreCase("TRIGGER")) {
      Serial.println(F("[CMD] Manual Trigger Override received."));
      executeSosTrigger();
    } else if (cmd.equalsIgnoreCase("STATUS")) {
      sendPeriodicHeartbeat();
    }
  }
}
