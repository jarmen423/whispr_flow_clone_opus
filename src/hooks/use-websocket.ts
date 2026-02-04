/**
 * @fileoverview LocalFlow WebSocket Hook - Real-time communication management
 *
 * This module provides the useWebSocket React hook for managing WebSocket
 * connections between the LocalFlow web UI and the WebSocket service. It
 * handles connection lifecycle, agent status tracking, and live activity updates.
 *
 * Purpose & Reasoning:
 *   The hook centralizes WebSocket connection management to avoid duplication
 *   across components. It provides:
 *   - Automatic connection with reconnection support
 *   - Agent online/offline status tracking
 *   - Live activity feed from desktop agents
 *   - Settings synchronization between UI and agents
 *
 *   Using a custom hook allows any component to access WebSocket functionality
 *   without managing socket instances directly, following React best practices
 *   for stateful logic reuse.
 *
 * Dependencies:
 *   External Packages:
 *     - socket.io-client: WebSocket client library with fallback support
 *     - React: Hooks (useEffect, useState, useCallback, useRef)
 *
 *   Services:
 *     - WebSocket Service: Running on WS_URL (default: localhost:3002)
 *
 * Role in Codebase:
 *   Used by the main page component (page.tsx) to enable real-time features:
 *   - Display agent connection status in header
 *   - Show live dictation activities from desktop agents
 *   - Send settings updates to connected agents
 *
 *   The hook maintains socket state and provides a clean interface for
 *   components to interact with WebSocket functionality.
 *
 * Key Technologies/APIs:
 *   - socket.io-client.io: Socket.IO client initialization
 *   - React.useEffect: Connection lifecycle management
 *   - React.useState: Connection status and activities state
 *   - React.useCallback: Memoized callback functions
 *   - React.useRef: Persistent socket reference across renders
 *
 * @module hooks/use-websocket
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

/**
 * Represents a live activity event from a desktop agent.
 *
 * Activities are broadcast by agents when they start recording or
 * complete dictation, allowing the web UI to show real-time activity.
 *
 * @interface LiveActivity
 */
export interface LiveActivity {
  /** Unique identifier for the activity */
  id: string;
  /** Type of activity being reported */
  type: "dictation_complete" | "recording_started";
  /** Transcribed text (for dictation_complete events) */
  text?: string;
  /** Refinement mode used */
  mode?: string;
  /** Unix timestamp of the activity */
  timestamp: number;
  /** Word count of the result (for dictation_complete) */
  wordCount?: number;
}

/**
 * Represents the current WebSocket and agent connection status.
 *
 * Provides real-time information about the health of connections
 * to both the WebSocket service and any connected desktop agents.
 *
 * @interface WebSocketStatus
 */
export interface WebSocketStatus {
  /** Whether the UI is connected to the WebSocket service */
  connected: boolean;
  /** Whether at least one desktop agent is connected */
  agentOnline: boolean;
  /** Timestamp of the most recent agent activity */
  lastActivity: number;
  /** ID of the currently connected agent (if any) */
  agentId?: string;
}

/**
 * Return type for the useWebSocket hook.
 *
 * Provides all state and functions needed to interact with the
 * WebSocket system from consuming components.
 *
 * @interface UseWebSocketReturn
 */
export interface UseWebSocketReturn {
  /** The Socket.IO socket instance (null if not connected) */
  socket: Socket | null;
  /** Current connection status including agent state */
  status: WebSocketStatus;
  /** Array of recent live activities from agents */
  liveActivities: LiveActivity[];
  /** Function to send settings updates to agents */
  sendSettings: (settings: SettingsUpdate) => void;
  /** Function to clear the live activities list */
  clearActivities: () => void;
}

/**
 * Settings update payload for agent synchronization.
 *
 * Sent from the web UI to connected agents when user changes
 * settings like hotkey, mode, or processing mode.
 *
 * @interface SettingsUpdate
 */
export interface SettingsUpdate {
  /** Hotkey combination string */
  hotkey?: string;
  /** Refinement mode */
  mode?: string;
  /** Where processing should occur */
  processingMode?: "cloud" | "local";
}

/** WebSocket service URL from environment or default */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";

