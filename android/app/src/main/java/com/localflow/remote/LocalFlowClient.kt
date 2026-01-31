package com.localflow.remote

import android.util.Base64
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

/**
 * Socket.IO client for connecting to LocalFlow WebSocket service
 * Uses /mobile namespace for remote microphone functionality
 */
class LocalFlowClient(
    private val listener: LocalFlowListener
) {

    companion object {
        private const val TAG = "LocalFlowClient"
        private const val NAMESPACE = "/mobile"
    }

    interface LocalFlowListener {
        fun onConnected()
        fun onDisconnected(reason: String)
        fun onConnectionError(error: String)
        fun onError(message: String)
    }

    private var socket: Socket? = null
    private var serverUrl: String = ""
    private var mode: String = "developer"
    private var processingMode: String = "networked-local"

    /**
     * Connect to the LocalFlow WebSocket server
     */
    fun connect(serverIp: String, mode: String = "developer", processingMode: String = "networked-local"): Boolean {
        this.serverUrl = "http://$serverIp:3002"
        this.mode = mode
        this.processingMode = processingMode

        try {
            val uri = URI(serverUrl + NAMESPACE)
            val options = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = 5
                reconnectionDelay = 1000
                reconnectionDelayMax = 5000
                transports = arrayOf("websocket", "polling")
            }

            socket = IO.socket(uri, options)
            setupSocketHandlers()
            socket?.connect()

            Log.i(TAG, "Connecting to $serverUrl")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to create socket", e)
            listener.onConnectionError(e.message ?: "Unknown error")
            return false
        }
    }

    /**
     * Disconnect from the server
     */
    fun disconnect() {
        socket?.disconnect()
        // socket = null
        Log.i(TAG, "Disconnected")
    }

    /**
     * Send recording started notification
     */
    fun sendRecordingStarted() {
        val data = JSONObject().apply {
            put("timestamp", System.currentTimeMillis())
        }
        socket?.emit("recording_started", data)
        Log.d(TAG, "Sent recording_started")
    }

    /**
     * Send audio data for processing
     */
    fun sendAudio(wavBytes: ByteArray) {
        val base64Audio = Base64.encodeToString(wavBytes, Base64.NO_WRAP)

        val data = JSONObject().apply {
            put("type", "process_audio")
            put("audio", base64Audio)
            put("mode", mode)
            put("processingMode", processingMode)
            put("timestamp", System.currentTimeMillis())
        }

        socket?.emit("process_audio", data)
        Log.d(TAG, "Sent process_audio (${base64Audio.length} chars)")
    }

    /**
     * Check if currently connected
     */
    fun isConnected(): Boolean {
        return socket?.connected() == true
    }

    private fun setupSocketHandlers() {
        socket?.apply {
            on(Socket.EVENT_CONNECT) {
                Log.i(TAG, "Connected to server")
                listener.onConnected()
            }

            on(Socket.EVENT_DISCONNECT) { args ->
                val reason = args.getOrNull(0)?.toString() ?: "unknown"
                Log.i(TAG, "Disconnected: $reason")
                listener.onDisconnected(reason)
            }

            on(Socket.EVENT_CONNECT_ERROR) { args ->
                val error = args.getOrNull(0)?.toString() ?: "Unknown connection error"
                Log.e(TAG, "Connection error: $error")
                listener.onConnectionError(error)
            }

            on("connection_confirmed") { args ->
                val data = args.getOrNull(0) as? JSONObject
                val serverTime = data?.optLong("serverTime")
                Log.i(TAG, "Connection confirmed, server time: $serverTime")
            }

            on("error") { args ->
                val data = args.getOrNull(0) as? JSONObject
                val message = data?.optString("message") ?: "Unknown error"
                Log.e(TAG, "Server error: $message")
                listener.onError(message)
            }
        }
    }
}
