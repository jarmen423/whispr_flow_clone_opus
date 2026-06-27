# Changelog

All notable changes to LocalFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-06-27

### Added - Auto-Mute System Audio During Dictation

**New Feature:** When the user presses a dictation hotkey, the agent temporarily mutes the system master audio (music, videos, browser tabs, etc.) so the microphone captures a clean voice signal. The previous mute state is automatically restored when recording stops.

**Why**
- Background audio bleeds into the mic and degrades Whisper transcription accuracy, especially with music, YouTube, or system notifications playing
- Muting the system master is global, so it works regardless of which app is playing audio
- The previous mute state is preserved — if the user already had audio muted, it stays muted; if it was unmuted, it returns to unmuted

**Implementation**
- Windows-only via pycaw (Python bindings for the Core Audio API)
- Gracefully degrades on macOS/Linux or if pycaw is unavailable: logs a warning, dictation continues normally without the mute behavior
- A `SystemAudioController` saves the current mute state on `_start_recording()`, calls `SetMute(1)`, and restores on `_stop_recording()`
- New dependency: `pycaw>=20240210` (added to `pyproject.toml` and `agent/requirements.txt`)

**Files Changed**
- `agent/localflow_agent/audio_control.py` - New module: `SystemAudioController` class
- `agent/localflow_agent/__init__.py` - Imported and instantiated the controller; added mute/restore calls in the recording lifecycle
- `pyproject.toml` - Added `pycaw>=20240210` dependency
- `agent/requirements.txt` - Added `pycaw>=20240210`

---

### Added - Voice Agent Mode (Alt+A) with Web Search

**New Feature:** Hold `Alt+A`, speak a question, release — answer is pasted at the cursor. Searches the web automatically when the question requires current information.

**How It Works**
- `llama-3.3-70b-versatile` (Groq) receives the transcribed question with a `web_search` tool available
- Model decides autonomously whether to search or answer directly
- If searching: Brave Search API returns top 5 results → model grounds its answer in them
- Answer is pasted at the cursor via the normal paste pipeline

**Configuration**
```bash
BRAVE_API_KEY=your_key_here
LOCALFLOW_AGENT_HOTKEY=alt+a          # optional, this is the default
# AGENT_LLM_MODEL=llama-3.3-70b-versatile  # optional override
```

**Files Changed**
- `src/app/api/agent/query/route.ts` - New route: Groq tool-call loop + Brave Search execution
- `mini-services/websocket-service/index.ts` - Added `"agent"` to mode union, routes to `/api/agent/query` instead of `/api/dictation/refine`
- `agent/localflow-agent.py` - Added `agent_hotkey` config, `agent_mode_active` flag, `Alt+A` registration, mode routing in `_stop_recording`
- `.env` - Added `BRAVE_API_KEY`, `LOCALFLOW_AGENT_HOTKEY` documentation

