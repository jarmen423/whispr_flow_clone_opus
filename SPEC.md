    # LocalFlow - Complete Engineering Specification
    **Version:** 1.0.0
    **Status:** Production Ready
    **Last Updated:** January 2025
    ---
    ## 1. Project Overview
    ### 1.1 Vision Statement
    LocalFlow is a hybrid cloud/local dictation system that enables users to speak naturally and receive professionally refined text in any application. The system provides flexible processing modes—fast cloud-based processing with usage-based pricing, or completely free local processing with optional offline capability.
    ### 1.2 Core Value Propositions
    - **System-wide dictation**: Works in any application via global hotkey
    - **Dual processing modes**: Switch between cloud (fast) and local (free) instantly
    - **Privacy by design**: Local mode processes all data on user's machine
    - **Developer-focused**: Intelligent refinement of technical terminology and code-related language
    - **Zero friction**: Press hotkey → speak → release → text appears
    - **Cost control**: Users choose per-use billing or free local processing
    ### 1.3 Success Criteria
    - Dictation latency <3 seconds (cloud) or <5 seconds (local)
    - 99%+ transcription accuracy on clear speech
    - System-wide paste reliability >95% across major applications
    - Graceful handling of network failures and offline mode
    - <100MB memory footprint for desktop agent
    - <5% CPU idle usage for WebSocket service
    ---
    ## 2. System Architecture
    ### 2.1 High-Level Architecture

┌─────────────────────────────────────────────────────────────────────────┐│ Client Layer │├─────────────────────────────────────────────────────────────────────────┤│ ││ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐││ │ Web UI │ │ Desktop Agent │ │ Mobile App ││ (Future)│ │ (Browser) │ │ (Python) │ │ (React Native)│││ └──────┬───────┘ └──────┬───────┘ └──────────────┘││ │ │ ││ └────────────┬───────────┘ ││ │ │├──────────────────────▼────────────────────────────────────┤│ WebSocket Service ││ (Port 3001) ││ ││ ┌────────────────────────────────┐ ││ │ Namespace: /agent │◄── Desktop Agents││ │ Namespace: /ui │◄── Web UIs ││ └─────────────┬──────────────┘ ││ │ │├───────────────────────▼───────────────────────────────┤│ Next.js API Layer ││ (Port 3000) ││ ││ ┌────────────────────────────────┐ ││ │ POST /api/dictation/ │ ││ │ - transcribe │ ││ │ - refine │ ││ └─────────────┬────────────────┘ ││ │ │├───────────────────────┼───────────────────────────────┤│ ▼ │ ││ ┌─────────────────┴────────────────────────┐ ││ │ Processing Engine │ ││ │ │ ││ │ ┌──────────┐ ┌──────────┐ │ ││ │ │ Cloud │ │ Local │ │ ││ │ │ z-ai │ │Whisper.cpp │ │ ││ │ │ │ │+ Ollama │ │ ││ │ │ ASR+LLM │ │ │ │ ││ │ └──────────┘ └──────────┘ │ ││ │ │ ││ └───────────────────────────────────────┘ ││ │└───────────────────────────────────────────────────┘

    ### 2.2 Data Flow
    #### Cloud Mode Processing

User speaks (5s)↓[Desktop Agent] records audio (16kHz, mono, 16-bit)↓[Desktop Agent] converts to WAV → base64↓[Desktop Agent] → WebSocket → POST /api/dictation/transcribe (mode=cloud)↓[Next.js] → z-ai-web-dev-sdk ASR → returns text (0.5s)↓[Next.js] → POST /api/dictation/refine (mode=cloud)↓[Next.js] → z-ai-web-dev-sdk LLM → returns refined text (1s)↓[WebSocket] → [Desktop Agent] receives result↓[Desktop Agent] copies to clipboard + sends Ctrl+V↓[Target App] displays textTotal: ~2-3 seconds

    #### Local Mode Processing

User speaks (5s)↓[Desktop Agent] records audio (16kHz, mono, 16-bit)↓[Desktop Agent] converts to WAV → base64↓[Desktop Agent] → WebSocket → POST /api/dictation/transcribe (mode=local)↓[Next.js] saves to temp file → executes whisper.cpp (2s)↓[Next.js] parses output → returns text↓[Next.js] → POST /api/dictation/refine (mode=local)↓[Next.js] → Ollama API (localhost:11434) → returns refined text (2s)↓[WebSocket] → [Desktop Agent] receives result↓[Desktop Agent] copies to clipboard + sends Ctrl+V↓[Target App] displays textTotal: ~4-6 seconds

    ### 2.3 Component Responsibilities
    | Component | Responsibility | Technology |
    |-----------|---------------|------------|
    | **Web UI** | User interface, settings, history display, configuration | Next.js 16, React 19, TypeScript |
    | **WebSocket Service** | Real-time communication, connection management, message routing | Bun, Socket.IO |
    | **Transcribe API** | Audio transcription (cloud/local routing) | Next.js API Route |
    | **Refine API** | Text refinement (cloud/local routing) | Next.js API Route |
    | **Desktop Agent** | Global hotkey, audio recording, system-wide paste | Python 3.7+, pynput, sounddevice |
    | **Cloud Processing** | Fast ASR/LLM via z-ai-web-dev-sdk | z-ai-web-dev-sdk |
    | **Local Processing** | Whisper.cpp transcription + Ollama refinement | Whisper.cpp, Ollama CLI |
    ---
    ## 3. Technology Stack
    ### 3.1 Core Framework
    ```yaml
    Web Framework:
    Name: Next.js
    Version: 16.x
    Router: App Router
    Runtimes: Node.js (Edge support planned)
    Language:
    Name: TypeScript
    Version: 5.9+
    Strict Mode: Enabled

**Rationale:** Next.js 16 provides latest React 19, server components, optimized production builds, and App Router for file-based routing. TypeScript enables type safety across the entire codebase.

### 3.2 Frontend Libraries

    UI Components:
    Library: shadcn/ui
    Base: Radix UI primitives
    Styling: Tailwind CSS 4
    State Management:
    Global: React Hooks (useState, useEffect, useContext)
    WebSocket: Custom hook (useWebSocket)
    Animations:
    Library: Framer Motion
    Use Case: Recording UI, status transitions, hover effects
    Icons:
    Library: Lucide React
    Version: Latest
    Notifications:
    Library: Sonner
    Features: Toasts with auto-dismiss

**Rationale:** shadcn/ui provides accessible, unstyled components with Tailwind CSS integration. Radix UI primitives are production-grade and well-maintained. Framer Motion for performant animations without layout thrashing.

### 3.3 Backend Services

    WebSocket Service:
    Runtime: Bun (for performance)
    Library: Socket.IO 4.8+
    Port: 3001
    Namespaces: /agent, /ui
    API Layer:
    Framework: Next.js API Routes
    Execution: Edge (planned), Node.js (current)
    Cloud Processing:
    SDK: z-ai-web-dev-sdk
    Features: ASR (speech-to-text), LLM (text generation)
    Local Processing:
    Transcription: Whisper.cpp (OpenBLAS build)
    Refinement: Ollama (CLI or API)

**Rationale:** Bun for WebSocket service provides 3x faster startup than Node.js. Socket.IO handles reconnection, namespaces, and binary data efficiently. z-ai-web-dev-sdk provides unified interface for AI capabilities.

### 3.4 Desktop Agent

    Language: Python 3.7+
    Dependencies:
    - pynput (global hotkey listener)
    - sounddevice (audio recording)
    - scipy.io.wavfile (WAV file I/O)
    - python-socketio (WebSocket client)
    - pyperclip (clipboard management)
    - pyautogui (keyboard simulation)
    Audio Configuration:
    Sample Rate: 16kHz
    Channels: 1 (mono)
    Bit Depth: 16-bit PCM
    Format: WAV (native for Whisper.cpp)

**Rationale:** Python has mature libraries for system-level interaction (hotkeys, clipboard, keyboard simulation). 16kHz mono is Whisper.cpp's native format for fastest processing without transcoding.

### 3.5 Development Tools

    Package Manager:
    Primary: Bun
    Fallback: npm
    Code Quality:
    Linter: ESLint 9.x
    Config: eslint-config-next
    Version Control:
    System: Git
    Branching: main, develop, feature/*
    Process:
    Git Flow inspired
    PR Reviews: Required
    CI/CD: GitHub Actions (planned)

* * *

## 4. API Specifications

### 4.1 POST /api/dictation/transcribe

**Purpose:** Transcribe audio to text using either cloud or local processing.**Request:**

    {
    audio: string,      // base64-encoded WAV audio data
    mode: 'cloud' | 'local'  // Processing mode selection
    }

**Success Response:**

    {
    success: true,
    text: string,          // Transcribed text
    wordCount: number,      // Number of words in text
    mode: 'cloud' | 'local', // Echo of mode used
    processingTime?: number // Cloud-only: ms to process
    }

**Error Response:**

    {
    error: string,                    // Error message
    details: string,                 // Detailed error info
    mode: 'cloud' | 'local'      // Mode attempted
    }

**HTTP Status Codes:**

* `200 OK`: Successful transcription
* `400 Bad Request`: Missing audio, invalid mode
* `500 Internal Server Error`: Processing failure**Processing Logic:****Cloud Mode:**```typescript

