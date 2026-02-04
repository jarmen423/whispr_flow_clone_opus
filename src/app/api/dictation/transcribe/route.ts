/**
 * @fileoverview LocalFlow Transcription API Route - Speech-to-Text Processing
 *
 * This module provides the API endpoint for audio transcription, supporting
 * multiple processing modes: cloud (Groq API), networked-local (remote Whisper/LFM
 * servers), and local (Whisper.cpp binary execution).
 *
 * Purpose & Reasoning:
 *   This API route serves as the abstraction layer between the frontend and
 *   various speech-to-text backends. It was designed to support flexibility
 *   in deployment scenarios:
 *   - Cloud mode: Fastest processing via Groq's Whisper API
 *   - Networked-local: Self-hosted processing on another machine
 *   - Local: Complete privacy with on-device processing
 *
 *   The route handles audio decoding, mode selection, error handling, and
 *   unified response formatting across all backends.
 *
 * Dependencies:
 *   External Services:
 *     - Groq API: Cloud-based Whisper transcription (console.groq.com)
 *     - Whisper API: Remote whisper.cpp server (WHISPER_API_URL)
 *     - LFM Server: LFM 2.5 Audio server for multimodal processing
 *
 *   Node.js APIs:
 *     - fs: File system operations for local mode temp files
 *     - child_process.execSync: Local Whisper.cpp execution
 *     - os.tmpdir: Temporary directory for audio processing
 *
 *   Next.js APIs:
 *     - next/server.NextRequest/NextResponse: Request/response handling
 *
 * Role in Codebase:
 *   Called by the main page (src/app/page.tsx) when the user finishes
 *   recording audio. Also called by the WebSocket service
 *   (mini-services/websocket-service/index.ts) when processing audio
 *   from desktop agents.
 *
 *   POST /api/dictation/transcribe - Process audio and return transcription
 *
 * Key Technologies/APIs:
 *   - fetch: HTTP requests to external APIs
 *   - FormData: Multipart form construction for audio upload
 *   - Buffer.from: Base64 audio decoding
 *   - AbortSignal.timeout: Request timeout handling
 *   - execSync: Synchronous process execution for local Whisper
 *
 * @module app/api/dictation/transcribe/route
 */

import { NextRequest, NextResponse } from "next/server";
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

// ============================================
// Environment Configuration
// ============================================

/**
 * Processing mode from environment or default.
 * Controls which transcription backend is used.
 */
const PROCESSING_MODE = process.env.PROCESSING_MODE || "networked-local";

/**
 * Groq API key for cloud transcription.
 * Falls back from GROQ_API_KEY to ZAI_API_KEY for compatibility.
 */
const ZAI_API_KEY = process.env.GROQ_API_KEY || process.env.ZAI_API_KEY || "";

/**
 * Groq ASR API endpoint URLs.
 * Uses Groq's OpenAI-compatible audio endpoints.
 * Translation requires the dedicated /translations endpoint.
 */
const GROQ_TRANSCRIPTION_URL =
  process.env.GROQ_ASR_API_BASE_URL || "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_TRANSLATION_URL = "https://api.groq.com/openai/v1/audio/translations";

/**
 * ASR model identifier for Groq API.
 * Default: whisper-large-v3 (high quality, multilingual).
 * Note: Only whisper-large-v3 supports translation. whisper-large-v3-turbo does NOT support translation.
 */
const ZAI_ASR_MODEL = process.env.GROQ_ASR_MODEL || process.env.ZAI_ASR_MODEL || "whisper-large-v3";

/**
 * Model for translation (must be whisper-large-v3).
 */
const GROQ_TRANSLATION_MODEL = "whisper-large-v3";

/**
 * Optional prompt for translation style guidance.
 * Helps with spelling of names and formatting preferences.
 */
const TRANSLATION_PROMPT = process.env.TRANSLATION_PROMPT || "";

/**
 * URL for remote Whisper/LFM server in networked-local mode.
 * Example: http://192.168.1.100:8080 or http://192.168.1.100:8888
 */
