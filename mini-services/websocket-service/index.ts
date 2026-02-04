/**
 * @fileoverview LocalFlow WebSocket Service - Real-time Communication Hub
 *
 * This module implements the WebSocket service that enables real-time
 * communication between desktop agents (Python) and the web UI (Next.js).
 * It uses Socket.IO for reliable bidirectional messaging with automatic
 * reconnection and fallback support.
 *
 * Purpose & Reasoning:
 *   The WebSocket service was created to bridge the gap between the desktop
 *   agent (running as a separate Python process) and the web-based UI. It
 *   provides:
 *   - Bidirectional real-time messaging without polling
 *   - Namespace separation (/agent for desktop, /ui for web clients)
 *   - Agent presence detection and status broadcasting
 *   - Audio processing orchestration via API calls
 *   - Rate limiting to prevent abuse
 *
 *   Socket.IO was chosen over plain WebSockets for its automatic
 *   reconnection, room/namespace support, and fallback transports.
 *
 * Dependencies:
 *   External Packages:
 *     - socket.io: WebSocket library with fallback transports
 *     - http: Node.js built-in HTTP server
 *
 *   External Services:
 *     - Next.js API: http://localhost:3005 for transcription/refinement
 *
 * Role in Codebase:
 *   This service runs as a separate process (bun run index.ts) and acts
 *   as the central message broker. Desktop agents connect to /agent namespace,
 *   web UIs connect to /ui namespace. The service forwards audio from agents
 *   to the API for processing, then broadcasts results back.
 *
 * Key Technologies/APIs:
 *   - socket.io.Server: WebSocket server with namespace support
 *   - http.createServer: HTTP server for Socket.IO attachment
 *   - Server.of("/namespace"): Namespace creation and isolation
 *   - Socket.on/emit: Event handling and message transmission
 *   - Namespace.emit: Broadcast to all clients in namespace
 *   - fetch: HTTP requests to transcription/refinement API
 *   - setInterval: Periodic stale connection detection
 *
 * @module websocket-service/index
 * @requires socket.io
 * @requires http
 */

import { Server } from "socket.io";
import { createServer } from "http";
import type { Socket } from "socket.io";

// ============================================
// Configuration
// ============================================

/**
 * WebSocket service port.
 * Default: 3002. Override with WS_PORT environment variable.
 */
const PORT = parseInt(process.env.WS_PORT || "3002", 10);

/**
 * Allowed CORS origins.
 * Comma-separated list in ALLOWED_ORIGINS env var.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3005,http://localhost:3002").split(",");

/**
 * Stale connection timeout in milliseconds.
 * Agents inactive longer than this are disconnected.
 * Default: 30000ms (30 seconds).
 */
const STALE_TIMEOUT = parseInt(process.env.WS_STALE_TIMEOUT || "30000", 10);

/**
 * Base URL for the Next.js API.
 * Used to forward audio for transcription/refinement.
 */
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3005";

// ============================================
// Types
// ============================================

/**
 * Represents a connected desktop agent.
 *
 * @interface AgentConnection
 */
interface AgentConnection {
  /** The Socket.IO socket instance */
  socket: Socket;
  /** Unix timestamp of last activity */
  lastActivity: number;
  /** Unique agent identifier */
  agentId: string;
}

/**
 * Audio processing message from agent.
 *
 * @interface ProcessAudioMessage
 */
interface ProcessAudioMessage {
  /** Message type identifier */
  type: "process_audio";
  /** Base64-encoded audio data */
  audio: string;
  /** Refinement mode for text processing */
  mode: "developer" | "concise" | "professional" | "raw" | "outline";
  /** Where processing should occur */
  processingMode?: "cloud" | "local";
  /** Whether to translate non-English audio to English */
  translate?: boolean;
  /** Client timestamp */
  timestamp: number;
}

/**
 * Settings update message.
 *
 * @interface SettingsUpdate
 */
