# LocalFlow Deployment Plan: Hosted API + BYOK Architecture

## Changes Summary

| File | Change |
|------|--------|
| `src/app/api/dictation/transcribe/route.ts` | Accepts `apiKey` in request body for BYOK cloud transcription |
| `agent/localflow-agent.py` | Replaced WebSocket with HTTP POST to hosted API; first-run API key prompt |
| `agent/requirements.txt` | Removed `python-socketio`, added `requests` |
| `src/app/setup/page.tsx` | New setup guide with Quick Config Generator |
| `src/app/dashboard/page.tsx` | Added Groq API Key input in Settings dialog |
| `src/app/page.tsx` | Added "Setup" link to navbar |
| `src/lib/utils.ts` | Added `apiKey` to Settings interface |
| `AGENTS.md` | Updated architecture docs |

---

## Step 1: Commit & Push (Triggers Vercel Auto-Deploy)

```bash
cd D:\whispr_flow_clones\opus
git add -A
git commit -m "refactor: hosted API + BYOK architecture

- Transcribe API accepts per-user apiKey from request body
- Agent uses HTTP POST instead of WebSocket
- Agent prompts for Groq API key on first run
- Add /setup page with config generator
- Add API key input to dashboard Settings
- Update AGENTS.md with new architecture docs"
git push origin main
```

Vercel is connected to `jarmen423/whispr_flow_clone_opus` and auto-deploys on push.

---

## Step 2: Verify Vercel Build

Watch the Vercel dashboard (or GitHub commit status) for:

- [ ] Build succeeds — no TypeScript errors
- [ ] New `/setup` route appears in build output
- [ ] Deployed URL loads without runtime errors

Deployed URL: `https://dictate.agentmemorylabs.com`

---

## Step 3: Production API Verification

### 3a. Test BYOK endpoint (user-provided key)

```bash
curl -X POST https://dictate.agentmemorylabs.com/api/dictation/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audio": "base64encoded...",
    "mode": "cloud",
    "apiKey": "gsk_your_test_key_here"
  }'
```

Expected: `200 OK`
```json
{
  "success": true,
  "text": "transcribed text here",
  "wordCount": 3,
  "mode": "cloud",
  "processingTime": 500
}
```

### 3b. Test fallback (server env var, no apiKey provided)

```bash
curl -X POST https://dictate.agentmemorylabs.com/api/dictation/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audio": "base64encoded...", "mode": "cloud"}'
```

Expected: Same success response (uses server's `GROQ_API_KEY` env var as fallback).

### 3c. Test CORS preflight

```bash
curl -X OPTIONS https://dictate.agentmemorylabs.com/api/dictation/transcribe \
  -H "Origin: https://example.com"
```

Expected: `204 No Content` with `Access-Control-Allow-Origin: *`

---

## Step 4: Web UI Verification

Open `https://dictate.agentmemorylabs.com` in a browser and verify:

| Page | Check | Expected |
|------|-------|----------|
| `/` (landing) | Navbar has "Setup" link | Yes, between "Download" and "Agent Memory Labs" |
| `/setup` | All 3 steps render | Install, Get Key, Run |
| `/setup` | Quick Config Generator | Paste key → see JSON config output |
| `/setup` | Hotkey Reference card | Shows all 6 hotkeys |
| `/dashboard` | Settings dialog opens | Click gear icon |
| `/dashboard` | API Key field visible | Password input labeled "Groq API Key" |
| `/dashboard` | API Key persists | Reload page → key still in field |

---

## Step 5: Desktop Agent Verification

The agent is installed by users via git clone. The install scripts pull from GitHub.

### 5a. Existing user update

```bash
cd ~/.localflow/localflow
git pull
source agent/.venv-whispr/bin/activate  # macOS/Linux
# or: agent\.venv-whispr\Scripts\Activate.ps1  # Windows
pip install -r agent/requirements.txt
```

### 5b. Fresh install test (Linux/macOS)

```bash
curl -fsSL https://dictate.agentmemorylabs.com/api/download?script=install-agent.sh | bash
localflow-agent
```

Expected startup log:
```
============================================================
LocalFlow Desktop Agent
============================================================
API: https://dictate.agentmemorylabs.com
Hotkey (raw): alt+l
Hotkey (format): alt+m
Hotkey (translate): alt+t
Hotkey (cleanup): alt+n
Hotkey (selection format): ctrl+shift+j
Mode: developer
Processing: cloud
============================================================
Registering recording hotkeys: [...]
Listening for hotkey: alt+l
Translation toggle: alt+t (currently OFF)
Press the hotkey to start recording, release to stop and transcribe.
Press Ctrl+C to exit.
```

**Critical:** No "Connecting to WebSocket" or connection retry messages.

### 5c. First-run API key prompt test

```bash
# Back up existing config
mv ~/.localflow/config.json ~/.localflow/config.json.bak

# Unset env var
unset GROQ_API_KEY
unset LOCALFLOW_API_KEY

# Run agent
localflow-agent
```

Expected interactive prompt:
```
============================================================
LocalFlow requires a Groq API key for cloud transcription.
Get your free API key at: https://console.groq.com/keys
============================================================

Enter your Groq API key: _
```

Enter a key → agent saves it to `~/.localflow/config.json` and continues.

### 5d. Dictation end-to-end test

1. Focus any text field (e.g., a text editor)
2. Hold `Alt+L` → speak a sentence → release
3. Expected behavior:
   - Overlay appears while holding
   - Overlay hides on release
   - Agent logs: "Audio captured (Normal), sending to API..."
   - Agent logs: "Transcribed: X words, Yms"
   - Text appears at cursor position

### 5e. Format mode test (Alt+M)

1. Hold `Alt+M` → speak "bullet list of three productivity tips" → release
2. Expected: Formatted markdown list pasted at cursor

### 5f. Selected-text formatter test (Alt+J)

1. Highlight some text in any editor
2. Tap `Alt+J`
3. Expected: Text is reformatted as markdown and replaced

---

## Step 6: Verify Install Scripts Still Work

The install scripts (`install-agent.ps1` and `install-agent.sh`) clone from GitHub and install dependencies. They should work unchanged since:
- The repo structure is the same
- `requirements.txt` is updated (removed socketio, added requests)
- The agent entry point is still `localflow-agent.py`

Test by downloading and running each script on their target platforms.

---

## Rollback Plan

If anything breaks in production:

**Option A: Git revert**
```bash
git revert HEAD
git push origin main
```

**Option B: Vercel Instant Rollback**
1. Go to Vercel dashboard → Project → Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"

**Option C: Revert specific file**
```bash
git checkout HEAD~1 -- agent/localflow-agent.py
git checkout HEAD~1 -- src/app/api/dictation/transcribe/route.ts
git commit -m "revert: rollback agent and transcribe API changes"
git push origin main
```

---

## Post-Deploy Checklist

- [ ] Vercel build green
- [ ] `/setup` page loads at `https://dictate.agentmemorylabs.com/setup`
- [ ] BYOK transcribe API works with test key
- [ ] Fallback transcribe works without apiKey (server env var)
- [ ] Dashboard Settings shows API Key field
- [ ] Agent starts without WebSocket connection attempt
- [ ] Agent first-run prompt works
- [ ] Agent dictation (Alt+L) pastes text
- [ ] Agent format mode (Alt+M) works
- [ ] Agent selected-text formatter (Alt+J) works
- [ ] Install scripts still work on fresh machines
