#!/bin/bash
# =============================================================================
# LocalFlow Desktop Agent Installer for macOS/Linux
# =============================================================================
# Clones the repository and installs the agent as a uv-managed tool, which
# provides the `localflow-agent` and `localflow-recover` console commands.
# Creates a Linux .desktop entry where supported.
#
# Requires uv (https://astral.sh/uv). If uv is missing it is installed
# automatically.
#
# Usage:
#   curl -fsSL https://dictate.agentmemorylabs.com/api/download?platform=macos | bash
#   # or for Linux:
#   curl -fsSL https://dictate.agentmemorylabs.com/api/download?platform=linux | bash
# =============================================================================

set -e

REPO_URL="https://github.com/jarmen423/whispr_flow_clone_opus.git"
INSTALL_DIR="$HOME/.localflow/localflow"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "${CYAN}==>${NC} $1"; }
ok()   { echo -e "${GREEN}   +${NC} $1"; }
warn() { echo -e "${YELLOW}   !${NC} $1"; }

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
fi

echo ""
echo "============================================"
echo -e "${CYAN}  LocalFlow Desktop Agent Installer${NC}"
echo "============================================"
echo ""

# --- Check Git ---
step "Checking for Git..."
if ! command -v git &>/dev/null; then
    echo -e "${RED}ERROR: Git is not installed or not in PATH.${NC}"
    echo "Please install Git from https://git-scm.com/downloads"
    exit 1
fi
ok "Found Git"

# --- Ensure uv is installed ---
step "Checking for uv..."
if ! command -v uv &>/dev/null; then
    warn "uv not found. Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # Make uv available in this session.
    export PATH="$HOME/.local/bin:$PATH"
    if ! command -v uv &>/dev/null; then
        echo -e "${RED}ERROR: uv is still not on PATH.${NC}"
        echo "Open a new terminal and re-run, or install manually:"
        echo "  https://docs.astral.sh/uv/getting-started/installation/"
        exit 1
    fi
fi
UV_VERSION=$(uv --version 2>&1)
ok "Found $UV_VERSION"

# --- Ensure ~/.local/bin is on PATH for this session ---
case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) export PATH="$HOME/.local/bin:$PATH" ;;
esac

# --- Clone or update repo ---
step "Downloading LocalFlow agent..."
if [ -d "$INSTALL_DIR" ]; then
    warn "Existing installation found at $INSTALL_DIR"
    warn "Updating..."
    cd "$INSTALL_DIR"
    git pull --quiet
else
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" --quiet
fi
cd "$INSTALL_DIR"
ok "Agent files ready at $INSTALL_DIR"

# --- Install the agent as a uv tool (editable so `git pull` updates it) ---
step "Installing agent via uv (this may take a minute on first run)..."
uv tool install --editable --force .
ok "Agent installed"
ok "Console command: localflow-agent"
ok "Console command: localflow-recover"

# Persist ~/.local/bin on PATH for future shells if missing.
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    case "$SHELL" in
        */zsh)
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
            ;;
        */bash)
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
            ;;
    esac
    warn "Added $HOME/.local/bin to your PATH. Run 'source ~/.bashrc' or 'source ~/.zshrc'."
fi

# --- Create .desktop entry (Linux only) ---
if [ "$OS" = "linux" ]; then
    step "Creating desktop entries..."
    DESKTOP_DIR="$HOME/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    AGENT_BIN="$HOME/.local/bin/localflow-agent"
    RECOVER_BIN="$HOME/.local/bin/localflow-recover"
    cat > "$DESKTOP_DIR/localflow-agent.desktop" << EOF
[Desktop Entry]
Name=LocalFlow Agent
Comment=LocalFlow Desktop Dictation Agent
Exec=$AGENT_BIN
Type=Application
Terminal=true
Categories=Audio;Utility;
EOF
    cat > "$DESKTOP_DIR/localflow-recover.desktop" << EOF
[Desktop Entry]
Name=LocalFlow Recovery
Comment=LocalFlow Failed Recording Recovery Console
Exec=$RECOVER_BIN
Type=Application
Terminal=true
Categories=Audio;Utility;
EOF
    ok "Desktop entries created"
fi

# --- Anonymous install ping (no PII, fails silently) ---
curl -s "https://dictate.agentmemorylabs.com/api/install-ping?platform=${OS}" > /dev/null 2>&1 || true

# --- Summary ---
echo ""
echo "============================================"
echo -e "${GREEN}  Installation Complete!${NC}"
echo "============================================"
echo ""
echo "Start the agent:"
echo -e "  ${CYAN}localflow-agent${NC}       (after updating PATH)"
echo ""
echo "Hotkeys (hold to record, release to paste):"
echo "  Alt+L  - Raw dictation"
echo "  Alt+M  - AI formatting (outlines, lists)"
echo "  Alt+T  - Translate mode (speak any language -> English)"
echo "  Alt+A  - Voice agent (ask a question, web-search grounded answer)"
echo "  Alt+.  - Toggle dictation (press once to start, again to stop)"
echo "  Alt+J  - Format selected text"
echo "  Alt+N  - Cleanup selected text"
echo ""
echo "Failed transcription recovery:"
echo -e "  ${CYAN}Open the Recovery Console:  localflow-recover${NC}"
echo "  List saved recordings:      localflow-agent --list-failed-recordings"
echo "  Retry the newest:           localflow-agent --retry-latest-failed"
echo "  Saved recordings folder:    $HOME/.localflow/failed-recordings"
echo "  Default retention: 72 hours"
echo ""
echo "Updates:"
echo "  cd $INSTALL_DIR && git pull && uv tool install --editable --force ."
echo ""
warn "On first run, enter your Groq API key if prompted."
echo ""