1. Decode base64 to binary buffer
2. Initialize z-ai-web-dev-sdk
3. Call zai.audio.asr.create({ file_base64: audio })
4. Extract text from response
5. Validate text is not empty
6. Return result``` **Local Mode:** ```typescript
7. Decode base64 to binary buffer
8. Write to temporary WAV file in /tmp/localflow/
9. Verify Whisper.cpp binary exists at WHISPER_PATH
10. Verify model file exists at WHISPER_MODEL_PATH
11. Execute: whisper -m MODEL -f INPUT.wav -nt 4 -otxt
12. Read OUTPUT.txt (created by whisper.cpp)
13. Clean up temporary files
14. Return result```**Error Handling:**

* Whisper binary not found: Return 500 with clear setup instructions
* Model file not found: Return 500 with download link
* Execution timeout (60s): Return 500 with timeout message
* Empty transcription: Return 400 with "No speech detected"
  
  ### 4.2 POST /api/dictation/refine
  
  **Purpose:** Refine transcribed text using LLM.**Request:**
  
      {
      text: string,                 // Raw transcribed text
      mode: 'developer' | 'concise' | 'professional' | 'raw',
      processingMode: 'cloud' | 'local'
      }
  
  **Success Response:**
  
      {
      success: true,
      refinedText: string,    // Processed text
      originalWordCount: number, // Words in input
      refinedWordCount: number,  // Words in output
      processingMode: 'cloud' | 'local'
      }
  
  **Error Response:**
  
      {
      error: string,
      details: string,
      processingMode: 'cloud' | 'local'
      }
  
  **System Prompts:****Developer Mode:**```You are a helpful assistant that acts as a dictation correction tool for developers. I will provide a raw transcript. You must:

1. Correct grammar and punctuation
2. Remove filler words (um, uh, like, you know)
3. Format technical terms correctly (e.g., 'git commit' instead of 'get commit', 'npm install' instead of 'n p m install')
4. Keep the same tone and voice as the original
5. Preserve code references and technical concepts accurately
6. Do not add any conversational filler like 'Here is the text'
7. Output ONLY the cleaned text, nothing else.
  
      **Concise Mode:**
  
  You are a helpful assistant that acts as a dictation simplification tool. I will provide a raw transcript. You must:
8. Remove all filler words (um, uh, like, you know, ah, hmm)
9. Shorten and simplify the text while keeping the meaning
10. Remove redundancies and repetition
11. Use clear, direct language
12. Do not add any conversational filler like 'Here is the text'
13. Output ONLY the cleaned text, nothing else.
  
      **Professional Mode:**
  
  You are a helpful assistant that acts as a dictation refinement tool. I will provide a raw transcript. You must:
14. Correct all grammar and punctuation
15. Remove filler words (um, uh, like, you know)
16. Transform casual language into professional, business-appropriate language
17. Maintain a formal yet natural tone
18. Ensure clear, concise communication
19. Do not add any conversational filler like 'Here is the text'
20. Output ONLY the cleaned text, nothing else.```**Raw Mode:**

* Returns input text unchanged
* No LLM call made**Processing Logic:****Cloud Mode:**```typescript