interface SettingsUpdate {
  /** Message type identifier */
  type: "settings_update";
  /** Hotkey configuration */
  hotkey?: string;
  /** Hotkey to toggle translation mode */
  translateHotkey?: string;
  /** Refinement mode */
  mode?: string;
  /** Processing location preference */
  processingMode?: "cloud" | "local";
  /** Whether to translate non-English audio to English */
  translate?: boolean;
}

// ============================================
// State Management
// ============================================

/**
 * Map of connected agents by socket ID.
 * @type {Map<string, AgentConnection>}
 */
const connectedAgents = new Map<string, AgentConnection>();

/**
 * Current settings to sync to newly connected agents.
 * @type {SettingsUpdate | null}
 */
let currentSettings: SettingsUpdate | null = null;

// ============================================
// Server Setup
// ============================================

/**
 * HTTP server instance for Socket.IO attachment.
 */
const httpServer = createServer();

/**
 * Socket.IO server instance with CORS configuration.
 *
 * Key Technologies/APIs:
 *   - Socket.IO Server: Real-time bidirectional communication
 *   - CORS: Cross-origin resource sharing configuration
 *   - maxHttpBufferSize: 10MB limit for audio data
 */
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
  transports: ["polling", "websocket"],
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB max message size
});

// ============================================
// Rate Limiting
// ============================================

/**
 * Map of agent message timestamps for rate limiting.
 * Tracks messages per agent to prevent abuse.
 * @type {Map<string, number[]>}
 */
const agentMessageTimestamps = new Map<string, number[]>();

/**
 * Checks if an agent has exceeded the rate limit.
 *
 * Implements a sliding window rate limit of 30 messages
 * per minute per agent to prevent abuse.
 *
 * @param agentId - The agent's socket ID
 * @returns boolean - True if within rate limit, false if exceeded
 */
function checkRateLimit(agentId: string): boolean {
  const now = Date.now();
  const timestamps = agentMessageTimestamps.get(agentId) || [];
  const recent = timestamps.filter((t) => now - t < 60000);
  agentMessageTimestamps.set(agentId, [...recent, now]);
  return recent.length < 30; // Max 30 messages per minute
}

// ============================================
// Broadcast Functions
// ============================================

/**
 * Broadcasts agent status to all connected UI clients.
 *
 * Sends the current agent online/offline status to all UI
 * clients so they can update their connection indicators.
 *
 * Key Technologies/APIs:
 *   - io.of("/ui").emit: Broadcast to all UI namespace clients
 *
 * @param online - Whether any agents are connected
 * @param agentId - Optional agent ID for specific updates
 */
function broadcastAgentStatus(online: boolean, agentId?: string) {
  const lastActivity = online
    ? Date.now()
    : connectedAgents.size > 0
      ? Math.max(...Array.from(connectedAgents.values()).map((a) => a.lastActivity))
      : 0;

  io.of("/ui").emit("agent_status", {
    online: connectedAgents.size > 0,
    lastActivity,
    agentId,
  });

  console.log(`[WS] Agent status broadcast: online=${connectedAgents.size > 0}, agents=${connectedAgents.size}`);
}

/**
 * Broadcasts activity updates to all UI clients.
 *
 * Sends dictation completion or recording start events to
 * the UI for display in the live activity feed.
 *
 * Key Technologies/APIs:
 *   - io.of("/ui").emit: Broadcast to UI namespace
 *
 * @param data - Activity data to broadcast
 */
function broadcastToUI(data: object) {
  io.of("/ui").emit("update", data);
}

// ============================================
// Audio Processing
// ============================================

/**
 * Processes audio through the transcription and refinement API.
 *
 * Takes audio from an agent, sends it to the Next.js API for
 * transcription and refinement, then returns results to the agent
 * and broadcasts to UI clients.
 *
 * Purpose & Reasoning:
 *   The WebSocket service acts as a coordinator rather than doing
 *   the actual processing. It forwards audio to the existing API
 *   endpoints to avoid duplicating the transcription/refinement logic.
 *
 * Key Technologies/APIs:
 *   - fetch: POST to /api/dictation/transcribe
 *   - fetch: POST to /api/dictation/refine
 *   - socket.emit: Send result back to agent
 *   - broadcastToUI: Notify UI of completion
 *
 * @param socket - The agent's socket connection
 * @param message - Audio processing request
 * @returns Promise<void>
 */
