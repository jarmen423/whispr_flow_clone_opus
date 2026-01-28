#!/bin/bash
# ============================================
# LocalFlow - Local Processing Setup Script
# ============================================
# This script sets up the local processing components:
# - Whisper.cpp for speech-to-text
# - Ollama for text refinement
# ============================================

set -e

echo "============================================"
echo "LocalFlow Local Processing Setup"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
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

# ============================================
# Install Ollama
# ============================================
install_ollama() {
    echo -e "${YELLOW}Installing Ollama...${NC}"
    
    if command -v ollama &> /dev/null; then
        echo -e "${GREEN}Ollama is already installed${NC}"
        return
    fi
    
    case $OS in
        macos)
            if command -v brew &> /dev/null; then
                brew install ollama
            else
                curl -fsSL https://ollama.ai/install.sh | sh
            fi
            ;;
        linux)
            curl -fsSL https://ollama.ai/install.sh | sh
            ;;
        windows)
            echo "Please download Ollama from: https://ollama.ai/download"
            echo "Then run this script again."
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}Ollama installed successfully${NC}"
}

# ============================================
# Download Ollama Model
# ============================================
setup_ollama_model() {
    local MODEL="${OLLAMA_MODEL:-llama3.2:1b}"
    
    echo -e "${YELLOW}Setting up Ollama model: $MODEL${NC}"
    
    # Start Ollama service if not running
    if ! pgrep -x "ollama" > /dev/null; then
        echo "Starting Ollama service..."
        ollama serve &
        sleep 3
    fi
    
    # Pull the model
    echo "Pulling model $MODEL (this may take a few minutes)..."
    ollama pull $MODEL
    
    echo -e "${GREEN}Model $MODEL ready${NC}"
}

# ============================================
# Install Whisper.cpp
# ============================================
install_whisper() {
    echo -e "${YELLOW}Installing Whisper.cpp...${NC}"
    
    local WHISPER_DIR="$HOME/.localflow/whisper.cpp"
    
    # Check if already installed
    if [[ -f "$WHISPER_DIR/main" ]] || command -v whisper &> /dev/null; then
        echo -e "${GREEN}Whisper.cpp is already installed${NC}"
        return
    fi
    
    # Install dependencies
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

# ============================================
# Download Whisper Model
# ============================================
download_whisper_model() {
    local MODEL="${WHISPER_MODEL:-small}"
    local MODEL_DIR="./models"
    local WHISPER_DIR="$HOME/.localflow/whisper.cpp"
    
    echo -e "${YELLOW}Downloading Whisper model: $MODEL${NC}"
    
    mkdir -p "$MODEL_DIR"
    
    # Use whisper.cpp's download script
    if [[ -f "$WHISPER_DIR/models/download-ggml-model.sh" ]]; then
        cd "$WHISPER_DIR"
        ./models/download-ggml-model.sh "$MODEL"
        
        # Copy to project models directory
        cp "models/ggml-${MODEL}.bin" "$OLDPWD/$MODEL_DIR/" 2>/dev/null || \
        cp "models/ggml-${MODEL}-q5_1.bin" "$OLDPWD/$MODEL_DIR/" 2>/dev/null || true
        
        cd "$OLDPWD"
    else
        # Direct download from HuggingFace
        local MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL}-q5_1.bin"
        echo "Downloading from $MODEL_URL..."
        curl -L -o "$MODEL_DIR/ggml-${MODEL}-q5_1.bin" "$MODEL_URL"
    fi
    
    echo -e "${GREEN}Whisper model downloaded to $MODEL_DIR${NC}"
}

# ============================================
# Create Environment File
# ============================================
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

# ============================================
# Main
# ============================================
main() {
    echo "This script will set up local processing for LocalFlow."
    echo "This includes:"
    echo "  1. Ollama (LLM for text refinement)"
    echo "  2. Whisper.cpp (speech-to-text)"
    echo "  3. Required models"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo
    
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

# Parse arguments
case "${1:-}" in
    --ollama-only)
        install_ollama
        setup_ollama_model
        ;;
    --whisper-only)
        install_whisper
        download_whisper_model
        ;;
    *)
        main
        ;;
esac
