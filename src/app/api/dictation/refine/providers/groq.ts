/**
 * @fileoverview Groq cloud refinement provider.
 */

import {
  ZAI_API_KEY,
  GROQ_LLM_API_BASE_URL,
  ZAI_LLM_MODEL,
  SYSTEM_PROMPTS,
  TRANSLATION_INSTRUCTION,
  RefinementMode,
} from "../prompts";

export async function refineCloud(
  text: string,
  mode: Exclude<RefinementMode, "raw" | "outline">,
  translated: boolean = false
): Promise<string> {
  if (!ZAI_API_KEY) {
    throw new Error("GROQ_API_KEY is required for cloud mode. Get your API key from: https://console.groq.com/keys");
  }

  const systemPrompt = SYSTEM_PROMPTS[mode].replace(
    "{TRANSLATION_HINT}",
    translated ? TRANSLATION_INSTRUCTION : ""
  );

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
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      if (response.status === 401) {
        throw new Error("Invalid GROQ_API_KEY. Check your API key at https://console.groq.com/keys");
      }
      if (response.status === 429) {
        throw new Error("Groq rate limit exceeded. Please try again later.");
      }

      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

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
