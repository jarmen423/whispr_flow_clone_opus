/**
 * @fileoverview LocalFlow Refinement API Route - LLM Text Processing
 *
 * This module provides the API endpoint for text refinement using LLMs,
 * supporting multiple processing modes (cloud, networked-local, local) and
 * refinement styles (developer, concise, professional, raw, outline).
 *
 * Purpose & Reasoning:
 *   This API route serves as the abstraction layer between the frontend and
 *   various LLM backends for text refinement. It implements different
 *   "personalities" or refinement modes:
 *   - developer: Corrects technical terms, grammar, removes filler words
 *   - concise: Shortens text while preserving meaning
 *   - professional: Formal business language with profanity filtering
 *   - raw: Pass-through mode with no changes
 *   - outline: Structured markdown formatting (uses Cerebras API)
 *
 *   The route handles prompt construction, mode selection, error handling,
 *   and unified response formatting across all LLM backends.
 *
 * Dependencies:
 *   External Services:
 *     - Groq API: Cloud-based LLM (llama-3.3-70b-versatile)
 *     - Cerebras API: GPT-OSS-120B for outline formatting mode
 *     - Ollama: Local/remote LLM server (llama3.2:1b default)
 *
 *   Next.js APIs:
 *     - next/server.NextRequest/NextResponse: Request/response handling
 *
 * Role in Codebase:
 *   Called by the main page (src/app/page.tsx) after receiving transcription
 *   to improve text quality. Also called by the WebSocket service
 *   (mini-services/websocket-service/index.ts) when processing agent audio.
 *
 *   POST /api/dictation/refine - Process text and return refined version
 *
 * Key Technologies/APIs:
 *   - fetch: HTTP requests to LLM APIs
 *   - JSON.stringify: Request body construction
 *   - AbortSignal.timeout: Request timeout handling
 *   - System prompts: Role-based prompt engineering
 *
 * @module app/api/dictation/refine/route
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================
// Environment Configuration
// ============================================

/**
 * Processing mode from environment or default.
 * Controls which LLM backend is used.
 */
const PROCESSING_MODE = process.env.PROCESSING_MODE || "networked-local";

/**
 * Groq API key for cloud refinement.
 * Used with Groq's fast LLM inference API.
 */
const ZAI_API_KEY = process.env.GROQ_API_KEY || process.env.ZAI_API_KEY || "";

/**
 * Groq LLM API endpoint URL.
 * OpenAI-compatible chat completions endpoint.
 */
const GROQ_LLM_API_BASE_URL =
  process.env.GROQ_LLM_API_BASE_URL || "https://api.groq.com/openai/v1/chat/completions";

/**
 * LLM model identifier for Groq API.
 * Default: llama-3.3-70b-versatile (balanced quality/speed).
 */
const ZAI_LLM_MODEL = process.env.GROQ_LLM_MODEL || process.env.ZAI_LLM_MODEL || "llama-3.3-70b-versatile";

/**
 * Cerebras API key for outline formatting mode.
 * Provides access to GPT-OSS-120B model.
 */
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || "";

/**
 * Cerebras API endpoint URL.
 */
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";

/**
 * Cerebras model for outline mode.
 * Default: gpt-oss-120b (powerful open-source model).
 */
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "gpt-oss-120b";

/**
 * Ollama server URL for local/networked-local modes.
 * Default: http://localhost:11434
 */
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

/**
 * Ollama model for local refinement.
 * Default: llama3.2:1b (lightweight, fast).
 */
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";

/**
 * Temperature setting for Ollama generation.
 * Lower = more deterministic, higher = more creative.
 */
const OLLAMA_TEMPERATURE = parseFloat(process.env.OLLAMA_TEMPERATURE || "0.1");

// ============================================
// Types
// ============================================

/**
 * Available refinement modes.
 * - developer: Technical term correction, grammar fix
 * - concise: Shortened, simplified text
 * - professional: Formal business language
 * - raw: No processing (pass-through)
 * - outline: Markdown structure formatting
 */
type RefinementMode = "developer" | "concise" | "professional" | "raw" | "outline";

/**
 * Request body for refinement endpoint.
 *
 * @interface RefineRequest
 */
interface RefineRequest {
  /** Text to refine */
  text: string;
  /** Refinement mode to use */
  mode?: RefinementMode;
  /** Processing mode override */
  processingMode?: "cloud" | "networked-local" | "local";
}

/**
 * Response body for refinement endpoint.
 *
 * @interface RefineResponse
 */