1. Select system prompt based on mode
2. Initialize z-ai-web-dev-sdk
3. Call zai.chat.completions.create({messages: [{ role: 'assistant', content: systemPrompt },{ role: 'user', content: text }],thinking: { type: 'disabled' }})
4. Extract refinedText from response
5. Return result``` **Local Mode:** ```typescript
6. Select system prompt based on mode
7. Call Ollama API: POST /api/generate{model: OLLAMA_MODEL,prompt: `${systemPrompt}${text}`,stream: false,options: { temperature: 0.1, top_p: 0.9 }}
8. Parse response JSON
9. Extract refinedText from response
10. Return result```**Error Handling:**

* Ollama not running: Return 500 with start instructions
* Model not available: Return 500 with pull command
* Request timeout (30s): Return 500 with timeout message
* Empty response: Return 500 with "Failed to refine text"

* * *

## 5. WebSocket Protocol

### 5.1 Connection Details

    WebSocket Server: ws://localhost:3001
    Namespaces:
    /agent  - Desktop agent connections
    /ui     - Web UI connections

### 5.2 Message Types

#### Agent → Server

**ping** (Heartbeat)

    {
    type: 'ping'
    }

Sent every 5 seconds to maintain connection.**process_audio** (Dictation request)

    {
    type: 'process_audio',
    audio: string,           // base64-encoded WAV
    mode: string,            // 'developer' | 'concise' | 'professional' | 'raw'
    timestamp: number          // Unix timestamp (ms)
    }

**recording_started** (Notification)

    {
    type: 'recording_started',
    timestamp: number
    }

Sent when agent starts recording audio.

#### Server → Agent

**connection_confirmed**

    {
    type: 'connection_confirmed',
    serverTime: number
    }

Sent immediately upon successful connection.**dictation_result** (Processing response)

    {
    type: 'dictation_result',
    originalText: string,
    refinedText: string,
    success: boolean,
    wordCount: number,
    processingTime: number
    }

**settings_update**

    {
    type: 'settings_update',
    hotkey: string,      // 'alt+v' | 'ctrl+v' | 'cmd+shift+v'
    mode: string         // Refinement mode
    }

Broadcast from web UI when settings change.

#### Server → UI

**agent_status**

    {
    type: 'agent_status',
    online: boolean,
    lastActivity: number,
    agentId?: string
    }

Broadcast when agent connects/disconnects/heartbeat.**update** (Live activity)

    // Dictation complete
    {
    type: 'dictation_complete',
    text: string,
    mode: string,
    timestamp: number,
    wordCount: number
    }
    // Recording started
    {
    type: 'recording_started',
    timestamp: number
    }

### 5.3 Connection Management

**Connection Lifecycle:**

    1. Client connects to appropriate namespace
    2. Server acknowledges connection
    3. Server sends current state (agent_status to UI)
    4. Client registers event handlers
    5. Agent starts heartbeat (5s interval)
    6. Server tracks lastActivity timestamp
    7. Server detects stale connections (>30s heartbeat)
    8. Server disconnects stale clients
    9. Client auto-reconnects on disconnect

**Stale Detection:**

    const STALE_THRESHOLD = 30000 // 30 seconds
    setInterval(() => {
    const now = Date.now()
    for (const [agentId, agent] of connectedAgents) {
    if (now - agent.lastActivity > STALE_THRESHOLD) {
    agent.socket.disconnect()
    connectedAgents.delete(agentId)
    broadcastAgentStatus(false)
    }
    }
    }, 10000) // Check every 10 seconds

* * *

## 6. Database Schema

### 6.1 Storage Strategy

**Local Storage (Browser):**

    // Stored in localStorage
    interface LocalStorage {
    'localflow-history': DictationItem[],
    'localflow-settings': Settings
    }
    interface DictationItem {
    id: string,              // Timestamp-based unique ID
    originalText: string,
    refinedText: string,
    timestamp: Date,
    duration: number,          // Recording duration in seconds
    mode: string              // 'developer' | 'concise' | 'professional' | 'raw'
    }
    interface Settings {
    hotkey: string,            // 'alt+v' | 'ctrl+v' | 'cmd+shift+v'
    refinementMode: string,     // 'developer' | 'concise' | 'professional' | 'raw'
    processingMode: 'cloud' | 'local',
    autoCopy: boolean,
    soundEnabled: boolean
    }

**Temporary Files (Server):**

    /tmp/localflow/
    ├── audio_*.wav          // Temporary audio files
    └── audio_*.txt          // Whisper.cpp output (auto-deleted)

**No Persistent Database:**

* All data stored client-side
* No server-side persistence
* Privacy-first design
* State is ephemeral across sessions**Rationale:** Dictation data is personal and transient. No need for server-side database. Reduces infrastructure, complexity, and privacy concerns.

* * *

## 7. Component Specifications

### 7.1 Web UI (src/app/page.tsx)

**Responsibilities:**

* Recording interface with audio visualization
* Real-time WebSocket connection status
* Settings management (modal interface)
* History display with search/filter (future)
* Live activity feed from agent dictations
* Clipboard copy functionality
* Audio level meter with animated bars**Key States:**
  
      interface LocalFlowState {
      isRecording: boolean,
      recordingTime: number,        // Seconds elapsed
      originalText: string,
      refinedText: string,
      isProcessing: boolean,        // API calls in progress
      audioLevel: number,           // 0-1 range
      history: DictationItem[],
      settings: Settings,
      selectedHistoryItem: DictationItem | null,
      liveActivities: LiveActivity[]
      }
  
  **Critical Methods:**
  
      class LocalFlow {
      // Audio Recording
      startRecording(): Promise<void>
      stopRecording(): void
      updateAudioLevel(): void
      // Processing
      processRecording(audioBlob: Blob): Promise<void>
      // UI Actions
      copyToClipboard(text: string): Promise<void>
      selectHistoryItem(item: DictationItem): void
      downloadAgent(): void
      // Settings
      updateSettings(newSettings: Partial<Settings>): void
      }
  
  ### 7.2 WebSocket Hook (src/hooks/use-websocket.ts)
  
  **Responsibilities:**
* Establish WebSocket connection to /ui namespace
* Handle connection lifecycle
* Receive and dispatch agent_status updates
* Receive and dispatch live activity updates
* Send settings updates to server
* Handle reconnection logic**Interface:**
  
      interface UseWebSocketReturn {
      socket: Socket | null,
      status: WebSocketStatus,
      liveActivities: LiveActivity[],
      sendSettings: (settings: SettingsUpdate) => void
      }
      interface WebSocketStatus {
      connected: boolean,
      online: boolean,
      lastActivity: number,
      agentId?: string
      }
  
  ### 7.3 Desktop Agent (agent/localflow-agent.py)
  
  **Responsibilities:**
* Global hotkey detection (Alt+V default)
* Audio recording (16kHz, mono)
* WebSocket connection management
* Audio → base64 encoding
* System-wide paste simulation
* Heartbeat maintenance
* Graceful shutdown**Class Structure:**
  
      class LocalFlowAgent:
      def __init__(self):
      # Initialize socket client
      # Setup audio recording
      # Configure hotkey listener
      def on_connect(self):
      # Log successful connection
      def on_disconnect(self):
      # Log disconnection
      # Attempt reconnection
      def on_dictation_result(self, data):
      # Copy to clipboard
      # Simulate paste (Ctrl+V / Cmd+V)
      # Log completion
      def start_recording(self):
      # Begin audio capture
      # Log start time
      def stop_recording(self):
      # End audio capture
      # Encode to base64
      # Send via WebSocket
      # Log stop time
      def audio_callback(self, indata, frames, time_info, status):
      # Capture audio samples
      # Handle errors
      def send_heartbeat(self):
      # Periodic ping every 5s
      def run(self):
      # Connect to WebSocket
      # Start audio stream
      # Start hotkey listener
      # Start heartbeat thread
      # Maintain event loop
  
  ### 7.4 WebSocket Service (mini-services/websocket-service/index.ts)
  
  **Responsibilities:**
* Serve Socket.IO on port 3001
* Manage /agent namespace connections
* Manage /ui namespace connections
* Route messages between namespaces
* Broadcast status updates
* Detect and cleanup stale connections
* Handle API requests for dictation**Core Functions:**
  
      class WebSocketService {
      // Connection Management
      handleAgentConnection(socket: Socket): void
      handleUIConnection(socket: Socket): void
      handleDisconnection(socket: Socket, namespace: string): void
      // Message Routing
      handleProcessAudio(socket: Socket,  ProcessAudioMessage): Promise<void>
      broadcastAgentStatus(online: boolean): void
      broadcastToUI( LiveActivity): void
      // Health Management
      startHeartbeatCheck(): void
      cleanupStaleConnections(): void
      }
  

* * *

## 8. Environment Configuration

### 8.1 Environment Variables

    # Processing Mode Selection
    PROCESSING_MODE=cloud  # 'cloud' | 'local'
    # Local Transcription (Whisper.cpp)
    WHISPER_PATH=/usr/local/bin/whisper
    WHISPER_MODEL_PATH=./models/ggml-small-q5_1.bin  # Corrected filename
    # Local Refinement (Ollama)
    OLLAMA_URL=http://localhost:11434
    OLLAMA_MODEL=llama3.2:1b

### 8.2 Configuration Validation

**Startup Checks:**

    // In transcribe route
    if (mode === 'local') {
    if (!existsSync(WHISPER_PATH)) {
    throw new Error(
    `Whisper binary not found at ${WHISPER_PATH}. ` +
    `Install: https://github.com/ggerganov/whisper.cpp/releases`
    )
    }
    if (!existsSync(WHISPER_MODEL_PATH)) {
    throw new Error(
    `Whisper model not found at ${WHISPER_MODEL_PATH}. ` +
    `Download: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin`
    )
    }
    }
    // In refine route
    if (processingMode === 'local') {
    // Test Ollama connection
    try {
    await fetch(`${OLLAMA_URL}/api/tags`, { timeout: 5000 })
    } catch {
    throw new Error(
    `Ollama not running at ${OLLAMA_URL}. ` +
    `Start with: ollama serve`
    )
    }
    }

