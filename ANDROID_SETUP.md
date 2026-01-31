# LocalFlow Android Remote Microphone - Setup Guide

This guide explains how to set up and use the Android remote microphone feature for LocalFlow, allowing you to use your Android phone as a wireless microphone for voice dictation on your desktop.

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Android App    │      │  WebSocket       │      │  Next.js + APIs  │
│  (Remote Mic)   │──────▶│  Service         │──────▶│  (Transcribe/    │
│                 │      │  (Port 3002)     │      │   Refine)        │
└─────────────────┘      └──────────────────┘      └────────┬─────────┘
       Socket.IO                  │                         │
       (/mobile ns)               │                         │ STT Engine
                                  │                         │ (Groq/ZAI/Whisper)
                                  │                         ▼
                                  │                ┌──────────────────┐
                                  │                │  AI Processing   │
                                  │                └────────┬─────────┘
                                  │                         │
                                  │                         │ Refined Text
                                  │                         ▼
                                  │      ┌──────────────────┐
                                  └─────▶│  Python Agent    │
                                         │  (Desktop)       │
                                         └────────┬─────────┘
                                                  │ Clipboard + Paste
                                                  ▼
                                         ┌──────────────────┐
                                         │  Active Window   │
                                         │  (Your Document) │
                                         └──────────────────┘
```

## Prerequisites

### Desktop Requirements
- LocalFlow already set up and running on your computer
- Python desktop agent configured and working
- Both desktop and Android device on the **same WiFi network**

### Android Requirements
- Android 8.0+ (API 26 or higher)
- Microphone permission
- Local network access (WiFi)

## Step 1: Find Your Desktop IP Address

You need your computer's local IP address for the Android app to connect.

### Windows
```powershell
ipconfig
# Look for "IPv4 Address" under your WiFi adapter
# Example: 192.168.1.100
```

### macOS
```bash
ifconfig | grep "inet "
# Look for your WiFi interface (usually en0)
# Example: 192.168.1.100
```

### Linux
```bash
ip addr show
# or
hostname -I
```

**Note:** Write down this IP address. It typically looks like `192.168.1.xxx` or `10.0.0.xxx`.

## Step 2: Build the Android App

### Option A: Build with Android Studio (Recommended)

1. Open Android Studio
2. Select "Open an Existing Project"
3. Navigate to the `android/` folder in this repository
4. Wait for Gradle sync to complete
5. Connect your Android device via USB (enable Developer Options > USB Debugging)
6. Click the "Run" button (green play icon)
7. Select your device

### Option B: Build with Command Line

Requirements:
- Android SDK installed
- `ANDROID_HOME` environment variable set

```bash
cd android

# Build debug APK
./gradlew assembleDebug

# Or install directly to connected device
./gradlew installDebug
```

The APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Option C: Build Release APK

```bash
cd android
./gradlew assembleRelease
```

For a signed release build, configure signing in `app/build.gradle.kts`:
```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("mykey.keystore")
            storePassword = "password"
            keyAlias = "alias"
            keyPassword = "password"
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

## Step 3: Start LocalFlow on Desktop

Make sure LocalFlow is running normally:

```bash
# In the main repository (not the worktree)
./scripts/start-all.ps1

# Or manually:
bun run dev:all
```

Verify the Python agent is connected:
- You should see: "Connected to WebSocket server" in the agent console
- WebSocket service should show at least one agent connected

## Step 4: Configure and Connect Android App

1. **Open the LocalFlow Remote app** on your Android device

2. **Enter your desktop IP address**:
   - Tap the "Desktop IP" field
   - Enter the IP from Step 1 (e.g., `192.168.1.100`)
   - This is saved for future use

3. **Tap "Connect"**:
   - Status indicator turns **yellow** while connecting
   - Turns **green** when connected
   - If it fails, check:
     - Desktop IP is correct
     - Both devices on same WiFi
     - LocalFlow is running on desktop

## Step 5: Using the Remote Microphone

### Recording
1. **Hold** the large circular "Hold to Record" button
2. **Speak** clearly into your phone's microphone
3. **Release** the button when done

### What Happens
1. Audio is recorded (16kHz mono WAV)
2. Sent to desktop over WiFi
3. Transcribed by your configured STT engine
4. Refined by LLM (if not in "raw" mode)
5. **Text appears at your desktop cursor!**

### Status Indicators

| Indicator | Color | Meaning |
|-----------|-------|---------|
| Connection | Red | Disconnected |
| Connection | Yellow | Connecting... |
| Connection | Green | Connected and ready |
| Record Button | Green | Ready to record |
| Record Button | Red | Recording in progress |

## Troubleshooting

### "No desktop agents connected" Error

This means the Android app connected to the WebSocket service, but the Python agent isn't running or connected.

**Solution:**
1. Check Python agent is running
2. Check agent shows "Connected to WebSocket server"
3. Restart the Python agent if needed

