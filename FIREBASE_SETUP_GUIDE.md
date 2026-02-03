# Firebase Setup Guide - Step by Step

## Overview
You need 2 pieces of information from Firebase:
1. **API Key** (looks like: `AIzaSyBxxxxxxxxxxxxxxxxxxx`)
2. **Database URL** (looks like: `https://your-project.firebaseio.com`)

---

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **"Create a project"**

   ![Create Project Button](https://firebase.google.com/downloads/brand-guidelines/SVG/logo-logomark.svg)

3. Enter project name: `whispr-flow` (or any name)
4. **Uncheck** "Enable Google Analytics for this project" (optional)
5. Click **"Create project"**
6. Wait for it to finish, then click **"Continue"**

---

## Step 2: Get Your API Key

1. In your Firebase project, look for a **gear icon** ⚙️ next to "Project Overview"
2. Click **"Project settings"**

   ![Project Settings](https://firebase.google.com/downloads/brand-guidelines/SVG/logo-logomark.svg)

3. You should see a page like this:

   ```
   General | Cloud Messaging | Integrations | Service accounts | Data privacy
   ```

4. Scroll down to **"Your apps"** section
5. Click the **"</>"** (Web) icon to add a web app

   ![Web Icon](https://firebase.google.com/downloads/brand-guidelines/SVG/logo-logomark.svg)

6. Enter **App nickname**: `whispr-web`
7. **Uncheck** "Also set up Firebase Hosting" (we don't need it)
8. Click **"Register app"**

9. You'll see this code:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyABC123xyz789...",                    ← COPY THIS
     authDomain: "whispr-flow.firebaseapp.com",
     databaseURL: "https://whispr-flow-default-rtdb.firebaseio.com",  ← AND THIS
     projectId: "whispr-flow",
     storageBucket: "whispr-flow.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

10. **Copy the `apiKey`** (keep this tab open!)

---

## Step 3: Enable Realtime Database

1. In the left sidebar, click **"Build"** to expand it
2. Click **"Realtime Database"**

   ![Realtime Database](https://firebase.google.com/downloads/brand-guidelines/SVG/logo-logomark.svg)

3. Click **"Create Database"**

4. Choose location:
   - Pick the region closest to you
   - `us-central1` for US
   - `europe-west1` for Europe
   - `asia-southeast1` for Asia

5. Click **"Next"**

6. **IMPORTANT: Choose "Start in test mode"**

   ```
   ⚠️ This will allow anyone with your database reference to read/write
   ```

   (This is OK for our use - we secure it with device ID)

7. Click **"Enable"**

8. You'll see your Database URL at the top:

   ```
   https://whispr-flow-default-rtdb.firebaseio.com/
                                               ↑
                                          Copy this URL
   ```

---

## Step 4: Run the Setup Script

Open PowerShell in your project folder and run:

```powershell
.\scripts\setup-firebase.ps1
```

It will ask for:
- **API Key**: Paste from Step 2
- **Database URL**: Paste from Step 3

---

## Step 5: Install Chrome Extension

1. Open Chrome browser
2. Go to: `chrome://extensions/`
3. Toggle **"Developer mode"** ON (top right)
4. Click **"Load unpacked"**
5. Select the `chromebook-extension` folder
6. Extension icon should appear in your toolbar

---

## Step 6: Configure Everything

### On Chromebook (Extension):
1. Click the Whispr Flow extension icon
2. Enter:
   - **Firebase API Key**: Your API key
   - **Database URL**: Your database URL
   - **Device ID**: Click "Generate" or type any unique ID
3. Click **"Save & Connect"**
4. Status should show green dot: **Connected**

### On iPhone (PWA):
1. Open Safari, go to: `http://YOUR_CHROMEBOOK_IP:3005/mobile`
2. Go to **Settings**
3. Enable **"Use Cloud Relay"**
4. Enter:
   - **Firebase API Key**: Same as above
   - **Database URL**: Same as above
5. Make sure **Device ID** matches the Chrome extension
6. Save settings

---

## Testing

1. On iPhone: Tap record, speak, tap stop
2. On Chromebook: Text should appear in your active text field!
3. If not auto-pasted, press Ctrl+V

---

## Troubleshooting

### Extension shows "Not configured"
→ Enter Firebase credentials in the extension popup

### Extension shows "Connecting..." forever
→ Check:
- API key is correct (starts with `AIza`)
- Database URL includes `https://`
- You enabled Realtime Database (Step 3)

### "Permission denied" error
→ Database rules need to allow access. In Firebase Console:
1. Go to Realtime Database
2. Click "Rules" tab
3. Make sure it shows:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Click "Publish"

### iPhone can't connect to PWA
→ Make sure:
- Chromebook and iPhone are on same WiFi
- You started the dev server: `bun run dev`
- Windows Firewall allows port 3005

---

## Security Note

The "test mode" database rules allow anyone to read/write. This is fine for personal use because:
- We use a unique device ID as a "password"
- Data is temporary (overwritten on each message)
- You're the only one who knows your device ID

For production, you'd add Firebase Authentication.
