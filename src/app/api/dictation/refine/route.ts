import { NextRequest, NextResponse } from "next/server";

// ============================================
// Environment Configuration
// ============================================

// Processing mode: 'cloud' | 'networked-local' | 'local'
const PROCESSING_MODE = process.env.PROCESSING_MODE || "networked-local";

// Z.AI Cloud API Configuration
const ZAI_API_KEY = process.env.ZAI_API_KEY || "";
const ZAI_API_BASE_URL = process.env.ZAI_API_BASE_URL || "https://api.z.ai/api/paas/v4";
const ZAI_LLM_MODEL = process.env.ZAI_LLM_MODEL || "glm-4.7-flash";

// Ollama Configuration (for networked-local and local modes)
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";
const OLLAMA_TEMPERATURE = parseFloat(process.env.OLLAMA_TEMPERATURE || "0.1");

// ============================================
// Types
// ============================================

type RefinementMode = "developer" | "concise" | "professional" | "raw";

interface RefineRequest {
  text: string;
  mode?: RefinementMode;
  processingMode?: "cloud" | "networked-local" | "local";
}

interface RefineResponse {
  success: boolean;
  refinedText?: string;
  originalWordCount?: number;
  refinedWordCount?: number;
  processingMode?: "cloud" | "networked-local" | "local";
  error?: string;
  details?: string;
}

// ============================================
// System Prompts
// ============================================

const SYSTEM_PROMPTS: Record<Exclude<RefinementMode, "raw">, string> = {
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
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate incoming refine request
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

  if (req.mode && !["developer", "concise", "professional", "raw"].includes(req.mode as string)) {
    throw new Error("Invalid refinement mode");
  }

  if (req.processingMode && !["cloud", "networked-local", "local"].includes(req.processingMode as string)) {
    throw new Error("Invalid processing mode");
  }

  return true;
}

/**
 * Determine effective processing mode based on configuration
 */
function getEffectiveMode(requestedMode?: string): "cloud" | "networked-local" | "local" {
  const mode = requestedMode || PROCESSING_MODE;

  // Cloud mode requires API key
  if (mode === "cloud") {
    if (!ZAI_API_KEY) {
      console.warn("[Refine] Cloud mode requested but ZAI_API_KEY not set, falling back to networked-local");
      return "networked-local";
    }
    return "cloud";
  }

  // Networked-local and local both use Ollama, just at different URLs
  return mode as "networked-local" | "local";
}

// ============================================
// Cloud Refinement (Z.AI API)
// ============================================

/**
 * Refine text using Z.AI GLM-4.7-Flash API
 * API Docs: https://docs.z.ai/api-reference/llm/chat-completion
 */
async function refineCloud(text: string, mode: Exclude<RefinementMode, "raw">): Promise<string> {
  if (!ZAI_API_KEY) {
    throw new Error(
      "ZAI_API_KEY is required for cloud mode. " +
      "Get your API key from: https://z.ai/manage-apikey/apikey-list"
    );
  }

  const systemPrompt = SYSTEM_PROMPTS[mode];

  try {
    const response = await fetch(`${ZAI_API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZAI_API_KEY}`,
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
        // Disable thinking mode for faster responses
        thinking: { type: "disabled" },
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
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

      throw new Error(`Z.AI API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Z.AI returns OpenAI-compatible format: { choices: [{ message: { content: "..." } }] }
    const refinedText = result.choices?.[0]?.message?.content;

    if (!refinedText) {
      throw new Error("Empty response from Z.AI LLM");
    }

    return refinedText.trim();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error("Z.AI API request timed out (30s limit)");
      }
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error("Failed to connect to Z.AI API. Check your internet connection.");
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
 * Refine text using Ollama API
 * Works for both networked-local and local modes (just different OLLAMA_URL)
 */
async function refineOllama(text: string, mode: Exclude<RefinementMode, "raw">): Promise<string> {
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
        { role: "user", content: text }
      ],
      stream: false,
      options: {
        temperature: OLLAMA_TEMPERATURE,
        top_p: 0.9,
        num_predict: 500,
      },
    };

    console.log(`[Refine] Request body:`, JSON.stringify({ ...requestBody, messages: requestBody.messages.map(m => ({ role: m.role, content: m.content.substring(0, 50) + "..." })) }));

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
        throw new Error(
          `Model ${OLLAMA_MODEL} not found. Install with: ollama pull ${OLLAMA_MODEL}`
        );
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
        throw new Error(
          `Ollama not running at ${OLLAMA_URL}. Start with: ollama serve`
        );
      }
      throw error;
    }
    throw new Error("Unknown error during local refinement");
  }
}

// ============================================
// Main Route Handler
// ============================================

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
