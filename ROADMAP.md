# LocalFlow Roadmap

Short-term and medium-term UX improvements for the LocalFlow desktop agent.

## v1.0.2 — Background mode (shipping now)

- [x] Default `localflow-agent` detaches to background instead of blocking the terminal
- [x] On launch, print configured hotkeys + how to change them
- [x] `localflow-agent --stop` to kill a running background agent
- [x] `localflow-agent --foreground` for debugging (shows logs inline)
- [x] Background process logs to `~/.localflow/agent.log`

## v1.1 — System tray + local settings page

- [ ] System tray icon (platform-native or PySide6 / wxPython wrapper)
  - Status indicator (running / listening / error)
  - Right-click menu: Settings, Recovery Console, Quit
- [ ] Local HTTP settings page (`localhost:PORT`)
  - View and edit all hotkeys from a browser
  - Reuses the local-HTML pattern from the recovery console
  - Writes changes back to `~/.localflow/config.json`
  - Tiny stdlib HTTP server or single FastAPI route handles read/write
- [ ] Settings page also accessible via `localflow-agent --settings`

## v1.2 — Auto-start on login

- [ ] Windows: Task Scheduler entry created during install
- [ ] Linux: `~/.config/autostart/localflow-agent.desktop` created during install
- [ ] macOS: `~/Library/LaunchAgents/com.agentmemorylabs.localflow.plist`
- [ ] Install scripts prompt: "Start LocalFlow automatically on login? [Y/n]"

## v1.3 — Polish

- [ ] First-run setup wizard (API key entry, hotkey test, quick tutorial)
- [ ] macOS Accessibility permission detection + guided grant flow
- [ ] Linux Wayland hotkey support (currently X11-focused via pynput)
- [ ] Per-app hotkey profiles (different default modes in different apps)

## v2.0 — VoiceUse merge: Voice agent mode

Merge VoiceUse (computer-use agent) into LocalFlow as a new mode. One install, one process, one set of hotkeys.

- [ ] New **Agent mode** hotkey (Alt+V): same audio capture + Whisper transcription, but output goes to LLM for intent parsing instead of paste
- [ ] Agent mode dispatch branch in recording pipeline (shared capture/transcribe, split output path)
- [ ] Computer-use execution engine ported from VoiceUse repo (screenshot, click, type, navigate)
- [ ] Agent mode uses its own system prompt + model config (separate from dictation modes)
- [ ] Visual feedback overlay shows agent status (thinking, executing, done) instead of waveform
- [ ] Config: per-mode model selection (e.g., dictation uses Groq Whisper, agent uses Claude/GPT/Gemma)
- [ ] Single repo consolidation — VoiceUse code moves into `agent/localflow_agent/agent_mode.py`
- [ ] Marketing: "Free open source dictation AND voice agent. One install."

## v3.0 — Mobile: Android & iOS apps

Native mobile apps that do real device control, not just a remote mic.

- [ ] **Android app** (Kotlin/Compose or Flutter)
  - On-device or cloud Whisper transcription
  - Accessibility Service API for real device control (read screen, inject taps/swipes, fill text fields)
  - Background hotkey / floating button to trigger dictation or agent mode
  - Works system-wide, not just in one app
- [ ] **iOS app** (Swift/SwiftUI)
  - Same feature set as Android where iOS APIs allow
  - Shortcuts app integration for system-wide triggers
  - Voice Control framework for device interaction
  - May need MDM or Accessibility permissions depending on control depth
- [ ] **On-device small model for tool use**
  - Gemma 2B / 3B quantized (GGUF or MLX) running locally on phone
  - Parses voice commands into structured tool calls on-device, no cloud needed
  - Fallback to cloud model (Groq, OpenAI) when local model lacks capability
  - Goal: basic agent actions work fully offline
- [ ] Shared protocol between desktop and mobile agents (same tool-calling format)
- [ ] Companion mode: phone as voice input for desktop agent over local network

## v2.1 — Subagent integration (jarmen423/subagent-tool)

Voice agent can spawn, manage, and communicate with autonomous coding subagents. Say "spawn a coder to fix the auth bug in my repo" and it launches a subagent session, reports progress, and notifies you when done.

- [ ] Register subagent-tool as a tool in the agent's tool registry
  - `spawn_subagent(goal, repo, context)` — launches a new subagent session
  - `check_subagent(session_id)` — returns status + latest output
  - `list_subagents()` — returns all active/recent sessions
  - `stop_subagent(session_id)` — terminates a running session
- [ ] NATS event bus integration for real-time subagent communication
  - Subscribe to subagent progress events (stdout, milestones, completion)
  - Voice agent receives notifications: "Coder finished, here's what it did"
  - User can interrupt mid-session: "Ask the coder to also add tests"
  - Bi-directional: voice agent can send instructions to running subagents
- [ ] TTS notifications for subagent events
  - "Subagent started on repo X"
  - "Subagent hit an error: <summary>"
  - "Subagent completed in 4 minutes. Want me to review the diff?"
- [ ] Safety layer: confirm before spawning subagents that modify repos
- [ ] Config: default subagent profile, allowed repos, max concurrent sessions

## Future considerations

- Browser extension (Chromium/Firefox) for in-browser agent actions
- Voice activation word ("Hey LocalFlow") as alternative to hotkeys
- Multi-language support for agent mode (non-English command parsing)
- Plugin system: third-party tool definitions the agent can call
- Federation: multiple devices running LocalFlow agents that can delegate to each other
