/**
 * @fileoverview Cloud transcription provider (Groq Whisper API).
 */

import {
  ZAI_API_KEY,
  ZAI_ASR_MODEL,
  GROQ_TRANSCRIPTION_URL,
  GROQ_TRANSLATION_URL,
  GROQ_TRANSLATION_MODEL,
  TRANSLATION_PROMPT,
} from "../config";

export async function transcribeCloud(
  audioBase64: string | Buffer,
  translate: boolean = false,
  apiKey?: string
): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  const effectiveKey = apiKey || ZAI_API_KEY;

  if (!effectiveKey) {
    throw new Error(
      "GROQ_API_KEY is required for cloud mode. Get your API key from: https://console.groq.com/keys"
    );
  }

  if (translate && ZAI_ASR_MODEL !== GROQ_TRANSLATION_MODEL) {
    console.warn(
      `[Transcribe] Translation requires ${GROQ_TRANSLATION_MODEL}, but using ${ZAI_ASR_MODEL}. Attempting anyway...`
    );
  }

  try {
    const audioBuffer = Buffer.isBuffer(audioBase64)
      ? audioBase64
      : Buffer.from(audioBase64, "base64");

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer as unknown as BlobPart], { type: "audio/wav" });
    formData.append("file", audioBlob, "audio.wav");
    formData.append("response_format", "json");

    const endpoint = translate ? GROQ_TRANSLATION_URL : GROQ_TRANSCRIPTION_URL;
    const model = translate ? GROQ_TRANSLATION_MODEL : ZAI_ASR_MODEL;

    formData.append("model", model);

    if (translate && TRANSLATION_PROMPT) {
      formData.append("prompt", TRANSLATION_PROMPT);
    }

    console.log(`[Transcribe] Using ${translate ? "translation" : "transcription"} endpoint: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      if (response.status === 401) {
        throw new Error("Invalid GROQ_API_KEY. Check your API key at https://console.groq.com/keys");
      }
      if (response.status === 429) {
        throw new Error("Groq rate limit exceeded. Please try again later.");
      }
      if (response.status === 400 && errorText.includes("duration")) {
        throw new Error("Audio too long. Maximum duration is 30 seconds.");
      }

      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

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
        throw new Error("Groq API request timed out (60s limit)");
      }
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error("Failed to connect to Groq API. Check your internet connection.");
      }
      throw error;
    }
    throw new Error("Unknown error during cloud transcription");
  }
}