* * *

## 9. Deployment Strategy

### 9.1 Development Environment

    Services:
    Next.js App: Port 3000 (auto-restart)
    WebSocket Service: Port 3001 (auto-restart)
    Development Tools:
    Hot Reload: Enabled for Next.js and Bun
    Linting: On-save with ESLint
    Logging: Console + file (dev.log, /tmp/websocket.log)
    Environment:
    Node Version: 20.x (via Bun)
    TypeScript: Strict mode
    Tailwind: JIT compilation

### 9.2 Production Environment

**Platform Options:****Option A: Single Server Deployment**

    Server:
    Type: VPS or bare metal
    OS: Ubuntu 22.04 LTS or newer
    CPU: 4+ cores
    RAM: 8GB+ recommended
    Services:
    - Next.js App (PM2 or systemd)
    - WebSocket Service (PM2 or systemd)
    Reverse Proxy:
    - Caddy (configured via Caddyfile)
    - Nginx (alternative)
    SSL:
    - Let's Encrypt (automatic)
    - Cloud provider SSL (alternative)

**Option B: Cloud Platform Deployment**

    Platform: Vercel
    - Next.js: Automatic deployment
    - WebSocket: Not supported, need external
    Platform: Railway / Fly.io
    - Next.js: Supported
    - WebSocket: Supported
    - Docker containerization required

**Option C: Docker Deployment**

    # Dockerfile (Next.js app + WebSocket)
    FROM oven/bun:1
    WORKDIR /app
    COPY package*.json ./
    RUN bun install
    COPY . .
    RUN bun run build
    EXPOSE 3000 3001
    CMD ["bun", "run", "start"]

**Option D: User Self-Hosted**

    # User runs on their own machine
    cd my-project
    bun install
    bun run dev    # For development
    bun run build  # For production
    bun run start  # Start production server

### 9.3 Process Management

**Production Deployment (PM2):**

    // ecosystem.config.js
    module.exports = {
    apps: [
    {
    name: 'localflow-app',
    script: './.next/standalone/server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
    NODE_ENV: 'production',
    PORT: 3000
    },
    error_file: './logs/app-error.log',
    out_file: './logs/app-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
    name: 'localflow-websocket',
    script: './mini-services/websocket-service/index.ts',
    instances: 1,
    interpreter: 'bun',
    env: {
    NODE_ENV: 'production',
    PORT: 3001
    },
    error_file: './logs/ws-error.log',
    out_file: './logs/ws-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
    ]
    }

**Systemd Service (Linux):**

    # /etc/systemd/system/localflow-app.service
    [Unit]
    Description=LocalFlow Next.js Application
    After=network.target
    [Service]
    Type=simple
    User=www-data
    WorkingDirectory=/var/www/localflow
    ExecStart=/usr/bin/bun run start
    Restart=on-failure
    RestartSec=10
    [Install]
    WantedBy=multi-user.target

* * *

## 10. Testing Strategy

### 10.1 Unit Testing

**Test Framework: Vitest**Coverage Goals:**

* API Routes: 80%+ coverage
* WebSocket Service: 70%+ coverage
* React Components: 80%+ coverage
* Desktop Agent: 60%+ coverage (limited by system dependencies)**Example Tests:**
  
      // transcribe.route.test.ts
      describe('POST /api/dictation/transcribe', () => {
      it('should transcribe audio in cloud mode', async () => {
      const mockZAI = {
      create: vi.fn().mockResolvedValue({
      audio: { asr: { create: vi.fn() } }
      })
      }
      const response = await POST('/api/dictation/transcribe', {
      audio: 'base64_audio',
      mode: 'cloud'
      })
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.text).toBeDefined()
      })
      it('should return error for missing audio', async () => {
      const response = await POST('/api/dictation/transcribe', {})
      expect(response.status).toBe(400)
      expect(response.body.error).toContain('required')
      })
      it('should handle local mode with Whisper.cpp', async () => {
      // Mock file system and child_process.exec
      // Test whisper binary execution
      // Test output file parsing
      // Test cleanup
      })
      })
  
  ### 10.2 Integration Testing
  
  **Test Scenarios:**

1. **Full Dictation Flow (Cloud Mode)**

