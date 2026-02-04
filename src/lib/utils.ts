/**
 * @fileoverview LocalFlow Utility Functions - Shared helper utilities
 *
 * This module provides shared utility functions used throughout the LocalFlow
 * application. It includes helper functions for class name management, formatting,
 * data conversion, and localStorage persistence.
 *
 * Purpose & Reasoning:
 *   Centralizing utility functions prevents code duplication and ensures
 *   consistent behavior across the application. Functions here are pure
 *   (no side effects except localStorage) and can be safely used in any
 *   component or context.
 *
 *   Key design decisions:
 *   - clsx + tailwind-merge for conflict-free Tailwind class merging
 *   - localStorage for settings/history persistence (simple, no backend needed)
 *   - TypeScript interfaces for type-safe settings and history items
 *
 * Dependencies:
 *   External Packages:
 *     - clsx: Conditional class name utility (handles arrays, objects, strings)
 *     - tailwind-merge: Resolves Tailwind CSS class conflicts intelligently
 *
 *   Browser APIs:
 *     - localStorage: Client-side persistent storage
 *     - FileReader: Asynchronous blob to base64 conversion
 *
 * Role in Codebase:
 *   Imported by virtually all components for class name management (cn)
 *   and by specific components for formatting, storage, and conversion.
 *   This is a foundational utility module with no dependencies on other
 *   application code.
 *
 * Key Technologies/APIs:
 *   - clsx: Conditional className construction (clsx/bind)
 *   - tailwind-merge: twMerge for deduplicating Tailwind classes
 *   - localStorage.setItem/getItem: Persistent browser storage
 *   - FileReader.readAsDataURL: Blob to base64 conversion
 *   - Date.now: Timestamp generation for IDs and time calculations
 *
 * @module lib/utils
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges and deduplicates Tailwind CSS classes intelligently.
 *
 * Combines clsx (for conditional class handling) with tailwind-merge
 * (for class conflict resolution) to provide a single utility for
 * all class name construction needs.
 *
 * Purpose & Reasoning:
 *   When combining classes from multiple sources (props, variants,
 *   conditional logic), conflicts can occur (e.g., "p-2 p-4"). This
 *   function resolves those conflicts by keeping the last occurrence
 *   while supporting all clsx input formats.
 *
 * Key Technologies/APIs:
 *   - clsx: Handles arrays, objects, and conditional classes
 *   - tailwind-merge: Intelligently merges conflicting Tailwind classes
 *
 * @param inputs - Class values to merge (strings, arrays, objects)
 * @returns string - Merged and deduplicated class names
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-blue-500", className)
 * // "px-2 py-1 bg-blue-500 [user-classes]"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a unique identifier based on timestamp and random string.
 *
 * Creates a collision-resistant ID suitable for React keys, database
 * primary keys, or any scenario requiring unique identifiers.
 *
 * Key Technologies/APIs:
 *   - Date.now: Millisecond timestamp for uniqueness
 *   - Math.random: Random suffix to prevent collisions in same millisecond
 *   - Number.toString(36): Base36 encoding for compact representation
 *
 * @returns string - Unique ID in format "{timestamp}-{random}"
 *
 * @example
 * generateId() // "1705331200000-abc123xyz"
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Formats a duration in seconds to a human-readable MM:SS string.
 *
 * Converts raw second counts into minutes:seconds format suitable
 * for display in recording timers and duration indicators.
 *
 * Key Technologies/APIs:
 *   - Math.floor: Integer division for minutes
 *   - String.padStart: Zero-padding for seconds
 *
 * @param seconds - Duration in seconds
 * @returns string - Formatted duration "M:SS" or "MM:SS"
 *
 * @example
 * formatDuration(65)  // "1:05"
 * formatDuration(125) // "2:05"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats a timestamp to a relative time description.
 *
 * Converts an absolute timestamp into a human-friendly relative
 * description like "Just now", "5 minutes ago", or "2 hours ago".
 *
 * Key Technologies/APIs:
 *   - Date.now: Current time reference
 *   - Time arithmetic: Difference calculation and threshold comparisons
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns string - Relative time description
 *
 * @example
 * formatRelativeTime(Date.now() - 60000)  // "1 minute ago"
 * formatRelativeTime(Date.now() - 360000) // "6 minutes ago"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return "Just now";
  } else if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }
}

/**
 * Counts the number of words in a text string.
 *
 * Splits text on whitespace and filters empty strings to provide
 * an accurate word count for dictation statistics.
 *
 * Key Technologies/APIs:
 *   - String.trim: Remove leading/trailing whitespace
 *   - String.split: Split on regex whitespace (\s+)
 *   - Array.filter: Remove empty strings from results
 *
 * @param text - The text to count words in
 * @returns number - Number of words (0 for empty/whitespace-only)
 *
 * @example
 * countWords("Hello world") // 2
 * countWords("  Multiple   spaces  ") // 2
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Sanitizes output text to prevent XSS vulnerabilities.
 *
 * Removes potentially dangerous HTML/JavaScript content including
 * script tags and javascript: URLs. Also truncates overly long
 * content to prevent memory issues.
 *
 * Purpose & Reasoning:
 *   While React provides XSS protection, this adds a defense layer
 *   for content that might be dangerouslySetInnerHTML or used
 *   outside React's protection.
 *
 * Key Technologies/APIs:
 *   - Regular expressions: Pattern matching for script tags and JS URLs
 *   - String.replace: Removal of dangerous patterns
 *   - String.substring: Length limiting
 *
 * @param text - Raw text to sanitize
 * @returns string - Sanitized text safe for display
 *
 * @example
 * sanitizeOutput("<script>alert('xss')</script>Hello")
 * // "Hello"
 */