const WHISPER_API_URL = process.env.WHISPER_API_URL || "";

/**
 * Audio API type for networked-local mode.
 * - 'whisper': Use Whisper.cpp /inference endpoint
 * - 'lfm': Use LFM 2.5 Audio /v1/chat/completions endpoint
 * - 'auto': Auto-detect based on server capabilities
 */
const AUDIO_API_TYPE = process.env.AUDIO_API_TYPE || "auto";

/**
 * Path to local Whisper.cpp binary for local mode.
 */
const WHISPER_PATH = process.env.WHISPER_PATH || "/usr/local/bin/whisper";

/**
 * Path to Whisper model file for local mode.
 */
const WHISPER_MODEL_PATH = process.env.WHISPER_MODEL_PATH || "./models/ggml-small-q5_1.bin";

/**
 * Number of threads for Whisper.cpp processing.
 */
const WHISPER_THREADS = process.env.WHISPER_THREADS || "4";

// ============================================
// Types
// ============================================

/**
 * Request body for transcription endpoint.
 *
 * @interface TranscribeRequest
 */
interface TranscribeRequest {
  /** Base64-encoded audio data */
  audio: string;
  /** Processing mode override */
  mode?: "cloud" | "networked-local" | "local";
  /** Whether to translate non-English audio to English */
  translate?: boolean;
}

/**
 * Response body for transcription endpoint.
 *
 * @interface TranscribeResponse
 */
interface TranscribeResponse {
  /** Whether transcription succeeded */
  success: boolean;
  /** Transcribed text (on success) */
  text?: string;
  /** Word count of transcription (on success) */
  wordCount?: number;
  /** Mode actually used for processing */
  mode?: "cloud" | "networked-local" | "local";
  /** Processing time in milliseconds (on success) */
  processingTime?: number;
  /** Error message (on failure) */
  error?: string;
  /** Detailed error information (on failure) */
  details?: string;
}

// ============================================
// Utilities
// ============================================

/**
 * Validates incoming transcription request data.
 *
 * Checks that the request contains valid audio data (base64 string)
 * and optionally validates the processing mode. Throws errors for
 * invalid data with descriptive messages.
 *
 * Key Technologies/APIs:
 *   - TypeScript type guards: data is TranscribeRequest
 *   - String length check: 5MB base64 limit (~3.75MB raw)
 *
 * @param data - Unknown data to validate
 * @returns boolean - True if data is valid TranscribeRequest
 * @throws Error - If audio too large or mode invalid
 */
function validateRequest(data: unknown): data is TranscribeRequest {
  if (!data || typeof data !== "object") return false;
  const req = data as Record<string, unknown>;

  if (!req.audio || typeof req.audio !== "string") {
    return false;
  }

  // Max 5MB base64 (approximately 3.75MB raw audio)
  if (req.audio.length > 5_000_000) {
    throw new Error("Audio too large (max 5MB)");
  }

  if (req.mode && !["cloud", "networked-local", "local"].includes(req.mode as string)) {
    throw new Error("Invalid processing mode");
  }

  if (req.translate !== undefined && typeof req.translate !== "boolean") {
    throw new Error("Invalid translate value (must be boolean)");
  }

  return true;
}

/**
 * Counts words in text for statistics.
 *
 * @param text - Text to count words in
 * @returns number - Word count
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Determines the effective processing mode based on configuration.
 *
 * Validates that required credentials/URLs are available for the
 * requested mode, falling back to alternative modes if necessary.
 *
 * Key Technologies/APIs:
 *   - Environment variable access
 *   - Console.warn: Fallback notifications
 *
 * @param requestedMode - Mode requested by client (optional)
 * @returns "cloud" | "networked-local" | "local" - Effective mode
 */