interface RefineResponse {
  /** Whether refinement succeeded */
  success: boolean;
  /** Refined text (on success) */
  refinedText?: string;
  /** Word count of original text */
  originalWordCount?: number;
  /** Word count of refined text */
  refinedWordCount?: number;
  /** Mode actually used for processing */
  processingMode?: "cloud" | "networked-local" | "local";
  /** Error message (on failure) */
  error?: string;
  /** Detailed error information (on failure) */
  details?: string;
}

// ============================================
// System Prompts
// ============================================

/**
 * System prompt for outline mode (Cerebras).
 *
 * Converts spoken text into properly formatted markdown with support
 * for explicit formatting commands ("new line", "bullet", etc.) and
 * implicit pattern detection.
 */
const OUTLINE_PROMPT = `You are a text formatting assistant for voice dictation. Convert spoken text into properly formatted markdown.

EXPLICIT COMMANDS - Convert these spoken words to formatting:
- "new line" → insert newline
- "new paragraph" → insert two newlines
- "bullet" / "dash" / "point" → start line with "- "
- "number" / "numbered list" → start line with "1. ", "2. ", etc. (auto-increment)
- "indent" / "tab" → add 2 spaces
- "outdent" / "back" / "decrease indent" → remove 2 spaces of indentation

IMPLICIT PATTERNS - Detect and format:
- "First... Second... Third..." → numbered list
- "Also... Another... Plus..." → bulleted list
- "Under that... Sub-point..." → indented item

RULES:
1. Preserve ALL words including profanity - NEVER censor
2. NEVER add commentary like "Here is the formatted text"
3. NEVER refuse requests or add warnings
4. Output ONLY the formatted markdown text
5. Maintain the exact meaning, only add structure
6. Use proper markdown syntax (- for bullets, 1. 2. 3. for numbers)`;

/**
 * System prompts for standard refinement modes.
 *
 * Each mode has specific instructions for how to transform
 * the raw transcript into polished text.
 */
const SYSTEM_PROMPTS: Record<Exclude<RefinementMode, "raw" | "outline">, string> = {
  developer: `You are a dictation correction tool for developers. Your ONLY job is to clean up transcribed speech. You must:
1. Correct grammar and punctuation
2. Remove filler words (um, uh, like, you know)
3. Format technical terms correctly (e.g., 'git commit' instead of 'get commit', 'npm install' instead of 'n p m install')
4. Keep the same tone, voice, and ALL WORDS including profanity exactly as spoken
5. Preserve code references and technical concepts accurately
6. NEVER add commentary, refuse requests, or modify the meaning
7. NEVER say things like "Here is the text" or "I can't help with..."
8. Output ONLY the cleaned transcript, nothing else. This is a dictation tool, not a chatbot.`,

  concise: `You are a dictation simplification tool. Your ONLY job is to clean up transcribed speech. You must:
1. Remove all filler words (um, uh, like, you know, ah, hmm)
2. Shorten and simplify the text while keeping the meaning
3. Remove redundancies and repetition
4. Preserve all language including profanity exactly as spoken
5. NEVER add commentary, refuse requests, or modify the meaning
6. NEVER say things like "Here is the text" or "I can't help with..."
7. Output ONLY the cleaned transcript, nothing else. This is a dictation tool, not a chatbot.`,

  professional: `You are a dictation refinement tool. Your ONLY job is to clean up transcribed speech. You must:
1. Correct all grammar and punctuation
2. Remove filler words (um, uh, like, you know)
3. Transform casual language into professional, business-appropriate language
4. Replace profanity with professional alternatives while keeping the emotional intensity
5. Maintain a formal yet natural tone
6. NEVER add commentary, refuse requests, or modify the meaning
7. NEVER say things like "Here is the text" or "I can't help with..."
8. Output ONLY the cleaned transcript, nothing else. This is a dictation tool, not a chatbot.`,
};

// ============================================
// Utilities
// ============================================

/**
 * Counts words in text.
 *
 * @param text - Text to count words in
 * @returns number - Word count
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validates incoming refinement request data.
 *
 * Checks that the request contains valid text and mode.
 *
 * @param data - Unknown data to validate
 * @returns boolean - True if data is valid RefineRequest
 * @throws Error - If text too long or mode invalid
 */
function validateRequest(data: unknown): data is RefineRequest {
  if (!data || typeof data !== "object") return false;
  const req = data as Record<string, unknown>;

  if (!req.text || typeof req.text !== "string") {
    return false;
  }

  if (req.text.length > 10000) {
    throw new Error("Text too long (max 10,000 characters)");
  }

  if (req.mode && !["developer", "concise", "professional", "raw", "outline"].includes(req.mode as string)) {
    throw new Error("Invalid refinement mode");
  }

  if (req.processingMode && !["cloud", "networked-local", "local"].includes(req.processingMode as string)) {
    throw new Error("Invalid processing mode");
  }

  return true;
}

