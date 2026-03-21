/**
 * @fileoverview LocalFlow Voice Agent Query API Route
 *
 * Handles voice Q&A with optional web search via Brave Search API.
 * The model (Groq) decides whether to call the web_search tool based
 * on whether the question needs current/factual information.
 *
 * Flow:
 *   1. Receive transcribed question text
 *   2. Call Groq with web_search tool available
 *   3. If model calls web_search → execute Brave Search → inject results → call Groq again
 *   4. Return final answer (pasted at cursor by the agent)
 *
 * POST /api/agent/query
 *   Body: { text: string }
 *   Response: { success: boolean, answer?: string, error?: string }
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================
// Config
// ============================================

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.ZAI_API_KEY || "";
const GROQ_LLM_API_BASE_URL =
  process.env.GROQ_LLM_API_BASE_URL || "https://api.groq.com/openai/v1/chat/completions";

// Use a capable model for tool calling — 70b is more reliable at function calling than 20b
const AGENT_LLM_MODEL = process.env.AGENT_LLM_MODEL || "llama-3.3-70b-versatile";

const BRAVE_API_KEY = process.env.BRAVE_API_KEY || "";
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

// ============================================
// System Prompt
// ============================================

const AGENT_SYSTEM_PROMPT = `You are a fast, helpful voice assistant embedded in the user's desktop. The user speaks questions to you and your answers are pasted directly at their cursor position.

Guidelines:
- Keep answers concise and direct — no unnecessary preamble like "Great question!" or "Certainly!"
- Use web_search when the question needs current info, recent events, prices, names, or facts you're not confident about
- If the user asks you to write or draft something, just write it without explaining what you're doing
- Use plain prose by default; only use markdown structure (headers, lists) when it genuinely helps readability
- Today's date: ${new Date().toISOString().split("T")[0]}`;

// ============================================
// Tool Definition
// ============================================

const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current information, recent events, facts, prices, or anything requiring up-to-date knowledge",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
};

// ============================================
// Brave Search
// ============================================

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
}

async function braveSearch(query: string): Promise<string> {
  if (!BRAVE_API_KEY) throw new Error("BRAVE_API_KEY not configured");

  const url = `${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=5`;
  const response = await fetch(url, {
    headers: {
      "X-Subscription-Token": BRAVE_API_KEY,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Brave Search error (${response.status})`);
  }

  const data = await response.json();
  const results: BraveWebResult[] = data.web?.results || [];

  if (results.length === 0) return "No search results found.";

  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || ""}`)
    .join("\n\n");
}

// ============================================
// Agent Query Loop
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = Record<string, any>;

async function queryAgent(text: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY required for agent mode");

  const messages: Message[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

  // First call — model decides if it needs web search
  const firstResponse = await fetch(GROQ_LLM_API_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AGENT_LLM_MODEL,
      messages,
      tools: [WEB_SEARCH_TOOL],
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!firstResponse.ok) {
    const err = await firstResponse.text().catch(() => "");
    throw new Error(`Groq agent error (${firstResponse.status}): ${err}`);
  }

  const firstResult = await firstResponse.json();
  const firstChoice = firstResult.choices?.[0];
  if (!firstChoice) throw new Error("Empty response from Groq");

  // Model wants to search the web
  if (firstChoice.finish_reason === "tool_calls") {
    const toolCall = firstChoice.message?.tool_calls?.[0];
    if (toolCall?.function?.name === "web_search") {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      console.log(`[Agent] Web search: "${args.query}"`);

      const searchResults = await braveSearch(args.query);
      console.log(`[Agent] Search returned ${searchResults.length} chars`);

      // Append assistant tool-call message and the search result
      messages.push(firstChoice.message);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: searchResults,
      });

      // Second call — model answers with search context
      const finalResponse = await fetch(GROQ_LLM_API_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AGENT_LLM_MODEL,
          messages,
          temperature: 0.3,
          max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!finalResponse.ok) {
        const err = await finalResponse.text().catch(() => "");
        throw new Error(`Groq final response error (${finalResponse.status}): ${err}`);
      }

      const finalResult = await finalResponse.json();
      const answer = finalResult.choices?.[0]?.message?.content;
      if (!answer) throw new Error("Empty final response from Groq");
      return answer.trim();
    }
  }

  // Model answered directly without searching
  const answer = firstChoice.message?.content;
  if (!answer) throw new Error("Empty response from Groq agent");
  return answer.trim();
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: "text is required" }, { status: 400 });
    }

    console.log(`[Agent] Query (${text.length} chars): "${text.substring(0, 100)}"`);
    const answer = await queryAgent(text.trim());
    console.log(`[Agent] Answer ready (${answer.length} chars)`);

    return NextResponse.json({ success: true, answer });
  } catch (error) {
    console.error("[Agent] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Agent query failed" },
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
