/**
 * LocalFlow WebSocket Service
 * 
 * Handles real-time communication between desktop agents and web UI.
 * 
 * Namespaces:
 *   /agent - Desktop agent connections
 *   /ui    - Web UI connections
 * 
 * Run with: bun run index.ts
 */

import { Server } from "socket.io";
import { createServer } from "http";

// Configuration
const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001").split(",");
const STALE_TIMEOUT = parseInt(process.env.WS_STALE_TIMEOUT || "30000", 10);
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// Types
interface AgentConnection {
  socket: Socket;
  lastActivity: number;
  agentId: string;
}

interface ProcessAudioMessage {
  type: "process_audio";
  audio: string;
  mode: "developer" | "concise" | "professional" | "raw";
  processingMode?: "cloud" | "local";
  timestamp: number;
}

interface SettingsUpdate {
  type: "settings_update";
  hotkey?: string;
  mode?: string;
  processingMode?: "cloud" | "local";
}

import type { Socket } from "socket.io";

// State
const connectedAgents = new Map<string, AgentConnection>();
let currentSettings: SettingsUpdate | null = null;

// Create HTTP server and Socket.IO instance
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
  transports: ["polling", "websocket"],
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB max message size
});

// Rate limiting
const agentMessageTimestamps = new Map<string, number[]>();

function checkRateLimit(agentId: string): boolean {
  const now = Date.now();
  const timestamps = agentMessageTimestamps.get(agentId) || [];
  const recent = timestamps.filter((t) => now - t < 60000);
  agentMessageTimestamps.set(agentId, [...recent, now]);
  return recent.length < 30; // Max 30 messages per minute
}

// Broadcast agent status to all UI clients
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

// Broadcast live activity to UI
function broadcastToUI(data: object) {
  io.of("/ui").emit("update", data);
}

// Process audio through API
async function processAudio(
  socket: Socket,
  message: ProcessAudioMessage
): Promise<void> {
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
      }),
    });

    const transcribeData = await transcribeResponse.json();

    if (!transcribeResponse.ok || !transcribeData.success) {
      throw new Error(transcribeData.error || "Transcription failed");
    }

    // Step 2: Refine
    let refinedText = transcribeData.text;

    if (message.mode !== "raw") {
      const refineResponse = await fetch(`${API_BASE_URL}/api/dictation/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcribeData.text,
          mode: message.mode,
          processingMode: message.processingMode || "cloud",
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

// Agent namespace handlers
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

// UI namespace handlers
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

// Stale connection detection
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

// Start server
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

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[WS] Received SIGTERM, shutting down...");
  io.close();
  httpServer.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[WS] Received SIGINT, shutting down...");
  io.close();
  httpServer.close();
  process.exit(0);
});
