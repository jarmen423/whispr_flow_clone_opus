#!/bin/bash
# whispr-flow.sh
# Universal startup script for LocalFlow (Linux/macOS)
# Usage: ./whispr-flow.sh [--stop]
#
# This script can be:
# 1. Run directly from the project root
# 2. Installed to PATH via: ./scripts/install-cli.sh
# 3. Then run from anywhere as: localflow [--stop]

set -e

# Determine project root
# Get the script's directory
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_SOURCE" ]; do
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
    SCRIPT_SOURCE="$(readlink "$SCRIPT_SOURCE")"
    [[ $SCRIPT_SOURCE != /* ]] && SCRIPT_SOURCE="$SCRIPT_DIR/$SCRIPT_SOURCE"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"

# Check if we're running from the project root (script next to package.json)
if [ -f "$SCRIPT_DIR/package.json" ]; then
    PROJECT_ROOT="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../package.json" ]; then
    # Running from scripts/ subdirectory
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
    # Not in project - check common locations or use environment variable
    POSSIBLE_PATHS=(
        "$LOCALFLOW_HOME"
        "$HOME/localflow"
        "$HOME/LocalFlow"
        "$HOME/whispr_flow_clones/opus"
    )
    
    PROJECT_ROOT=""
    for PATH_CHECK in "${POSSIBLE_PATHS[@]}"; do
        if [ -n "$PATH_CHECK" ] && [ -f "$PATH_CHECK/package.json" ]; then
            PROJECT_ROOT="$PATH_CHECK"
            break
        fi
    done
    
    if [ -z "$PROJECT_ROOT" ]; then
        echo -e "\033[0;31mError: Could not find LocalFlow project directory.\033[0m"
        echo -e "\033[0;31mPlease set LOCALFLOW_HOME environment variable to your project root.\033[0m"
        echo -e "\033[0;31mOr run this script from the project directory.\033[0m"
        exit 1
    fi
fi

# Resolve the agent command: prefer the uv-installed console script, fall back
# to `uv run` from the project root for a fresh checkout.
if command -v localflow-agent >/dev/null 2>&1; then
    AGENT_CMD="localflow-agent"
elif command -v uv >/dev/null 2>&1; then
    AGENT_CMD="uv run --project \"$PROJECT_ROOT\" localflow-agent"
else
    AGENT_CMD=""
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m'

# Function to stop services
stop_services() {
    echo -e "${YELLOW}Stopping LocalFlow services...${NC}"

    # Find and kill node processes (Next.js and WebSocket service)
    if pgrep -f "next dev" > /dev/null 2>&1; then
        pkill -f "next dev"
    fi

    if pgrep -f "websocket-service" > /dev/null 2>&1; then
        pkill -f "websocket-service"
    fi

    # Find and kill agent processes (covers both the legacy python script and
    # the uv-installed console script).
    if pgrep -f "localflow-agent" > /dev/null 2>&1; then
        pkill -f "localflow-agent"
    fi

    echo -e "${RED}Stopped!${NC}"
}

# Function to start services
start_services() {
    echo -e "${CYAN}Starting LocalFlow services...${NC}"
    echo -e "${GRAY}Project root: $PROJECT_ROOT${NC}"

    # Check that the agent is available
    if [ -z "$AGENT_CMD" ]; then
        echo -e "${RED}Error: localflow-agent not found.${NC}"
        echo -e "${RED}Install with: uv tool install --editable \"$PROJECT_ROOT\"${NC}"
        exit 1
    fi

    # Check if npm dependencies are installed
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        echo -e "${YELLOW}Warning: node_modules not found. Running npm install...${NC}"
        cd "$PROJECT_ROOT" && npm install
    fi

    # Start Web UI and WebSocket service in background
    echo -e "${GREEN}Starting Web UI and WebSocket service...${NC}"
    cd "$PROJECT_ROOT"
    nohup npm run dev:all > /tmp/localflow-web.log 2>&1 &

    # Start Desktop Agent in background
    echo -e "${GREEN}Starting Desktop Agent...${NC}"
    nohup $AGENT_CMD > /tmp/localflow-agent.log 2>&1 &

    echo -e "${GREEN}Services started!${NC}"
    echo -e "${CYAN}Press Alt+L for Raw mode, Alt+M for Format mode${NC}"
    echo ""
    echo "Logs:"
    echo "  Web services: tail -f /tmp/localflow-web.log"
    echo "  Agent:        tail -f /tmp/localflow-agent.log"
}

# Parse arguments
if [ "$1" == "--stop" ] || [ "$1" == "-s" ] || [ "$1" == "stop" ]; then
    stop_services
else
    start_services
fi
