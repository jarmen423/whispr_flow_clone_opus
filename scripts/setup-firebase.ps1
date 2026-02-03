# Whispr Flow - Firebase Setup Helper Script
# This script helps you get your Firebase credentials

Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║         Whispr Flow - Firebase Setup Helper                    ║
║                                                                ║
║  This script will guide you through getting Firebase creds     ║
╚════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host "`nSTEP 1: Create a Firebase Project" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "1. Go to: https://console.firebase.google.com/"
Write-Host "2. Click 'Create Project' (or select existing)"
Write-Host "3. Name it: whispr-flow (or any name you want)"
Write-Host "4. Disable Google Analytics (optional)"
Write-Host "5. Click 'Create' and wait..."
Write-Host "`nPress Enter when you've created the project..." -NoNewline
$null = Read-Host

Write-Host "`nSTEP 2: Get Your Credentials" -ForegroundColor Green
Write-Host "------------------------------"
Write-Host "1. In your Firebase project, click the GEAR icon (Project settings)"
Write-Host "2. Under 'General' tab, scroll to 'Your apps'"
Write-Host "3. Click the WEB icon (looks like: </>)"
Write-Host "4. Enter app nickname: whispr-web"
Write-Host "5. Click 'Register app'"
Write-Host "`nYou'll see code like this:"
Write-Host @"
const firebaseConfig = {
  apiKey: "AIzaSyB...",                    <-- COPY THIS
  authDomain: "whispr-flow.firebaseapp.com",
  databaseURL: "https://...firebaseio.com", <-- AND THIS
  projectId: "whispr-flow",
  ...
};
"@ -ForegroundColor Yellow

Write-Host "`nSTEP 3: Enable Realtime Database" -ForegroundColor Green
Write-Host "----------------------------------"
Write-Host "1. In left sidebar, click 'Realtime Database'"
Write-Host "2. Click 'Create Database'"
Write-Host "3. Choose location closest to you"
Write-Host "4. Select 'Start in test mode'"
Write-Host "5. Click 'Enable'"

Write-Host "`nSTEP 4: Enter Your Credentials" -ForegroundColor Green
Write-Host "--------------------------------"

$apiKey = Read-Host -Prompt "`nEnter your API Key (AIzaSy...)"
$dbUrl = Read-Host -Prompt "Enter your Database URL (https://...firebaseio.com)"

if (-not $apiKey -or -not $dbUrl) {
    Write-Host "`n❌ Error: Both fields are required!" -ForegroundColor Red
    exit 1
}

# Create .env.local file
$envContent = @"
# Whispr Flow - Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=$apiKey
NEXT_PUBLIC_FIREBASE_DATABASE_URL=$dbUrl
"@

$envContent | Out-File -FilePath ".env.local" -Encoding UTF8 -Force

Write-Host "`n✅ Credentials saved to .env.local!" -ForegroundColor Green

# Create extension config
$extConfig = @"
{
  \"firebaseApiKey\": \"$apiKey\",
  \"firebaseDbUrl\": \"$dbUrl\"
}
"@

$extConfig | Out-File -FilePath "chromebook-extension/firebase-config.json" -Encoding UTF8 -Force

Write-Host "✅ Extension config saved!" -ForegroundColor Green

Write-Host @"

══════════════════════════════════════════════════════════════════
                    NEXT STEPS
══════════════════════════════════════════════════════════════════

1. Run: bun install

2. Start the dev server:
   bun run dev

3. Install Chrome Extension:
   - Open Chrome, go to: chrome://extensions/
   - Enable "Developer mode" (toggle top right)
   - Click "Load unpacked"
   - Select the 'chromebook-extension' folder

4. Configure the extension:
   - Click the Whispr Flow icon in toolbar
   - Enter your Firebase credentials
   - Copy the Device ID shown

5. Open iPhone PWA:
   - Go to http://YOUR_IP:3005/mobile
   - Enable "Use Cloud Relay"
   - Enter same Firebase credentials
   - Device ID should match (or enter manually)

6. Test it!
   - Record on iPhone
   - Text appears on Chromebook automatically!

══════════════════════════════════════════════════════════════════
"@ -ForegroundColor Cyan
