"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface LiveActivity {
  id: string;
  type: "dictation_complete" | "recording_started";
  text?: string;
  mode?: string;
  timestamp: number;
  wordCount?: number;
}

export interface WebSocketStatus {
  connected: boolean;
  agentOnline: boolean;
  lastActivity: number;
  agentId?: string;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  status: WebSocketStatus;
  liveActivities: LiveActivity[];
  sendSettings: (settings: SettingsUpdate) => void;
  clearActivities: () => void;
}

export interface SettingsUpdate {
  hotkey?: string;
  mode?: string;
  processingMode?: "cloud" | "local";
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";

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

  const clearActivities = useCallback(() => {
    setLiveActivities([]);
  }, []);

  const sendSettings = useCallback((settings: SettingsUpdate) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("settings_update", settings);
    }
  }, []);

  useEffect(() => {
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
      newSocket.on("agent_status", (data: {
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
      });

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
