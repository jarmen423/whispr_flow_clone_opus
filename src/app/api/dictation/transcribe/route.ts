import { NextRequest, NextResponse } from "next/server";
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

// Environment configuration
const PROCESSING_MODE = process.env.PROCESSING_MODE || "cloud";
const WHISPER_PATH = process.env.WHISPER_PATH || "/usr/local/bin/whisper";
const WHISPER_MODEL_PATH = process.env.WHISPER_MODEL_PATH || "./models/ggml-small-q5_1.bin";
const WHISPER_THREADS = process.env.WHISPER_THREADS || "4";
// Remote Whisper API URL (for networked local mode)
// If set, uses HTTP API instead of local binary execution
const WHISPER_API_URL = process.env.WHISPER_API_URL || "";

interface TranscribeRequest {
  audio: string; // base64-encoded audio
  mode?: "cloud" | "local";
}

interface TranscribeResponse {
  success: boolean;
  text?: string;
  wordCount?: number;
  mode?: "cloud" | "local";
  processingTime?: number;
  error?: string;
  details?: string;
}

/**
 * Validate incoming transcription request
 */
function validateRequest(data: unknown): data is TranscribeRequest {
  if (!data || typeof data !== "object") return false;
  const req = data as Record<string, unknown>;
  
  if (!req.audio || typeof req.audio !== "string") {
    return false;
  }
  
  if (req.audio.length > 5_000_000) {
    throw new Error("Audio too large (max 5MB)");
  }
  
  if (req.mode && !["cloud", "local"].includes(req.mode as string)) {
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
 * Cloud transcription using browser-based Web Speech API simulation
 * In production, this would use z-ai-web-dev-sdk or similar
 */
async function transcribeCloud(_audioBase64: string): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();
  
  // In a real implementation, you would use:
  // import { ZAI } from "z-ai-web-dev-sdk";
  // const zai = new ZAI();
  // const result = await zai.audio.asr.create({ file_base64: audioBase64 });
  
  // For demo purposes, we'll simulate the API call
  // This is where you'd integrate with your actual cloud ASR service
  
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return simulated transcription
  // In production, replace this with actual API call
  const text = "This is a demo transcription. Replace this with actual cloud ASR integration.";
  
  return {
    text,
    processingTime: Date.now() - startTime,
  };
}

/**
 * Remote transcription using Whisper.cpp HTTP API server
 * This is used when WHISPER_API_URL is set (networked local mode)
 */
async function transcribeRemoteWhisper(audioBase64: string): Promise<{ text: string }> {
  try {
    // Test connection first
    const healthCheck = await fetch(`${WHISPER_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (!healthCheck || !healthCheck.ok) {
      // Try the inference endpoint directly if health check fails
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

    return { text: text.trim() };
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
    throw new Error("Unknown error during remote transcription");
  }
}

/**
 * Local transcription using Whisper.cpp binary (direct execution)
 */
async function transcribeLocalBinary(audioBase64: string): Promise<{ text: string }> {
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

    return { text };
  } catch (error) {
    // Cleanup on error
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
    } catch {}

    if (error instanceof Error) {
      if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
        throw new Error("Whisper.cpp execution timed out (60s limit)");
      }
      throw error;
    }
    throw new Error("Unknown error during local transcription");
  }
}

/**
 * Local transcription - routes to either remote API or local binary
 */
async function transcribeLocal(audioBase64: string): Promise<{ text: string }> {
  // If WHISPER_API_URL is set, use remote API (networked local mode)
  if (WHISPER_API_URL) {
    return transcribeRemoteWhisper(audioBase64);
  }
  
  // Otherwise, use local binary execution
  return transcribeLocalBinary(audioBase64);
}

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
          mode: body.mode || PROCESSING_MODE as "cloud" | "local",
        },
        { status: 400 }
      );
    }

    const mode = body.mode || (PROCESSING_MODE as "cloud" | "local");

    let result: { text: string; processingTime?: number };

    if (mode === "cloud") {
      result = await transcribeCloud(body.audio);
    } else {
      result = await transcribeLocal(body.audio);
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
        mode: PROCESSING_MODE as "cloud" | "local",
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