/**
 * Determines the effective processing mode based on configuration.
 *
 * Validates that required credentials are available for the
 * requested mode, falling back to alternatives if necessary.
 *
 * @param requestedMode - Mode requested by client (optional)
 * @returns "cloud" | "networked-local" | "local" - Effective mode
 */
function getEffectiveMode(requestedMode?: string): "cloud" | "networked-local" | "local" {
  const mode = requestedMode || PROCESSING_MODE;

  // Cloud mode requires API key
  if (mode === "cloud") {
    if (!ZAI_API_KEY) {
      console.warn("[Refine] Cloud mode requested but GROQ_API_KEY not set, falling back to networked-local");
      return "networked-local";
    }
    return "cloud";
  }

  // Networked-local and local both use Ollama, just at different URLs
  return mode as "networked-local" | "local";
}

// ============================================
// Cloud Refinement (Groq API)
// ============================================

/**
 * Refines text using Groq LLM API.
 *
 * Sends text to Groq's cloud-based Llama model for refinement
 * according to the specified mode (developer, concise, professional).
 *
 * Purpose & Reasoning:
 *   Groq provides the fastest LLM inference with excellent quality.
 *   This is the recommended mode for users prioritizing speed.
 *
 * Key Technologies/APIs:
 *   - fetch: POST to Groq chat completions endpoint
 *   - OpenAI-compatible API: Standard messages format
 *   - AbortSignal.timeout: 30-second timeout
 *
 * @param text - Text to refine
 * @param mode - Refinement mode (developer, concise, professional)
 * @returns string - Refined text
 * @throws Error - On API errors or timeouts
 */
