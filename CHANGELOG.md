# Changelog

All notable changes to LocalFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Translation Mode (🌐 Speak Any Language → English)

**New Feature:** Real-time translation of non-English speech to English with translation-ese correction.

**How It Works**
- Press `Alt+T` to toggle translation mode (or use UI toggle)
- Speak in any language (Spanish, French, German, etc.)
- Whisper translates to English
- Refinement LLM fixes "translation-ese" (awkward grammar from raw translation)

**Translation Pipeline**
```
Spanish Speech → Whisper Translation → Raw English → LLM Refinement → Natural English
```

**Key Features**
- **Alt+T Hotkey**: Toggle translation mode on both web UI and desktop agent
- **Visual Indicator**: Blue "🌐 Translate" badge in web UI header when active
- **Translation-Aware Prompts**: LLM receives special instructions to fix common translation issues:
  - "The car red" → "The red car"
  - "I have hunger" → "I'm hungry"
- **Groq API Integration**: Uses dedicated `/v1/audio/translations` endpoint (requires whisper-large-v3)
- **Full Stack Support**: Works in Cloud, Networked-Local, and Local modes

**Files Changed**
- `src/app/page.tsx` - Translation toggle UI, Alt+T hotkey, visual indicator
- `src/app/api/dictation/transcribe/route.ts` - Translation endpoint support, Groq /translations API
- `src/app/api/dictation/refine/route.ts` - Translation-aware prompts with translation-ese correction
- `src/lib/utils.ts` - Added `translate` and `translateHotkey` to Settings interface
- `src/hooks/use-websocket.ts` - Updated SettingsUpdate interface
- `mini-services/websocket-service/index.ts` - Pass `translate` and `translated` flags
- `agent/localflow-agent.py` - Alt+T hotkey, toggle_translation() method, visual overlay

### Fixed - Keyboard Event Suppression in Terminal Applications

**Issue:** Hotkey presses leak through to terminal apps (PowerShell, Windows Terminal), causing repeated characters like 'm' or 'l'

**Root Cause**
- pynput's `GlobalHotKeys` class only **detects** hotkeys - it never suppresses the underlying key events
- Terminal emulators have different input handling that makes this more visible
- The previous dual-listener approach (GlobalHotKeys + Listener) allowed key events to leak through

**Solution**
- Replaced `GlobalHotKeys` with a single `keyboard.Listener` using manual key state tracking
- Suppress hotkey events by returning `False` from `on_press` and `on_release` callbacks
- Suppress both key press AND release events for hotkey-related keys
- Maintain suppression only during the hotkey window (while Alt+letter is held)

**Key Implementation Details**
- Manual tracking of pressed keys via `self.pressed_keys` set
- Check for Alt keys via `key in {Key.alt_l, Key.alt_r, Key.alt_gr, Key.alt}`
- Detect hotkey character by both `key.char` and virtual key code (`key.vk`) fallback
- Suppress events during paste operations to prevent interference
- Reset state on recording stop to handle "rollover" key releases

**Files Changed**
- `agent/localflow-agent.py` - Rewrote `_setup_hotkey_listener()` with event suppression

## [1.2.1] - 2026-01-29

### Fixed - Recording Overlay Threading Error

**Issue:** `RuntimeError: main thread is not in main loop`

The recording overlay animation was causing intermittent crashes due to Tkinter threading violations.

**Root Cause**
- Tkinter canvas operations (`canvas.delete()`) were being called from a background animation thread
- Tkinter's mainloop was running on a different thread, causing race conditions
- When `hide()` was called, it could race with the animation thread

**Solution**
- Refactored `_animate()` to use Tkinter's thread-safe `root.after()` scheduling instead of a separate thread with `time.sleep()`
- Added safety checks and `TclError` exception handling in `_draw_frame()`
- Updated `hide()` to schedule window destruction on the Tkinter thread via `root.after(0, _destroy)`

**Files Changed**
- `agent/recording_overlay.py` - Rewrote animation system for thread-safety

### Fixed - Paste Handler Blocking Error

**Issue:** `AttributeError: 'float' object has no attribute 'time'`

After transcription, pasting would fail and block the system from accepting new recordings.