/**
 * React hook for WebSocket connection management.
 *
 * Manages a Socket.IO connection to the LocalFlow WebSocket service,
 * providing real-time status updates, live activities, and settings
 * synchronization capabilities.
 *
 * Purpose & Reasoning:
 *   This hook encapsulates all WebSocket logic, making it easy for
 *   components to access real-time features without duplicating
 *   connection management code. It handles connection, reconnection,
 *   event subscriptions, and cleanup automatically.
 *
 * Key Technologies/APIs:
 *   - socket.io-client.io: Socket initialization with options
 *   - Socket.on("connect"|"disconnect"|"connect_error"): Lifecycle events
 *   - Socket.on("agent_status"): Agent presence updates
 *   - Socket.on("update"): Live activity broadcasts
 *   - Socket.emit("settings_update"): Send settings to agents
 *   - useEffect cleanup: Proper disconnection on unmount
 *
 * @returns UseWebSocketReturn - Socket instance, status, activities, and helpers
 *
 * @example
 * function MyComponent() {
 *   const { status, liveActivities, sendSettings } = useWebSocket();
 *
 *   return (
 *     <div>
 *       <p>Agent: {status.agentOnline ? "Online" : "Offline"}</p>
 *       {liveActivities.map(a => <p key={a.id}>{a.text}</p>)}
 *     </div>
 *   );
 * }
 */
export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    agentOnline: false,
    lastActivity: 0,
  });
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const socketRef = useRef<Socket | null>(null);

  /**
   * Clears all live activities from the list.
   *
   * Memoized callback to prevent unnecessary re-renders in consuming
   * components.
   */
  const clearActivities = useCallback(() => {
    setLiveActivities([]);
  }, []);

  /**
   * Sends settings updates to all connected agents.
   *
   * Emits a settings_update event to the WebSocket service, which
   * forwards it to any connected desktop agents.
   *
   * @param settings - Settings object to send to agents
   */
  const sendSettings = useCallback((settings: SettingsUpdate) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("settings_update", settings);
    }
  }, []);

  /**
   * Sets up the WebSocket connection on mount.
   *
   * Creates a Socket.IO connection to the /ui namespace and configures
   * event handlers for connection lifecycle and data updates. Cleans
   * up the connection when the component unmounts.
   */
  useEffect(() => {
    /**
     * Creates and configures the Socket.IO connection.
     *
     * Initializes the socket with reconnection settings and registers
     * all event handlers for the /ui namespace.
     */
    const connectSocket = () => {
      const newSocket = io(`${WS_URL}/ui`, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      });

      newSocket.on("connect", () => {
        console.log("[WebSocket] Connected to /ui namespace");
        setStatus((prev) => ({ ...prev, connected: true }));
      });

      newSocket.on("disconnect", (reason) => {
        console.log("[WebSocket] Disconnected:", reason);
        setStatus((prev) => ({ ...prev, connected: false }));
      });

      newSocket.on("connect_error", (error) => {
        console.error("[WebSocket] Connection error:", error.message);
        setStatus((prev) => ({ ...prev, connected: false }));
      });

      // Handle agent status updates
      newSocket.on(
        "agent_status",
        (data: {
          online: boolean;
          lastActivity: number;
          agentId?: string;
        }) => {
          console.log("[WebSocket] Agent status:", data);
          setStatus((prev) => ({
            ...prev,
            agentOnline: data.online,
            lastActivity: data.lastActivity,
            agentId: data.agentId,
          }));
        }
      );

      // Handle live activity updates
      newSocket.on("update", (data: LiveActivity) => {
        console.log("[WebSocket] Live activity:", data);
        setLiveActivities((prev) => {
          const newActivity = {
            ...data,
            id: `${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          };
          // Keep only the last 50 activities
          const updated = [...prev, newActivity].slice(-50);
          return updated;
        });
      });

      // Handle connection confirmation
      newSocket.on("connection_confirmed", (data: { serverTime: number }) => {
        console.log("[WebSocket] Connection confirmed, server time:", data.serverTime);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    };

    connectSocket();

    // Cleanup function - disconnect socket on unmount
    return () => {
      const timeoutRef = reconnectTimeoutRef.current;
      const currentSocket = socketRef.current;
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      if (currentSocket) {
        currentSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    socket,
    status,
    liveActivities,
    sendSettings,
    clearActivities,
  };
}