* Start recording
* Speak 5-second phrase
* Stop recording
* Receive transcription
* Receive refinement
* Copy to clipboard
* Paste in test application

2. **Full Dictation Flow (Local Mode)**

* Start Ollama server
* Start recording
* Speak 5-second phrase
* Stop recording
* Verify Whisper.cpp execution
* Verify Ollama API call
* Receive refinement
* Copy to clipboard
* Paste in test application

3. **WebSocket Reconnection**

* Agent connects
* Server crashes
* Agent auto-reconnects
* Agent resumes dictation

4. **Mode Switching**

* Dictate in cloud mode
* Switch to local mode in settings
* Dictate again
* Verify local processing used
* Switch back to cloud mode

5. **Concurrent Agents**

* Start two desktop agents
* Both connect
* Server tracks both
* Status broadcast to UI shows both

6. **Stale Connection Detection**

* Agent connects
* Stop heartbeat
* Wait 35 seconds
* Verify server disconnects agent
* Verify UI shows offline status
  
  ### 10.3 End-to-End Testing
  
  **Test Environments:****Windows 11:**
* VS Code integration
* Notion integration
* Slack integration
* Terminal integration**macOS:**
* VS Code integration
* Notes app integration
* Messages app integration**Linux:**
* VS Code integration
* Terminal integration
* LibreOffice Writer integration**Test Cases:**
  
      Test Case 1: Technical Term Refinement
      Input: "I need to run get commit"
      Expected: "I need to run git commit"
      Test Case 2: Filler Word Removal
      Input: "I was like you know working on the code"
      Expected: "I was working on the code"
      Test Case 3: Professional Refinement
      Input: "gonna do some stuff with the api"
      Expected: "I'm going to work with the API"
      Test Case 4: Code Context Preservation
      Input: "Create a function that takes x and y and returns x plus y"
      Expected: "Create a function that takes x and y and returns x plus y"
      Test Case 5: Punctuation Correction
      Input: "hello world how are you"
      Expected: "Hello, world. How are you?"
  

* * *

## 11. Performance Requirements

### 11.1 Latency Targets

| Operation | Target | Maximum |
| --- | --- | --- |
| WebSocket Connect | <500ms | <2s |
| Audio Recording Start | <100ms | <500ms |
| Cloud Transcription (5s audio) | <800ms | <3s |
| Cloud Refinement (30 words) | <500ms | <2s |
| Local Transcription (5s audio) | <2s | <5s |
| Local Refinement (30 words) | <2s | <5s |
| End-to-End (Cloud) | <1.5s | <5s |
| End-to-End (Local) | <4s | <8s |

### 11.2 Resource Limits

**Desktop Agent:**

    Memory:
    Target: <50MB idle
    Maximum: <200MB during dictation
    CPU:
    Idle: <1%
    Recording: <5%
    Processing: <20%
    Audio:
    Buffer: 5 seconds (80KB)
    Sample Rate: 16kHz
    Latency: <100ms

**WebSocket Service:**

    Memory:
    Target: <30MB per connection
    Maximum: <500MB total
    CPU:
    Idle: <1%
    Per Message: <5%
    Connections:
    Maximum: 100 concurrent
    Default: 10 per namespace

**Next.js App:**

    Memory:
    Target: <100MB per session
    Maximum: <500MB total
    Response Time:
    Static: <50ms (cached)
    API: <200ms average
    Bundle Size:
    Initial: <300KB gzipped
    Route-based: <100KB each

### 11.3 Throughput Targets

    WebSocket Service:
    Messages/sec: >1000
    Broadcast Latency: <10ms
    Concurrent Connections: >50
    API Routes:
    Requests/sec: >100
    Error Rate: <1%
    Timeout Rate: <0.1%
    Desktop Agent:
    Dictations/min: >30
    Hotkey Latency: <50ms
    Paste Success Rate: >95%

* * *

## 12. Security Considerations

### 12.1 Threat Model

| Threat | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Audio interception | Low | High | Local processing option |
| WebSocket MITM | Low | High | WSS + origin validation |
| Paste injection | Medium | Medium | Clipboard validation |
| Stored data leak | Low | High | No server storage |
| API key exposure | Low | Critical | Server-side only, environment vars |
| Malicious agent | Low | High | Connection limits, rate limiting |
| Local escalation | Low | High | Isolate desktop agent |

### 12.2 Security Measures

**WebSocket Security:**

    // Enable only secure transports
    const io = new Server(httpServer, {
    cors: {
    origin: process.env.ALLOWED_ORIGINS || '*',
    credentials: true
    },
    transports: ['websocket']  // No polling
    maxHttpBufferSize: 1e6  // 1MB max message size
    })
    // Rate limiting per agent
    const agentMessageLimiter = new Map<string, number[]>()
    function checkRateLimit(agentId: string): boolean {
    const timestamps = agentMessageLimiter.get(agentId) || []
    const recent = timestamps.filter(t => Date.now() - t < 60000)
    return recent.length < 30  // Max 30 messages per minute
    }

**API Security:**

    // Input validation
    function validateAudioInput(data: any): data is TranscribeRequest {
    if (!data.audio || typeof data.audio !== 'string') {
    throw new Error('Invalid audio data')
    }
    if (!data.mode || !['cloud', 'local'].includes(data.mode)) {
    throw new Error('Invalid processing mode')
    }
    if (data.audio.length > 5_000_000) {  // ~25MB
    throw new Error('Audio too large')
    }
    return data
    }
    // Output sanitization
    function sanitizeOutput(text: string): string {
    // Limit length
    if (text.length > 10000) {
    return text.substring(0, 10000)
    }
    // Remove potential malicious content
    return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    }

**Desktop Agent Security:**

    # Validate WebSocket URL
    if not WEBSOCKET_URL.startswith(('ws://', 'wss://')):
    raise ValueError("Invalid WebSocket URL")
    # Sanitize audio file paths
    import os
    TEMP_DIR = os.path.join(tempfile.gettempdir(), 'localflow')
    TEMP_DIR = os.path.abspath(TEMP_DIR)  # Prevent path traversal
    # Limit paste operations
    PASTE_COOLDOWN = 0.1  # 100ms between pastes

**Environment Variable Security:**

    # Never commit .env file
    .env
    .env.local
    .env.production
    # Use .env.example for documentation
    .env.example
    # Validate in production
    if [ -z "$PROCESSING_MODE" ]; then
    echo "ERROR: PROCESSING_MODE must be set"
    exit 1
    fi

* * *

## 13. Scalability Plans

### 13.1 Current Architecture Limits

| Component | Current Limit | Bottleneck |
| --- | --- | --- |
| WebSocket Service | 100 concurrent | Memory |
| Next.js API | Server CPU | Request processing |
| Desktop Agent | 1 per machine | System resources |
| Local Processing | Whisper CPU | Transcription speed |