async function processAudio(socket: Socket, message: ProcessAudioMessage): Promise<void> {
  const agentId = socket.id;
  const startTime = Date.now();

  console.log(`[WS] Processing audio from agent ${agentId}, mode: ${message.mode}`);

  try {
    // Step 1: Transcribe
    const transcribeResponse = await fetch(`${API_BASE_URL}/api/dictation/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio: message.audio,
        mode: message.processingMode || "cloud",
        translate: message.translate || false,
      }),
    });

    const transcribeData = await transcribeResponse.json();

    if (!transcribeResponse.ok || !transcribeData.success) {
      throw new Error(transcribeData.error || "Transcription failed");
    }

    // Step 2: Refine (skip for raw mode)
    let refinedText = transcribeData.text;

    if (message.mode !== "raw") {
      const refineResponse = await fetch(`${API_BASE_URL}/api/dictation/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcribeData.text,
          mode: message.mode,
          processingMode: message.processingMode || "cloud",
          translated: message.translate || false,
        }),
      });

      const refineData = await refineResponse.json();

      if (!refineResponse.ok || !refineData.success) {
        throw new Error(refineData.error || "Refinement failed");
      }

      refinedText = refineData.refinedText;
    }

    const processingTime = Date.now() - startTime;

    // Send result back to agent
    socket.emit("dictation_result", {
      type: "dictation_result",
      originalText: transcribeData.text,
      refinedText,
      success: true,
      wordCount: transcribeData.wordCount,
      processingTime,
    });

    // Broadcast to UI
    broadcastToUI({
      type: "dictation_complete",
      text: refinedText,
      mode: message.mode,
      timestamp: Date.now(),
      wordCount: transcribeData.wordCount,
    });

    console.log(`[WS] Audio processed in ${processingTime}ms, words: ${transcribeData.wordCount}`);
  } catch (error) {
    console.error("[WS] Processing error:", error);

    socket.emit("dictation_result", {
      type: "dictation_result",
      originalText: "",
      refinedText: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      wordCount: 0,
      processingTime: Date.now() - startTime,
    });
  }
}

// ============================================
// Agent Namespace Handlers (/agent)
// ============================================

/**
 * Agent namespace for desktop agent connections.
 *
 * Desktop agents (Python localflow-agent.py) connect to this
 * namespace to send audio and receive transcription results.
 */
const agentNamespace = io.of("/agent");

agentNamespace.on("connection", (socket: Socket) => {
  const agentId = socket.id;
  console.log(`[WS] Agent connected: ${agentId}`);

  // Store connection
  connectedAgents.set(agentId, {
    socket,
    lastActivity: Date.now(),
    agentId,
  });

  // Send confirmation
  socket.emit("connection_confirmed", {
    type: "connection_confirmed",
    serverTime: Date.now(),
  });

  // Send current settings if any
  if (currentSettings) {
    socket.emit("settings_update", currentSettings);
  }

  // Broadcast status
  broadcastAgentStatus(true, agentId);

  // Handle ping (heartbeat)
  socket.on("ping", () => {
    const agent = connectedAgents.get(agentId);
    if (agent) {
      agent.lastActivity = Date.now();
    }
  });

  // Handle recording started
  socket.on("recording_started", (data: { timestamp: number }) => {
    const agent = connectedAgents.get(agentId);
    if (agent) {
      agent.lastActivity = Date.now();
    }

    broadcastToUI({
      type: "recording_started",
      timestamp: data.timestamp,
    });

    console.log(`[WS] Agent ${agentId} started recording`);
  });

  // Handle process audio
  socket.on("process_audio", async (message: ProcessAudioMessage) => {
    // Rate limit check
    if (!checkRateLimit(agentId)) {
      socket.emit("dictation_result", {
        type: "dictation_result",
        success: false,
        error: "Rate limit exceeded (max 30 per minute)",
      });
      return;
    }

    const agent = connectedAgents.get(agentId);
    if (agent) {
      agent.lastActivity = Date.now();
    }

    await processAudio(socket, message);
  });

  // Handle disconnect
  socket.on("disconnect", (reason: string) => {
    console.log(`[WS] Agent disconnected: ${agentId}, reason: ${reason}`);
    connectedAgents.delete(agentId);
    agentMessageTimestamps.delete(agentId);
    broadcastAgentStatus(false, agentId);
  });
});

