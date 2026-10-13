# RakshaPulse (रक्षा पल्स) — ESP8266 Inbuilt Button Wearable SOS Controller

This module integrates the **ESP8266 (NodeMCU v2/v3, ESP-12E/F, Wemos D1 Mini)** with its **Onboard / Inbuilt Push Button (FLASH Button)** directly into the RakshaPulse Emergency Lifeline Network.

---

## 🔘 Inbuilt Button Operation

**No external push buttons or jumper wires are required!**  
The ESP8266 NodeMCU board comes with an onboard physical momentary push button labeled **`FLASH`**:

```text
 ┌────────────────────────────────────────────────────────┐
 │            ESP8266 NODEMCU / ESP-12E BOARD             │
 │                                                        │
 │   [ INBUILT "FLASH" BUTTON ] ─── Hardwired to GPIO 0   │
 │   [ INBUILT STATUS LED     ] ─── Hardwired to GPIO 2   │
 │   [ ONBOARD WI-FI CHIP     ] ─── 802.11 b/g/n (2.4GHz) │
 │   [ MICRO-USB / TYPE-C     ] ─── USB-Serial (115200)   │
 └──────────────────────────┬─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
   [ Mode 1: Wi-Fi HTTP ]       [ Mode 2: Web Serial ]
   Direct HTTP POST to          Direct USB connection in
   /api/sos/wearable            Chrome/Edge browser (<5ms)
```

- **Inbuilt Button:** Labeled `FLASH` on the board PCB. It is internally tied to **GPIO 0 (Pin D3 on NodeMCU)**.
- **Normal State:** Pulled `HIGH` internally.
- **Pressed State:** Connects GPIO 0 directly to `GND` (`LOW`).
- **Emergency Trigger:** When pressed or held for >1.2 seconds, the firmware detects the press and instantly transmits an SOS alert.
- **Inbuilt LED:** Blue status LED on **GPIO 2 (Pin D4)** blinks while connecting, strobes on button hold, and stays lit during emergency dispatch.

---

## 📋 Pin & Board Mapping

| Component | Board Label | GPIO Number | Function / Behavior |
|---|---|---|---|
| **Inbuilt Button** | `FLASH` (or `USER`) | **GPIO 0** (D3) | Momentary push button (Active LOW when pressed) |
| **Inbuilt LED** | Blue LED | **GPIO 2** (D4) | Hardware status & emergency confirmation |
| **Wi-Fi** | Antenna PCB | Onboard | Transmits HTTP POST to `/api/sos/wearable` |
| **USB Serial** | Micro-USB | TX/RX | Emits JSON telemetry at **115200 baud** |

---

## ⚙️ Arduino IDE Setup & Upload Instructions

1. Open **Arduino IDE** (version 1.8.x or 2.x).
2. Ensure ESP8266 Board Support is installed:
   - Go to **File → Preferences** (or Arduino IDE → Settings).
   - In "Additional Boards Manager URLs", add:  
     `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
   - Go to **Tools → Board → Boards Manager**, search for `esp8266`, and install it.
3. Open the sketch:
   `hardware/esp8266_wearable_sos/esp8266_wearable_sos.ino`
4. In the sketch, optionally update your Wi-Fi credentials:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```
5. In the Arduino IDE menu, configure your board:
   - **Tools → Board → ESP8266 Boards → NodeMCU 1.0 (ESP-12E Module)** (or Generic ESP8266)
   - **Tools → Port → Select the COM port** (e.g., `/dev/cu.usbserial-xxx` on Mac or `COM3` on Windows)
   - **Tools → Upload Speed → 115200**
6. Click **Upload** (Ctrl+U / Cmd+U).
7. Open **Tools → Serial Monitor** at **115200 baud**.
8. Press the **inbuilt `FLASH` button** on the ESP8266 — the board immediately dispatches the SOS distress packet!

---

## 🌐 Connecting Directly in the Web Browser (Web Serial API)

RakshaPulse supports plug-and-play USB connection directly from Chrome / Edge:

1. Plug the **ESP8266** into your computer via USB.
2. Open RakshaPulse in **Google Chrome** or **Microsoft Edge**.
3. Click the **"ESP8266 Band (Inbuilt Button)"** card in the dashboard.
4. Tap **"🔌 Connect via USB"** and select the ESP8266 serial port.
5. **Press the inbuilt FLASH button on the board**:
   - The browser detects the physical button press in real-time.
   - The emergency countdown activates, voice announcement sounds, and 3 simultaneous phone calls are dialed!

---

## 📡 Telemetry Packet Format

The ESP8266 sends structured JSON over USB Serial (115200 baud) and HTTP POST:

```json
{
  "event": "SOS",
  "deviceId": "ESP8266_BAND_01",
  "source": "ESP8266_WEARABLE",
  "button": "INBUILT_FLASH",
  "pressType": "INBUILT_LONG_HOLD",
  "battery": 94,
  "timestamp": 12840
}
```

```json
{
  "event": "TEST_SOS",
  "deviceId": "ESP8266_BAND_01",
  "source": "ESP8266_WEARABLE",
  "button": "INBUILT_FLASH",
  "testMode": true,
  "timestamp": 16900
}
```

---

# RakshaPulse Arduino Nano Wearable SOS Controller (External Button)

Target Sketch: [`hardware/arduino_nano_wearable_sos/arduino_nano_wearable_sos.ino`](file:///Users/kunalgaur/new/hardware/arduino_nano_wearable_sos/arduino_nano_wearable_sos.ino)

### 🔘 Pin & Wiring Connections
- **External Push Button:**
  - One leg connects to **Digital Pin D2** on Arduino Nano.
  - Opposite leg connects to **GND** pin.
  - Configured with internal `INPUT_PULLUP` (no external 10k resistor needed!).
- **Status LED:** Pin **D13** (Onboard Arduino Nano LED).
- **Optional Buzzer:** Pin **D4** (5V active piezo buzzer).

### ⚡ Behavioral Protocol:
1. **Hold Duration:** Must be held for **2.0 seconds** to trigger emergency SOS.
2. **False Trigger Filter:** If released before 2.0 seconds, the countdown aborts immediately.
3. **Dispatch:**
   - Emits structured JSON over USB Serial at **115200 baud**.
   - Triggers **3 Simultaneous Outbound Emergency Voice Calls**.
   - Dispatches **Automatic SMS with Exact GPS Coordinates, Address & Google Maps Pin** to family numbers.
   - Dispatches **Automatic WhatsApp Message with Exact Location Navigation Link** to family numbers.