### 13.2 Scaling Strategy

**Horizontal Scaling (Cloud Mode):**

    WebSocket Service:
    - Load balance across multiple instances
    - Sticky sessions for agent reconnection
    - Redis pub/sub for cross-server messaging
    Next.js API:
    - Edge runtime for global distribution
    - CDN caching for static assets
    - Regional API endpoints
    Database (future):
    - Add PostgreSQL for user accounts
    - Store usage history
    - Enable analytics

**Vertical Scaling (Local Mode):**

    Desktop Agent:
    - Multi-threading for audio capture
    - Asynchronous processing
    - GPU acceleration (optional)
    Whisper.cpp:
    - Use quantized models (q5_1, q8_0)
    - Increase thread count for multi-core
    - Batch processing for longer audio
    Ollama:
    - Use smaller models for speed
    - Cache common phrases
    - Context window optimization

**Caching Strategy:**

    // API-level caching
    const transcriptionCache = new LRUCache<string, string>({
    max: 1000,
    ttl: 3600000  // 1 hour
    })
    // Check cache before processing
    const cached = transcriptionCache.get(audioHash)
    if (cached) {
    return { text: cached, cached: true }
    }
    // Common phrase caching (LLM)
    const phraseCache = new Map<string, string>()
    phraseCache.set('git commit', 'git commit')  // Pre-seed common technical terms

* * *

## 14. Monitoring and Observability

### 14.1 Metrics to Track

**Application Metrics:**

    interface Metrics {
    // Business Metrics
    dictations_total: number,
    dictations_cloud_mode: number,
    dictations_local_mode: number,
    dictations_per_minute: number,
    // Performance Metrics
    avg_transcription_time_ms: number,
    avg_refinement_time_ms: number,
    p95_latency_ms: number,
    p99_latency_ms: number,
    // Reliability Metrics
    websocket_connection_success_rate: number,
    paste_success_rate: number,
    transcription_error_rate: number,
    // Resource Metrics
    websocket_memory_mb: number,
    desktop_agent_memory_mb: number,
    active_connections: number
    }

**Health Checks:**

    // GET /health
    {
    status: 'healthy',
    version: '1.0.0',
    services: {
    websocket: 'running',
    api: 'running',
    cloud_processing: 'available',
    local_processing: process.env.PROCESSING_MODE === 'local' ? 'available' : 'disabled'
    },
    uptime: number,  // Seconds since start
    connections: {
    agents: number,
    ui_clients: number
    }
    }

### 14.2 Logging Strategy

**Log Levels:**

    enum LogLevel {
    ERROR = 0,  // System errors, failures
    WARN = 1,   // Degradation, recoverable issues
    INFO = 2,   // Normal operations, state changes
    DEBUG = 3   // Detailed execution flow
    }

**Structured Logging:**

    interface LogEntry {
    timestamp: number,
    level: LogLevel,
    service: 'websocket' | 'api' | 'agent',
    message: string,
    data?: any,
    error?: Error
    }
    // Example
    logger.info('agent_connected', {
    agentId: 'socket_abc123',
    mode: 'cloud'
    })

**Log Retention:**

    Development:
    - Console output
    - File logging (dev.log)
    - No retention limit
    Production:
    - Console (warn+ only)
    - File logging (app.log, error.log)
    - 30-day rotation
    - External aggregation (future)

### 14.3 Alerting

**Alert Conditions:**

    // Critical alerts (immediate notification)
    if (errorRate > 0.05) {
    sendPagerDutyAlert('High error rate detected')
    }
    if (activeConnections === 0 && uptime > 60) {
    sendSlackAlert('No active connections for 1 minute')
    }
    if (desktopAgentMemory > 200) {
    sendEmailAlert('Desktop agent memory leak detected')
    }
    // Warning alerts (hourly digest)
    if (avgLatency > 5000) {
    queueWarningAlert('High latency detected')
    }

* * *

## 15. Documentation Requirements

### 15.1 User Documentation

**End-User Documentation:**

* [ ] Quick Start Guide
* [ ] Installation Instructions (Windows/macOS/Linux)
* [ ] Cloud vs Local Mode Comparison
* [ ] Local Setup Guide (Whisper.cpp + Ollama)
* [ ] Troubleshooting FAQ
* [ ] Keyboard Shortcuts Reference
* [ ] Settings Explained
* [ ] Privacy Policy
  
  ### 15.2 Developer Documentation
  
  **Technical Documentation:**
