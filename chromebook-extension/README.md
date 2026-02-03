# Whispr Flow Chrome Extension

Receive voice transcriptions from your iPhone and auto-paste into any webpage.

## Features

- **Cloud Relay**: Works from anywhere - no local network required
- **Auto-paste**: Automatically inserts text into focused input fields
- **Global Hotkey**: Press `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on Mac) to open
- **Clipboard Copy**: Always copies text to clipboard as backup
- **Notifications**: Shows desktop notification when text is received

## Architecture

```
iPhone PWA ──Firebase RTDB──▶ Chrome Extension
   (sends)      (cloud)        (receives & pastes)
```

Uses **Firebase Realtime Database** free tier as the cloud relay:
- 50,000 reads/day
- 20,000 writes/day
- No project pausing (unlike Supabase)
- Always available

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create Project"
3. Name it "whispr-flow" (or any name)
4. Disable Google Analytics (optional)
5. Click "Create"

### 2. Get Firebase Credentials

1. In your Firebase project, click the gear icon → "Project settings"
2. Under "General" tab, find "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Name it "whispr-flow-web"
5. **Copy the `apiKey` and `databaseURL`**

Example:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",           // <-- Copy this
  databaseURL: "https://whispr-flow-default-rtdb.firebaseio.com",  // <-- And this
  // ... other fields
};
```

### 3. Enable Realtime Database

1. In Firebase Console, click "Realtime Database" (left sidebar)
2. Click "Create Database"
3. Choose location closest to you
4. **Start in test mode** (we'll secure it later)
5. Click "Enable"

### 4. Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chromebook-extension` folder
5. Extension icon should appear in toolbar

### 5. Configure Extension

1. Click the Whispr Flow extension icon
2. Enter your Firebase credentials:
   - **Firebase API Key**: From step 2
   - **Database URL**: From step 2 (e.g., `https://your-project.firebaseio.com`)
   - **Device ID**: Copy this and share with your iPhone
3. Click "Save & Connect"
4. Status should show "Connected" with green dot

### 6. Configure iPhone PWA

1. Open the LocalFlow web app on your iPhone
2. Go to Settings
3. Enable "Use Cloud Relay"
4. Enter the same Firebase credentials:
   - **Firebase API Key**: Same as above
   - **Database URL**: Same as above
5. Save settings
6. Your Device ID will be shown - make sure it matches the Chrome extension

## Usage

### From iPhone:
1. Tap the record button
2. Speak your text
3. Tap stop
4. Text is automatically sent to Chromebook!

### On Chromebook:
1. Make sure you're in a text field (Google Docs, email, etc.)
2. Text will automatically appear where your cursor is
3. Or press Ctrl+V to paste manually

## Troubleshooting

### Extension shows "Not configured"
- Click the extension icon and enter Firebase credentials
- Make sure all three fields are filled

### Extension shows "Connecting..."
- Check your Firebase credentials are correct
- Verify database URL includes `https://`
- Check internet connection

### Text not appearing
- Make sure auto-paste is enabled in the extension
- Click in a text field first (input, textarea, or Google Doc)
- Check notification - text is always copied to clipboard
- Try manual paste with Ctrl+V

### Hotkey not working
- Go to `chrome://extensions/shortcuts`
- Find "Whispr Flow" and set your preferred shortcut

## Security Notes

### Firebase Rules (Basic)
After setup works, secure your database:

```json
{
  "rules": {
    "transcriptions": {
      "$deviceId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### Data Privacy
- Data is stored temporarily in Firebase (overwritten on each message)
- No authentication required (uses device ID as security through obscurity)
- For production, add proper Firebase Auth

## Free Tier Limits

Firebase Spark (free) plan:
- ✅ 50,000 database reads/day
- ✅ 20,000 database writes/day
- ✅ 1GB data stored
- ✅ No credit card required
- ✅ No project pausing

This is plenty for personal voice dictation use!

## Alternative: Local Network Mode

If you prefer not to use cloud relay:

1. Disable "Use Cloud Relay" on iPhone
2. Enter your Chromebook's local IP address
3. Both devices must be on same WiFi
4. Use the Python receiver (`linux-receiver.py`) if needed

## Files

- `manifest.json` - Extension configuration
- `background.js` - Firebase listener and auto-paste logic
- `popup.html/js` - Extension UI
- `content.js` - (Optional) Page injection if needed

## Development

To modify:
1. Edit files in this folder
2. Go to `chrome://extensions/`
3. Click refresh icon on Whispr Flow extension
4. Test changes

## License

MIT - Feel free to modify for your use!
