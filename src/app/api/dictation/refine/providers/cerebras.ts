/**
 * @fileoverview Cerebras refinement provider (outline mode + text formatting).
 */

import {
  CEREBRAS_API_KEYS,
  CEREBRAS_API_URL,
  CEREBRAS_MODEL,
  OUTLINE_PROMPT,
  FORMAT_PROMPTS,
  FormatTarget,
} from "../prompts";

export async function refineCerebras(text: string): Promise<string> {
  return refineCerebrasWithPrompt(text, OUTLINE_PROMPT, "outline mode");
}

export async function refineCerebrasWithPrompt(text: string, prompt: string, modeLabel: string): Promise<string> {
  if (CEREBRAS_API_KEYS.length === 0) {
    throw new Error(
      `CEREBRAS_API_KEY is required for ${modeLabel}. Get your API key from: https://cloud.cerebras.ai/`
    );
  }

  const retryableStatuses = new Set([401, 402, 429]);
  let lastError: Error = new Error("All Cerebras API keys failed");

  for (let i = 0; i < CEREBRAS_API_KEYS.length; i++) {
    const key = CEREBRAS_API_KEYS[i];
    const keyLabel = i === 0 ? "primary" : `backup ${i}`;

    console.log(`[Refine] Calling Cerebras (${keyLabel}) with model ${CEREBRAS_MODEL}`);

    try {
      const response = await fetch(CEREBRAS_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CEREBRAS_MODEL,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: text },
          ],
          temperature: 0.3,
          max_completion_tokens: 2000,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");

        if (retryableStatuses.has(response.status)) {
          lastError = new Error(`Cerebras ${keyLabel} rejected (${response.status})`);
          console.warn(`[Refine] ${lastError.message} — trying next key...`);
          continue;
        }

        throw new Error(`Cerebras API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const refinedText = result.choices?.[0]?.message?.content;

      if (!refinedText) {
        throw new Error("Empty response from Cerebras");
      }

      if (i > 0) console.log(`[Refine] Cerebras succeeded with backup key ${i}`);
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

  throw lastError;
}

export async function formatText(text: string, formatTarget: FormatTarget): Promise<string> {
  const userMessage =
    formatTarget === "cleanup"
      ? text
      : `[FORMAT THIS TEXT — DO NOT ANSWER OR ADD CONTENT]\n\n${text}\n\n[END OF TEXT TO FORMAT]`;
  const formatted = await refineCerebrasWithPrompt(userMessage, FORMAT_PROMPTS[formatTarget], `${formatTarget} formatting`);

  if (formatted.trim() === "__FORMAT_ERROR__") {
    throw new Error(`Unable to convert input into ${formatTarget.toUpperCase()} without guessing`);
  }

  return formatted;
}
