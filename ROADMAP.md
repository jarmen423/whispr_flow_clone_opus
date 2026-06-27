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
