"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Settings, Wifi, WifiOff, Copy, Check } from "lucide-react";
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push } from 'firebase/database';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IOSInstallPrompt } from "./ios-install-prompt";

// Firebase configuration for cloud relay
// Get these values from your Firebase project settings
const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
};

interface ProcessedResult {
  text: string;
  wordCount: number;
}

export default function MobilePage() {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Settings
  const [apiKey, setApiKey] = useState("");
  const [receiverIp, setReceiverIp] = useState("");
  const [mode, setMode] = useState<"developer" | "concise" | "professional" | "raw">("developer");
  const [showSettings, setShowSettings] = useState(false);
  const [firebaseApiKey, setFirebaseApiKey] = useState("");
  const [firebaseDbUrl, setFirebaseDbUrl] = useState("");
  const [useCloudRelay, setUseCloudRelay] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  
  // Status
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "sending" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastResult, setLastResult] = useState<ProcessedResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved settings
  useEffect(() => {
    const savedKey = localStorage.getItem("localflow-groq-key");
    const savedIp = localStorage.getItem("localflow-receiver-ip");
    const savedMode = localStorage.getItem("localflow-mode") as typeof mode;
    const savedFirebaseKey = localStorage.getItem("localflow-firebase-key");
    const savedFirebaseDbUrl = localStorage.getItem("localflow-firebase-db-url");
    const savedUseCloudRelay = localStorage.getItem("localflow-use-cloud-relay");
    const savedDeviceId = localStorage.getItem("localflow-device-id");
    if (savedKey) setApiKey(savedKey);
    if (savedIp) setReceiverIp(savedIp);
    if (savedMode) setMode(savedMode);
    if (savedFirebaseKey) setFirebaseApiKey(savedFirebaseKey);
    if (savedFirebaseDbUrl) setFirebaseDbUrl(savedFirebaseDbUrl);
    if (savedUseCloudRelay) setUseCloudRelay(savedUseCloudRelay === "true");
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
    } else {
      // Generate a unique device ID
      const newDeviceId = Math.random().toString(36).substring(2, 15);
      setDeviceId(newDeviceId);
      localStorage.setItem("localflow-device-id", newDeviceId);
    }
  }, []);

  // Save settings
  const saveSettings = () => {
    localStorage.setItem("localflow-groq-key", apiKey);
    localStorage.setItem("localflow-receiver-ip", receiverIp);
    localStorage.setItem("localflow-mode", mode);
    localStorage.setItem("localflow-firebase-key", firebaseApiKey);
    localStorage.setItem("localflow-firebase-db-url", firebaseDbUrl);
    localStorage.setItem("localflow-use-cloud-relay", useCloudRelay.toString());
    localStorage.setItem("localflow-device-id", deviceId);
    setShowSettings(false);
    setErrorMessage("");
  };

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);
      }, 100);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!apiKey) {
      setErrorMessage("Please enter your Groq API key in settings");
      setShowSettings(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      
      setIsRecording(true);
      setStatus("recording");
      setErrorMessage("");
      setLastResult(null);

    } catch (error) {
      console.error("[Mobile] Failed to start recording:", error);
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : "Failed to access microphone"
      );
    }
  }, [apiKey]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;

    setIsRecording(false);
    mediaRecorderRef.current.stop();
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const processAudio = async (audioBlob: Blob) => {
    setStatus("processing");

    try {
      // Step 1: Convert to WAV format (Groq prefers WAV)
      const wavBlob = await convertToWav(audioBlob);
      
      // Step 2: Call Groq API directly from browser!
      const formData = new FormData();
      formData.append("file", wavBlob, "audio.wav");
      formData.append("model", "whisper-large-v3");
      formData.append("response_format", "json");

      console.log("[Mobile] Calling Groq API...");
      
      const transcribeResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text();
        throw new Error(`Groq error: ${errorText}`);
      }

      const transcribeData = await transcribeResponse.json();
      const originalText = transcribeData.text;

      console.log("[Mobile] Transcribed:", originalText);

      // Step 3: Refine text (if not raw mode)
      let finalText = originalText;
      
      if (mode !== "raw") {
        setStatus("processing");
        
        const systemPrompts = {
          developer: "You are a dictation correction tool for developers. Clean up grammar, remove filler words, format technical terms correctly. Output ONLY the cleaned text.",
          concise: "Make this text concise. Remove filler words. Output ONLY the result.",
          professional: "Transform this into professional business language. Output ONLY the result.",
        };

        const refineResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompts[mode] },
              { role: "user", content: `Clean up this transcript:\n\n${originalText}` }
            ],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        if (refineResponse.ok) {
          const refineData = await refineResponse.json();
          finalText = refineData.choices?.[0]?.message?.content?.trim() || originalText;
        }
      }

      const wordCount = finalText.split(/\s+/).filter(w => w.length > 0).length;
      
      setLastResult({ text: finalText, wordCount });
      
      // Step 4: Send to Android receiver (if configured)
      if (receiverIp) {
        await sendToReceiver(finalText, wordCount);
      }
      
      setStatus("done");

    } catch (error) {
      console.error("[Mobile] Processing error:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Processing failed");
    }
  };

  const sendToReceiver = async (text: string, wordCount: number) => {
    setStatus("sending");

    // Use Firebase cloud relay if configured
    if (useCloudRelay && firebaseApiKey && firebaseDbUrl) {
      try {
        const firebaseConfig = {
          apiKey: firebaseApiKey,
          databaseURL: firebaseDbUrl,
          projectId: 'whispr-flow',
          authDomain: `${firebaseApiKey?.split(':')[0]}.firebaseapp.com`,
        };

        const app = initializeApp(firebaseConfig, 'whispr-mobile');
        const db = getDatabase(app);

        // Write to a path based on device ID
        const transcriptionRef = ref(db, `transcriptions/${deviceId}`);
        await set(transcriptionRef, {
          text,
          wordCount,
          timestamp: Date.now(),
          deviceId,
        });

        console.log("[Mobile] Sent to Firebase cloud relay");
      } catch (error) {
        console.error("[Mobile] Firebase error:", error);
      }
    }

    // Also try direct WebSocket if receiver IP is configured (local network)
    if (receiverIp) {
      return new Promise<void>((resolve) => {
        try {
          const ws = new WebSocket(`ws://${receiverIp}:3002`);

          ws.onopen = () => {
            console.log("[Mobile] Connected to local receiver");

            ws.send(JSON.stringify({
              event: "paste_text",
              data: {
                text,
                wordCount,
                timestamp: Date.now(),
              }
            }));

            setTimeout(() => {
              ws.close();
              resolve();
            }, 500);
          };

          ws.onerror = (error) => {
            console.error("[Mobile] WebSocket error:", error);
            resolve();
          };

          ws.onclose = () => {
            resolve();
          };

          setTimeout(() => {
            if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
            resolve();
          }, 3000);

        } catch (error) {
          console.error("[Mobile] Failed to send to receiver:", error);
          resolve();
        }
      });
    }

    return Promise.resolve();
  };

  const copyToClipboard = async () => {
    if (!lastResult) return;
    
    try {
      await navigator.clipboard.writeText(lastResult.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Convert WebM to WAV for Groq
  const convertToWav = async (webmBlob: Blob): Promise<Blob> => {
    // For simplicity, we'll send WebM and let Groq handle it
    // Groq supports multiple formats including webm
    return webmBlob;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <IOSInstallPrompt />
      
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            LocalFlow Mic
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            iPhone → Android/Chromebook
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Recording Button */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={toggleRecording}
                disabled={status === "processing" || status === "sending"}
                className={`
                  relative w-32 h-32 rounded-full flex items-center justify-center
                  transition-all duration-300 ease-out
                  ${isRecording 
                    ? "bg-red-500 shadow-red-500/50 shadow-2xl scale-95" 
                    : "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/50 shadow-2xl hover:scale-105 active:scale-95"
                  }
                  ${(status === "processing" || status === "sending") ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {isRecording ? (
                  <div className="w-12 h-12 bg-white rounded-sm" />
                ) : (
                  <Mic className="w-12 h-12 text-white" />
                )}
                
                {isRecording && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                    <span className="absolute -inset-4 rounded-full border-2 border-red-500/30 animate-pulse" />
                  </>
                )}
              </button>

              <div className="text-center">
                {isRecording ? (
                  <div className="space-y-2">
                    <div className="text-3xl font-mono font-bold text-red-500">
                      {formatTime(recordingTime)}
                    </div>
                    <div className="text-sm text-red-500">Recording... Tap to stop</div>
                  </div>
                ) : status === "processing" ? (
                  <div className="text-blue-600">Processing with AI...</div>
                ) : status === "sending" ? (
                  <div className="text-blue-600">Sending to device...</div>
                ) : (
                  <div className="text-slate-500">
                    <p className="font-medium">Tap to record</p>
                    <p className="text-sm">Audio sent directly to Groq</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Result */}
        {lastResult && (
          <Card className="border-0 shadow-md bg-green-50 dark:bg-green-900/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">
                  Result ({lastResult.wordCount} words)
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-8 w-8 p-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-800 dark:text-slate-200">{lastResult.text}</p>
              {receiverIp && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  ✓ Sent to {receiverIp}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Settings */}
        <Card className="border-0 shadow-md">
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={() => setShowSettings(!showSettings)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </CardTitle>
              <span className="text-xs text-slate-400">
                {showSettings ? "▲" : "▼"}
              </span>
            </div>
          </CardHeader>
          
          {showSettings && (
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label htmlFor="api-key">Groq API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="gsk_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-slate-400">
                  Get your key at{" "}
                  <a href="https://console.groq.com/keys" target="_blank" className="underline">
                    console.groq.com
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="use-cloud-relay">Use Cloud Relay (Recommended)</Label>
                  <input
                    id="use-cloud-relay"
                    type="checkbox"
                    checked={useCloudRelay}
                    onChange={(e) => setUseCloudRelay(e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Works from anywhere - no local network needed
                </p>
              </div>

              {useCloudRelay && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firebase-key">Firebase API Key</Label>
                    <Input
                      id="firebase-key"
                      type="password"
                      placeholder="AIza..."
                      value={firebaseApiKey}
                      onChange={(e) => setFirebaseApiKey(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firebase-db-url">Firebase Database URL</Label>
                    <Input
                      id="firebase-db-url"
                      type="text"
                      placeholder="https://your-project.firebaseio.com"
                      value={firebaseDbUrl}
                      onChange={(e) => setFirebaseDbUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="device-id">Device ID (share with Chromebook)</Label>
                    <Input
                      id="device-id"
                      type="text"
                      value={deviceId}
                      readOnly
                      className="bg-slate-100"
                    />
                    <p className="text-xs text-slate-400">
                      Enter this ID in the Chrome extension
                    </p>
                  </div>
                </>
              )}

              {!useCloudRelay && (
                <div className="space-y-2">
                  <Label htmlFor="receiver-ip">Local Receiver IP (optional)</Label>
                  <Input
                    id="receiver-ip"
                    type="text"
                    placeholder="192.168.1.100"
                    value={receiverIp}
                    onChange={(e) => setReceiverIp(e.target.value)}
                  />
                  <p className="text-xs text-slate-400">
                    For local network only - same WiFi required
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mode">Refinement Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="raw">Raw (No AI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={saveSettings} className="w-full">
                Save Settings
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Instructions */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <p>1. Enter your Groq API key above</p>
          <p>2. Enable "Cloud Relay" and enter Firebase credentials</p>
          <p>3. Share your Device ID with Chrome extension</p>
          <p>4. Record audio - text appears on Chromebook automatically!</p>
        </div>
      </div>
    </div>
  );
}
