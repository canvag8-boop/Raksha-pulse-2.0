// RakshaPulse ESP8266 Wearable SOS Controller Modal
// Supports Inbuilt FLASH Push Button (GPIO 0 / D3) + Wi-Fi HTTP + Direct Web Serial API

import React, { useState, useRef } from 'react';
import {
  Radio,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Play,
  ShieldAlert,
  Zap,
  Activity,
  Usb,
  Terminal,
  Layers,
  Cpu
} from 'lucide-react';
import { useEmergency } from '../context/EmergencyContext';
import {
  playTactileClick,
  playAlertSentSound,
  playWakeChime
} from '../utils/audio';

export default function WearableStatusModal({ isOpen, onClose }) {
  const { wearableStatus, setWearableStatus, commitEmergencyReport } = useEmergency();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState('');

  // Web Serial API states
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialPortInfo, setSerialPortInfo] = useState('');
  const [serialLogs, setSerialLogs] = useState([
    'Ready. Plug in ESP8266 via USB or connect over Wi-Fi (Endpoint: /api/sos/wearable).'
  ]);
  const serialPortRef = useRef(null);
  const readerRef = useRef(null);
  const readableStreamClosedRef = useRef(null);

  if (!isOpen) return null;

  const appendLog = (msg) => {
    setSerialLogs(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Connect via Web Serial API directly to ESP8266 plugged in via USB
  const handleConnectWebSerial = async () => {
    playTactileClick();
    if (!('serial' in navigator)) {
      appendLog('Web Serial API not supported in this browser. Use Chrome/Edge or Wi-Fi HTTP.');
      return;
    }

    try {
      appendLog('Requesting USB Serial port for ESP8266...');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      serialPortRef.current = port;
      setIsSerialConnected(true);
      setSerialPortInfo('ESP8266 NodeMCU @ 115200 baud');
      appendLog('✓ Connected to ESP8266 on USB Serial (115200 baud)');

      setWearableStatus(prev => ({
        ...prev,
        connected: true,
        deviceId: 'ESP8266_BAND_01',
        lastSeen: Date.now()
      }));

      // Start reading serial stream
      const textDecoder = new TextDecoderStream();
      readableStreamClosedRef.current = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      readSerialLoop(reader);
    } catch (err) {
      appendLog(`Serial connection cancelled or failed: ${err.message}`);
    }
  };

  const readSerialLoop = async (reader) => {
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep last incomplete chunk

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            appendLog(`RX: ${line}`);

            // Parse JSON from ESP8266
            try {
              if (line.startsWith('{') && line.endsWith('}')) {
                const packet = JSON.parse(line);

                if (packet.event === 'SOS') {
                  appendLog('🚨 INBUILT FLASH BUTTON PRESSED on ESP8266! Dispatching SOS...');
                  playWakeChime();
                  commitEmergencyReport({
                    emergencyType: 'Hardware SOS (ESP8266 Inbuilt Button)',
                    description: 'Emergency alert triggered via ESP8266. Wearer pressed onboard inbuilt FLASH button on GPIO 0.',
                    peopleCount: 1,
                    injured: 'Unknown',
                    source: 'ESP8266_WEARABLE',
                    deviceId: packet.deviceId || 'ESP8266_BAND_01'
                  });
                } else if (packet.event === 'TEST_SOS') {
                  appendLog('🧪 Test SOS received from ESP8266 Inbuilt Button');
                  playAlertSentSound();
                } else if (packet.event === 'HEARTBEAT') {
                  setWearableStatus(prev => ({
                    ...prev,
                    connected: true,
                    lastSeen: Date.now()
                  }));
                }
              }
            } catch (jsonErr) {
              // Plain text print from ESP8266
            }
          }
        }
      }
    } catch (err) {
      appendLog(`Serial stream error: ${err.message}`);
    } finally {
      setIsSerialConnected(false);
      appendLog('Serial port disconnected.');
    }
  };

  const handleDisconnectSerial = async () => {
    playTactileClick();
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close();
      }
      serialPortRef.current = null;
      setIsSerialConnected(false);
      appendLog('Disconnected from ESP8266.');
    } catch (err) {
      appendLog(`Disconnect error: ${err.message}`);
    }
  };

  // Simulate hardware trigger via HTTP bridge
  const handleSimulateHardwareSOS = async (isTest = false) => {
    playTactileClick();
    setIsSimulating(true);
    setSimMessage(isTest ? 'Simulating Inbuilt FLASH Test Click...' : 'Simulating Inbuilt FLASH Emergency Press...');

    try {
      const response = await fetch('/api/sos/wearable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer raksha_band_secret_key_2026'
        },
        body: JSON.stringify({
          device_id: wearableStatus.deviceId || 'ESP8266_BAND_01',
          source: 'ESP8266_WEARABLE',
          button: 'INBUILT_FLASH',
          button_pin: 0,
          event: isTest ? 'TEST_SOS' : 'SOS',
          test_mode: isTest
        })
      });

      const data = await response.json();
      if (data.success) {
        setSimMessage(isTest ? '✓ Test acknowledged (GPIO 0)' : '🚨 SOS activated via ESP8266!');
        appendLog(`Simulated ${isTest ? 'Test' : 'Live'} SOS on Inbuilt Button -> Success`);
        if (!isTest) {
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      } else {
        setSimMessage(`Error: ${data.error || 'Request failed'}`);
      }
    } catch (err) {
      setSimMessage(`Network Error: ${err.message}`);
    } finally {
      setTimeout(() => setIsSimulating(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-left overflow-hidden my-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isSerialConnected || wearableStatus.connected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">ESP8266 Wearable SOS Controller</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  isSerialConnected || wearableStatus.connected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                }`}>
                  {isSerialConnected ? 'USB SERIAL CONNECTED' : wearableStatus.connected ? 'ONLINE' : 'STANDBY'}
                </span>
              </div>
              <p className="text-xs text-slate-400">NodeMCU / ESP-12E with Inbuilt FLASH Button on GPIO 0</p>
            </div>
          </div>

          <button
            onClick={() => { playTactileClick(); onClose(); }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Microcontroller
            </span>
            <div className="text-sm font-mono font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>ESP8266 (80/160MHz)</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              SOS Trigger
            </span>
            <div className="text-sm font-bold flex items-center gap-1.5 text-rose-400">
              <Zap className="w-3.5 h-3.5" />
              <span>Inbuilt Button (GPIO 0)</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Network Links
            </span>
            <div className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Wi-Fi + USB Serial</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Button Type
            </span>
            <div className="text-xs font-mono font-bold text-emerald-400">
              Onboard FLASH (No Wiring)
            </div>
          </div>
        </div>

        {/* ESP8266 Onboard Hardware Mapping */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2 mb-4">
          <div className="flex items-center justify-between text-cyan-400 font-bold">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Inbuilt Hardware Architecture</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Zero External Components</span>
          </div>

          <div className="font-mono text-[11px] bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-slate-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-rose-400 font-bold">Inbuilt FLASH Button:</span>
              <span className="text-white">GPIO 0 (Pin D3 on NodeMCU)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Inbuilt Blue Status LED:</span>
              <span className="text-emerald-400">GPIO 2 (Pin D4)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Wi-Fi HTTP Endpoint:</span>
              <span className="text-cyan-400 font-sans text-[10px]">/api/sos/wearable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">USB Baud Rate:</span>
              <span className="text-amber-400">115200 Baud</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            The board uses the <strong>onboard physical FLASH button</strong> already soldered onto the ESP8266 NodeMCU.
            Pressing the button grounds GPIO 0 and immediately broadcasts an encrypted emergency distress beacon.
          </p>
        </div>

        {/* Direct Web Serial USB Connection */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 mb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Usb className="w-4 h-4 text-emerald-400" />
              Direct USB Web Serial Link
            </span>
            {isSerialConnected ? (
              <button
                onClick={handleDisconnectSerial}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnectWebSerial}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>Connect via USB</span>
              </button>
            )}
          </div>

          {/* Mini Serial Terminal */}
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 font-mono text-[10px] text-slate-400 h-20 overflow-y-auto space-y-0.5">
            {serialLogs.map((log, i) => (
              <div key={i} className="truncate">{log}</div>
            ))}
          </div>
        </div>

        {/* Simulation / Testing Buttons */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Hardware Simulation & Override</span>
            {isSimulating && <span className="text-rose-400 animate-pulse">{simMessage}</span>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSimulateHardwareSOS(true)}
              disabled={isSimulating}
              className="py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🧪 Test Mode (Inbuilt Button)</span>
            </button>

            <button
              onClick={() => handleSimulateHardwareSOS(false)}
              disabled={isSimulating}
              className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>🚨 Live Inbuilt Button SOS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
