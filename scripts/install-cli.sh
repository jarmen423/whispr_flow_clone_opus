#!/bin/bash
# install-cli.sh
# Install LocalFlow CLI command to your system PATH
# Run: ./scripts/install-cli.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m'

echo -e "${CYAN}=== LocalFlow CLI Installer ===${NC}"
echo ""

# Determine install location
LOCAL_BIN="$HOME/.local/bin"
SOURCE_SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/whispr-flow.sh"
TARGET_SCRIPT="$LOCAL_BIN/localflow"

# Create .local/bin if it doesn't exist
if [ ! -d "$LOCAL_BIN" ]; then
    echo -e "${YELLOW}Creating $LOCAL_BIN...${NC}"
    mkdir -p "$LOCAL_BIN"
fi

# Check if SOURCE_SCRIPT exists
if [ ! -f "$SOURCE_SCRIPT" ]; then
    echo -e "${RED}Error: Source script not found at $SOURCE_SCRIPT${NC}"
    exit 1
fi

# Copy the script
echo -e "${GREEN}Installing localflow command...${NC}"
cp "$SOURCE_SCRIPT" "$TARGET_SCRIPT"
chmod +x "$TARGET_SCRIPT"

# Check if LOCAL_BIN is in PATH
if [[ ":$PATH:" != *":$LOCAL_BIN:"* ]]; then
    echo -e "${YELLOW}Adding $LOCAL_BIN to your PATH...${NC}"
    
    # Detect shell and update appropriate rc file
    SHELL_NAME="$(basename "$SHELL")"
    case "$SHELL_NAME" in
        bash)
            RC_FILE="$HOME/.bashrc"
            if [ -f "$HOME/.bash_profile" ]; then
                RC_FILE="$HOME/.bash_profile"
            fi
            ;;
        zsh)
            RC_FILE="$HOME/.zshrc"
            ;;
        fish)
            RC_FILE="$HOME/.config/fish/config.fish"
            mkdir -p "$(dirname "$RC_FILE")"
            ;;
        *)
            RC_FILE="$HOME/.profile"
            ;;
    esac
    
    # Add to PATH in rc file
    echo "" >> "$RC_FILE"
    echo "# Added by LocalFlow CLI installer" >> "$RC_FILE"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$RC_FILE"
    
    echo -e "${YELLOW}Added PATH export to $RC_FILE${NC}"
    echo -e "${YELLOW}Run 'source $RC_FILE' or restart your terminal to use the command.${NC}"
else
    echo -e "${GRAY}$LOCAL_BIN is already in PATH${NC}"
fi

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "Usage:"
echo "  localflow        - Start LocalFlow services"
echo "  localflow --stop - Stop LocalFlow services"
echo ""

# Check if we can run it now
if command -v localflow &> /dev/null; then
    echo -e "${GREEN}You can use 'localflow' right now!${NC}"
else
    echo -e "${YELLOW}Note: Run 'source ~/.bashrc' (or your shell's rc file) or restart your terminal to use the command.${NC}"
fi
