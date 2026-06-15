"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MODES, MODE_MAP, type ModeId, DEFAULT_MODE } from "@/lib/modes";
import { Keycap } from "@/components/primitives/Keycap";
import { TerminalSurface } from "@/components/primitives/TerminalSurface";
import { SectionHeading } from "@/components/primitives/SectionHeading";
import { StaticWaveform } from "@/components/terminal/StaticWaveform";
import { cn } from "@/lib/cn";

/** Map of reserved letter → mode id, for the keyboard layout. */
const LETTER_TO_MODE: Record<string, ModeId> = {
  L: "raw",
  M: "format",
  T: "translate",
  A: "agent",
  J: "format-selection",
  N: "cleanup",
} as const;

const RESERVED = new Set(Object.keys(LETTER_TO_MODE));

/**
 * A single row of the stylized keyboard. Filler keys are decorative (aria-hidden);
 * reserved keys are interactive buttons that swap the demo panel.
 */
interface RowDef {
  /** Letters in order. Use "" for a gap. The reserved letters light up. */
  keys: string[];
}

// A compact 3-row QWERTY fragment that includes all 6 reserved letters.
const ROWS: RowDef[] = [
  { keys: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"] },
  { keys: ["A", "S", "D", "F", "G", "H", "J", "K", "L"] },
  { keys: ["Z", "X", "C", "V", "B", "N", "M"] },
];

export function HotkeyKeyboard() {
  const [active, setActive] = useState<ModeId>(DEFAULT_MODE);
  const mode = MODE_MAP[active];

  return (
    <section id="keys" className="cv-auto border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading kicker="the keys.">
          Hold a hotkey. Talk. Let go. Every mode is one keystroke. Hover a lit
          key to see what it does.
        </SectionHeading>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Keyboard */}
          <div className="flex flex-col items-center gap-6">
            <div className="w-full max-w-xl rounded-xl border border-line bg-panel/60 p-4 shadow-panel sm:p-6">
              {/* Alt modifier row */}
              <div className="mb-2 flex gap-1.5">
                <Keycap glyph="Alt" wide lit size="md" />
                <span className="self-center font-mono text-xs text-muted">
                  +
                </span>
                <span className="self-center font-mono text-xs text-muted">
                  then a letter
                </span>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                {ROWS.map((row, ri) => (
                  <div
                    key={ri}
                    className="flex gap-1.5"
                    style={{ marginLeft: `${ri * 12}px` }}
                  >
                    {row.keys.map((letter) => {
                      const isReserved = RESERVED.has(letter);
                      const modeId = LETTER_TO_MODE[letter];
                      const isActive = modeId === active;
                      return isReserved ? (
                        <button
                          key={letter}
                          type="button"
                          onFocus={() => setActive(modeId)}
                          onMouseEnter={() => setActive(modeId)}
                          aria-label={`${MODE_MAP[modeId].keys.join(" + ")}: ${MODE_MAP[modeId].name}`}
                          aria-pressed={isActive}
                          className="rounded-md transition-transform focus-visible:translate-y-[-2px] hover:-translate-y-0.5"
                        >
                          <Keycap
                            glyph={letter}
                            size="md"
                            lit
                            className={cn(
                              isActive && "ring-2 ring-accent ring-offset-2 ring-offset-panel",
                            )}
                          />
                        </button>
                      ) : (
                        <Keycap
                          key={letter}
                          glyph={letter}
                          size="md"
                          filler
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Mini legend of all 6 modes */}
            <ul className="grid w-full max-w-xl grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
              {MODES.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onFocus={() => setActive(m.id)}
                    onMouseEnter={() => setActive(m.id)}
                    onClick={() => setActive(m.id)}
                    className={cn(
                      "flex items-center gap-2 font-mono text-xs transition-colors",
                      active === m.id ? "text-accent" : "text-muted hover:text-content",
                    )}
                  >
                    <span className="text-muted">{m.keys.join("")}</span>
                    <span>{m.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Shared-element demo panel — content morphs on key swap */}
          <div className="flex items-center">
            <div className="w-full" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode.id}
                  layoutId="hotkey-demo"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <TerminalSurface title={`localflow — ${mode.keys.join("+").toLowerCase()}`}>
                    <div className="flex flex-col gap-3 font-mono text-sm">
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>
                          <span className="text-accent">$</span> {mode.keys.join("+").toLowerCase()}
                        </span>
                        <span className="rounded border border-line px-1.5 py-0.5 text-[10px]">
                          {mode.trigger}
                        </span>
                      </div>

                      <div className="h-8">
                        <StaticWaveform />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted">
                          <span className="text-muted/60">before</span>
                          <br />
                          <span className="text-muted">{mode.before}</span>
                        </p>
                        <p className="text-xs">
                          <span className="text-accent">→</span>{" "}
                          <span className="text-accent/80">after</span>
                          <br />
                          <span className="whitespace-pre-line text-content">
                            {mode.after}
                          </span>
                        </p>
                      </div>
                    </div>
                  </TerminalSurface>

                  <p className="mt-4 text-sm text-muted">
                    <span className="font-mono text-accent">{mode.name}.</span>{" "}
                    {mode.blurb}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
