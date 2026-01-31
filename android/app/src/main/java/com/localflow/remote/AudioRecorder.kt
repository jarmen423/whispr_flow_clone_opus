package com.localflow.remote

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Records audio in WAV format compatible with Whisper.cpp
 * - Sample Rate: 16000 Hz (16kHz)
 * - Channels: Mono (1)
 * - Bit Depth: 16-bit PCM
 */
class AudioRecorder {

    companion object {
        private const val TAG = "AudioRecorder"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE_FACTOR = 2
    }

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private var isRecording = false
    private val audioBuffer = mutableListOf<Short>()

    /**
     * Start recording audio
     */
    @SuppressLint("MissingPermission")
    fun startRecording(): Boolean {
        if (isRecording) {
            Log.w(TAG, "Already recording")
            return false
        }

        val minBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT
        )

        if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
            Log.e(TAG, "Invalid buffer size")
            return false
        }

        val bufferSize = minBufferSize * BUFFER_SIZE_FACTOR

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord initialization failed")
                return false
            }

            audioBuffer.clear()
            isRecording = true
            audioRecord?.startRecording()

            recordingThread = Thread {
                recordAudio(bufferSize)
            }.apply {
                start()
            }

            Log.i(TAG, "Recording started")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start recording", e)
            return false
        }
    }

    /**
     * Stop recording and return WAV bytes
     */
    fun stopRecording(): ByteArray? {
        if (!isRecording) {
            Log.w(TAG, "Not recording")
            return null
        }

        isRecording = false
        recordingThread?.join(1000)
        recordingThread = null

        audioRecord?.apply {
            stop()
            release()
        }
        audioRecord = null

        val audioData = audioBuffer.toShortArray()
        audioBuffer.clear()

        if (audioData.isEmpty()) {
            Log.w(TAG, "No audio data recorded")
            return null
        }

        Log.i(TAG, "Recording stopped, ${audioData.size} samples")
        return createWavFile(audioData)
    }

    /**
     * Recording loop - runs on background thread
     */
    private fun recordAudio(bufferSize: Int) {
        val buffer = ShortArray(bufferSize / 2)

        while (isRecording) {
            val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
            if (read > 0) {
                synchronized(audioBuffer) {
                    for (i in 0 until read) {
                        audioBuffer.add(buffer[i])
                    }
                }
            }
        }
    }

    /**
     * Convert PCM data to WAV format bytes
     */
    private fun createWavFile(pcmData: ShortArray): ByteArray {
        val byteArrayOutputStream = ByteArrayOutputStream()

        // Convert shorts to bytes (little-endian)
        val pcmBytes = ByteArray(pcmData.size * 2)
        for (i in pcmData.indices) {
            pcmBytes[i * 2] = (pcmData[i].toInt() and 0xFF).toByte()
            pcmBytes[i * 2 + 1] = ((pcmData[i].toInt() shr 8) and 0xFF).toByte()
        }

        val sampleRate = SAMPLE_RATE
        val channels = 1
        val bitsPerSample = 16
        val byteRate = sampleRate * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val dataSize = pcmBytes.size

        try {
            // RIFF header
            byteArrayOutputStream.write("RIFF".toByteArray())
            byteArrayOutputStream.write(intToBytes(36 + dataSize)) // File size - 8
            byteArrayOutputStream.write("WAVE".toByteArray())

            // fmt chunk
            byteArrayOutputStream.write("fmt ".toByteArray())
            byteArrayOutputStream.write(intToBytes(16)) // Subchunk size
            byteArrayOutputStream.write(shortToBytes(1)) // Audio format (PCM)
            byteArrayOutputStream.write(shortToBytes(channels.toShort()))
            byteArrayOutputStream.write(intToBytes(sampleRate))
            byteArrayOutputStream.write(intToBytes(byteRate))
            byteArrayOutputStream.write(shortToBytes(blockAlign.toShort()))
            byteArrayOutputStream.write(shortToBytes(bitsPerSample.toShort()))

            // data chunk
            byteArrayOutputStream.write("data".toByteArray())
            byteArrayOutputStream.write(intToBytes(dataSize))
            byteArrayOutputStream.write(pcmBytes)

        } catch (e: IOException) {
            Log.e(TAG, "Error creating WAV file", e)
        }

        return byteArrayOutputStream.toByteArray()
    }

    /**
     * Convert Int to little-endian byte array (4 bytes)
     */
    private fun intToBytes(value: Int): ByteArray {
        return ByteBuffer.allocate(4)
            .order(ByteOrder.LITTLE_ENDIAN)
            .putInt(value)
            .array()
    }

    /**
     * Convert Short to little-endian byte array (2 bytes)
     */
    private fun shortToBytes(value: Short): ByteArray {
        return ByteBuffer.allocate(2)
            .order(ByteOrder.LITTLE_ENDIAN)
            .putShort(value)
            .array()
    }

    fun isRecording(): Boolean = isRecording
}
