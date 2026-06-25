/**
 * @fileoverview Environment configuration constants for the transcribe route.
 */

export const PROCESSING_MODE = process.env.PROCESSING_MODE || "networked-local";

export const ZAI_API_KEY = process.env.GROQ_API_KEY || process.env.ZAI_API_KEY || "";

export const GROQ_TRANSCRIPTION_URL =
  process.env.GROQ_ASR_API_BASE_URL || "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_TRANSLATION_URL = "https://api.groq.com/openai/v1/audio/translations";

export const ZAI_ASR_MODEL = process.env.GROQ_ASR_MODEL || process.env.ZAI_ASR_MODEL || "whisper-large-v3";

export const GROQ_TRANSLATION_MODEL = "whisper-large-v3";

export const TRANSLATION_PROMPT = process.env.TRANSLATION_PROMPT || "";

export const WHISPER_API_URL = process.env.WHISPER_API_URL || "";

export const AUDIO_API_TYPE = process.env.AUDIO_API_TYPE || "auto";

export const WHISPER_PATH = process.env.WHISPER_PATH || "/usr/local/bin/whisper";

export const WHISPER_MODEL_PATH = process.env.WHISPER_MODEL_PATH || "./models/ggml-small-q5_1.bin";

export const WHISPER_THREADS = process.env.WHISPER_THREADS || "4";