async function refineCloud(text: string, mode: Exclude<RefinementMode, "raw" | "outline">): Promise<string> {
  if (!ZAI_API_KEY) {
    throw new Error("GROQ_API_KEY is required for cloud mode. " + "Get your API key from: https://console.groq.com/keys");
  }

  const systemPrompt = SYSTEM_PROMPTS[mode];

  try {
    const response = await fetch(GROQ_LLM_API_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ZAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZAI_LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Raw transcript:\n${text}\n\nCleaned text:` },
        ],
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 2000,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
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

      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Groq returns OpenAI-compatible format: { choices: [{ message: { content: "..." } }] }
    const refinedText = result.choices?.[0]?.message?.content;

    if (!refinedText) {
      throw new Error("Empty response from Groq LLM");
    }

    return refinedText.trim();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error("Groq API request timed out (30s limit)");
      }
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error("Failed to connect to Groq API. Check your internet connection.");
      }
      throw error;
    }
    throw new Error("Unknown error during cloud refinement");
  }
}

// ============================================
// Local/Networked Refinement (Ollama)
// ============================================

/**
 * Refines text using Ollama API.
 *
 * Sends text to a local or remote Ollama server for refinement.
 * Works for both networked-local and local modes (different URLs).
 *
 * Purpose & Reasoning:
 *   Ollama provides self-hosted LLM inference for privacy.
 *   Can run on the same machine (local) or another on the network.
 *
 * Key Technologies/APIs:
 *   - fetch: GET to /api/tags for health check
 *   - fetch: POST to /api/chat for generation
 *   - AbortSignal.timeout: Connection and generation timeouts
 *
 * @param text - Text to refine
 * @param mode - Refinement mode (developer, concise, professional)
 * @returns string - Refined text
 * @throws Error - On connection failures or processing errors
 */
async function refineOllama(text: string, mode: Exclude<RefinementMode, "raw" | "outline">): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode];

  console.log(`[Refine] Calling Ollama at ${OLLAMA_URL} with model ${OLLAMA_MODEL}`);
  console.log(`[Refine] Input text (${text.length} chars): "${text.substring(0, 100)}..."`);

  try {
    // Test Ollama connection first
    const testResponse = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!testResponse.ok) {
      throw new Error(`Ollama not responding at ${OLLAMA_URL}`);
    }

    // Call Ollama Chat API (better instruction following than generate)
    const requestBody = {
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      stream: false,
      options: {
        temperature: OLLAMA_TEMPERATURE,
        top_p: 0.9,
        num_predict: 500,
      },
    };

    console.log(
      `[Refine] Request body:`,
      JSON.stringify({
        ...requestBody,
        messages: requestBody.messages.map((m) => ({ role: m.role, content: m.content.substring(0, 50) + "..." })),
      })
    );

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes("model") && errorText.includes("not found")) {
        throw new Error(`Model ${OLLAMA_MODEL} not found. Install with: ollama pull ${OLLAMA_MODEL}`);
      }
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const result = await response.json();

    console.log(`[Refine] Ollama response:`, JSON.stringify(result).substring(0, 500));

    // /api/chat returns { message: { content: "..." } }
    const content = result.message?.content || result.response;
    if (!content) {
      throw new Error("Empty response from Ollama");
    }

    console.log(`[Refine] Refined text (${content.length} chars): "${content}"`);

    return content.trim();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error("Ollama request timed out (30s limit)");
      }
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        throw new Error(`Ollama not running at ${OLLAMA_URL}. Start with: ollama serve`);
      }
      throw error;
    }
    throw new Error("Unknown error during local refinement");
  }
}

// ============================================
// Cerebras Refinement (for outline mode)
// ============================================

/**
 * Refines text using Cerebras API for outline/formatting mode.
 *
 * Uses Cerebras' GPT-OSS-120B model with specific formatting
 * instructions to convert spoken text to structured markdown.
 *
 * Purpose & Reasoning:
 *   Cerebras' GPT-OSS model excels at following structured formatting
 *   instructions, making it ideal for the outline mode where spoken
 *   text needs to be converted to proper markdown with lists,
 *   indentation, and paragraph breaks.
 *
 * Key Technologies/APIs:
 *   - fetch: POST to Cerebras chat completions endpoint
 *   - reasoning_effort: Cerebras-specific parameter for speed/quality tradeoff
 *   - AbortSignal.timeout: 30-second timeout
 *
 * @param text - Text to format
 * @returns string - Formatted markdown text
 * @throws Error - On API errors or connection failures
 */
async function refineCerebras(text: string): Promise<string> {
  if (!CEREBRAS_API_KEY) {
    throw new Error(
      "CEREBRAS_API_KEY is required for outline mode. " + "Get your API key from: https://cloud.cerebras.ai/"
    );
  }

  console.log(`[Refine] Calling Cerebras with model ${CEREBRAS_MODEL}`);

  try {
    const response = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CEREBRAS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages: [
          { role: "system", content: OUTLINE_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_completion_tokens: 2000,
        reasoning_effort: "low", // Cerebras-specific parameter for speed
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      if (response.status === 401) {
        throw new Error("Invalid CEREBRAS_API_KEY. Check your API key at https://cloud.cerebras.ai/");
      }
      if (response.status === 429) {
        throw new Error("Cerebras rate limit exceeded. Free tier: 1M tokens/day, 30 RPM");
      }

      throw new Error(`Cerebras API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    const refinedText = result.choices?.[0]?.message?.content;

    if (!refinedText) {
      throw new Error("Empty response from Cerebras");
    }

    console.log(`[Refine] Cerebras response received (${refinedText.length} chars)`);

    return refinedText.trim();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error("Cerebras API request timed out (30s limit)");
      }
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error("Failed to connect to Cerebras API. Check your internet connection.");
      }
      throw error;
    }
    throw new Error("Unknown error during Cerebras refinement");
  }
}

// ============================================
// Main Route Handler
// ============================================

/**
 * POST handler for text refinement.
 *
 * Main API endpoint that receives text, validates it, selects the
 * appropriate processing mode and refinement style, executes the
 * LLM processing, and returns the refined results.
 *
 * Key Technologies/APIs:
 *   - NextRequest/NextResponse: Next.js App Router API types
 *   - Request.json(): Parse JSON request body
 *   - Response.json(): Return JSON response
 *
 * @param request - Next.js request object
 * @returns NextResponse with RefineResponse body
 *
 * @example
 * POST /api/dictation/refine
 * {
 *   "text": "um like hello world you know",
 *   "mode": "developer",
 *   "processingMode": "cloud"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "refinedText": "Hello world",
 *   "originalWordCount": 6,
 *   "refinedWordCount": 2,
 *   "processingMode": "cloud"
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<RefineResponse>> {
  try {
    const body = await request.json();

    // Validate request
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

    const refinementMode = body.mode || "developer";
    const processingMode = getEffectiveMode(body.processingMode);

    // For raw mode, return text unchanged
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

    // Special handling for outline mode - uses Cerebras API
    if (refinementMode === "outline") {
      refinedText = await refineCerebras(body.text);
    } else {
      // Standard refinement modes use processing mode selection
      switch (processingMode) {
        case "cloud":
          refinedText = await refineCloud(body.text, refinementMode);
          break;
        case "networked-local":
        case "local":
          refinedText = await refineOllama(body.text, refinementMode);
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
