/**
 * @fileoverview Networked-local transcription providers (LFM 2.5 Audio and Whisper.cpp).
 */

import { WHISPER_API_URL, AUDIO_API_TYPE } from "../config";
import { transcribeLFM } from "./lfm";
import { transcribeWhisperCpp } from "./whisper-cpp";

export { transcribeLFM, transcribeWhisperCpp };

/**
 * Transcribes audio using networked local server with auto-detection.
 *
 * Determines whether to use LFM or Whisper.cpp based on configuration
 * or auto-detection via endpoint probing.
 *
 * @param audioBase64 - Base64-encoded audio data or raw Buffer
 * @param translate - Whether to translate non-English audio to English
 * @returns Object with transcribed text and processing time
 */
export async function transcribeNetworkedLocal(
  audioBase64: string | Buffer,
  translate: boolean = false
): Promise<{ text: string; processingTime: number }> {
  if (!WHISPER_API_URL) {
    throw new Error(
      "WHISPER_API_URL is required for networked-local mode. Set it to your audio server URL (e.g., http://192.168.1.100:8888)"
    );
  }

  if (AUDIO_API_TYPE === "lfm") {
    console.log("[Transcribe] Using LFM 2.5 Audio API");
    return transcribeLFM(audioBase64);
  }

  if (AUDIO_API_TYPE === "whisper") {
    console.log("[Transcribe] Using Whisper.cpp API");
    return transcribeWhisperCpp(audioBase64, translate);
  }

  console.log("[Transcribe] Auto-detecting API type...");

  try {
    const modelsCheck = await fetch(`${WHISPER_API_URL}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (modelsCheck && modelsCheck.ok) {
      console.log("[Transcribe] Detected LFM/llama.cpp server (has /v1/models endpoint)");
      return transcribeLFM(audioBase64);
    }

    const healthCheck = await fetch(`${WHISPER_API_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (healthCheck && healthCheck.ok) {
      console.log("[Transcribe] Detected Whisper.cpp server (has /health endpoint)");
      return transcribeWhisperCpp(audioBase64, translate);
    }

    console.log("[Transcribe] Could not detect API type, defaulting to LFM");
    return transcribeLFM(audioBase64);
  } catch (error) {
    console.error("[Transcribe] Error during API detection:", error);
    return transcribeLFM(audioBase64);
  }
}
