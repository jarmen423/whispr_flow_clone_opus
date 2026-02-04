#!/bin/bash
# =============================================================================
# LocalFlow Local Processing Setup Script
# =============================================================================
# Purpose:
#   This script automates the setup of local processing infrastructure for
#   LocalFlow. It installs and configures the components needed for fully
#   offline dictation: Ollama (LLM for text refinement) and Whisper.cpp
#   (speech-to-text transcription).
#
# Reasoning:
#   While LocalFlow supports cloud processing for convenience, many users
#   require or prefer complete data privacy. This script provides a one-command
#   setup for local processing, eliminating the need for manual installation
#   and configuration of multiple dependencies.
#
# Dependencies:
#   System Requirements:
#     - macOS or Linux (Windows requires manual setup)
#     - curl: For downloading installers and models
##     - git: For cloning whisper.cpp repository
#     - cmake and build tools: For compiling whisper.cpp
#
#   Installed Components:
#     - Ollama: Local LLM inference server (https://ollama.ai)
#     - Ollama model (default: llama3.2:1b): Lightweight LLM for text refinement
#     - Whisper.cpp: High-performance speech-to-text (https://github.com/ggerganov/whisper.cpp)
#     - Whisper model (default: small): Multilingual transcription model
#
# Role in Codebase:
#   This is a developer/user convenience script called once during initial
#   setup. It is not part of the runtime application. After running this
#   script, users can configure PROCESSING_MODE=local in their .env file.
#
# Usage:
#   ./scripts/setup-local.sh           # Full setup
#   ./scripts/setup-local.sh --ollama-only    # Install only Ollama
#   ./scripts/setup-local.sh --whisper-only   # Install only Whisper.cpp
#
# Key Technologies/APIs:
#   - curl: HTTP client for downloads
#   - git: Version control for whisper.cpp source
#   - cmake: Build system for C++ compilation
#   - make: Build automation
#   - pgrep: Process checking for Ollama status
#
# Environment Variables:
#   OLLAMA_MODEL: Model to install (default: llama3.2:1b)
#   WHISPER_MODEL: Whisper model size (default: small)
#
# Author: LocalFlow Development Team
# =============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "============================================"
echo "LocalFlow Local Processing Setup"
echo "============================================"
echo ""

# ============================================================================
# Color Definitions for Output
# ============================================================================

# ANSI color codes for terminal output
RED='\033[0;31m'     # Error messages
GREEN='\033[0;32m'   # Success messages
YELLOW='\033[1;33m'  # Warning/information messages
NC='\033[0m'         # No Color (reset)

# ============================================================================
# Operating System Detection
# ============================================================================

# Detect the operating system to use appropriate installation methods
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi

echo "Detected OS: $OS"
echo ""

# ============================================================================
# Function: install_ollama
# ============================================================================
#
# Installs the Ollama LLM server if not already present.
#
# Ollama provides a simple API for running LLMs locally. This function
# uses the official Ollama install script or Homebrew on macOS.
#
# Key Technologies/APIs:
#   - curl: Downloads Ollama install script
#   - command -v: Checks if ollama binary exists
#   - brew: macOS package manager (if available)
#
# Side Effects:
#   - Installs Ollama to system PATH
#   - Modifies shell configuration for PATH updates
#
# Returns:
#   None. Exits on Windows (manual install required).
#
install_ollama() {
    echo -e "${YELLOW}Installing Ollama...${NC}"
    
    # Check if already installed
    if command -v ollama &> /dev/null; then
        echo -e "${GREEN}Ollama is already installed${NC}"
        return
    fi
    
    # Install based on OS
    case $OS in
        macos)
            # Prefer Homebrew if available, otherwise use install script
            if command -v brew &> /dev/null; then
                brew install ollama
            else
                curl -fsSL https://ollama.ai/install.sh | sh
            fi
            ;;
        linux)
            # Use official install script on Linux
            curl -fsSL https://ollama.ai/install.sh | sh
            ;;
        windows)
            # Windows requires manual installation
            echo "Please download Ollama from: https://ollama.ai/download"
            echo "Then run this script again."
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}Ollama installed successfully${NC}"
}

