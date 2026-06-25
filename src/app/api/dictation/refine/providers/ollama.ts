/**
 * @fileoverview Ollama refinement provider (local/networked).
 */

import {
  OLLAMA_URL,
  OLLAMA_MODEL,
  OLLAMA_TEMPERATURE,
  SYSTEM_PROMPTS,
  TRANSLATION_INSTRUCTION,
  RefinementMode,
} from "../prompts";

export async function refineOllama(
  text: string,
  mode: Exclude<RefinementMode, "raw" | "outline">,
  translated: boolean = false
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[mode].replace(
    "{TRANSLATION_HINT}",
    translated ? TRANSLATION_INSTRUCTION : ""
  );

  console.log(`[Refine] Calling Ollama at ${OLLAMA_URL} with model ${OLLAMA_MODEL}`);
  console.log(`[Refine] Input text (${text.length} chars): "${text.substring(0, 100)}..."`);

  try {
    const testResponse = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!testResponse.ok) {
      throw new Error(`Ollama not responding at ${OLLAMA_URL}`);
    }

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