function getEffectiveMode(requestedMode?: string): "cloud" | "networked-local" | "local" {
  const mode = requestedMode || PROCESSING_MODE;

  // Cloud mode requires API key
  if (mode === "cloud") {
    if (!ZAI_API_KEY) {
      console.warn(
        "[Transcribe] Cloud mode requested but GROQ_API_KEY not set, falling back to networked-local"
      );
      return WHISPER_API_URL ? "networked-local" : "local";
    }
    return "cloud";
  }

  // Networked-local mode requires WHISPER_API_URL
  if (mode === "networked-local") {
    if (!WHISPER_API_URL) {
      console.warn(
        "[Transcribe] Networked-local mode requested but WHISPER_API_URL not set, falling back to local"
      );
      return "local";
    }
    return "networked-local";
  }

  return "local";
}

// ============================================
// Cloud Transcription (Groq API)
// ============================================

/**
 * Transcribes or translates audio using Groq's Whisper API.
 *
 * Sends audio to Groq's cloud-based Whisper service for fast,
 * high-quality transcription. When translate is true, uses the dedicated
 * /translations endpoint which is the recommended approach per Groq docs.
 *
 * Purpose & Reasoning:
 *   Groq provides the fastest transcription with excellent accuracy.
 *   For translation, we use the dedicated /translations endpoint with
 *   whisper-large-v3 (the only model that supports translation).
 *
 * Key Technologies/APIs:
 *   - fetch: POST to Groq ASR endpoint
 *   - FormData: Multipart form with audio file
 *   - AbortSignal.timeout: 60-second request timeout
 *   - /v1/audio/translations: Dedicated translation endpoint
 *
 * @param audioBase64 - Base64-encoded audio data
 * @param translate - Whether to translate non-English audio to English
 * @returns Object with transcribed text and processing time
 * @throws Error - On API errors, timeouts, or no speech detected
 *
 * @example
 * const result = await transcribeCloud(base64Audio, false);
 * console.log(result.text); // "Hello world"
 */
