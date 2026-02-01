# Whispr Flow - Chromebook

Two apps for your Chromebook:

1. **Whispr Flow** - Receive transcriptions from iPhone
2. **Whispr Chromebook** - Record directly on Chromebook (no iPhone needed)

---

## 🎤 Option 1: Whispr Flow (iPhone → Chromebook)

Use this when you want to record on your iPhone and have text automatically appear on your Chromebook.

### Setup

1. **Enable Linux** on Chromebook:
   ```
   Settings → Advanced → Developers → Linux development environment → ON
   Wait ~10 minutes for installation
   ```

2. **Copy this folder** to the Chromebook (Google Drive, USB, email)

3. **Move to Linux files**:
   - Open Files app
   - Find `chromebook-receiver` folder
   - Right-click → Cut
   - Navigate to **Linux files** → Paste

4. **Run setup** (in Linux terminal):
   ```bash
   cd ~/chromebook-receiver
   bash setup.sh
   ```

5. **Done!** You now have 3 desktop icons:

| Icon | Purpose |
|------|---------|
| 🎤 **Whispr Flow** | Normal use - runs silently in background |
| 🐛 **Whispr Flow (Debug)** | Shows terminal with live logs (for troubleshooting) |
| 📋 **Whispr Flow Logs** | View past logs if something broke |

### Daily Use

1. Double-click 🎤 **Whispr Flow**
2. Open Chrome to `http://localhost:3005` to see IP address
3. On iPhone: Open Safari → `http://[IP]:3005/mobile`
4. Enter Groq API key, start recording
5. Text automatically appears on Chromebook clipboard!

---

## 🎙️ Option 2: Whispr Chromebook (Standalone)

Use this when you **don't have your iPhone**. Records directly on Chromebook.

### Setup

Same steps 1-3 as above (enable Linux, copy folder, move to Linux files)

4. **Run standalone setup** (in Linux terminal):
   ```bash
   cd ~/chromebook-receiver
   bash setup-standalone.sh
   ```

5. **Done!** You have a new desktop icon:

| Icon | Purpose |
|------|---------|
| 🎙️ **Whispr Chromebook** | Record and transcribe directly on Chromebook |

### Daily Use

1. Double-click 🎙️ **Whispr Chromebook**
2. Enter Groq API key (first time only, saved for later)
3. Click **START RECORDING**
4. Speak into Chromebook microphone
5. Click **STOP RECORDING**
6. Text is transcribed and copied to clipboard!

---

## 📁 Files in this Folder

| File | Purpose |
|------|---------|
| `linux-receiver.py` | Receiver server (WebSocket + web UI) |
| `setup.sh` | Setup for receiver mode |
| `view-logs.sh` | Helper to view receiver logs |
| `web-clipboard-receiver.html` | Status page shown in browser |
| `whispr-chromebook.py` | **NEW** Standalone recording app |
| `setup-standalone.sh` | **NEW** Setup for standalone mode |
| `README.md` | This file |

---

## 🐛 Troubleshooting

### Receiver mode (iPhone connection)

**"Cannot connect from iPhone"**
- Check both devices are on same WiFi
- Check IP address on status page (`http://localhost:3005`)
- Try 🐛 Debug mode to see connection messages

**"Clipboard not working"**
```bash
sudo apt install xclip wl-clipboard
```

### Standalone mode (Chromebook recording)

**"No microphone detected"**
```bash
sudo apt install alsa-utils
# Test mic: arecord -l
```

**"No GUI appears"**
- Make sure you're not in a terminal-only session
- Try running with terminal to see errors:
  ```bash
  python3 ~/chromebook-receiver/whispr-chromebook.py
  ```

---

## 📝 Log Locations

```
~/.local/share/whispr-flow/receiver.log       # Receiver logs
~/.config/whispr-flow/config.json             # Standalone app config (API key)
```

Logs rotate automatically (5MB max, 3 backups).

---

## 💡 Which Should I Use?

| Situation | Use |
|-----------|-----|
| Have iPhone, want to walk around while talking | 🎤 **Whispr Flow** (Receiver) |
| Don't have iPhone, at Chromebook | 🎙️ **Whispr Chromebook** (Standalone) |
| iPhone mic is better quality | 🎤 **Whispr Flow** (Receiver) |
| Want simplest setup (one device) | 🎙️ **Whispr Chromebook** (Standalone) |

**You can install both!** They work independently.
