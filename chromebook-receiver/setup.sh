#!/bin/bash
# Setup script for Whispr Flow Linux Receiver
# NOTE: This is separate from setup-standalone.sh for Whispr Chromebook

set -e

echo "🎤 Setting up Whispr Flow Receiver..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt-get update
sudo apt-get install -y xclip python3-pip
pip3 install websockets

# Create directories
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/whispr-flow"
mkdir -p "$HOME/Desktop"

echo "🖥️  Creating desktop shortcuts..."

# 1. NORMAL MODE - Silent (no terminal)
NORMAL_DESKTOP="$HOME/Desktop/Whispr-Flow.desktop"
cat > "$NORMAL_DESKTOP" << EOF
[Desktop Entry]
Name=🎤 Whispr Flow
Comment=Receive voice transcriptions from iPhone (silent mode)
Exec=python3 $SCRIPT_DIR/linux-receiver.py
Type=Application
Terminal=false
Icon=audio-input-microphone
Categories=AudioVideo;Audio;
StartupNotify=true
Path=$SCRIPT_DIR
X-GNOME-Autostart-enabled=false
EOF

# 2. DEBUG MODE - With terminal (for troubleshooting)
DEBUG_DESKTOP="$HOME/Desktop/Whispr-Flow-Debug.desktop"
cat > "$DEBUG_DESKTOP" << EOF
[Desktop Entry]
Name=🐛 Whispr Flow (Debug)
Comment=Receive voice transcriptions (with logs visible)
Exec=python3 $SCRIPT_DIR/linux-receiver.py --debug
Type=Application
Terminal=true
Icon=utilities-terminal
Categories=AudioVideo;Audio;Development;
StartupNotify=true
Path=$SCRIPT_DIR
EOF

# 3. VIEW LOGS - Backdoor to see what's happening
LOGS_DESKTOP="$HOME/Desktop/Whispr-Flow-Logs.desktop"
cat > "$LOGS_DESKTOP" << EOF
[Desktop Entry]
Name=📋 Whispr Flow Logs
Comment=View receiver logs for debugging
Exec=bash $SCRIPT_DIR/view-logs.sh
Type=Application
Terminal=true
Icon=text-x-log
Categories=System;Monitor;
Path=$SCRIPT_DIR
EOF

# Make all desktop files executable
chmod +x "$NORMAL_DESKTOP"
chmod +x "$DEBUG_DESKTOP"
chmod +x "$LOGS_DESKTOP"

# Also add to applications menu
cp "$NORMAL_DESKTOP" "$HOME/.local/share/applications/whispr-flow.desktop"
cp "$DEBUG_DESKTOP" "$HOME/.local/share/applications/whispr-flow-debug.desktop"
cp "$LOGS_DESKTOP" "$HOME/.local/share/applications/whispr-flow-logs.desktop"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 You now have 3 desktop icons:"
echo ""
echo "  🎤 Whispr Flow         - Normal mode (silent, no terminal)"
echo "  🐛 Whispr Flow (Debug) - Shows terminal with live logs"
echo "  📋 Whispr Flow Logs    - View past logs if something went wrong"
echo ""
echo "💡 For regular use: Double-click 🎤 Whispr Flow"
echo "   If it's not working: Double-click 🐛 Whispr Flow (Debug)"
echo "   To check old logs: Double-click 📋 Whispr Flow Logs"
echo ""
echo "📱 iPhone connection:"
echo "   Open Safari → http://[CHROMEBOOK_IP]:3005/mobile"
echo ""
echo "📝 Log file location:"
echo "   ~/.local/share/whispr-flow/receiver.log"
echo ""
