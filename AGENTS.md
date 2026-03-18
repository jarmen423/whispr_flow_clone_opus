# Repo Notes

## Hotkey Rules

- Keep dictation hotkeys in the `Alt+<letter>` space only.
- Current defaults are `Alt+L` raw dictation, `Alt+M` outline formatting dictation, `Alt+N` cleanup dictation, `Alt+T` translation toggle, and `Alt+J` selected-text formatting.
- The selected-text formatter may use `Alt+J`, but it must never reuse a letter already assigned to recording or translation shortcuts.
- For combo parsing, treat `ctrl+shift+j` style shortcuts as three tokens. The terminal key is the third token, not the second.

## Startup Verification

- If a hotkey change touches `agent/localflow-agent.py`, verify the agent starts cleanly before assuming the feature works.
- A startup crash in the desktop agent means `whispr-flow` can look "started" while `Alt+L` does nothing, because the web services may still be running in the background.
- Check for a log line like `Registering recording hotkeys:` and confirm the process stays alive after registration.

## Regression Note

- On March 11, 2026, the selected-text formatter feature regressed startup by registering `ctrl+shift+shift` instead of `ctrl+shift+j`, which caused `pynput` to raise `ValueError: shift` and prevented the desktop agent from listening for `Alt+L`.
- On March 18, 2026, the desktop agent also needed a runtime settings fix so `Alt+M`, `Alt+N`, and `Alt+T` updates actually refreshed the live hotkey listener state.