**Root Cause**
- Line 248 had `self.last_paste_time = now.time()`
- `now` is already a `float` result from `time.time()`
- Calling `.time()` on a float raises `AttributeError`

**Solution**
- Changed `self.last_paste_time = now.time()` to `self.last_paste_time = now`

**Files Changed**
- `agent/localflow-agent.py` - Fixed line 248

## [1.2.0] - 2026-01-28

### Fixed - Agent Hotkey Detection

**Improved Global Hotkey Detection**
- Switched from manual VK code detection to pynput's `GlobalHotKeys` class
- Added support for all Alt key variants:
  - Left Alt (`<alt_l>`)
  - Right Alt (`<alt_r>`)
  - AltGr (`<alt_gr>`)
- Changed default hotkey from `Alt+Z` to `Alt+L` (letter keys work more reliably)

**Why These Changes Were Needed**
- Previous implementation using manual VK code detection wasn't capturing Alt key presses reliably on Windows
- Symbol keys like `/` and `?` share physical keys and have dual functions, making them problematic for hotkeys
- `GlobalHotKeys` class automatically handles detection and key suppression for letter keys
- Letter keys don't have shift variants and work much better for hotkey combinations

**Fixed Issues**
- ✅ Alt key now properly detected in all combinations
- ✅ Hotkey release detection now works reliably
- ✅ Letter keys are automatically suppressed (won't type while Alt is held)
- ✅ Recording starts and stops correctly on hotkey press/release

**Technical Details**
- Replaced manual `Listener` with `on_press`/`on_release` callbacks
- Now uses `GlobalHotKeys` with three registered combinations:
  - `<alt_l>+l`
  - `<alt_r>+l`
  - `<alt_gr>+l`
- Separate `Listener` still tracks key releases for stopping recording
- Added `_on_hotkey_press()` method as callback for `GlobalHotKeys`

**Files Changed**
- `agent/localflow-agent.py` - Rewrote `_setup_hotkey_listener()` method
- `agent/requirements.txt` - Added `python-dotenv` dependency

### Changed - LLM Refinement

**Switched to Ollama Chat API**
- Changed from Ollama `generate` endpoint to `chat/completions` endpoint
- Updated system prompts for better text refinement
- Added developer, concise, professional, and raw modes

**Benefits**
- Better compatibility with Ollama 1.5+ models
- More reliable responses from smaller models
- Improved text formatting and punctuation

### Changed - WebSocket Transport

**Fixed WebSocket Connection Issues**
- Added explicit `transports=['polling', 'websocket']` to Socket.IO connection
- Added `websocket-client` Python dependency for proper WebSocket transport support
- Fixed connection issues between Python agent and Node.js server

### Changed - Port Configuration

**Updated Default Ports**
- WebSocket service: `3001` → `3002`
- Next.js app: `3000` → `3005`
- Updated all documentation and environment variable defaults

### Added - Visual Recording Overlay

**RecordingOverlay Component**
- Added visual feedback when recording is active
- Shows overlay window while recording
- Automatically hides when recording stops

## [1.1.0] - 2026-01-27

### Added - Three-Tier Processing Mode

**Cloud Mode (New)**
- Fast processing via Z.AI API
- Requires `ZAI_API_KEY` environment variable
- Uses `glm-asr-2512` for speech-to-text
- Uses `glm-4.7-flash` for text refinement

**Networked Local Mode (Default)**
- Free processing using remote Whisper.cpp and Ollama servers
- Configure `WHISPER_API_URL` for remote Whisper server
- Configure `OLLAMA_URL` for remote Ollama server
- Recommended for home network setups

**Local Mode**
- Everything runs on the same machine
- Requires local Whisper.cpp binary and models
- Requires local Ollama installation

### Added - Z.AI Cloud API Integration

**Speech-to-Text**
- GLM-ASR-2512 model via Z.AI API
- 60-second timeout
- Automatic fallback to local modes if API key not set

**Text Refinement**
- GLM-4.7-Flash model for fast processing
- Configurable via `ZAI_LLM_MODEL` environment variable

### Fixed - Whisper.cpp Server Instructions

- Corrected build instructions using CMake
- Fixed binary path in documentation
- Updated model download URLs

## [1.0.0] - 2026-01-26

### Initial Release

**Core Features**
- Global hotkey dictation (default: Alt+Z)
- Real-time audio recording
- WebSocket communication between agent and server
- Speech-to-text via Whisper.cpp
- Text refinement via Ollama
- Multiple refinement modes (developer, concise, professional, raw)
- Web UI for configuration and monitoring
- Clipboard integration with automatic paste

**Architecture**
- Python desktop agent with global hotkey listener
- Next.js 16 web application
- Socket.IO WebSocket service
- Modular API routes for transcription and refinement

**Supported Platforms**
- Windows 10/11
- macOS 12+
- Linux (tested on Ubuntu 22.04)

---

## Upgrade Notes

### Upgrading from 1.1.0 to 1.2.0

**Hotkey Changes**
If you customized `LOCALFLOW_HOTKEY` in your `.env`, you may need to update it:
- Symbol keys (like `/`, `?`, `-`) are no longer recommended
- Use letter keys instead: `alt+l`, `alt+v`, `alt+d`, etc.
- All Alt variants (left, right, AltGr) are now supported

**Required Actions**
1. Pull latest changes: `git pull origin main`
2. Reinstall Python dependencies: `pip install -r agent/requirements.txt`
3. Update `.env` if using symbol keys in hotkey
4. Restart the agent: `python agent/localflow-agent.py`

### Upgrading from 1.0.0 to 1.1.0

**New Processing Modes**
- Update `.env` to select processing mode: `PROCESSING_MODE=cloud|networked-local|local`
- Configure appropriate URLs for your chosen mode
- Cloud mode requires `ZAI_API_KEY`

**Port Changes**
- Update `WS_PORT` from `3001` to `3002` in `.env`
- Update `PORT` from `3000` to `3005` in `.env`

---

## Configuration Reference

### Environment Variables

**Hotkey Configuration**
```bash
# Default hotkey (use letter keys)
LOCALFLOW_HOTKEY=alt+l
```

**Processing Mode Selection**
```bash
# Choose processing mode
PROCESSING_MODE=networked-local  # cloud, networked-local, local
```

**Cloud Mode (Z.AI API)**
```bash
ZAI_API_KEY=your_api_key_here
ZAI_API_BASE_URL=https://api.z.ai/api/paas/v4
ZAI_ASR_MODEL=glm-asr-2512
ZAI_LLM_MODEL=glm-4.7-flash
```

**Networked Local Mode**
```bash
WHISPER_API_URL=http://192.168.1.100:8080
OLLAMA_URL=http://192.168.1.100:11434
OLLAMA_MODEL=qwen2:1.5b
OLLAMA_TEMPERATURE=0.1
```

**Local Mode**
```bash
WHISPER_PATH=/usr/local/bin/whisper
WHISPER_MODEL_PATH=./models/ggml-small-q5_1.bin
WHISPER_THREADS=8
```

---

## Troubleshooting

### Hotkey Not Working

**Symptoms**
- Pressing hotkey does nothing
- Recording doesn't start
- Keys type instead of triggering recording

**Solutions**
1. Check agent is running: `python agent/localflow-agent.py`
2. Verify hotkey uses letter key, not symbol: `LOCALFLOW_HOTKEY=alt+l`
3. Check agent logs for: `[INFO] Registering hotkeys: ['<alt_l>+l', ...]`
4. Try different Alt variants (left Alt, right Alt, AltGr)
5. On Windows, run agent as Administrator

### Transcription Failed

**Symptoms**
- `[ERROR] Dictation failed: Transcription failed`
- Recording works but no text appears

**Solutions**
1. Check Whisper server is running: `curl http://your-server:port/health`
2. Verify `WHISPER_API_URL` is correct in `.env`
3. Check network connectivity to Whisper server
4. Test server manually: `curl -X POST -F "file=@audio.wav" http://server:port/inference`
5. Check agent logs for detailed error messages

### WebSocket Connection Issues

**Symptoms**
- `[ERROR] Failed to connect: ...`
- Agent can't reach server

**Solutions**
1. Start WebSocket service: `bun run dev:ws` or `bun run start:ws`
2. Check `LOCALFLOW_WS_URL` matches `WS_PORT` in `.env`
3. Verify ports are not in use: `netstat -an | grep 3002`
4. Check firewall settings
5. Ensure both services are on same network (for networked-local mode)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