async function transcribeCloud(
  audioBase64: string,
  translate: boolean = false
): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!ZAI_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is required for cloud mode. " + "Get your API key from: https://console.groq.com/keys"
    );
  }

  // Translation requires whisper-large-v3 (turbo does not support translation)
  if (translate && ZAI_ASR_MODEL !== GROQ_TRANSLATION_MODEL) {
    console.warn(
      `[Transcribe] Translation requires ${GROQ_TRANSLATION_MODEL}, but using ${ZAI_ASR_MODEL}. ` +
        "Attempting anyway..."
    );
  }

  try {
    // Decode base64 to binary buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Create form data with the audio file
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("file", audioBlob, "audio.wav");
    formData.append("response_format", "json");

    // Determine endpoint and model based on translation mode
    const endpoint = translate ? GROQ_TRANSLATION_URL : GROQ_TRANSCRIPTION_URL;
    const model = translate ? GROQ_TRANSLATION_MODEL : ZAI_ASR_MODEL;

    formData.append("model", model);

    // Add optional prompt for style guidance (translation only)
    // Prompt helps with: spelling of names, formatting preferences, punctuation style
    // Limited to 224 tokens per Groq/OpenAI docs
    if (translate && TRANSLATION_PROMPT) {
      formData.append("prompt", TRANSLATION_PROMPT);
    }

    console.log(`[Transcribe] Using ${translate ? "translation" : "transcription"} endpoint: ${endpoint}`);

    // Groq API uses multipart/form-data with file upload
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ZAI_API_KEY}`,
      },
      body: formData,
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      // Handle common error cases
      if (response.status === 401) {
        throw new Error("Invalid GROQ_API_KEY. Check your API key at https://console.groq.com/keys");
      }
      if (response.status === 429) {
        throw new Error("Groq rate limit exceeded. Please try again later.");
      }
      if (response.status === 400 && errorText.includes("duration")) {
        throw new Error("Audio too long. Maximum duration is 30 seconds.");
      }

      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Groq returns { text: "transcribed text", ... }
    const text = result.text || "";

    if (!text.trim()) {
      throw new Error("No speech detected in audio");
    }

    return {
      text: text.trim(),
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error("Groq API request timed out (60s limit)");
      }
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error("Failed to connect to Groq API. Check your internet connection.");
      }
      throw error;
    }
    throw new Error("Unknown error during cloud transcription");
  }
}

// ============================================
// Networked Local Transcription (Remote Whisper or LFM Server)
// ============================================

/**
 * Transcribes audio using LFM 2.5 Audio multimodal API.
 *
 * Sends audio to an LFM (Liquid Foundation Model) server using the
 * OpenAI-compatible chat completions API with streaming support.
 *
 * Purpose & Reasoning:
 *   LFM 2.5 Audio is a multimodal model that can process audio
 *   directly, potentially offering better quality than Whisper
 *   on certain types of content.
 *
 * Key Technologies/APIs:
 *   - fetch: POST to /v1/chat/completions
 *   - SSE streaming: Server-sent events for progressive responses
 *   - ReadableStream.getReader: Stream reading
 *   - TextDecoder: Binary to string conversion
 *
 * @param audioBase64 - Base64-encoded audio data
 * @returns Object with transcribed text and processing time
 * @throws Error - On API errors or connection failures
 */
async function transcribeLFM(audioBase64: string): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!WHISPER_API_URL) {
    throw new Error(
      "WHISPER_API_URL is required for LFM mode. " +
        "Set it to your LFM 2.5 Audio server URL (e.g., http://192.168.1.100:8888)"
    );
  }

  try {
    // Call the LFM server using OpenAI-compatible chat completions API (streaming required)
    const response = await fetch(`${WHISPER_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "LFM2.5-Audio-1.5B",
        messages: [
          {
            role: "system",
            content: "Perform ASR.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: "wav",
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.0,
        stream: true, // LFM 2.5 server requires streaming
      }),
      signal: AbortSignal.timeout(120000), // 120 second timeout for longer audio
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`LFM API error (${response.status}): ${errorText}`);
    }

    // Parse streaming response (SSE format)
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body from LFM server");
    }

    const decoder = new TextDecoder();
    let aggregatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              aggregatedText += content;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    if (!aggregatedText.trim()) {
      throw new Error("No speech detected in audio");
    }

    console.log(`[LFM] Transcribed: "${aggregatedText.trim().substring(0, 100)}..."`);

    return {
      text: aggregatedText.trim(),
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error(`LFM API request timed out (120s limit). Server: ${WHISPER_API_URL}`);
      }
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        throw new Error(
          `Cannot connect to LFM API at ${WHISPER_API_URL}. ` + `Make sure the llama-liquid-audio-server is running.`
        );
      }
      throw error;
    }
    throw new Error("Unknown error during LFM transcription");
  }
}

/**
 * Transcribes audio using remote Whisper.cpp HTTP server.
 *
 * Sends audio to a whisper.cpp server instance via its /inference
 * endpoint. Compatible with the standard whisper.cpp HTTP server.
 *
 * Purpose & Reasoning:
 *   Whisper.cpp servers provide a lightweight, efficient option
 *   for self-hosted transcription without the complexity of
 *   multimodal models.
 *
 * Key Technologies/APIs:
 *   - fetch: POST to /inference endpoint
 *   - FormData: Multipart form with audio file
 *   - AbortSignal.timeout: 60-second timeout
 *   - task=translate: Whisper translation parameter
 *
 * @param audioBase64 - Base64-encoded audio data
 * @param translate - Whether to translate non-English audio to English
 * @returns Object with transcribed text and processing time
 * @throws Error - On API errors or connection failures
 */
async function transcribeWhisperCpp(
  audioBase64: string,
  translate: boolean = false
): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!WHISPER_API_URL) {
    throw new Error(
      "WHISPER_API_URL is required for Whisper.cpp mode. " +
        "Set it to your whisper.cpp server URL (e.g., http://192.168.1.100:8080)"
    );
  }

  try {
    // Decode base64 to binary
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Create form data with the audio file
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("file", audioBlob, "audio.wav");
    formData.append("response_format", "json");

    // Add translation parameter if requested
    // Whisper.cpp server supports task=translate to translate to English
    if (translate) {
      formData.append("task", "translate");
    }

    // Call the Whisper API server
    const response = await fetch(`${WHISPER_API_URL}/inference`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Whisper API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Handle different response formats from whisper.cpp server
    const text = result.text || result.transcription || result.result || "";

    if (!text.trim()) {
      throw new Error("No speech detected in audio");
    }

    return {
      text: text.trim(),
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error(`Whisper API request timed out (60s limit). Server: ${WHISPER_API_URL}`);
      }
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        throw new Error(
          `Cannot connect to Whisper API at ${WHISPER_API_URL}. ` +
            `Make sure the whisper.cpp server is running: ./server -m model.bin --host 0.0.0.0 --port 8080`
        );
      }
      throw error;
    }
    throw new Error("Unknown error during Whisper transcription");
  }
}