* [ ] Architecture Overview
* [ ] API Reference
* [ ] WebSocket Protocol
* [ ] Component Documentation
* [ ] Environment Configuration
* [ ] Deployment Guide
* [ ] Testing Guide
* [ ] Contributing Guidelines
* [ ] Code Style Guide
  
  ### 15.3 Code Documentation
  
  **Inline Comments:**```typescript/**

* Transcribes audio using either cloud or local processing.

* @param audio - Base64-encoded WAV audio data
* @param mode - 'cloud' for z-ai SDK, 'local' for Whisper.cpp
* @returns Transcription result with text and metadata

* @throws {Error} If audio is invalid or processing fails

* @example
* const result = await transcribe(audioBase64, 'cloud')
* console.log(result.text) // "Hello world"*/async function transcribe(audio: string, mode: 'cloud' | 'local'): Promise<TranscribeResult>``` **TypeScript JSDoc:** ```typescript/**
* WebSocket connection hook for managing real-time communication

* @returns Object containing socket, connection status, live activities, and send function*/export function useWebSocket(): UseWebSocketReturn
  

* * *

## 16. Cost Analysis

### 16.1 Development Costs

**Infrastructure (Monthly):**

    Development:
    - VPS (4GB RAM): $10-20
    - Domain: $10-12/year
    - SSL: $0 (Let's Encrypt)
    Production (self-hosted):
    - VPS (8GB RAM): $20-40
    - Domain: $10-12/year
    - SSL: $0 (Let's Encrypt)
    - Backup: $5-10
    Cloud Platform (Vercel/Railway):
    - Free tier: $0 (limited)
    - Pro tier: $20-40 (generous limits)

### 16.2 User Costs

**Cloud Mode:**

    Usage-Based Pricing (estimated):
    - Transcription: $0.005/min (~$0.25 per 50 dictations)
    - LLM Refinement: $0.001/1K tokens (~$0.10 per 50 dictations)
    - Total (typical user): $1-4/month
    - Total (power user): $10-20/month
    Factors:
    - Dictation length (more words = higher cost)
    - Refinement mode (developer/professional = more tokens)
    - Frequency of use

**Local Mode:**

    One-Time Setup Costs:
    - No monetary cost
    - Time: 1-2 hours for initial setup
    - Hardware: i5+/8GB RAM recommended
    Recurring Costs:
    - $0 forever
    - Electricity: Negligible
    - Internet: Not required

### 16.3 Cost Optimization

**User-Facing Optimizations:**

    // Smart mode switching
    interface SmartModeConfig {
    userBudget: number,        // Monthly budget in USD
    currentSpend: number,     // Current month spend
    autoSwitchThreshold: number  // Switch to local at X% of budget
    }
    function recommendProcessingMode(config: SmartModeConfig): 'cloud' | 'local' {
    if (config.currentSpend >= config.autoSwitchThreshold * config.userBudget) {
    return 'local'  // Auto-switch to free mode
    }
    return 'cloud'
    }

**Server-Side Optimizations:**

    // Request batching
    const batchBuffer: DictationRequest[] = []
    setInterval(() => {
    if (batchBuffer.length >= 10) {
    processBatch(batchBuffer)
    batchBuffer.length = 0
    }
    }, 1000)  // Process every second
    // Response compression
    import { gzip } from 'zlib'
    function compressResponse(data: any): Buffer {
    return gzip(JSON.stringify(data))
    }

* * *

## 17. Development Workflow

### 17.1 Git Workflow

**Branch Strategy:**

    main
    ↑
    develop
    ↑
    feature/dictation-local-mode
    feature/websocket-reconnection
    feature/ui-redesign
    hotfix/clipboard-paste-failure

**Commit Message Format:**

    <type>(<scope>): <subject>
    <body>
    <footer>
    Types:
    feat: New feature
    fix: Bug fix
    docs: Documentation changes
    style: Code style changes
    refactor: Code refactoring
    perf: Performance improvements
    test: Adding tests
    chore: Build process or tooling
    Example:
    feat(api): add local mode support for transcribe route
    - Add Whisper.cpp integration
    - Add model path validation
    - Add temporary file management
    - Update error handling
    Closes #123

### 17.2 Code Review Checklist

**Pre-Merge Requirements:**

* [ ] All tests passing
* [ ] ESLint warnings <5
* [ ] TypeScript strict mode compliance
* [ ] Documentation updated
* [ ] Performance regression check
* [ ] Security review completed
* [ ] Backward compatibility maintained**Code Review Criteria:**
* [ ] Follows code style guide
* [ ] Adequate test coverage
* [ ] No security vulnerabilities
* [ ] No performance degradation
* [ ] Clear, documented APIs
* [ ] Error handling complete
  
  ### 17.3 CI/CD Pipeline
  
  **GitHub Actions Workflow:**```yamlname: LocalFlow CIon: [push, pull_request]jobs:test:runs-on: ubuntu-lateststeps:

* Checkout code
* Install Bun
* Install dependencies
* Run linter
* Run unit tests
* Run integration tests
* Upload coveragebuild:needs: testruns-on: ubuntu-lateststeps:
* Checkout code
* Install Bun
* Install dependencies
* Build Next.js app
* Test production builddeploy:needs: buildif: github.ref == 'refs/heads/main'runs-on: ubuntu-lateststeps:
* Deploy to production
* Run smoke tests
* Notify team
  

* * *

## 18. Release Process

### 18.1 Versioning

**Semantic Versioning:**

    MAJOR.MINOR.PATCH
    MAJOR: Breaking changes, architecture updates
    MINOR: New features, backward compatible
    PATCH: Bug fixes, minor improvements
    Examples:
    1.0.0 → Initial release
    1.1.0 → Add local mode support
    1.1.1 → Fix WebSocket reconnection
    2.0.0 → New WebSocket protocol

### 18.2 Release Checklist

**Pre-Release:**

