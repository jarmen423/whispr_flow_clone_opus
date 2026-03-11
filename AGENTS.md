# Repo Notes

## Hotkey Rules

- Keep dictation hotkeys in the `Alt+<letter>` space only.
- Keep selected-text formatter hotkeys out of the Alt keyspace to avoid collisions with recording and translation shortcuts.
- For combo parsing, treat `ctrl+shift+j` style shortcuts as three tokens. The terminal key is the third token, not the second.

## Startup Verification

- If a hotkey change touches `agent/localflow-agent.py`, verify the agent starts cleanly before assuming the feature works.
- A startup crash in the desktop agent means `whispr-flow` can look "started" while `Alt+L` does nothing, because the web services may still be running in the background.
- Check for a log line like `Registering recording hotkeys:` and confirm the process stays alive after registration.

## Regression Note

- On March 11, 2026, the selected-text formatter feature regressed startup by registering `ctrl+shift+shift` instead of `ctrl+shift+j`, which caused `pynput` to raise `ValueError: shift` and prevented the desktop agent from listening for `Alt+L`.
