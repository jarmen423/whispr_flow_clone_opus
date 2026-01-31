# LocalFlow Remote - Android App

Remote microphone app for LocalFlow voice dictation system.

## Features

- Record audio on Android and send to LocalFlow desktop for processing
- Hold-to-record button for easy dictation
- Automatic connection to desktop over WiFi/LAN
- Real-time status indicators

## Requirements

- Android 8.0+ (API 26+)
- LocalFlow desktop running on the same network
- Microphone permission

## Setup

1. Build the app in Android Studio or using Gradle:
   ```bash
   ./gradlew assembleDebug
   ```

2. Install on your Android device

3. Find your desktop's IP address (e.g., `192.168.1.100`)

4. Enter the IP in the app and tap "Connect"

5. Hold the record button to speak, release to send

6. Text appears at your desktop cursor!

## Audio Format

The app records in WAV format compatible with Whisper.cpp:
- Sample Rate: 16000 Hz
- Channels: Mono (1)
- Bit Depth: 16-bit PCM

## Project Structure

```
app/src/main/java/com/localflow/remote/
├── MainActivity.kt      # Main UI and coordinator
├── AudioRecorder.kt     # 16kHz WAV recording
└── LocalFlowClient.kt   # Socket.IO client for /mobile namespace
```

## Architecture

```
Android (record) → Socket.IO (/mobile) → WebSocket Service → Next.js API → STT → Python Agent → Clipboard
```
