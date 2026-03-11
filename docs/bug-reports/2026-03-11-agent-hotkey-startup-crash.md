# Bug Report: Desktop Agent Startup Crash Blocked `Alt+L`

Date: March 11, 2026

## Summary

The desktop agent failed during startup, so global dictation never began listening for `Alt+L` even though the rest of the app appeared to be running.

## User Impact

- `whispr-flow` looked like it started normally.
- Existing background services on ports `3002` and `3005` could still be running.
- `Alt+L` did nothing because the Python desktop agent crashed before hotkey registration completed.

## Root Cause

The selected-text formatter hotkey parser treated `ctrl+shift+j` as if the terminal key were `shift`.

That produced invalid `pynput` registrations like:

- `<ctrl_l>+<shift_l>+shift`
- `<ctrl_r>+<shift_r>+shift`

`pynput.keyboard.GlobalHotKeys` rejected those combinations with:

```text
ValueError: shift
```

## Fix

- Parse the final key from the third token for `ctrl+shift+<key>` combinations.
- Keep the default selected-text formatter hotkey on `Ctrl+Shift+J`.
- Verify the agent remains running after hotkey registration.

## Validation

- Reproduced the crash locally by launching `agent/localflow-agent.py`.
- Confirmed the original failure at startup with `ValueError: shift`.
- Patched the parser and confirmed the agent stays running under a controlled launch.
- Ran `python -m py_compile agent/localflow-agent.py`.

## Preventive Guidance

- Do not assume a visible web app means the desktop agent is healthy.
- Any hotkey work should include an actual agent startup check.
- Mixed modifier shortcuts need explicit parsing tests, especially `ctrl+shift+<key>`.