**TODO**: Investigate Cerebras tool calling support (cookbook: https://inference-docs.cerebras.ai/cookbook/agents/build-your-own-perplexity). If Qwen 3 235B supports the full OpenAI tool spec, migrate agent to Cerebras for ~10x faster generation.

---

### Added - Cerebras Backup Key Auto-Rotation

**New Feature:** Three Cerebras API keys with automatic failover on 401/402/429.

**How It Works**
- `CEREBRAS_API_KEY`, `CEREBRAS_API_KEY_2`, `CEREBRAS_API_KEY_3` are all read at startup
- On retryable error (quota hit, invalid key, rate limit), the next key is tried immediately
- Non-retryable errors (400 bad request, 500 server error) fail fast without retrying

**Files Changed**
- `src/app/api/dictation/refine/route.ts` - Replaced single `CEREBRAS_API_KEY` const with `CEREBRAS_API_KEYS` array; rewrote `refineCerebrasWithPrompt` with retry loop
- `.env` - Added `CEREBRAS_API_KEY_2`, `CEREBRAS_API_KEY_3`

---

### Fixed - Cerebras Model and Parameter Compatibility

**Issues Fixed**
- `gpt-oss-120b` is not available on the free tier — changed `CEREBRAS_MODEL` to `qwen-3-235b-a22b-instruct-2507`
- `reasoning_effort` parameter is only supported by `gpt-oss-120b` — removed from all Cerebras API calls (causes 400 on Qwen)

**Files Changed**
- `.env` - Updated `CEREBRAS_MODEL`
- `src/app/api/dictation/refine/route.ts` - Removed `reasoning_effort` from request body

---

### Fixed - Selection Copy Reliability (Clipboard Sentinel)

**Issue:** Alt+J and Alt+N were sending stale clipboard content to the API when focus was wrong or Alt was still held when Ctrl+C fired.

**Root Cause**
- The GlobalHotKeys callback fires while Alt is still physically held
- If Ctrl+C fires too quickly, the OS sees Ctrl+Alt+C — which most apps don't treat as copy
- The old clipboard content was then silently shipped to the API, producing wrong output

**Solution**
- Write a sentinel value (`__WHISPR_COPY_SENTINEL__`) to clipboard before Ctrl+C
- After 200ms, read clipboard — if unchanged, the copy failed
- On failure: restore original clipboard, log warning, return empty string (shows "No selection" overlay)

**Files Changed**
- `agent/localflow-agent.py` - Rewrote `copy_selection()` with sentinel detection

---

### Added - whispr-flow-debug Command

**New Development Tool:** `whispr-flow-debug` runs all services in the current terminal with color-coded prefixed logs — useful for debugging agent behavior.

**Features**
- Kills any processes holding ports 3002 and 3005 before starting
- Runs Next.js, WebSocket service, and Python agent under `concurrently` with color-coded `[nextjs]`, `[websocket]`, `[agent]` prefixes
- Uses `-u` flag for Python (unbuffered stdout) so agent logs appear in real time
- Uses `.cmd` wrappers (`next.cmd`, `sucrase-node.cmd`) for Windows compatibility without bun

**Usage**
```powershell
whispr-flow-debug   # from anywhere in PowerShell
```

**Files Changed**
- `whispr-flow-debug.ps1` - New script
- PowerShell profile - Added `whispr-flow-debug` function

---

### Changed - Formatter Hotkeys And Selected-Text Cleanup

**What Changed**
- Switched the selected-text formatter default back to `Alt+J`
- Added a dedicated selected-text cleanup hotkey on `Alt+N` for punctuation, spelling, and grammar repair passes
- Kept `Alt+M` as the outline/formatting dictation hotkey

**Why**
- `Ctrl+Shift+J` collides with browser developer tools in common workflows
- Raw dictation and translation can leave behind artifacts such as literal punctuation words like `slash`
- Cleanup is distinct from both outline dictation and selected-text markdown formatting, so it now has its own selected-text hotkey

**Implementation Details**
- The desktop agent now refreshes `formatHotkey`, `translateHotkey`, and `cleanupHotkey` from live `settings_update` events
- Selected-text formatter hotkeys are normalized against all reserved recording shortcuts before registration
- Added a cleanup pass for selected text focused on punctuation/control words, spelling repair, and grammar cleanup
- Fixed the mock listener cleanup path used by startup verification

**Result**
- `Alt+L` remains raw dictation
- `Alt+M` remains outline/list formatting dictation
- `Alt+J` formats highlighted text without using the microphone
- `Alt+N` cleans up highlighted text without using the microphone

**Files Changed**
- `agent/localflow-agent.py` - Added selected-text cleanup hotkey support, live hotkey refresh handling, conflict-aware selection hotkey normalization, and startup cleanup fix
- `src/app/api/dictation/refine/route.ts` - Added selected-text cleanup target and prompt
- `src/lib/utils.ts` - Added cleanup hotkey settings and changed the selected-text formatter default back to `alt+j`
- `src/app/page.tsx` - Added cleanup hotkey controls and selected-text cleanup UI copy
- `src/hooks/use-websocket.ts` - Extended settings sync types with `cleanupHotkey`
- `mini-services/websocket-service/index.ts` - Extended settings payload types with `cleanupHotkey`
- `AGENTS.md` - Updated repo hotkey guidance and regression notes

### Fixed - Desktop Agent Startup Crash From Formatter Hotkey Parsing

**Issue:** The selected-text formatter hotkey parser misread `Ctrl+Shift+J` and registered `shift` as the terminal key. That caused the desktop agent to crash during startup with `ValueError: shift`, which made `Alt+L` appear broken because the hotkey listener never came up.

**Solution**
- Corrected `ctrl+shift+<key>` parsing in the desktop agent so the terminal key is read from the third token
- Verified the agent now stays running after hotkey registration

**Files Changed**
- `agent/localflow-agent.py` - Fixed selected-text formatter hotkey parsing during listener setup
- `docs/bug-reports/2026-03-11-agent-hotkey-startup-crash.md` - Added regression write-up and validation notes
- `AGENTS.md` - Added repo guidance for hotkey parsing and startup verification

### Added - Selected-Text Formatter

**New Feature:** Format highlighted text without recording audio.

**How It Works**
- Highlight existing text in any app
- Press `Alt+J` to format the selection without using the microphone
- The agent copies the selection, sends it to the formatting API, and pastes the formatted result back
- The formatted result stays on the clipboard after completion

**Supported Output Targets**
- `Markdown` (default)
- `JSON`
- `JSONL`
- `CSV`

**Key Features**
- **Separate Hotkey Path**: Selected-text formatting now uses its own hotkey and does not share the dictation recording flow
- **Cerebras Formatting Backend**: Formatting requests use a dedicated `text_format` API operation
- **Selection-Aware Workflow**: The desktop agent captures highlighted text via clipboard copy, formats it, and pastes the result back
- **Settings Support**: The web UI now exposes selected-text formatter enablement, hotkey selection, and default output target
- **Chooser Command Path**: A separate command path exists for manual format selection via `whispr-flow -formatSelection`

**Files Changed**
- `agent/localflow-agent.py` - Added selected-text formatting flow, separate hotkey handling, and format chooser command path
- `src/app/api/dictation/refine/route.ts` - Added `text_format` operation and per-target prompts for Markdown, JSON, JSONL, and CSV
- `src/app/page.tsx` - Added selected-text formatter settings UI
- `src/lib/utils.ts` - Added selected-text formatter settings and migration from old Alt-based hotkeys
- `src/hooks/use-websocket.ts` - Extended settings sync for selected-text formatter options
- `mini-services/websocket-service/index.ts` - Extended settings payload for selected-text formatter options
- `whispr-flow.ps1` - Added `-formatSelection`, `-chooseFormat`, and `-formatTarget` options

### Added - Formatter Status Overlay

**New Feature:** Visual status feedback for selected-text formatting requests.

**What Users See**
- Request acknowledgment when the formatting hotkey is pressed
- A processing state while the formatting request is in flight
- Success, no-selection, disabled, and failure states after completion

**Implementation Details**
- Extended the existing overlay to support both animated recording mode and text-only transient status mode
- Hid the overlay before paste operations to avoid interfering with focus during replacement

**Files Changed**
- `agent/recording_overlay.py` - Added status overlay mode and transient message rendering
- `agent/localflow-agent.py` - Added formatter request/progress/success/error overlay states

### Fixed - Selected-Text Formatter Hotkey Collision

**Issue:** The original selected-text formatter hotkey lived in the Alt keyspace, which conflicted with the dictation hotkeys and could hijack normal `Alt+L` / `Alt+M` behavior.

**Solution**
- Moved the selected-text formatter default hotkey to `Ctrl+Shift+J`
- Reserved Alt-based combinations for recording and translation workflows only
- Added a migration so older saved `Alt+J` / `Alt+K` settings are automatically upgraded

**Result**
- `Alt+L` remains raw dictation
- `Alt+M` remains microphone + markdown formatting
- `Ctrl+Shift+J` formats highlighted text without microphone access

**Files Changed**
- `agent/localflow-agent.py` - Normalized selection formatter hotkeys and registered separate Ctrl/Shift combinations
- `src/lib/utils.ts` - Migrated legacy Alt-based selection formatter hotkeys
- `src/app/page.tsx` - Updated formatter hotkey options in settings

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
