/**
 * Whispr Flow - Chrome Extension Background Service Worker
 * Receives transcriptions from Firebase Realtime Database
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, onValue, off } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// State management
const state = {
  isRunning: false,
  lastReceived: null,
  autoPaste: true,
  deviceId: null,
  firebaseUnsubscribe: null,
  firebaseApp: null
};

// Get settings from storage
async function getSettings() {
  const result = await chrome.storage.local.get([
    'firebaseApiKey',
    'firebaseDbUrl',
    'deviceId',
    'autoPaste'
  ]);
  return result;
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('[Whispr] Copied to clipboard:', text.substring(0, 50) + '...');
    return true;
  } catch (err) {
    console.error('[Whispr] Failed to copy:', err);
    return false;
  }
}

// Auto-paste into active tab
async function autoPaste(text) {
  if (!state.autoPaste) return false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return false;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (textToPaste) => {
        const activeElement = document.activeElement;
        if (!activeElement) return { success: false, error: 'No active element' };

        const isInput = activeElement.tagName === 'INPUT' ||
                       activeElement.tagName === 'TEXTAREA' ||
                       activeElement.isContentEditable;

        if (!isInput) return { success: false, error: 'Not an input field' };

        if (activeElement.isContentEditable) {
          document.execCommand('insertText', false, textToPaste);
        } else {
          const start = activeElement.selectionStart || 0;
          const end = activeElement.selectionEnd || 0;
          const value = activeElement.value || '';
          activeElement.value = value.substring(0, start) + textToPaste + value.substring(end);
          activeElement.selectionStart = activeElement.selectionEnd = start + textToPaste.length;
        }

        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true };
      },
      args: [text]
    });

    return true;
  } catch (err) {
    console.error('[Whispr] Auto-paste failed:', err);
    return false;
  }
}

// Handle incoming transcription
async function handleTranscription(text, wordCount, deviceId) {
  console.log(`[Whispr] Received: ${text.substring(0, 50)}... (${wordCount} words) from ${deviceId}`);

  state.lastReceived = {
    text,
    wordCount,
    timestamp: Date.now(),
    deviceId
  };

  await chrome.storage.local.set({ lastReceived: state.lastReceived });

  const clipboardSuccess = await copyToClipboard(text);
  const pasteSuccess = await autoPaste(text);

  // Show notification
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Whispr Flow',
    message: `Received ${wordCount} words${pasteSuccess ? ' and pasted' : clipboardSuccess ? ' (copied)' : ''}`
  });

  // Update badge
  await chrome.action.setBadgeText({ text: '✓' });
  await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);

  return {
    status: clipboardSuccess || pasteSuccess ? 'ok' : 'error',
    message: clipboardSuccess ? 'Copied to clipboard' : 'Failed to copy',
    pasted: pasteSuccess
  };
}

// Start Firebase listener
async function startFirebaseListener() {
  const settings = await getSettings();

  if (!settings.firebaseApiKey || !settings.firebaseDbUrl || !settings.deviceId) {
    console.log('[Whispr] Firebase not configured');
    state.isRunning = false;
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    return;
  }

  // Clean up existing connection
  if (state.firebaseUnsubscribe) {
    off(state.firebaseUnsubscribe);
    state.firebaseUnsubscribe = null;
  }

  if (state.firebaseApp) {
    // Note: Firebase doesn't have a clean way to delete apps in browser
    state.firebaseApp = null;
  }

  try {
    const firebaseConfig = {
      apiKey: settings.firebaseApiKey,
      databaseURL: settings.firebaseDbUrl,
      projectId: 'whispr-flow',
      authDomain: `${settings.firebaseApiKey?.split(':')[0]}.firebaseapp.com`,
    };

    state.firebaseApp = initializeApp(firebaseConfig, 'whispr-extension');
    const db = getDatabase(state.firebaseApp);

    const transcriptionRef = ref(db, `transcriptions/${settings.deviceId}`);

    // Listen for changes
    onValue(transcriptionRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.text) {
        // Only process if it's a new message (within last 30 seconds)
        const age = Date.now() - (data.timestamp || 0);
        if (age < 30000) {
          handleTranscription(data.text, data.wordCount || 0, settings.deviceId);
        }
      }
    });

    state.firebaseUnsubscribe = transcriptionRef;
    state.isRunning = true;
    state.deviceId = settings.deviceId;
    state.autoPaste = settings.autoPaste !== false;

    await chrome.action.setBadgeText({ text: '●' });
    await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });

    console.log('[Whispr] Firebase listener started for device:', settings.deviceId);
  } catch (err) {
    console.error('[Whispr] Failed to start Firebase:', err);
    state.isRunning = false;
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      case 'getStatus':
        const settings = await getSettings();
        sendResponse({
          isRunning: state.isRunning,
          deviceId: state.deviceId,
          lastReceived: state.lastReceived,
          autoPaste: state.autoPaste,
          hasConfig: !!(settings.firebaseApiKey && settings.firebaseDbUrl && settings.deviceId)
        });
        break;

      case 'setAutoPaste':
        state.autoPaste = request.enabled;
        await chrome.storage.local.set({ autoPaste: request.enabled });
        sendResponse({ success: true });
        break;

      case 'saveSettings':
        await chrome.storage.local.set({
          firebaseApiKey: request.firebaseApiKey,
          firebaseDbUrl: request.firebaseDbUrl,
          deviceId: request.deviceId,
          autoPaste: request.autoPaste
        });
        // Restart listener with new settings
        await startFirebaseListener();
        sendResponse({ success: true });
        break;

      case 'testConnection':
        await startFirebaseListener();
        sendResponse({ success: state.isRunning });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true;
});

// Handle global hotkey
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-recording') {
    console.log('[Whispr] Hotkey pressed');
    chrome.action.openPopup();
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(startFirebaseListener);
chrome.runtime.onInstalled.addListener(startFirebaseListener);

// Listen for storage changes to restart if settings change
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.firebaseApiKey || changes.firebaseDbUrl || changes.deviceId)) {
    console.log('[Whispr] Settings changed, restarting listener');
    startFirebaseListener();
  }
});

// Start immediately
startFirebaseListener();

console.log('[Whispr] Background script loaded');
