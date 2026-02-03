/**
 * Whispr Flow - Chrome Extension Popup
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const connectionStatus = document.getElementById('connection-status');
  const statusText = document.getElementById('status-text');
  const statusDot = connectionStatus.querySelector('.status-dot');
  const deviceIdDisplay = document.getElementById('device-id-display');
  const autoPasteToggle = document.getElementById('auto-paste-toggle');
  const lastReceivedSection = document.getElementById('last-received-section');
  const lastReceivedText = document.getElementById('last-received-text');
  const firebaseKeyInput = document.getElementById('firebase-key');
  const firebaseDbUrlInput = document.getElementById('firebase-db-url');
  const deviceIdInput = document.getElementById('device-id-input');
  const saveBtn = document.getElementById('save-btn');

  // Load current status
  async function loadStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStatus' });

      if (response) {
        // Update status display
        if (response.isRunning) {
          statusText.textContent = 'Connected';
          statusDot.className = 'status-dot connected';
        } else if (response.hasConfig) {
          statusText.textContent = 'Connecting...';
          statusDot.className = 'status-dot warning';
        } else {
          statusText.textContent = 'Not configured';
          statusDot.className = 'status-dot disconnected';
        }

        // Update device ID
        if (response.deviceId) {
          deviceIdDisplay.textContent = response.deviceId;
          deviceIdInput.value = response.deviceId;
        }

        // Update auto-paste
        autoPasteToggle.checked = response.autoPaste;

        // Update last received
        if (response.lastReceived) {
          lastReceivedText.textContent = response.lastReceived.text;
          lastReceivedSection.classList.remove('hidden');
        }
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }

  // Load saved settings
  async function loadSettings() {
    const settings = await chrome.storage.local.get([
      'firebaseApiKey',
      'firebaseDbUrl',
      'deviceId',
      'autoPaste'
    ]);

    if (settings.firebaseApiKey) {
      firebaseKeyInput.value = settings.firebaseApiKey;
    }
    if (settings.firebaseDbUrl) {
      firebaseDbUrlInput.value = settings.firebaseDbUrl;
    }
    if (settings.deviceId) {
      deviceIdInput.value = settings.deviceId;
    }
    if (settings.autoPaste !== undefined) {
      autoPasteToggle.checked = settings.autoPaste;
    }
  }

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const firebaseApiKey = firebaseKeyInput.value.trim();
    const firebaseDbUrl = firebaseDbUrlInput.value.trim();
    const deviceId = deviceIdInput.value.trim();
    const autoPaste = autoPasteToggle.checked;

    if (!firebaseApiKey || !firebaseDbUrl || !deviceId) {
      alert('Please fill in all fields');
      return;
    }

    saveBtn.textContent = 'Connecting...';
    saveBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveSettings',
        firebaseApiKey,
        firebaseDbUrl,
        deviceId,
        autoPaste
      });

      if (response.success) {
        saveBtn.textContent = 'Connected!';
        setTimeout(() => {
          saveBtn.textContent = 'Save & Connect';
          saveBtn.disabled = false;
        }, 2000);
        await loadStatus();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      saveBtn.textContent = 'Error - Try Again';
      saveBtn.disabled = false;
    }
  });

  // Handle auto-paste toggle
  autoPasteToggle.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({
      action: 'setAutoPaste',
      enabled: autoPasteToggle.checked
    });
  });

  // Initial load
  await loadSettings();
  await loadStatus();
});
