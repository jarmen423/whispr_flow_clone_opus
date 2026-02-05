# Post-Mortem: Hotkey Release Detection Regression

**Date:** February 4, 2026  
**Incident Duration:** ~25 minutes active debugging  
**Severity:** High (Core functionality broken)  
**Author:** Autopilot debugging session with user

---

## Incident Summary

The desktop agent's push-to-talk hotkey (Alt+L) stopped responding to key releases, causing recordings to continue indefinitely. The visual overlay would remain visible and audio capture would never stop until the process was killed.

---

## Timeline

| Time | Event |
|------|-------|
| Pre-77118fd | Working push-to-talk with minor UX issue: letter keys sometimes leaked to terminal |
| Commit `77118fd` | Attempted fix for key suppression - **introduced regression** |
| Commit `d3f4b7a` | Added translation mode (Alt+T) on top of broken code |
| 2026-02-04 20:52 | User reports bug: hotkey never releases |
| 2026-02-04 21:08 | Confirmed: "Recording started" logged but never "Recording stopped" |
| 2026-02-04 21:09 | Identified that even committed HEAD was broken |
| 2026-02-04 21:10 | Reverted to `77118fd~1` - functionality restored |

---

## Relevant Commits

### `77118fd` - fix(agent): implement keyboard event suppression
**This commit introduced the regression.**

Changed from pynput's GlobalHotKeys to manual `pressed_keys` set tracking:
```python
# On press:
self.pressed_keys.add(key)

# On release:
self.pressed_keys.discard(key)  # ❌ FAILS - different Key object!
```

### `d3f4b7a` - Add translation mode (Alt+T)
Added translation feature on top of already-broken hotkey code. This commit is fine; the bug was inherited from `77118fd`.

### `77118fd~1` (unnamed parent commit)
The last known working state. Uses GlobalHotKeys for detection with VK-code-based release checking directly on the key object.

---

## Root Cause Analysis

### The Bug
pynput generates **different Key/KeyCode objects** for press versus release events of the same physical key. While they represent the same key, they are distinct Python objects with potentially different memory addresses and attribute values.

### Why the Fix Failed

The fix in `77118fd` tracked pressed keys using Python object identity:

```python
def on_press(key):
    self.pressed_keys.add(key)  # Adds press Key object
    
def on_release(key):
    self.pressed_keys.discard(key)  # Release Key object ≠ press Key object!
```

When `on_release` was called:
1. `self.pressed_keys.discard(key)` silently did nothing (key not in set)
2. The check `is_alt_pressed()` still returned True (stale set)
3. The release condition was never satisfied
4. Recording never stopped

### The Working Code Pattern

The pre-77118fd code checked the released key's attributes directly:

```python
def on_release(key):
    # Check the released key itself - not a set lookup
    is_alt_key = key in ALT_KEYS  # Works - Key enum comparison
    
    # Check VK code directly on this key object
    if hasattr(key, "vk") and key.vk is not None:
        char_from_vk = chr(key.vk).lower()
        is_hotkey_char = char_from_vk in ('l', 'm')
```

This works because it examines the **current release event's key** rather than trying to match it against stored press events.

---

## Impact Assessment

### What Broke
- ❌ Push-to-talk completely non-functional
- ❌ Agent unusable for dictation
- ❌ Recording overlay stuck on screen

### What Was Preserved
- ✅ Server-side transcription logic
- ✅ Web UI functionality
- ✅ WebSocket communication
- ✅ Audio processing pipeline

### What Was Lost in Rollback
- ❌ Agent-side translation toggle (Alt+T hotkey)
- ❌ Agent sending `translate` parameter to server
- ✅ Server-side translation support intact (UI toggle still works)

---

## Resolution

Reverted `agent/localflow-agent.py` to the commit before 77118fd:

```bash
git show 77118fd~1:agent/localflow-agent.py > agent/localflow-agent.py
```

This restored the working hotkey detection while accepting the minor UX issue of letter key leakage in terminals.

---

## Lessons Learned

1. **pynput Key object identity is unreliable across events**
   - Always use VK codes (integers) for cross-event tracking
   - Never rely on `set.add(key)` / `set.discard(key)` patterns

2. **Push-to-talk testing must cover the release path**
   - Press detection working ≠ full functionality
   - Test the complete press → hold → release cycle

3. **Separate concerns in commits**
   - Hotkey suppression fix should have been isolated
   - Translation feature commit would have been unaffected by rollback

4. **Terminal key leakage is low-priority**
   - The original "bug" was cosmetic in limited contexts
   - Breaking core functionality to fix it was not worth the risk

---

## Follow-Up Actions

- [ ] Re-implement translation mode in agent (see `TRANSLATION_REIMPLEMENT_SPEC.md`)
- [ ] Research Windows low-level keyboard hooks for proper key suppression
- [ ] Add integration tests for hotkey release detection
- [ ] Document the terminal key leakage as known behavior

---

## References

- Commit `77118fd`: https://github.com/jarmen423/whispr_flow_clone_opus/commit/77118fd
- Commit `d3f4b7a`: https://github.com/jarmen423/whispr_flow_clone_opus/commit/d3f4b7a
- pynput documentation: https://pynput.readthedocs.io/
- Related spec: `agent/TRANSLATION_REIMPLEMENT_SPEC.md`
