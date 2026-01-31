# Build and Share APK - Quick Guide

This guide shows you how to build the Android Receiver APK and share it with friends.

## Prerequisites

- **Android Studio** installed on your computer
  - Download: https://developer.android.com/studio
- This repo cloned to your computer

## Build Options

You have two ways to build the APK:

### Option 1: Terminal (Fast, No GUI) ⭐ RECOMMENDED

**Prerequisites:**
- Java JDK 17+ installed
- Set `JAVA_HOME` environment variable

**Build commands:**
```bash
# Navigate to android-receiver folder
cd android-receiver

# Build debug APK
./gradlew assembleDebug

# Or on Windows (if gradlew doesn't work)
gradlew.bat assembleDebug
```

**That's it!** The APK will be built at:
```
android-receiver/app/build/outputs/apk/debug/app-debug.apk
```

### Option 2: Android Studio (GUI)

If you prefer a graphical interface:

1. Launch **Android Studio**
2. Click **"Open"** (not "New Project")
3. Navigate to: `[your-repo-path]/android-receiver`
4. Click **OK**
5. Wait for Gradle sync (2-5 minutes)
6. Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
7. Click the **"locate"** link when done

## Step 3: Find the APK File

The APK is located at:
```
android-receiver/app/build/outputs/apk/debug/app-debug.apk
```

**File size:** ~3-5 MB

## Step 4: Share the APK

### Option 1: Email
1. Attach `app-debug.apk` to an email
2. Send to your friend
3. They download on their Chromebook

### Option 2: Google Drive / Dropbox
1. Upload `app-debug.apk` to cloud storage
2. Share the download link
3. Friend downloads on Chromebook

### Option 3: USB Drive
1. Copy `app-debug.apk` to USB drive
2. Plug into Chromebook
3. Copy file to Chromebook Downloads

## Step 5: Friend Installs on Chromebook

### Enable Unknown Sources (One-time setup)

1. On Chromebook, open **Settings**
2. Go to **Apps** → **Google Play Store** → **Manage Android preferences**
3. Go to **Security & privacy**
4. Enable **"Unknown sources"** or **"Install unknown apps"**
   - May need to enable for Files app or Browser

### Install the APK

1. Open **Files** app on Chromebook
2. Find `app-debug.apk` (in Downloads)
3. **Double-click** the APK file
4. Tap **Install**
5. Tap **Open** when done

## Step 6: Setup Complete!

Your friend now has the LocalFlow Receiver app installed.

**Next steps:**
1. They open the app
2. Tap "Start Receiver"
3. Note the IP address shown
4. You enter that IP in your iPhone PWA settings
5. Start dictating!

## Troubleshooting

### Terminal Build Issues

**"Command not found: ./gradlew"**
- Make sure you're in the `android-receiver` directory
- On Windows, use: `gradlew.bat assembleDebug`
- Or use full path: `bash gradlew assembleDebug`

**"JAVA_HOME is not set"**
```bash
# Mac/Linux
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home

# Windows (PowerShell)
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"

# Then run build again
./gradlew assembleDebug
```

**"Could not find or load main class"**
- Java is not installed correctly
- Download from: https://adoptium.net (Java 17 LTS)

**Build fails with "connection timeout"**
- Check internet connection (downloads dependencies on first build)
- Try again: `./gradlew clean assembleDebug`

### APK Installation Issues

**"Install blocked" error**
- Make sure "Unknown sources" is enabled in Android settings
- Try enabling it specifically for the Files app

**"Parse error" or "App not installed"**
- APK may be corrupted during transfer
- Rebuild and resend

**"App from unknown developer" warning**
- This is normal for sideloaded apps
- Tap "Install anyway" or "Continue"

## Rebuilding After Changes

If you update the code:

1. Make changes in Android Studio
2. Click **Build** → **Rebuild Project**
3. Or: `./gradlew clean assembleDebug`
4. New APK will be in same location
5. Share the new APK

## Alternative: Release APK (Smaller, Optimized)

For a smaller, optimized APK:

1. In Android Studio: **Build** → **Generate Signed Bundle / APK**
2. Choose **APK**
3. Create or select a keystore (for signing)
4. Select **release** build type
5. File will be at: `app/build/outputs/apk/release/app-release.apk`

**Note:** Release APK requires code signing, which is more complex. Debug APK is fine for personal use.

## Summary

| Step | Action |
|------|--------|
| 1 | Open `android-receiver` in Android Studio |
| 2 | Build → Build APK(s) |
| 3 | Find APK in `build/outputs/apk/debug/` |
| 4 | Share `app-debug.apk` with friend |
| 5 | Friend enables "Unknown sources" and installs |
| 6 | Done! |

**Total time:** ~5-10 minutes first time, ~2 minutes for rebuilds.
