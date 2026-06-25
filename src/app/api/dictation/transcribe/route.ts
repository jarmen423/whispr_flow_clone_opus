/**
 * @fileoverview LocalFlow Transcription API Route - Speech-to-Text Processing
 *
 * This module provides the API endpoint for audio transcription, supporting
 * multiple processing modes: cloud (Groq API), networked-local (remote Whisper/LFM
 * servers), and local (Whisper.cpp binary execution).
 *
 * POST /api/dictation/transcribe - Process audio and return transcription
 *
 * @module app/api/dictation/transcribe/route
 */

import { NextRequest, NextResponse } from "next/server";
import { ZAI_API_KEY, WHISPER_API_URL, PROCESSING_MODE } from "./config";
import { transcribeCloud } from "./providers/cloud";
import { transcribeNetworkedLocal } from "./providers/networked-local";
import { transcribeLocalBinary } from "./providers/local-binary";

// ============================================
// Types
// ============================================

interface TranscribeRequest {
  audio: string;
  mode?: "cloud" | "networked-local" | "local";
  translate?: boolean;
  apiKey?: string;
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

function validateRequest(data: unknown): data is TranscribeRequest {
  if (!data || typeof data !== "object") return false;
  const req = data as Record<string, unknown>;

  if (!req.audio || typeof req.audio !== "string") {
    return false;
  }

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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getEffectiveMode(
  requestedMode?: string,
  apiKey?: string
): "cloud" | "networked-local" | "local" {
  const mode = requestedMode || PROCESSING_MODE;

  if (mode === "cloud") {
    if (!apiKey && !ZAI_API_KEY) {
      console.warn(
        "[Transcribe] Cloud mode requested but no GROQ_API_KEY provided, falling back to networked-local"
      );
      return WHISPER_API_URL ? "networked-local" : "local";
    }
    return "cloud";
  }

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
// Route Handlers
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<TranscribeResponse>> {
  try {
    const contentType = request.headers.get("content-type") || "";
    let audioBase64: string | Buffer;
    let mode: string | undefined;
    let translate: boolean;
    let apiKey: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File | null;

      if (!audioFile) {
        return NextResponse.json(
          { success: false, error: "No audio file in multipart request" },
          { status: 400 }
        );
      }

      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

      if (audioBuffer.length > 7_500_000) {
        return NextResponse.json(
          {
            success: false,
            error: "Audio too large (max ~7.5MB raw)",
            details: `Audio size: ~${Math.round(audioBuffer.length / 100000) / 10}MB`,
            mode: getEffectiveMode(mode),
          },
          { status: 413 }
        );
      }

      audioBase64 = audioBuffer;
      mode = (formData.get("mode") as string) || undefined;
      translate = formData.get("translate") === "true";
      apiKey = (formData.get("apiKey") as string) || undefined;
    } else {
      const body = await request.json();

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

      audioBase64 = body.audio;
      mode = body.mode;
      translate = body.translate === true;
      apiKey = body.apiKey;
    }

    const effectiveMode = getEffectiveMode(mode, apiKey);

    let result: { text: string; processingTime?: number };

    switch (effectiveMode) {
      case "cloud":
        result = await transcribeCloud(audioBase64, translate, apiKey);
        break;
      case "networked-local":
        result = await transcribeNetworkedLocal(audioBase64, translate);
        break;
      case "local":
        if (translate) {
          console.warn("[Transcribe] Translation not supported in local binary mode, transcribing only");
        }
        result = await transcribeLocalBinary(audioBase64);
        break;
      default:
        throw new Error(`Unknown processing mode: ${effectiveMode}`);
    }

    return NextResponse.json({
      success: true,
      text: result.text,
      wordCount: countWords(result.text),
      mode: effectiveMode,
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
