package com.localflow.remote

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.lifecycle.lifecycleScope
import com.localflow.remote.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Main activity for LocalFlow Remote microphone app
 */
class MainActivity : AppCompatActivity(), LocalFlowClient.LocalFlowListener {

    companion object {
        private const val PREFS_NAME = "LocalFlowPrefs"
        private const val PREF_SERVER_IP = "server_ip"
    }

    private lateinit var binding: ActivityMainBinding
    private lateinit var audioRecorder: AudioRecorder
    private lateinit var localFlowClient: LocalFlowClient

    private var isConnected = false
    private var isRecording = false

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (!isGranted) {
            Toast.makeText(this, R.string.permission_required, Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        audioRecorder = AudioRecorder()
        localFlowClient = LocalFlowClient(this)

        checkMicrophonePermission()
        setupUI()
        loadSavedIp()
    }

    override fun onDestroy() {
        super.onDestroy()
        localFlowClient.disconnect()
    }

    private fun checkMicrophonePermission() {
        when {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED -> {
                // Permission granted
            }
            else -> {
                requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    private fun setupUI() {
        // Connect/Disconnect button
        binding.btnConnect.setOnClickListener {
            if (isConnected) {
                disconnect()
            } else {
                connect()
            }
        }

        // Record button - hold to record
        binding.btnRecord.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    if (isConnected && !isRecording) {
                        startRecording()
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (isRecording) {
                        stopRecording()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun loadSavedIp() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedIp = prefs.getString(PREF_SERVER_IP, "")
        binding.etServerIp.setText(savedIp)
    }

    private fun saveIp(ip: String) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            putString(PREF_SERVER_IP, ip)
        }
    }

    private fun connect() {
        val serverIp = binding.etServerIp.text.toString().trim()

        if (serverIp.isEmpty()) {
            binding.tilServerIp.error = "Enter desktop IP address"
            return
        }

        binding.tilServerIp.error = null
        saveIp(serverIp)

        updateStatus(Status.CONNECTING)
        localFlowClient.connect(serverIp)
    }

    private fun disconnect() {
        localFlowClient.disconnect()
        updateStatus(Status.DISCONNECTED)
    }

    private fun startRecording() {
        if (audioRecorder.startRecording()) {
            isRecording = true
            localFlowClient.sendRecordingStarted()
            updateRecordingState(true)
        }
    }

    private fun stopRecording() {
        lifecycleScope.launch {
            isRecording = false
            updateRecordingState(false)
            updateStatus(Status.PROCESSING)

            val wavBytes = withContext(Dispatchers.IO) {
                audioRecorder.stopRecording()
            }

            if (wavBytes != null) {
                localFlowClient.sendAudio(wavBytes)
            } else {
                updateStatus(Status.CONNECTED)
                Toast.makeText(this@MainActivity, "No audio recorded", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateRecordingState(recording: Boolean) {
        binding.apply {
            if (recording) {
                btnRecord.text = getString(R.string.status_recording)
                btnRecord.backgroundTintList = ContextCompat.getColorStateList(
                    this@MainActivity,
                    R.color.record_button_recording
                )
                progressRecording.visibility = View.VISIBLE
                btnRecord.isEnabled = false
            } else {
                btnRecord.text = getString(R.string.hold_to_record)
                btnRecord.backgroundTintList = ContextCompat.getColorStateList(
                    this@MainActivity,
                    R.color.record_button_normal
                )
                progressRecording.visibility = View.GONE
                btnRecord.isEnabled = isConnected
            }
        }
    }

    private fun updateStatus(status: Status) {
        runOnUiThread {
            binding.apply {
                when (status) {
                    Status.DISCONNECTED -> {
                        tvStatus.text = getString(R.string.status_disconnected)
                        vStatusIndicator.background = ContextCompat.getDrawable(
                            this@MainActivity,
                            R.drawable.circle_red
                        )
                        btnConnect.text = getString(R.string.btn_connect)
                        btnRecord.isEnabled = false
                        tilServerIp.isEnabled = true
                        isConnected = false
                    }
                    Status.CONNECTING -> {
                        tvStatus.text = getString(R.string.status_connecting)
                        vStatusIndicator.background = ContextCompat.getDrawable(
                            this@MainActivity,
                            R.drawable.circle_yellow
                        )
                        btnConnect.isEnabled = false
                    }
                    Status.CONNECTED -> {
                        tvStatus.text = getString(R.string.status_connected)
                        vStatusIndicator.background = ContextCompat.getDrawable(
                            this@MainActivity,
                            R.drawable.circle_green
                        )
                        btnConnect.text = getString(R.string.btn_disconnect)
                        btnConnect.isEnabled = true
                        btnRecord.isEnabled = true
                        tilServerIp.isEnabled = false
                        isConnected = true
                    }
                    Status.PROCESSING -> {
                        tvStatus.text = getString(R.string.status_processing)
                        btnRecord.isEnabled = false
                    }
                }
            }
        }
    }

    // LocalFlowListener callbacks
    override fun onConnected() {
        updateStatus(Status.CONNECTED)
    }

    override fun onDisconnected(reason: String) {
        updateStatus(Status.DISCONNECTED)
    }

    override fun onConnectionError(error: String) {
        lifecycleScope.launch {
            updateStatus(Status.DISCONNECTED)
            Toast.makeText(this@MainActivity, "Connection error: $error", Toast.LENGTH_LONG).show()
        }
    }

    override fun onError(message: String) {
        lifecycleScope.launch {
            if (message.contains("No desktop agent connected")) {
                updateStatus(Status.CONNECTED)
                Toast.makeText(this@MainActivity, R.string.error_no_agents, Toast.LENGTH_LONG).show()
            } else {
                Toast.makeText(this@MainActivity, "Error: $message", Toast.LENGTH_LONG).show()
            }
        }
    }

    enum class Status {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,
        PROCESSING
    }
}