/**
 * Transcribes audio using networked local server with auto-detection.
 *
 * Determines whether to use LFM or Whisper.cpp based on configuration
 * or auto-detection via endpoint probing.
 *
 * Key Technologies/APIs:
 *   - Endpoint probing: /v1/models for LFM, /health for Whisper
 *   - AbortSignal.timeout: Quick detection timeouts
 *
 * @param audioBase64 - Base64-encoded audio data
 * @param translate - Whether to translate non-English audio to English
 * @returns Object with transcribed text and processing time
 * @throws Error - If server unavailable or neither API detected
 */
async function transcribeNetworkedLocal(
  audioBase64: string,
  translate: boolean = false
): Promise<{ text: string; processingTime: number }> {
  if (!WHISPER_API_URL) {
    throw new Error(
      "WHISPER_API_URL is required for networked-local mode. " +
        "Set it to your audio server URL (e.g., http://192.168.1.100:8888)"
    );
  }

  // Determine which API to use
  if (AUDIO_API_TYPE === "lfm") {
    console.log("[Transcribe] Using LFM 2.5 Audio API");
    return transcribeLFM(audioBase64);
  }

  if (AUDIO_API_TYPE === "whisper") {
    console.log("[Transcribe] Using Whisper.cpp API");
    return transcribeWhisperCpp(audioBase64, translate);
  }

  // Auto-detect: try to probe the server type
  console.log("[Transcribe] Auto-detecting API type...");

  try {
    // Try to detect LFM server by checking /v1/models endpoint
    const modelsCheck = await fetch(`${WHISPER_API_URL}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (modelsCheck && modelsCheck.ok) {
      console.log("[Transcribe] Detected LFM/llama.cpp server (has /v1/models endpoint)");
      return transcribeLFM(audioBase64);
    }

    // Try to detect Whisper.cpp server by checking /health endpoint
    const healthCheck = await fetch(`${WHISPER_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (healthCheck && healthCheck.ok) {
      console.log("[Transcribe] Detected Whisper.cpp server (has /health endpoint)");
      return transcribeWhisperCpp(audioBase64, translate);
    }

    // Default to LFM since that's what the user is setting up
    console.log("[Transcribe] Could not detect API type, defaulting to LFM");
    return transcribeLFM(audioBase64);
  } catch (error) {
    console.error("[Transcribe] Error during API detection:", error);
    // Default to LFM
    return transcribeLFM(audioBase64);
  }
}

// ============================================
// Local Binary Transcription (Whisper.cpp)
// ============================================

/**
 * Transcribes audio using local Whisper.cpp binary.
 *
 * Writes audio to a temp file, executes the Whisper.cpp binary,
 * reads the output, and cleans up. Provides complete privacy
 * as no data leaves the local machine.
 *
 * Purpose & Reasoning:
 *   Local mode provides maximum privacy and zero external
 *   dependencies once set up. Suitable for air-gapped environments
 *   or users with strict data privacy requirements.
 *
 * Key Technologies/APIs:
 *   - fs: File write/read/unlink for temp files
 *   - child_process.execSync: Execute Whisper binary
 *   - os.tmpdir: System temp directory
 *   - path.join: Cross-platform path construction
 *
 * @param audioBase64 - Base64-encoded audio data
 * @returns Object with transcribed text and processing time
 * @throws Error - If binary missing, model missing, or processing fails
 */
async function transcribeLocalBinary(audioBase64: string): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  // Verify Whisper binary exists
  if (!existsSync(WHISPER_PATH)) {
    throw new Error(
      `Whisper binary not found at ${WHISPER_PATH}. ` + `Install from: https://github.com/ggerganov/whisper.cpp/releases`
    );
  }

  // Verify model file exists
  if (!existsSync(WHISPER_MODEL_PATH)) {
    throw new Error(
      `Whisper model not found at ${WHISPER_MODEL_PATH}. ` +
        `Download from: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin`
    );
  }

  // Create temp directory
  const tempDir = join(tmpdir(), "localflow");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const inputPath = join(tempDir, `audio_${timestamp}.wav`);
  const outputPath = join(tempDir, `audio_${timestamp}`);

  try {
    // Decode base64 to file
    const audioBuffer = Buffer.from(audioBase64, "base64");
    writeFileSync(inputPath, audioBuffer);

    // Execute Whisper.cpp
    const command = `"${WHISPER_PATH}" -m "${WHISPER_MODEL_PATH}" -f "${inputPath}" -t ${WHISPER_THREADS} -otxt -of "${outputPath}"`;

    execSync(command, {
      timeout: 60000, // 60 second timeout
      encoding: "utf-8",
    });

    // Read output
    const outputFile = `${outputPath}.txt`;
    if (!existsSync(outputFile)) {
      throw new Error("Whisper.cpp did not produce output file");
    }

    const text = readFileSync(outputFile, "utf-8").trim();

    // Cleanup
    unlinkSync(inputPath);
    unlinkSync(outputFile);

    if (!text) {
      throw new Error("No speech detected in audio");
    }

    return {
      text,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    // Cleanup on error
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
    } catch {
      /* ignore cleanup errors */
    }

    if (error instanceof Error) {
      if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
        throw new Error("Whisper.cpp execution timed out (60s limit)");
      }
      throw error;
    }
    throw new Error("Unknown error during local transcription");
  }
}