export function sanitizeOutput(text: string): string {
  if (text.length > 10000) {
    text = text.substring(0, 10000);
  }
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/javascript:/gi, "");
}

/**
 * Converts a Blob (audio file) to base64-encoded string.
 *
 * Uses FileReader API to asynchronously read a Blob as a data URL,
 * then extracts the base64 payload (removing the data URL prefix).
 *
 * Key Technologies/APIs:
 *   - FileReader: Browser API for reading Blob/File objects
 *   - FileReader.readAsDataURL: Read blob as base64 data URL
 *   - Promise wrapper: Convert callback API to async/await
 *
 * @param blob - The audio blob to convert
 * @returns Promise<string> - Base64-encoded audio data (no data URL prefix)
 *
 * @example
 * const blob = new Blob([audioData], { type: "audio/wav" });
 * const base64 = await blobToBase64(blob);
 * // "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data URL prefix (e.g., "data:audio/wav;base64,")
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Interface representing a dictation history item.
 *
 * Defines the structure for stored dictation records including
 * both original transcription and refined text, along with metadata
 * about when and how the dictation was processed.
 *
 * @interface DictationItem
 */
export interface DictationItem {
  /** Unique identifier for the history item */
  id: string;
  /** Original raw transcription from speech-to-text */
  originalText: string;
  /** Refined/processed text after LLM processing */
  refinedText: string;
  /** Unix timestamp when dictation was recorded */
  timestamp: number;
  /** Duration of recording in seconds */
  duration: number;
  /** Refinement mode used (developer, concise, professional, raw) */
  mode: "developer" | "concise" | "professional" | "raw";
  /** Where processing occurred (cloud or local) */
  processingMode: "cloud" | "local";
}

/**
 * Interface representing application settings.
 *
 * Defines the user-configurable options for the LocalFlow application
 * including hotkey preferences, processing modes, and UI options.
 *
 * @interface Settings
 */
export interface Settings {
  /** Global hotkey for triggering dictation */
  hotkey: string;
  /** Hotkey to toggle translation mode */
  translateHotkey: string;
  /** LLM refinement mode for text processing */
  refinementMode: "developer" | "concise" | "professional" | "raw";
  /** Where transcription/processing occurs */
  processingMode: "cloud" | "local";
  /** Whether to automatically copy results to clipboard */
  autoCopy: boolean;
  /** Whether sound effects are enabled */
  soundEnabled: boolean;
  /** Whether to translate non-English audio to English (Whisper translation) */
  translate: boolean;
}

/**
 * Default application settings.
 *
 * Used as initial values and when resetting settings to defaults.
 * These values are optimized for general developer use.
 *
 * @constant {Settings}
 */
export const defaultSettings: Settings = {
  hotkey: "alt+v",
  translateHotkey: "alt+t",
  refinementMode: "developer",
  processingMode: "cloud",
  autoCopy: true,
  soundEnabled: true,
  translate: false,
};

/**
 * Saves application settings to localStorage.
 *
 * Persists user preferences for hotkeys, processing modes, and UI options
 * across browser sessions. Includes SSR check to prevent errors during
 * server-side rendering.
 *
 * Key Technologies/APIs:
 *   - localStorage.setItem: Browser persistent storage
 *   - JSON.stringify: Serialize settings object to string
 *   - typeof window check: SSR compatibility
 *
 * @param settings - The settings object to persist
 * @returns void
 *
 * @example
 * saveSettings({ hotkey: "alt+z", processingMode: "local", ... });
 */
export function saveSettings(settings: Settings): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("localflow-settings", JSON.stringify(settings));
  }
}

/**
 * Loads application settings from localStorage.
 *
 * Retrieves previously saved user preferences, merging with defaults
 * for any missing properties. Returns defaults if nothing saved or
 * on parse errors.
 *
 * Key Technologies/APIs:
 *   - localStorage.getItem: Retrieve stored settings
 *   - JSON.parse: Deserialize settings string
 *   - Spread operator: Merge with defaults for backward compatibility
 *   - try/catch: Handle corrupted storage data
 *
 * @returns Settings - Loaded settings merged with defaults
 *
 * @example
 * const settings = loadSettings();
 * // Returns saved settings or defaults if none exist
 */
export function loadSettings(): Settings {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("localflow-settings");
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored) };
      } catch {
        return defaultSettings;
      }
    }
  }
  return defaultSettings;
}

/**
 * Saves dictation history to localStorage.
 *
 * Persists recent dictation items for history viewing. Automatically
 * trims to the last 100 items to prevent storage quota issues.
 *
 * Key Technologies/APIs:
 *   - Array.slice: Keep only recent 100 items
 *   - localStorage.setItem: Persistent storage
 *
 * @param history - Array of dictation items to save
 * @returns void
 *
 * @example
 * const newItem = { id: "...", originalText: "...", ... };
 * saveHistory([...history, newItem]);
 */
export function saveHistory(history: DictationItem[]): void {
  if (typeof window !== "undefined") {
    // Keep only the last 100 items
    const trimmed = history.slice(-100);
    localStorage.setItem("localflow-history", JSON.stringify(trimmed));
  }
}

/**
 * Loads dictation history from localStorage.
 *
 * Retrieves previously saved dictation items. Returns empty array
 * if nothing saved or on parse errors.
 *
 * Key Technologies/APIs:
 *   - localStorage.getItem: Retrieve stored history
 *   - JSON.parse: Deserialize history array
 *   - try/catch: Handle corrupted storage data
 *
 * @returns DictationItem[] - Array of history items (empty if none)
 *
 * @example
 * const history = loadHistory();
 * history.forEach(item => console.log(item.refinedText));
 */
export function loadHistory(): DictationItem[] {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("localflow-history");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
  }
  return [];
}