# ============================================================================
# Function: setup_ollama_model
# ============================================================================
#
# Downloads and prepares the specified Ollama model.
#
# Starts the Ollama service if not running and pulls the model.
# The default model (llama3.2:1b) is optimized for speed on consumer hardware.
#
# Key Technologies/APIs:
#   - pgrep: Check if ollama process is running
#   - ollama serve: Start the Ollama server
#   - ollama pull: Download model from Ollama registry
#
# Environment Variables:
#   OLLAMA_MODEL: Model name to install (default: llama3.2:1b)
#
# Side Effects:
#   - Starts Ollama server in background
#   - Downloads model files (~1-2GB depending on model)
#
# Returns:
#   None. Exits on failure.
#
setup_ollama_model() {
    # Use environment variable or default to lightweight model
    local MODEL="${OLLAMA_MODEL:-llama3.2:1b}"
    
    echo -e "${YELLOW}Setting up Ollama model: $MODEL${NC}"
    
    # Start Ollama service if not running
    if ! pgrep -x "ollama" > /dev/null; then
        echo "Starting Ollama service..."
        ollama serve &
        sleep 3  # Wait for service to initialize
    fi
    
    # Pull the model from Ollama registry
    echo "Pulling model $MODEL (this may take a few minutes)..."
    ollama pull $MODEL
    
    echo -e "${GREEN}Model $MODEL ready${NC}"
}

# ============================================================================
# Function: install_whisper
# ============================================================================
#
# Clones and compiles Whisper.cpp from source.
#
# Whisper.cpp is a high-performance C++ implementation of OpenAI's Whisper
# model. This function clones the repository and compiles with OpenBLAS
# acceleration for better performance on CPU.
#
# Key Technologies/APIs:
#   - git clone: Download whisper.cpp source
#   - make: Compile C++ source code
#   - OpenBLAS: Optimized linear algebra library for acceleration
#
# Side Effects:
#   - Creates $HOME/.localflow/whisper.cpp directory
#   - Compiles binary to whisper.cpp/main
#
# Returns:
#   None. Skips if already installed.
#
install_whisper() {
    echo -e "${YELLOW}Installing Whisper.cpp...${NC}"
    
    local WHISPER_DIR="$HOME/.localflow/whisper.cpp"
    
    # Check if already installed
    if [[ -f "$WHISPER_DIR/main" ]] || command -v whisper &> /dev/null; then
        echo -e "${GREEN}Whisper.cpp is already installed${NC}"
        return
    fi
    
    # Install build dependencies
    case $OS in
        macos)
            if command -v brew &> /dev/null; then
                brew install cmake sdl2
            fi
            ;;
        linux)
            sudo apt-get update
            sudo apt-get install -y build-essential cmake libsdl2-dev
            ;;
    esac
    
    # Clone and build
    mkdir -p "$HOME/.localflow"
    git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
    cd "$WHISPER_DIR"
    
    # Build with OpenBLAS for better performance
    make clean
    WHISPER_OPENBLAS=1 make -j
    
    echo -e "${GREEN}Whisper.cpp built successfully${NC}"
    echo "Binary location: $WHISPER_DIR/main"
}

