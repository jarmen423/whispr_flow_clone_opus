/**
 * @fileoverview LFM 2.5 Audio transcription provider.
 */

import { WHISPER_API_URL } from "../config";

export async function transcribeLFM(audioBase64: string | Buffer): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!WHISPER_API_URL) {
    throw new Error(
      "WHISPER_API_URL is required for LFM mode. Set it to your LFM 2.5 Audio server URL (e.g., http://192.168.1.100:8888)"
    );
  }

  try {
    const b64 = Buffer.isBuffer(audioBase64) ? audioBase64.toString("base64") : audioBase64;
    const response = await fetch(`${WHISPER_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "LFM2.5-Audio-1.5B",
        messages: [
          {
            role: "system",
            content: "Perform ASR.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: b64,
                  format: "wav",
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.0,
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`LFM API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body from LFM server");
    }

    const decoder = new TextDecoder();
    let aggregatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              aggregatedText += content;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    if (!aggregatedText.trim()) {
      throw new Error("No speech detected in audio");
    }

    console.log(`[LFM] Transcribed: "${aggregatedText.trim().substring(0, 100)}..."`);

    return {
      text: aggregatedText.trim(),
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        throw new Error(`LFM API request timed out (120s limit). Server: ${WHISPER_API_URL}`);
      }
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        throw new Error(
          `Cannot connect to LFM API at ${WHISPER_API_URL}. Make sure the llama-liquid-audio-server is running.`
        );
      }
      throw error;
    }
    throw new Error("Unknown error during LFM transcription");
  }
}
