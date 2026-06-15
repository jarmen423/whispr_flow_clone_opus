/**
 * The six hotkey modes — single source of truth.
 *
 * Consumed by:
 *   - HotkeyKeyboard (key labels, lit state, hover swap)
 *   - ModeCards (before/after examples)
 *   - TerminalDemo (streaming demo token scripts)
 *
 * Hotkey letters are reserved per AGENTS.md. Do not reassign without updating
 * the keyboard layout in components/sections/HotkeyKeyboard.tsx.
 */

export type ModeId = "raw" | "format" | "agent" | "translate" | "cleanup" | "format-selection";

export interface Mode {
  id: ModeId;
  /** Hotkey modifier + letter, e.g. ["Alt", "L"] */
  keys: string[];
  /** Terminal-style label, e.g. "raw" */
  label: string;
  /** Human name for tooltips & cards */
  name: string;
  /** One-line description */
  blurb: string;
  /** How the hotkey is used — hold to record, tap, or toggle */
  trigger: "hold" | "tap" | "toggle";
  /** Card before-state (what you said / what's highlighted) */
  before: string;
  /** Card after-state (what gets pasted) */
  after: string;
  /** Longer example for the expanded card replay */
  beforeLong: string;
  afterLong: string;
  /** Token-by-token script the hero terminal streams when this mode is active */
  demoTokens: string[];
}

export const MODES: Mode[] = [
  {
    id: "raw",
    keys: ["Alt", "L"],
    label: "raw",
    name: "Raw dictation",
    blurb: "Transcription only. No LLM. Fastest path from mouth to cursor.",
    trigger: "hold",
    before: "(speaking) hey remind the team standup moved to ten",
    after: "hey remind the team standup moved to ten",
    beforeLong: "(speaking) so the deploy checklist needs a new step for the migration script and can someone update the runbook",
    afterLong:
      "so the deploy checklist needs a new step for the migration script and can someone update the runbook",
    demoTokens: [
      "hey",
      "remind",
      "the",
      "team",
      "standup",
      "moved",
      "to",
      "ten",
    ],
  },
  {
    id: "format",
    keys: ["Alt", "M"],
    label: "format",
    name: "Format mode",
    blurb: "Cerebras turns spoken structure into clean outlines and lists.",
    trigger: "hold",
    before: "(speaking) three things first ship the fix second write the retro third ping design",
    after:
      "1. ship the fix\n2. write the retro\n3. ping design",
    beforeLong:
      "(speaking) ok roadmap q3 we finish auth then mobile then billing and under billing migrate stripe and add webhooks",
    afterLong:
      "## Q3 roadmap\n\n- auth\n- mobile\n- billing\n  - migrate stripe\n  - add webhooks",
    demoTokens: ["1.", "ship", "the", "fix", "2.", "write", "retro"],
  },
  {
    id: "agent",
    keys: ["Alt", "A"],
    label: "agent",
    name: "Voice agent",
    blurb: "Ask a question. Get a web-grounded answer pasted at the cursor.",
    trigger: "hold",
    before: "(speaking) what's the latest stable version of next js",
    after:
      "Next.js 16.1.6 is the current stable release (June 2026), shipped on the Fluid Compute runtime.",
    beforeLong:
      "(speaking) is bun compatible with react server components in production",
    afterLong:
      "Yes. Bun 1.2+ runs RSC via the React flight server. Vercel still recommends Node for managed RSC deploys; self-hosted Bun is production-ready.",
    demoTokens: ["next.js", "16.1.6", "stable", "fluid", "compute"],
  },
  {
    id: "translate",
    keys: ["Alt", "T"],
    label: "translate",
    name: "Translate",
    blurb: "Toggle Whisper translation. Speak any language, paste English.",
    trigger: "toggle",
    before: "(hablando) hola equipo la reunion es manana a las diez",
    after: "hello team the meeting is tomorrow at ten",
    beforeLong:
      "(parlant) le deploiement est prevu pour vendredi il faut finaliser les tests",
    afterLong:
      "the deployment is scheduled for friday we need to finish the tests",
    demoTokens: ["hello", "team", "meeting", "tomorrow", "ten"],
  },
  {
    id: "format-selection",
    keys: ["Alt", "J"],
    label: "format-selection",
    name: "Format selection",
    blurb: "Highlight text. Tap. Cerebras reformats it in place.",
    trigger: "tap",
    before: "so basically like we need to um ship this by friday hopefully",
    after: "We need to ship this by Friday.",
    beforeLong:
      "yeah the PR is like almost done just need reviews from maybe sarah or alex and then we can probably merge",
    afterLong:
      "PR is nearly done. Need reviews from Sarah or Alex, then we can merge.",
    demoTokens: ["We", "need", "to", "ship", "by", "Friday."],
  },
  {
    id: "cleanup",
    keys: ["Alt", "N"],
    label: "cleanup",
    name: "Cleanup",
    blurb: "Repairs Whisper artifacts in highlighted text. Punctuation, grammar, filler.",
    trigger: "tap",
    before: "hey um so basically the deploy script uh it broke last night",
    after: "The deploy script broke last night.",
    beforeLong:
      "ok so like the metrics dashboard is kinda slow whenever we query the last thirty days it times out",
    afterLong:
      "The metrics dashboard is slow. Querying the last thirty days times out.",
    demoTokens: ["The", "deploy", "script", "broke", "last", "night."],
  },
];

export const MODE_MAP: Record<ModeId, Mode> = Object.fromEntries(
  MODES.map((m) => [m.id, m]),
) as Record<ModeId, Mode>;

/** Default mode for the hero demo loop and the keyboard's initial selection. */
export const DEFAULT_MODE: ModeId = "raw";