// ============================================
// Main Route Handler
// ============================================

/**
 * POST handler for audio transcription.
 *
 * Main API endpoint that receives audio data, validates it, selects
 * the appropriate processing mode, executes transcription, and
 * returns the results.
 *
 * Key Technologies/APIs:
 *   - NextRequest/NextResponse: Next.js App Router API types
 *   - Request.json(): Parse JSON request body
 *   - Response.json(): Return JSON response
 *
 * @param request - Next.js request object
 * @returns NextResponse with TranscribeResponse body
 *
 * @example
 * POST /api/dictation/transcribe
 * {
 *   "audio": "base64EncodedAudioString...",
 *   "mode": "cloud"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "text": "Hello world",
 *   "wordCount": 2,
 *   "mode": "cloud",
 *   "processingTime": 500
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<TranscribeResponse>> {
  try {
    const body = await request.json();

    // Validate request
    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: "Audio data is required",
          mode: getEffectiveMode(body.mode),
        },
        { status: 400 }
      );
    }

    const mode = getEffectiveMode(body.mode);
    const translate = body.translate === true;

    let result: { text: string; processingTime?: number };

    switch (mode) {
      case "cloud":
        result = await transcribeCloud(body.audio, translate);
        break;
      case "networked-local":
        result = await transcribeNetworkedLocal(body.audio, translate);
        break;
      case "local":
        // Local binary doesn't support translation yet
        if (translate) {
          console.warn("[Transcribe] Translation not supported in local binary mode, transcribing only");
        }
        result = await transcribeLocalBinary(body.audio);
        break;
      default:
        throw new Error(`Unknown processing mode: ${mode}`);
    }

    return NextResponse.json({
      success: true,
      text: result.text,
      wordCount: countWords(result.text),
      mode,
      processingTime: result.processingTime,
    });
  } catch (error) {
    console.error("[Transcribe] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: "Transcription failed",
        details: errorMessage,
        mode: getEffectiveMode(),
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * Responds to CORS preflight requests with appropriate headers
 * to allow cross-origin requests from the desktop agent.
 *
 * @returns NextResponse with CORS headers
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
