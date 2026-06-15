/**
 * All page copy + mode examples in one place.
 * Lets the page composition stay structural; copy lives here.
 */

export type HotkeyMode = {
  id: string;
  /** Display glyph on the key */
  key: string;
  /** Full chord shown in the chip, e.g. "⌥L" */
  chord: string;
  /** Accessible label */
  label: string;
  /** One-line job framing (used in modes-as-moods cards) */
  job: string;
  /** Spoken / raw "before" example */
  before: string;
  /** Formatted / result "after" example */
  after: string;
  /** Short tag for the keyboard tooltip */
  tag: string;
  accent: string; // hex used for the key glow tint
};

export const MODES: HotkeyMode[] = [
  {
    id: "dictate",
    key: "L",
    chord: "⌥L",
    label: "Raw dictation",
    job: "Dictate a message",
    before:
      "hey team pushing the auth fix now will need like twenty minutes to verify across staging and prod",
    after:
      "Hey team — pushing the auth fix now. Will need ~20 min to verify across staging and prod.",
    tag: "Raw transcription · no LLM",
    accent: "#ff7a59",
  },
  {
    id: "outline",
    key: "M",
    chord: "⌥M",
    label: "Outline / format",
    job: "Brain-dump an outline",
    before:
      "okay the launch doc needs an intro the problem section three case studies pricing comparison and then a faq",
    after:
      "# Launch doc\n\n- Intro\n- The problem\n- Case studies (3)\n- Pricing comparison\n- FAQ",
    tag: "Cerebras formats spoken structure",
    accent: "#b666e6",
  },
  {
    id: "agent",
    key: "A",
    chord: "⌥A",
    label: "Voice agent",
    job: "Ask out loud, get an answer",
    before:
      "what's the latest stable version of next js and when did it ship",
    after:
      "Next.js 15.1 shipped December 2025 — stable. App Router is the default; React 19 support is included.",
    tag: "Web-search grounded answer",
    accent: "#8b5cf6",
  },
  {
    id: "translate",
    key: "T",
    chord: "⌥T",
    label: "Translation toggle",
    job: "Speak any language, paste English",
    before:
      "bonjour je voudrais réserver une table pour quatre personnes ce soir",
    after:
      "Hello, I'd like to reserve a table for four people tonight.",
    tag: "Toggle Whisper translation mode",
    accent: "#f59e0b",
  },
  {
    id: "polish",
    key: "J",
    chord: "⌥J",
    label: "Polish selection",
    job: "Polish what you highlighted",
    before:
      "so basically we are gonna wanna maybe look into the possibility of potentially shipping this next week idk",
    after:
      "We're targeting a ship next week.",
    tag: "Tighten selected text (Cerebras)",
    accent: "#10b981",
  },
  {
    id: "cleanup",
    key: "N",
    chord: "⌥N",
    label: "Cleanup selection",
    job: "Clean up a messy transcript",
    before:
      "um so yeah the the meeting is at at three um on thursday with with the the design team",
    after:
      "The meeting is at 3pm on Thursday with the design team.",
    tag: "Repair Whisper artifacts in selection",
    accent: "#3b82f6",
  },
];

export const FEELS_LIKE_STEPS = [
  {
    n: "01",
    title: "Hold the key.",
    body: "No app to open. Alt+L is always listening for the moment a thought arrives.",
  },
  {
    n: "02",
    title: "Talk naturally.",
    body: "Messy, half-finished, full of umms. That's fine — that's how thinking sounds.",
  },
  {
    n: "03",
    title: "It appears, formatted.",
    body: "Clean text, pasted exactly where your cursor already is. Keep going.",
  },
];

export const EARLY_TESTERS = [
  {
    quote:
      "It's the first dictation tool that's actually faster than typing for me. I forget it's there until I need it.",
    name: "Early tester",
    role: "Software engineer",
  },
  {
    quote:
      "I draft whole docs by talking now. The formatting mode turns my rambling into an outline without me editing.",
    name: "Early tester",
    role: "PM",
  },
  {
    quote:
      "Alt+J on a sentence is magic. I write rough, highlight, and it's tight. That's my whole editing flow.",
    name: "Early tester",
    role: "Writer",
  },
];

export const INSTALL_COMMANDS = {
  win: "uv tool install --editable .",
  mac: "uv tool install --editable .",
  linux: "uv tool install --editable .",
} as const;
