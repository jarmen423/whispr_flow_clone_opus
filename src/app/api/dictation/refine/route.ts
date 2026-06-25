/**
 * @fileoverview LocalFlow Refinement API Route - LLM Text Processing
 *
 * This module provides the API endpoint for text refinement using LLMs,
 * supporting multiple processing modes (cloud, networked-local, local) and
 * refinement styles (developer, concise, professional, raw, outline, cleanup).
 *
 * POST /api/dictation/refine - Process text and return refined version
 *
 * @module app/api/dictation/refine/route
 */

import { NextRequest, NextResponse } from "next/server";
import {
  PROCESSING_MODE,
  ZAI_API_KEY,
  RefineRequest,
  RefineResponse,
  RefinementMode,
  RefineOperation,
  FormatTarget,
} from "./prompts";
import { refineCloud } from "./providers/groq";
import { refineOllama } from "./providers/ollama";
import { refineCerebras, formatText } from "./providers/cerebras";

// ============================================
// Utilities
// ============================================

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validateRequest(data: unknown): data is RefineRequest {
  if (!data || typeof data !== "object") return false;
  const req = data as Record<string, unknown>;

  if (!req.text || typeof req.text !== "string") {
    return false;
  }

  if (req.text.length > 10000) {
    throw new Error("Text too long (max 10,000 characters)");
  }

  if (req.operation && !["dictation_refine", "text_format"].includes(req.operation as string)) {
    throw new Error("Invalid refine operation");
  }

  if (req.mode && !["developer", "concise", "professional", "raw", "outline", "cleanup"].includes(req.mode as string)) {
    throw new Error("Invalid refinement mode");
  }

  if (req.formatTarget && !["markdown", "json", "jsonl", "csv", "cleanup"].includes(req.formatTarget as string)) {
    throw new Error("Invalid format target");
  }

  if (req.processingMode && !["cloud", "networked-local", "local"].includes(req.processingMode as string)) {
    throw new Error("Invalid processing mode");
  }

  if (req.translated !== undefined && typeof req.translated !== "boolean") {
    throw new Error("Invalid translated value (must be boolean)");
  }

  return true;
}

function getEffectiveMode(requestedMode?: string): "cloud" | "networked-local" | "local" {
  const mode = requestedMode || PROCESSING_MODE;

  if (mode === "cloud") {
    if (!ZAI_API_KEY) {
      console.warn("[Refine] Cloud mode requested but GROQ_API_KEY not set, falling back to networked-local");
      return "networked-local";
    }
    return "cloud";
  }

  return mode as "networked-local" | "local";
}

// ============================================
// Route Handlers
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<RefineResponse>> {
  try {
    const body = await request.json();

    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: "Text is required",
          processingMode: getEffectiveMode(body.processingMode),
        },
        { status: 400 }
      );
    }

    const operation: RefineOperation = body.operation || "dictation_refine";
    const refinementMode = body.mode || "developer";
    const formatTarget: FormatTarget = body.formatTarget || "markdown";
    const processingMode = getEffectiveMode(body.processingMode);
    const wasTranslated = body.translated === true;

    if (operation === "text_format") {
      const refinedText = await formatText(body.text, formatTarget);

      return NextResponse.json({
        success: true,
        refinedText,
        originalWordCount: countWords(body.text),
        refinedWordCount: countWords(refinedText),
        processingMode,
      });
    }

    if (refinementMode === "raw") {
      return NextResponse.json({
        success: true,
        refinedText: body.text,
        originalWordCount: countWords(body.text),
        refinedWordCount: countWords(body.text),
        processingMode,
      });
    }

    let refinedText: string;

    if (refinementMode === "outline") {
      refinedText = await refineCerebras(body.text);
    } else {
      switch (processingMode) {
        case "cloud":
          refinedText = await refineCloud(body.text, refinementMode, wasTranslated);
          break;
        case "networked-local":
        case "local":
          refinedText = await refineOllama(body.text, refinementMode, wasTranslated);
          break;
        default:
          throw new Error(`Unknown processing mode: ${processingMode}`);
      }
    }

    return NextResponse.json({
      success: true,
      refinedText,
      originalWordCount: countWords(body.text),
      refinedWordCount: countWords(refinedText),
      processingMode,
    });
  } catch (error) {
    console.error("[Refine] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: "Refinement failed",
        details: errorMessage,
        processingMode: getEffectiveMode(),
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