// ============================================
// UI Namespace Handlers (/ui)
// ============================================

/**
 * UI namespace for web client connections.
 *
 * Web UI clients (browser) connect to this namespace to receive
 * live activity updates and send settings changes.
 */
const uiNamespace = io.of("/ui");

uiNamespace.on("connection", (socket: Socket) => {
  console.log(`[WS] UI client connected: ${socket.id}`);

  // Send confirmation
  socket.emit("connection_confirmed", {
    type: "connection_confirmed",
    serverTime: Date.now(),
  });

  // Send current agent status
  const hasAgents = connectedAgents.size > 0;
  const lastActivity = hasAgents
    ? Math.max(...Array.from(connectedAgents.values()).map((a) => a.lastActivity))
    : 0;

  socket.emit("agent_status", {
    online: hasAgents,
    lastActivity,
    agentId: hasAgents ? Array.from(connectedAgents.keys())[0] : undefined,
  });

  // Handle settings update from UI
  socket.on("settings_update", (settings: SettingsUpdate) => {
    console.log("[WS] Settings update from UI:", settings);
    currentSettings = settings;

    // Broadcast to all agents
    agentNamespace.emit("settings_update", settings);
  });

  // Handle disconnect
  socket.on("disconnect", (reason: string) => {
    console.log(`[WS] UI client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// ============================================
// Stale Connection Detection
// ============================================

/**
 * Periodic cleanup of stale agent connections.
 *
 * Checks every 10 seconds for agents that haven't sent a ping
 * within STALE_TIMEOUT and disconnects them.
 */
setInterval(() => {
  const now = Date.now();
  for (const [agentId, agent] of connectedAgents) {
    if (now - agent.lastActivity > STALE_TIMEOUT) {
      console.log(`[WS] Disconnecting stale agent: ${agentId}`);
      agent.socket.disconnect();
      connectedAgents.delete(agentId);
      broadcastAgentStatus(false, agentId);
    }
  }
}, 10000); // Check every 10 seconds

// ============================================
// Server Startup
// ============================================

/**
 * Start the HTTP server and listen for connections.
 */
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                  LocalFlow WebSocket Service                ║
╠════════════════════════════════════════════════════════════╣
║  Port:        ${PORT.toString().padEnd(44)}║
║  Namespaces:  /agent, /ui                                  ║
║  Origins:     ${ALLOWED_ORIGINS.join(", ").substring(0, 44).padEnd(44)}║
╚════════════════════════════════════════════════════════════╝
  `);
});

// ============================================
// Graceful Shutdown
// ============================================

/**
 * Handles SIGTERM signal for graceful shutdown.
 *
 * Closes Socket.IO connections and HTTP server before exiting.
 */
process.on("SIGTERM", () => {
  console.log("[WS] Received SIGTERM, shutting down...");
  io.close();
  httpServer.close();
  process.exit(0);
});

/**
 * Handles SIGINT signal for graceful shutdown (Ctrl+C).
 *
 * Closes Socket.IO connections and HTTP server before exiting.
 */
process.on("SIGINT", () => {
  console.log("[WS] Received SIGINT, shutting down...");
  io.close();
  httpServer.close();
  process.exit(0);
});