* [ ] All critical bugs fixed
* [ ] Performance benchmarks met
* [ ] Security audit passed
* [ ] Documentation complete
* [ ] CHANGELOG.md updated
* [ ] Version number updated**Release Day:**
* [ ] Create Git tag
* [ ] Build production artifacts
* [ ] Deploy to staging
* [ ] Run smoke tests
* [ ] Deploy to production
* [ ] Verify health checks
* [ ] Monitor for issues**Post-Release:**
* [ ] Monitor error rates
* [ ] Review user feedback
* [ ] Address critical bugs immediately
* [ ] Plan next release
  
  ### 18.3 Change Log Format
  
  ```markdown
  
  ## [1.1.0] - 2025-01-27
  
  ### Added
  

* Hybrid cloud/local processing mode
* Local transcription via Whisper.cpp
* Local refinement via Ollama
* Processing mode selector in UI
* Environment configuration support
* Complete local setup guide
  
  ### Changed
  
* Refactored transcribe route for dual-mode support
* Refactored refine route for dual-mode support
* Updated WebSocket protocol to include mode info
* Improved error messages for local mode setup
  
  ### Fixed
  
* WebSocket connection stability
* Memory leak in desktop agent
* File cleanup for temporary files
  
  ### Security
  
* Input validation for all APIs
* Sanitization of WebSocket messages
* Path traversal prevention in temp files
  

* * *

## 19. Future Enhancements

### 19.1 Planned Features (Q2 2025)

**Phase 1: Enhanced Experience**

* [ ] Per-dictation mode selection (cloud for meetings, local for coding)
* [ ] Voice activity detection (auto-stop on silence)
* [ ] Noise suppression for local transcription
* [ ] Custom system prompts for LLM refinement
* [ ] Multi-language support (local mode)**Phase 2: Platform Expansion**
* [ ] Mobile app (React Native) with push-to-talk
* [ ] Browser extension (Chrome/Firefox)
* [ ] CLI tool for terminal-only dictation
* [ ] Obsidian plugin
* [ ] VS Code extension**Phase 3: Advanced Features**
* [ ] User accounts and synchronization
* [ ] Usage analytics dashboard
* [ ] Custom vocabulary management
* [ ] Team collaboration (shared dictations)
* [ ] API for third-party integrations
  
  ### 19.2 Technology Evolution
  
  **Near-Term:**

* Edge runtime for API routes (global distribution)
* WebAssembly for desktop agent (portability)
* WebGPU for local processing (faster inference)**Long-Term:**
* Federated learning for personalized models
* On-device fine-tuning
* Speech-to-text directly in browser (Web Speech API with LLM fallback)

* * *

## 20. Appendix

### 20.1 Configuration Templates

**Full .env.example:**

    # ============================================
    # LocalFlow Environment Configuration
    # ============================================
    # Processing Mode
    # Options: 'cloud' (fast, usage-based) or 'local' (free, offline)
    PROCESSING_MODE=cloud
    # ============================================
    # Cloud Processing (z-ai-web-dev-sdk)
    # ============================================
    # No configuration needed - uses cloud credentials
    # ============================================
    # Local Transcription (Whisper.cpp)
    # ============================================
    # Path to Whisper.cpp binary
    WHISPER_PATH=/usr/local/bin/whisper
    # Path to Whisper model file
    # Download from: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
    # Models:
    #   - ggml-tiny-q5_1.bin (fastest, least accurate)
    #   - ggml-small-q5_1.bin (recommended, good balance)
    #   - ggml-medium-q5_1.bin (most accurate, slowest)
    WHISPER_MODEL_PATH=./models/ggml-small-q5_1.bin  # Corrected filename
    # Number of CPU threads for Whisper
    WHISPER_THREADS=4
    # ============================================
    # Local Refinement (Ollama)
    # ============================================
    # Ollama API URL
    OLLAMA_URL=http://localhost:11434
    # Ollama model
    # Install with: ollama pull <model>
    # Models:
    #   - llama3.2:1b (smallest, fastest)
    #   - llama3.2:3b (good balance)
    #   - llama3.2:7b (smarter, slower)
    OLLAMA_MODEL=llama3.2:1b
    # Temperature (lower = more deterministic)
    OLLAMA_TEMPERATURE=0.1
    # ============================================
    # WebSocket Service
    # ============================================
    # Port for WebSocket service
    WS_PORT=3001
    # Maximum concurrent connections
    WS_MAX_CONNECTIONS=100
    # Heartbeat interval (milliseconds)
    WS_HEARTBEAT_INTERVAL=5000
    # Stale connection timeout (milliseconds)
    WS_STALE_TIMEOUT=30000
    # ============================================
    # CORS Configuration
    # ============================================
    # Allowed origins for WebSocket connections
    ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
    # ============================================
    # Application
    # ============================================
    # Node environment
    NODE_ENV=development
    # Port for Next.js application
    PORT=3000
    # Application URL (for callbacks if needed)
    APP_URL=http://localhost:3000

### 20.2 File Structure (Complete)

    /home/z/my-project/
    │
    ├── .env.example                    # Environment configuration template
    ├── .gitignore
    ├── eslint.config.mjs
    ├── next.config.ts
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── bun.lockb
    ├── Caddyfile                       # Reverse proxy configuration
    │
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx              # Main web UI
    │   │   ├── layout.tsx            # Root layout
    │   │   ├── globals.css           # Global styles
    │   │   └── api/
    │   │       └── dictation/
    │   │           ├── transcribe/
    │   │           │   └── route.ts  # Transcription API
    │   │           └── refine/
    │   │               └── route.ts  # Refinement API
    │   │
    │   ├── components/
    │   │   └── ui/                  # shadcn/ui components
    │   │       ├── button.tsx
    │   │       ├── card.tsx
    │   │       ├── dialog.tsx
    │   │       ├── select.tsx
    │   │       ├── switch.tsx
    │   │       ├── textarea.tsx
    │   │       ├── alert.tsx
    │   │       └── ...
    │   │
    │   └── hooks/
    │   │   ├── use-websocket.ts     # WebSocket connection hook
    │   │   ├── use-mobile.ts
    │   │   └── use-toast.ts
    │   │
    │   └── lib/
    │       ├── db.ts                # Database client (future)
    │       └── utils.ts            # Utility functions
    │
    ├── mini-services/
    │   └── websocket-service/
    │       ├── index.ts             # Socket.IO server
    │       └── package.json
    │
    ├── agent/
    │   ├── localflow-agent.py       # Desktop Python agent
    │   └── README.md              # Agent documentation
    │
    ├── prisma/
    │   └── schema.prisma            # Database schema (future)
    │
    ├── public/
    │   └── ...                     # Static assets
    │
    ├── .next/                       # Next.js build output
    │
    ├── logs/                        # Application logs (production)
    │   ├── app.log
    │   ├── app-error.log
    │   ├── ws.log
    │   └── ws-error.log
    │
    ├── tests/                       # Test files
    │   ├── api/
    │   │   ├── transcribe.test.ts
    │   │   └── refine.test.ts
    │   ├── websocket/
    │   │   └── service.test.ts
    │   └── integration/
    │       └── e2e.test.ts
    │
    ├── docs/
    │   ├── API.md
    │   ├── ARCHITECTURE.md
    │   ├── DEPLOYMENT.md
    │   └── CONTRIBUTING.md
    │
    ├── scripts/
    │   ├── setup-local.sh           # Local mode setup script
    │   ├── deploy.sh                 # Deployment script
    │   └── health-check.sh           # Production health monitoring
    │
    ├── LOCALFLOW_README.md           # User-facing README
    ├── SETUP_LOCAL.md               # Local mode setup guide
    ├── SPEC.md                     # This file
    └── CHANGELOG.md                 # Version history

### 20.3 Dependencies Reference

**Package.json:**

    {
    "name": "localflow",
    "version": "1.0.0",
    "private": true,
    "scripts": {
    "dev": "next dev -p 3000 2>&1 | tee dev.log",
    "build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
    "start": "NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log",
    "lint": "eslint .",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "db:push": "prisma db push",
    "db:generate": "prisma generate"
    },
    "dependencies": {
    "next": "^16.1.1",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "socket.io": "^4.8.3",
    "socket.io-client": "^4.8.3",
    "z-ai-web-dev-sdk": "^0.0.15",
    "framer-motion": "^12.26.2",
    "lucide-react": "^0.525.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.4.0"
    },
    "devDependencies": {
    "@types/react": "^19.2.8",
    "@types/react-dom": "^19.2.3",
    "typescript": "^5.9.3",
    "eslint": "^9.39.2",
    "eslint-config-next": "^16.1.3",
    "tailwindcss": "^4.1.18",
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.0"
    }
    }

* * *

## Conclusion

This specification provides a complete blueprint for building LocalFlow from scratch. It covers:✅ Architecture and data flow✅ Technology stack with rationale✅ Complete API specifications✅ WebSocket protocol✅ Security considerations✅ Performance requirements✅ Deployment strategy✅ Testing approach✅ Monitoring and observability✅ Documentation requirements✅ Future roadmap**The system is designed to be:**

* **Flexible:** Users choose cloud/local per use case
* **Scalable:** Architecture supports growth
* **Secure:** Multiple layers of protection
* **Maintainable:** Clean code, comprehensive tests
* **Deployable:** Multiple deployment options
* **User-Friendly:** Simple setup, clear documentation**Engineering teams can use this spec to:**

1. Replicate the current implementation
2. Extend with new features
3. Optimize based on metrics
4. Scale for user growth
5. Maintain long-term stabilityThis spec is versioned and should be updated alongside code changes to keep documentation in sync with implementation reality.```
