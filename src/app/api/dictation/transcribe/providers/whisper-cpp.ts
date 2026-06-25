/**
 * @fileoverview Whisper.cpp remote server transcription provider.
 */

import { WHISPER_API_URL } from "../config";

export async function transcribeWhisperCpp(
  audioBase64: string | Buffer,
  translate: boolean = false
): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!WHISPER_API_URL) {
    throw new Error(
      "WHISPER_API_URL is required for Whisper.cpp mode. Set it to your whisper.cpp server URL (e.g., http://192.168.1.100:8080)"
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

    if (translate) {
      formData.append("task", "translate");
    }

    const response = await fetch(`${WHISPER_API_URL}/inference`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Whisper API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    const text = result.text || result.transcription || result.result || "";

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
        throw new Error(`Whisper API request timed out (60s limit). Server: ${WHISPER_API_URL}`);
      }
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        throw new Error(
          `Cannot connect to Whisper API at ${WHISPER_API_URL}. Make sure the whisper.cpp server is running: ./server -m model.bin --host 0.0.0.0 --port 8080`
        );
      }
      throw error;
    }
    throw new Error("Unknown error during Whisper transcription");
  }
}
