"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Settings,
  Copy,
  Check,
  Clock,
  Zap,
  HardDrive,
  Wifi,
  WifiOff,
  Download,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  cn,
  formatDuration,
  formatRelativeTime,
  countWords,
  blobToBase64,
  loadSettings,
  saveSettings,
  loadHistory,
  saveHistory,
  generateId,
  type Settings as AppSettings,
  type DictationItem,
  defaultSettings,
} from "@/lib/utils";

export default function LocalFlowPage() {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [originalText, setOriginalText] = useState("");
  const [refinedText, setRefinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [history, setHistory] = useState<DictationItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);

  // WebSocket
  const { status, liveActivities, sendSettings } = useWebSocket();

  // Load settings and history on mount
  useEffect(() => {
    setSettings(loadSettings());
    setHistory(loadHistory());
  }, []);

  // Keyboard shortcut: Alt+T to toggle translation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+T toggles translation mode
      if (e.altKey && e.key === "t") {
        e.preventDefault();
        const newTranslate = !settings.translate;
        updateSettings({ translate: newTranslate });
        toast.info(newTranslate ? "Translation mode enabled" : "Translation mode disabled");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.translate]);

  // Update audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && isRecording) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analyzer for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start audio level visualization
      updateAudioLevel();

      if (settings.soundEnabled) {
        // Play start sound
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.1;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 100);
      }

      toast.success("Recording started");
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to access microphone");
    }
  };

  // Stop recording and process
  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        // Clean up
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        setIsRecording(false);
        setAudioLevel(0);

        // Process audio
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processRecording(audioBlob);
        resolve();
      };

      mediaRecorderRef.current!.stop();
    });
  };

  // Process recording
  const processRecording = async (audioBlob: Blob) => {
    if (audioBlob.size === 0) {
      toast.error("No audio recorded");
      return;
    }

    setIsProcessing(true);
    const startTime = Date.now();

    try {
      // Convert to base64
      const audioBase64 = await blobToBase64(audioBlob);

      // Step 1: Transcribe
      const transcribeResponse = await fetch("/api/dictation/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: audioBase64,
          mode: settings.processingMode,
          translate: settings.translate,
        }),
      });

      const transcribeData = await transcribeResponse.json();

      if (!transcribeResponse.ok || !transcribeData.success) {
        throw new Error(transcribeData.error || "Transcription failed");
      }

      setOriginalText(transcribeData.text);

      // Step 2: Refine (skip for raw mode)
      let finalText = transcribeData.text;

      if (settings.refinementMode !== "raw") {
        const refineResponse = await fetch("/api/dictation/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: transcribeData.text,
            mode: settings.refinementMode,
            processingMode: settings.processingMode,
            translated: settings.translate,
          }),
        });

        const refineData = await refineResponse.json();

        if (!refineResponse.ok || !refineData.success) {
          throw new Error(refineData.error || "Refinement failed");
        }

        finalText = refineData.refinedText;
      }

      setRefinedText(finalText);

      // Auto-copy to clipboard
      if (settings.autoCopy) {
        await navigator.clipboard.writeText(finalText);
        toast.success("Text copied to clipboard");
      }

      // Add to history
      const newItem: DictationItem = {
        id: generateId(),
        originalText: transcribeData.text,
        refinedText: finalText,
        timestamp: Date.now(),
        duration: recordingTime,
        mode: settings.refinementMode,
        processingMode: settings.processingMode,
      };

      const updatedHistory = [...history, newItem];
      setHistory(updatedHistory);
      saveHistory(updatedHistory);

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
      toast.success(`Processed in ${processingTime}s`);

      if (settings.soundEnabled) {
        // Play success sound
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 1320;
        gainNode.gain.value = 0.1;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 150);
      }
    } catch (error) {
      console.error("Processing error:", error);
      toast.error(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Update settings
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
    sendSettings({
      hotkey: updated.hotkey,
      translateHotkey: updated.translateHotkey,
      mode: updated.refinementMode,
      processingMode: updated.processingMode,
      translate: updated.translate,
    });
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
    toast.success("History cleared");
  };

  // Select history item
  const selectHistoryItem = (item: DictationItem) => {
    setOriginalText(item.originalText);
    setRefinedText(item.refinedText);
    setShowHistory(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">LocalFlow</h1>
              <p className="text-sm text-muted-foreground">Smart Dictation System</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 text-sm">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  status.connected ? "status-online" : "status-offline"
                )}
              />
              <span className="text-muted-foreground">
                {status.connected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {/* Agent Status */}
            <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 text-sm">
              {status.agentOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">
                {status.agentOnline ? "Agent Online" : "Agent Offline"}
              </span>
            </div>

            {/* Translation Mode Indicator */}
            {settings.translate && (
              <div className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-sm border border-blue-500/20">
                <span className="text-blue-600 dark:text-blue-400 font-medium">🌐 Translate</span>
              </div>
            )}

            {/* Settings */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Settings</DialogTitle>
                  <DialogDescription>
                    Configure your dictation preferences
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Processing Mode */}
                  <div className="space-y-2">
                    <Label>Processing Mode</Label>
                    <Select
                      value={settings.processingMode}
                      onValueChange={(value: "cloud" | "local") =>
                        updateSettings({ processingMode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cloud">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            <span>Cloud (Fast)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="local">
                          <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4" />
                            <span>Local (Free)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {settings.processingMode === "cloud"
                        ? "Fast processing with usage-based pricing"
                        : "Free offline processing on your machine"}
                    </p>
                  </div>

                  {/* Refinement Mode */}
                  <div className="space-y-2">
                    <Label>Refinement Mode</Label>
                    <Select
                      value={settings.refinementMode}
                      onValueChange={(value: "developer" | "concise" | "professional" | "raw") =>
                        updateSettings({ refinementMode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="concise">Concise</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="raw">Raw (No Refinement)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Hotkey */}
                  <div className="space-y-2">
                    <Label>Hotkey</Label>
                    <Select
                      value={settings.hotkey}
                      onValueChange={(value) => updateSettings({ hotkey: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alt+v">Alt + V</SelectItem>
                        <SelectItem value="ctrl+shift+v">Ctrl + Shift + V</SelectItem>
                        <SelectItem value="cmd+shift+v">Cmd + Shift + V</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Global hotkey for desktop agent
                    </p>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-copy to clipboard</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically copy refined text
                        </p>
                      </div>
                      <Switch
                        checked={settings.autoCopy}
                        onCheckedChange={(checked) =>
                          updateSettings({ autoCopy: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Sound effects</Label>
                        <p className="text-xs text-muted-foreground">
                          Play sounds for recording events
                        </p>
                      </div>
                      <Switch
                        checked={settings.soundEnabled}
                        onCheckedChange={(checked) =>
                          updateSettings({ soundEnabled: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="flex items-center gap-2">
                          Translate to English
                          <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Alt+T</kbd>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Translate non-English speech to English (Whisper large-v3)
                        </p>
                      </div>
                      <Switch
                        checked={settings.translate}
                        onCheckedChange={(checked) =>
                          updateSettings({ translate: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* History */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <History className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>History</span>
                    {history.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    Your recent dictations
                  </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-2 py-4">
                  {history.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No dictations yet
                    </p>
                  ) : (
                    [...history].reverse().map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectHistoryItem(item)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">
                            {item.mode}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">
                          {item.refinedText}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Processing Mode Indicator */}
        <Alert variant={settings.processingMode === "cloud" ? "default" : "success"}>
          {settings.processingMode === "cloud" ? (
            <Zap className="h-4 w-4" />
          ) : (
            <HardDrive className="h-4 w-4" />
          )}
          <AlertTitle>
            {settings.processingMode === "cloud" ? "Cloud Mode" : "Local Mode"}
          </AlertTitle>
          <AlertDescription>
            {settings.processingMode === "cloud"
              ? "Using cloud processing for fast, accurate transcription"
              : "Processing locally - completely free and private"}
          </AlertDescription>
        </Alert>

        {/* Recording Card */}
        <Card className="overflow-hidden">
          <CardHeader className="text-center">
            <CardTitle>Voice Dictation</CardTitle>
            <CardDescription>
              {isRecording
                ? "Recording... Click to stop"
                : isProcessing
                ? "Processing your audio..."
                : "Click the microphone to start recording"}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-6">
            {/* Recording Button */}
            <motion.button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={cn(
                "relative flex h-32 w-32 items-center justify-center rounded-full transition-all",
                isRecording
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
              whileTap={{ scale: 0.95 }}
            >
              {/* Pulse animation */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 rounded-full bg-destructive animate-pulse-ring"
                  />
                )}
              </AnimatePresence>

              {/* Icon */}
              {isRecording ? (
                <MicOff className="h-12 w-12 relative z-10" />
              ) : (
                <Mic className="h-12 w-12 relative z-10" />
              )}
            </motion.button>

            {/* Audio Level Visualization */}
            {isRecording && (
              <div className="flex items-end justify-center gap-1 h-12">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-primary rounded-full audio-bar"
                    style={{
                      height: `${Math.max(20, Math.min(100, audioLevel * 100 + Math.random() * 20))}%`,
                    }}
                    animate={{
                      height: `${Math.max(20, Math.min(100, audioLevel * 100 + Math.random() * 20))}%`,
                    }}
                    transition={{ duration: 0.1 }}
                  />
                ))}
              </div>
            )}

            {/* Recording Timer */}
            {(isRecording || recordingTime > 0) && (
              <div className="flex items-center gap-2 text-lg font-mono">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatDuration(recordingTime)}</span>
              </div>
            )}

            {/* Processing Spinner */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <motion.div
                  className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <span>Processing with {settings.processingMode} mode...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <AnimatePresence>
          {(originalText || refinedText) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4 md:grid-cols-2"
            >
              {/* Original Text */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Original Transcription
                  </CardTitle>
                  <CardDescription>
                    {countWords(originalText)} words
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={originalText}
                    readOnly
                    className="min-h-[120px] bg-muted/30"
                  />
                </CardContent>
              </Card>

              {/* Refined Text */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        Refined Text
                      </CardTitle>
                      <CardDescription>
                        {countWords(refinedText)} words
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(refinedText)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 mr-1 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={refinedText}
                    onChange={(e) => setRefinedText(e.target.value)}
                    className="min-h-[120px]"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Activities from Agent */}
        {liveActivities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Live Activity</CardTitle>
              <CardDescription>
                Recent dictations from desktop agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[...liveActivities].reverse().slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                    {activity.wordCount && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {activity.wordCount} words
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download Agent */}
        {!status.agentOnline && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Download className="h-8 w-8 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Desktop Agent</h3>
              <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                Install the desktop agent to use global hotkey dictation in any application
              </p>
              <Button variant="outline" asChild>
                <a href="/agent/localflow-agent.py" download>
                  Download Agent
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground pt-8">
          <p>Press <kbd className="px-1.5 py-0.5 rounded bg-muted">{settings.hotkey}</kbd> to dictate anywhere</p>
        </footer>
      </div>
    </div>
  );
}
