#!/bin/bash
# Setup script for Whispr Chromebook (Standalone - no iPhone needed)
# SEPARATE from the receiver setup to avoid conflicts

set -e

echo "🎙️ Setting up Whispr Chromebook (Standalone)..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Install dependencies (standalone needs tkinter and alsa-utils)
echo "📦 Installing dependencies..."
sudo apt-get update
sudo apt-get install -y xclip alsa-utils python3-tk

# Create directories
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.config/whispr-flow"
mkdir -p "$HOME/Desktop"

echo "🖥️  Creating desktop shortcut..."

# Standalone app desktop entry
cat > "$HOME/Desktop/Whispr-Chromebook.desktop" << EOF
[Desktop Entry]
Name=🎙️ Whispr Chromebook
Comment=Record and transcribe directly on Chromebook (no iPhone needed)
Exec=python3 $SCRIPT_DIR/whispr-chromebook.py
Type=Application
Terminal=false
Icon=audio-input-microphone
Categories=AudioVideo;Audio;
StartupNotify=true
Path=$SCRIPT_DIR
EOF

# Make executable
chmod +x "$HOME/Desktop/Whispr-Chromebook.desktop"

# Also add to applications menu
cp "$HOME/Desktop/Whispr-Chromebook.desktop" "$HOME/.local/share/applications/"

echo ""
echo "✅ Whispr Chromebook installed!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  🎙️ WHISPR CHROMEBOOK (Standalone)"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Use when you DON'T have your iPhone."
echo "  Records directly on Chromebook, transcribes via Groq,"
echo "  and copies to clipboard."
echo ""
echo "  🎙️ Whispr Chromebook   - Desktop icon created"
echo ""
echo "═══════════════════════════════════════════════════"
echo ""
echo "💡 First time use:"
echo "   1. Double-click 🎙️ Whispr Chromebook"
echo "   2. Enter your Groq API key"
echo "   3. Click START RECORDING"
echo "   4. Speak, then click STOP"
echo "   5. Text is copied to clipboard!"
echo ""
echo "⚙️  Config saved to: ~/.config/whispr-flow/"
echo ""
