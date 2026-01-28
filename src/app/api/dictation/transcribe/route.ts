import { NextRequest, NextResponse } from "next/server";
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

// ============================================
// Environment Configuration
// ============================================

// Processing mode: 'cloud' | 'networked-local' | 'local'
const PROCESSING_MODE = process.env.PROCESSING_MODE || "networked-local";

// Z.AI Cloud API Configuration
const ZAI_API_KEY = process.env.ZAI_API_KEY || "";
const ZAI_API_BASE_URL = process.env.ZAI_API_BASE_URL || "https://api.z.ai/api/paas/v4";
const ZAI_ASR_MODEL = process.env.ZAI_ASR_MODEL || "glm-asr-2512";

// Remote Whisper API Configuration (for networked-local mode)
const WHISPER_API_URL = process.env.WHISPER_API_URL || "";

// Local Whisper Binary Configuration (for local mode)
const WHISPER_PATH = process.env.WHISPER_PATH || "/usr/local/bin/whisper";
const WHISPER_MODEL_PATH = process.env.WHISPER_MODEL_PATH || "./models/ggml-small-q5_1.bin";
const WHISPER_THREADS = process.env.WHISPER_THREADS || "4";

// ============================================
// Types
// ============================================

interface TranscribeRequest {
  audio: string; // base64-encoded audio
  mode?: "cloud" | "networked-local" | "local";
}

interface TranscribeResponse {
  success: boolean;
  text?: string;
  wordCount?: number;
  mode?: "cloud" | "networked-local" | "local";
  processingTime?: number;
  error?: string;
  details?: string;
}

// ============================================
// Utilities
// ============================================

/**
 * Validate incoming transcription request
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

  return true;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Determine effective processing mode based on configuration
 */
function getEffectiveMode(requestedMode?: string): "cloud" | "networked-local" | "local" {
  const mode = requestedMode || PROCESSING_MODE;

  // Cloud mode requires API key
  if (mode === "cloud") {
    if (!ZAI_API_KEY) {
      console.warn("[Transcribe] Cloud mode requested but ZAI_API_KEY not set, falling back to networked-local");
      return WHISPER_API_URL ? "networked-local" : "local";
    }
    return "cloud";
  }

  // Networked-local mode requires WHISPER_API_URL
  if (mode === "networked-local") {
    if (!WHISPER_API_URL) {
      console.warn("[Transcribe] Networked-local mode requested but WHISPER_API_URL not set, falling back to local");
      return "local";
    }
    return "networked-local";
  }

  return "local";
}

// ============================================
// Cloud Transcription (Z.AI API)
// ============================================

/**
 * Transcribe audio using Z.AI GLM-ASR-2512 API
 * API Docs: https://docs.z.ai/api-reference/audio/audio-transcriptions
 */
async function transcribeCloud(audioBase64: string): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!ZAI_API_KEY) {
    throw new Error(
      "ZAI_API_KEY is required for cloud mode. " +
      "Get your API key from: https://z.ai/manage-apikey/apikey-list"
    );
  }

  try {
    // Z.AI ASR API accepts file_base64 for base64-encoded audio
    const response = await fetch(`${ZAI_API_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZAI_ASR_MODEL,
        file_base64: audioBase64,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      
      // Handle common error cases
      if (response.status === 401) {
        throw new Error("Invalid ZAI_API_KEY. Check your API key at https://z.ai/manage-apikey/apikey-list");
      }
      if (response.status === 429) {
        throw new Error("Z.AI rate limit exceeded. Please try again later.");
      }
      if (response.status === 400 && errorText.includes("duration")) {
        throw new Error("Audio too long. Maximum duration is 30 seconds.");
      }
      
      throw new Error(`Z.AI API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Z.AI ASR returns { text: "transcribed text", ... }
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
        throw new Error("Z.AI API request timed out (60s limit)");
      }
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error("Failed to connect to Z.AI API. Check your internet connection.");
      }
      throw error;
    }
    throw new Error("Unknown error during cloud transcription");
  }
}

// ============================================
// Networked Local Transcription (Remote Whisper Server)
// ============================================

/**
 * Transcribe using remote Whisper.cpp HTTP API server
 */
async function transcribeNetworkedLocal(audioBase64: string): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!WHISPER_API_URL) {
    throw new Error(
      "WHISPER_API_URL is required for networked-local mode. " +
      "Set it to your whisper.cpp server URL (e.g., http://192.168.1.100:8080)"
    );
  }

  try {
    // Test connection first
    const healthCheck = await fetch(`${WHISPER_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (!healthCheck || !healthCheck.ok) {
      console.log("[Whisper API] Health check not available, trying inference directly");
    }

    // Decode base64 to binary
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Create form data with the audio file
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("file", audioBlob, "audio.wav");
    formData.append("response_format", "json");

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
    throw new Error("Unknown error during networked transcription");
  }
}

// ============================================
// Local Binary Transcription (Whisper.cpp)
// ============================================

/**
 * Transcribe using local Whisper.cpp binary
 */
async function transcribeLocalBinary(audioBase64: string): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  // Verify Whisper binary exists
  if (!existsSync(WHISPER_PATH)) {
    throw new Error(
      `Whisper binary not found at ${WHISPER_PATH}. ` +
      `Install from: https://github.com/ggerganov/whisper.cpp/releases`
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
    } catch { /* ignore cleanup errors */ }

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

    let result: { text: string; processingTime?: number };

    switch (mode) {
      case "cloud":
        result = await transcribeCloud(body.audio);
        break;
      case "networked-local":
        result = await transcribeNetworkedLocal(body.audio);
        break;
      case "local":
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

// Handle OPTIONS for CORS
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