### Connection Timeout

**Symptoms:** Status stays yellow, then turns red.

**Solutions:**
1. Verify desktop IP is correct
2. Check both devices are on the same WiFi network
3. Disable Windows Firewall or add exception for port 3002
4. Check if `WS_PORT` environment variable was changed from default 3002

### Audio Not Processing

**Symptoms:** Recording sends but no text appears on desktop.

**Solutions:**
1. Check Python agent console for errors
2. Verify STT service is working (test with desktop hotkey first)
3. Check WebSocket service console for processing errors

### Poor Audio Quality

**Tips:**
- Hold phone closer to your mouth
- Reduce background noise
- Speak clearly and at normal pace
- Check phone's microphone isn't obstructed by case

### Android App Crashes

**Check:**
- Microphone permission is granted (Settings > Apps > LocalFlow Remote > Permissions)
- Android 8.0+ (API 26)
- Sufficient storage space

## Network Requirements

### Ports Used
| Port | Service | Direction |
|------|---------|-----------|
| 3002 | WebSocket Service | Android → Desktop |
| 3005 | Next.js API | WebSocket Service → Desktop |

### Firewall Configuration

If using Windows Firewall, allow:
- Bun/Node.js through private networks
- Port 3002 inbound (private networks only)

```powershell
# PowerShell (Administrator)
New-NetFirewallRule -DisplayName "LocalFlow WebSocket" -Direction Inbound -LocalPort 3002 -Protocol TCP -Action Allow -Profile Private
```

## Advanced Configuration

### Environment Variables

The Android app currently uses these defaults:
- **Mode:** `developer` (grammar correction)
- **Processing:** `networked-local` (uses your configured STT)

To customize, modify `MainActivity.kt` or add a settings screen:
```kotlin
localFlowClient.connect(serverIp, mode = "concise", processingMode = "cloud")
```

### Audio Format Details

The app records in exact format Whisper.cpp expects:
- **Sample Rate:** 16000 Hz (16kHz)
- **Channels:** Mono (1 channel)
- **Bit Depth:** 16-bit PCM
- **Format:** WAV (RIFF header)
- **Encoding:** Base64 for transmission

No transcoding needed on desktop - audio goes straight to STT engine.

## Security Considerations

⚠️ **Important:** This feature is designed for **trusted local networks only**.

- No authentication on `/mobile` namespace (by design for simplicity)
- Anyone on your WiFi can connect and send audio
- Audio is transmitted unencrypted over local network
- If this concerns you, restrict to trusted networks or add firewall rules

## Development

### Project Structure
```
android/
├── app/src/main/java/com/localflow/remote/
│   ├── MainActivity.kt      # UI and coordination
│   ├── AudioRecorder.kt     # WAV recording (16kHz mono)
│   └── LocalFlowClient.kt   # Socket.IO client
├── app/src/main/res/
│   ├── layout/              # UI layouts
│   ├── values/              # Strings and colors
│   └── drawable/            # Icons and shapes
└── build.gradle.kts         # Dependencies
```

### Key Dependencies
```kotlin
// Socket.IO client for real-time communication
implementation("io.socket:socket.io-client:2.1.0")

// Coroutines for async operations
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

// Material3 UI components
implementation("com.google.android.material:material:1.11.0")
```

### Debugging

Enable Socket.IO debug logging:
```kotlin
// In LocalFlowClient.kt setupSocketHandlers()
Log.d(TAG, "Socket event: connect")
```

View Android logs:
```bash
adb logcat -s LocalFlowClient:D AudioRecorder:D MainActivity:D
```

## Known Limitations

1. **Single desktop agent:** If multiple Python agents are connected, all will receive and paste the result
2. **No auto-discovery:** Must manually enter desktop IP address
3. **No encryption:** Audio transmitted as base64 over HTTP (local network only)
4. **Portrait only:** UI optimized for portrait orientation
5. **No background recording:** App must be in foreground to record

## Future Enhancements

Potential improvements:
- mDNS/Bonjour auto-discovery of desktop
- Settings screen for mode selection
- Multiple agent handling (active window detection)
- TLS/SSL support for encrypted audio
- Quick Settings tile for one-tap recording
- Wear OS support for smartwatches

## Getting Help

If you encounter issues:
1. Check this guide's Troubleshooting section
2. Review the Python agent console output
3. Check WebSocket service logs
4. Use `adb logcat` to view Android logs
5. File an issue with logs from both sides

## Summary

With the Android remote microphone, you can:
- ✅ Use your phone as a wireless microphone
- ✅ Dictate from anywhere in WiFi range
- ✅ Get transcription pasted directly to your desktop cursor
- ✅ Use the same refinement modes as desktop
- ✅ Keep existing desktop hotkey workflow intact

The setup requires:
1. Desktop IP address
2. Same WiFi network
3. LocalFlow running on desktop
4. Android 8.0+ device

Enjoy wireless dictation!