# ============================================================================
# Function: download_whisper_model
# ============================================================================
#
# Downloads a Whisper model file in GGML format.
#
# Uses whisper.cpp's built-in download script if available, otherwise
# downloads directly from HuggingFace. Models are quantized for efficiency.
#
# Key Technologies/APIs:
#   - whisper.cpp download script: Official model downloader
#   - curl: Direct download from HuggingFace
#   - HuggingFace: Model hosting (ggerganov/whisper.cpp)
#
# Environment Variables:
#   WHISPER_MODEL: Model size - tiny, base, small, medium, large (default: small)
#
# Side Effects:
#   - Creates ./models directory
#   - Downloads ~500MB-3GB model file depending on size
#
# Returns:
#   None.
#
download_whisper_model() {
    local MODEL="${WHISPER_MODEL:-small}"
    local MODEL_DIR="./models"
    local WHISPER_DIR="$HOME/.localflow/whisper.cpp"
    
    echo -e "${YELLOW}Downloading Whisper model: $MODEL${NC}"
    
    mkdir -p "$MODEL_DIR"
    
    # Use whisper.cpp's download script if available
    if [[ -f "$WHISPER_DIR/models/download-ggml-model.sh" ]]; then
        cd "$WHISPER_DIR"
        ./models/download-ggml-model.sh "$MODEL"
        
        # Copy to project models directory
        cp "models/ggml-${MODEL}.bin" "$OLDPWD/$MODEL_DIR/" 2>/dev/null || \
        cp "models/ggml-${MODEL}-q5_1.bin" "$OLDPWD/$MODEL_DIR/" 2>/dev/null || true
        
        cd "$OLDPWD"
    else
        # Direct download from HuggingFace as fallback
        local MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL}-q5_1.bin"
        echo "Downloading from $MODEL_URL..."
        curl -L -o "$MODEL_DIR/ggml-${MODEL}-q5_1.bin" "$MODEL_URL"
    fi
    
    echo -e "${GREEN}Whisper model downloaded to $MODEL_DIR${NC}"
}

# ============================================================================
# Function: create_env_file
# ============================================================================
#
# Generates a .env file configured for local processing mode.
#
# Detects installed paths and creates an environment file with
# sensible defaults for local-only operation.
#
# Key Technologies/APIs:
#   - command -v: Find whisper binary location
#   - here document (cat << EOF): Multi-line file generation
#
# Side Effects:
#   - Creates/overwrites .env file in current directory
#
# Returns:
#   None.
#
create_env_file() {
    echo -e "${YELLOW}Creating .env file...${NC}"
    
    local WHISPER_PATH="$HOME/.localflow/whisper.cpp/main"
    local MODEL_PATH="./models/ggml-small-q5_1.bin"
    
    # Check for alternative whisper location
    if command -v whisper &> /dev/null; then
        WHISPER_PATH=$(which whisper)
    fi
    
    # Check for model file
    if [[ -f "./models/ggml-small.bin" ]]; then
        MODEL_PATH="./models/ggml-small.bin"
    fi
    
    # Generate .env file with local configuration
    cat > .env << EOF
# LocalFlow Environment Configuration
# Generated by setup-local.sh

# Processing Mode
PROCESSING_MODE=local

# Whisper.cpp Configuration
WHISPER_PATH=$WHISPER_PATH
WHISPER_MODEL_PATH=$MODEL_PATH
WHISPER_THREADS=4

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TEMPERATURE=0.1

# WebSocket Service
WS_PORT=3002

# Next.js
PORT=3005
EOF

    echo -e "${GREEN}.env file created${NC}"
}

# ============================================================================
# Function: main
# ============================================================================
#
# Main execution flow for full setup.
#
# Guides the user through confirmation and orchestrates the
# installation steps in the correct order.
#
# Returns:
#   None. Exits on user cancellation.
#
main() {
    echo "This script will set up local processing for LocalFlow."
    echo "This includes:"
    echo "  1. Ollama (LLM for text refinement)"
    echo "  2. Whisper.cpp (speech-to-text)"
    echo "  3. Required models"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
    # Exit if user doesn't confirm
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    echo ""
    
    # Run setup steps
    install_ollama
    echo ""
    
    setup_ollama_model
    echo ""
    
    install_whisper
    echo ""
    
    download_whisper_model
    echo ""
    
    create_env_file
    echo ""
    
    # Success message with next steps
    echo "============================================"
    echo -e "${GREEN}Setup Complete!${NC}"
    echo "============================================"
    echo ""
    echo "To start LocalFlow with local processing:"
    echo "  1. Make sure Ollama is running: ollama serve"
    echo "  2. Start the app: bun run dev:all"
    echo ""
    echo "Your .env file has been configured for local mode."
    echo ""
}

# ============================================================================
# Command Line Argument Parsing
# ============================================================================

case "${1:-}" in
    --ollama-only)
        # Install only Ollama and model
        install_ollama
        setup_ollama_model
        ;;
    --whisper-only)
        # Install only Whisper.cpp and model
        install_whisper
        download_whisper_model
        ;;
    *)
        # Default: full setup
        main
        ;;
esac
