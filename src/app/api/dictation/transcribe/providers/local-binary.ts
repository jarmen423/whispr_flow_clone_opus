/**
 * @fileoverview Local binary transcription provider (Whisper.cpp executable).
 */

import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { WHISPER_PATH, WHISPER_MODEL_PATH, WHISPER_THREADS } from "../config";

export async function transcribeLocalBinary(audioBase64: string | Buffer): Promise<{ text: string; processingTime: number }> {
  const startTime = Date.now();

  if (!existsSync(WHISPER_PATH)) {
    throw new Error(
      `Whisper binary not found at ${WHISPER_PATH}. Install from: https://github.com/ggerganov/whisper.cpp/releases`
    );
  }

  if (!existsSync(WHISPER_MODEL_PATH)) {
    throw new Error(
      `Whisper model not found at ${WHISPER_MODEL_PATH}. Download from: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin`
    );
  }

  const tempDir = join(tmpdir(), "localflow");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const inputPath = join(tempDir, `audio_${timestamp}.wav`);
  const outputPath = join(tempDir, `audio_${timestamp}`);

  try {
    const audioBuffer = Buffer.isBuffer(audioBase64)
      ? audioBase64
      : Buffer.from(audioBase64, "base64");
    writeFileSync(inputPath, audioBuffer);

    const command = `"${WHISPER_PATH}" -m "${WHISPER_MODEL_PATH}" -f "${inputPath}" -t ${WHISPER_THREADS} -otxt -of "${outputPath}"`;

    execSync(command, {
      timeout: 60000,
      encoding: "utf-8",
    });

    const outputFile = `${outputPath}.txt`;
    if (!existsSync(outputFile)) {
      throw new Error("Whisper.cpp did not produce output file");
    }

    const text = readFileSync(outputFile, "utf-8").trim();

    unlinkSync(inputPath);
    unlinkSync(outputFile);

    if (!text) {
      throw new Error("No speech detected in audio");
    }

    return {
      text,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
    } catch {
      /* ignore cleanup errors */
    }

    if (error instanceof Error) {
      if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
        throw new Error("Whisper.cpp execution timed out (60s limit)");
      }
      throw error;
    }
    throw new Error("Unknown error during local transcription");
  }
}
