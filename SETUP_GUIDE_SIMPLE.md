# LocalFlow - Simple Windows Setup Guide

## What is LocalFlow?

LocalFlow is a system that **converts your voice to written text** automatically. You speak, and the program types what you said into any application (Word, Excel, AutoCAD, etc.). It's like having an assistant that helps you write quickly using your voice.

---

## ⚡ Quick Automated Setup (Recommended)

> **Note:** There's an automated installation script that handles most of this for you!

### Step 0: Download LocalFlow

**Option A: Download ZIP (Easiest)**

1. Go to: https://github.com/jarmen423/whispr_flow_clone_opus (or wherever this repo is)
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Extract the ZIP to a folder (e.g., `C:\LocalFlow` or `C:\Users\YourName\LocalFlow`)
5. Remember this location!

**Option B: Clone with Git (If you have Git installed)**

```powershell
# Clone to your desired location
cd C:\Users\YourName
git clone https://github.com/jarmen423/whispr_flow_clone_opus.git LocalFlow
cd LocalFlow
```

### Step 1: One-Click Install (Easiest)

1. Open **PowerShell** (search for it in Windows menu)
2. Navigate to **where you downloaded/extracted** LocalFlow:

```powershell
# Example - adjust to YOUR path:
cd C:\Users\YourName\LocalFlow

# Or if you extracted to your Desktop:
cd C:\Users\YourName\Desktop\LocalFlow

# Or wherever you put it:
cd "C:\Your\Actual\Path\To\LocalFlow"
```

3. Run the installer:

```powershell
.\scripts\install-cli.ps1
```

This installs the `localflow` command to your system.

4. **Restart PowerShell**, then simply run from **anywhere**:

```powershell
localflow
```

Done! LocalFlow will start automatically. Use `Alt+L` to dictate anywhere.

To stop:
```powershell
localflow -stop
```

---

## 🔑 Step 2: Configure API Keys

The installer above will **automatically prompt you for API keys!**

If you skipped them during install, or need to update them later:
```powershell
cd C:\Your\Actual\Path\To\LocalFlow
.\scripts\setup-api-keys.ps1
```

### What Keys You'll Need:

| Key | Purpose | Required? | Get It Free |
|-----|---------|-----------|-------------|
| **Groq** | Speech-to-text | ✅ Yes | [console.groq.com/keys](https://console.groq.com/keys) |
| **Cerebras** | Smart formatting (Alt+M) | ⭕ Optional | [cloud.cerebras.ai](https://cloud.cerebras.ai/) |

## 🎮 What to Expect & How to Use

After running `localflow`, you'll see output like this:

```
============================================================
LocalFlow Desktop Agent
============================================================
Hotkey (raw): alt+l
Hotkey (format): alt+m
Hotkey (translate): alt+t
Mode: developer
Processing: cloud
============================================================
Listening for hotkey: alt+l
Translation toggle: alt+t (currently OFF)
Press the hotkey to start recording, release to stop and transcribe.
Press Ctrl+C to exit.
```

### Default Hotkeys:

| Hotkey | Function |
|--------|----------|
| **Alt+L** | **Raw mode** - Hold to record,release to transcribe. No formatting, fastest speed. |
| **Alt+M** | **Format mode** - Hold to record, release to transcribe with smart formatting (lists, bullets, etc.) |
| **Alt+T** | **Toggle translation** - Press once to turn on/off translation mode (speak any language → English output) |

### How to Use:

1. **Open any application** (Word, Excel, Notepad, PowerShell, etc.)
2. **Click where you want text to appear**
3. **Hold Alt+L** (keep both keys pressed)
4. **Speak** while holding the keys
5. **Release** when done speaking
6. Text automatically appears!

### Want Different Hotkeys?

If you want to customize the hotkeys (e.g., use Alt+V instead of Alt+L):

1. Open PowerShell and navigate to your LocalFlow folder:
```powershell
cd C:\Your\Actual\Path\To\LocalFlow
```

2. Create/edit the `.env` file:
```powershell
# If .env doesn't exist, copy the example:
copy .env.example .env

# Edit with Notepad:
notepad .env
```

3. Add or modify these lines:
```bash
# Customize your hotkeys (use letter keys, not symbols):
LOCALFLOW_HOTKEY=alt+v          # Change raw mode hotkey
LOCALFLOW_FORMAT_HOTKEY=alt+f   # Change format mode hotkey
LOCALFLOW_TRANSLATE_HOTKEY=alt+t # Change translation toggle
```

4. Save and restart LocalFlow:
```powershell
localflow -stop
localflow
```

**Note:** Use **letter keys** (a-z) for best reliability. Symbol keys like `/`, `?`, `-` can be unreliable on Windows.



---

## 🛠️ Manual Setup (If Automated Install Fails)

If the automated script doesn't work, follow these steps:

### Step 1: Install Required Programs

#### A) Install Node.js Runtime

**If you have Bun and it works:**
```powershell
# Install Bun (fast JavaScript runtime)
powershell -c "irm bun.sh/install.ps1|iex"

# Verify
bun --version
```

**If Bun doesn't work or you encounter issues (Windows-specific):**

> Many Windows users face issues with Bun. Use Node.js + npm instead:

1. Download Node.js from: https://nodejs.org/
2. Download the **LTS version** (green button)
3. Run the installer (keep all default options)
4. Verify installation:

```powershell
node --version
npm --version
```

Both commands should show version numbers.

**Note:** If using npm instead of bun, replace all `bun` commands with `npm` throughout this guide:
- `bun install` → `npm install`
- `bun run dev:all` → `npm run dev:all`
- `bun run dev` → `npm run dev`

#### B) Install Python

1. Go to: https://www.python.org/downloads/
2. Download the latest version for Windows
3. **IMPORTANT:** During installation, check **"Add Python to PATH"**
4. Click "Install Now"
5. Verify:

```powershell
python --version
```

---

### Step 2: Navigate to LocalFlow

```powershell
# Navigate to wherever you extracted/cloned LocalFlow
cd C:\Your\Actual\Path\To\LocalFlow
```

---

### Step 3: Install Dependencies

#### A) Install JavaScript packages:

**With Bun:**
```powershell
bun install
```

**With npm (if Bun doesn't work):**
```powershell
npm install
```

Wait a few minutes for it to download everything.

#### B) Install Python packages:

```powershell
cd agent
pip install pynput sounddevice scipy python-socketio pyperclip pyautogui numpy
cd ..
```

---

### Step 4: Configure Cloud Mode (Easiest Processing Mode)

This mode uses internet services to process your voice. **Costs about $1-2/month** with normal use, or use the generous free tier.

#### A) Get a Groq API Key (Free):

1. Go to: https://console.groq.com/playground
2. Create a free account (can use Google/Microsoft login)
3. Click "API Keys" in the left menu
4. Click "Create API Key"
5. Give it a name (e.g., "LocalFlow")
6. **Copy the key** (looks like: `gsk_abcd1234...`)

#### B) Configure the .env file:

```powershell
# Copy the example file
copy .env.example .env

# Edit with Notepad
notepad .env
```

In Notepad, find and modify these lines:

```bash
# Change this:
PROCESSING_MODE=networked-local

# To this:
PROCESSING_MODE=cloud

# And add your Groq API key:
GROQ_API_KEY=gsk_paste_your_key_here
```

Save (Ctrl+S) and close Notepad.

---

### Step 5: Start LocalFlow

You need **TWO PowerShell windows**:

**Window 1 - Web Application & WebSocket Service:**
```powershell
# Navigate to your LocalFlow folder
cd C:\Your\Actual\Path\To\LocalFlow

# With Bun:
bun run dev:all

# OR with npm:
npm run dev:all
```

**Window 2 - Desktop Agent:**
```powershell
# Navigate to your LocalFlow folder
cd C:\Your\Actual\Path\To\LocalFlow\agent
python localflow-agent.py
```

✅ You should see:
```
============================================
LocalFlow Desktop Agent
============================================
Hotkey: alt+l
Mode: developer
Processing: cloud
============================================
Listening for hotkey: alt+l
```

---

### Step 6: Use LocalFlow!

#### A) Test in Web Browser:

1. Open browser
2. Go to: http://localhost:3005
3. Click the microphone button
4. Speak something
5. Click again to stop
6. Your text appears!

#### B) Use in Any Application (The Best Part):

1. Open any program (Word, Excel, Notepad, etc.)
2. Click where you want to type
3. **Hold Alt+L** (both keys together)
4. **Speak** while holding the keys
5. **Release** when done
6. Text automatically appears!

---

## 🎤 Hotkeys

| Key | Function |
|-----|----------|
| **Alt+L** | Normal mode (dictates exactly what you say) |
| **Alt+M** | Format mode (creates lists, bullets, structure) |
| **Alt+T** | Toggle translation (speak Spanish, writes English) |

---

## 🌐 Translation Mode (Spanish → English)

1. Press **Alt+T** (you'll see a notification)
2. Now when you use **Alt+L** or **Alt+M**:
   - You speak in **Spanish**
   - The system writes in **English**
3. Press **Alt+T** again to turn off

---

## 📝 Voice Commands for Formatting

When using **Alt+M** (format mode), you can say:

- "new line" → Insert line break
- "new paragraph" → Insert two line breaks
- "bullet" / "dash" / "point" → Create bullet list
- "number" / "numbered list" → Create numbered list
- "indent" / "tab" → Add indentation
- "outdent" / "back" → Remove indentation

---

## ❓ Troubleshooting

### Problem: "Bun doesn't work on Windows"

**Solution:** This is common. Use Node.js + npm instead:
1. Install Node.js from: https://nodejs.org/
2. Replace `bun` commands with `npm`:
   - `bun install` → `npm install`
   - `bun run dev:all` → `npm run dev:all`

### Problem: "Microphone doesn't work"

**Solution:**
1. Go to Windows Settings → Privacy → Microphone
2. Make sure "Allow apps to access your microphone" is **On**
3. Restart the Python agent

### Problem: "No text appears"

**Solution:**
1. Verify both PowerShell windows are open (web server + agent)
2. Check your Groq API key is correctly set in `.env`
3. Make sure you have internet connection (cloud mode requires internet)

### Problem: "Alt+L keys don't work"

**Solution:**
1. Close the Python agent (Ctrl+C in the window)
2. Right-click PowerShell → "Run as administrator"
3. Navigate to folder and run agent again

### Problem: "Repeated 'L' or 'M' letters appear"

**Solution:**
- This is normal in PowerShell terminals
- Use LocalFlow in other apps (Word, Excel, AutoCAD, etc.)

### Problem: "npm install fails" or "Module not found"

**Solution:**
```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rmdir /s node_modules
npm install
```

---

## 💰 Cloud Mode Costs

- Groq offers a **generous free tier**
- If exceeded, costs approximately **$0.001 per dictation**
- Typical usage: **$1-2/month**
- **Alternative:** Configure local mode (free, but more complex setup)

---

## 🎓 Perfect for Structural Engineers

**Use cases:**

- **Dictating calculations:** "Reinforced concrete beam with fc equals 250 kilograms per square centimeter"
- **Technical reports:** Dictate site observations directly
- **Field notes:** Convert voice notes to formatted text
- **Translation:** Speak Spanish, get English for international technical documents
- **Material lists:** Use Alt+M to create lists automatically

---

## ✅ Checklist

Before starting:

- [ ] Node.js or Bun installed ✓
- [ ] Python installed ✓
- [ ] Dependencies installed (`npm install` or `bun install` + Python packages) ✓
- [ ] `.env` file configured with API key ✓
- [ ] Web server running (port 3005) ✓
- [ ] Python agent running ✓
- [ ] Tested with Alt+L in Word or similar ✓

---

## 📚 Additional Resources

- Full documentation: `SETUP_GUIDE.md` and `CLAUDE.md` in project folder
- Automated startup script: `.\scripts\start-all.ps1`
- Install CLI command: `.\scripts\install-cli.ps1`

---

**You're all set!** 🎉

Try it first in the web interface, then use Alt+L in your favorite programs.
