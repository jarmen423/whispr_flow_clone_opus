"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Streaming demo — types out a real before→after example, simulating
 * the dictation flow. Drives the orb's "speaking" state via onSpeaking.
 *
 * Phases per loop:
 *   typing  → "before" text streams char-by-char (fast)
 *   format  → brief pause, then text morphs to "after"
 *   pasted  → "✓ pasted" confirmation shows
 *   reset   → clear and loop
 *
 * Reduced motion: jump straight to the final "after" + pasted state, no typing.
 * Pauses on hover.
 */

type Phase = "typing" | "format" | "pasted" | "reset";

const BEFORE =
  "hey team pushing the auth fix now will need like twenty minutes to verify";
const AFTER =
  "Hey team — pushing the auth fix now. Will need ~20 min to verify.";

const TYPE_INTERVAL = 45; // ms per char
const FORMAT_PAUSE = 600; // ms before morph
const PASTED_HOLD = 1800; // ms showing pasted state
const RESET_PAUSE = 800; // ms before loop

export function StreamingDemo({
  onSpeaking,
}: {
  onSpeaking?: (speaking: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [pasted, setPasted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timers = useRef<number[]>([]);

  // Clear all pending timers
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const addTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (paused) return;
    clearTimers();

    // Reduced motion: show final state immediately, then loop slowly.
    if (reduced) {
      setText(AFTER);
      setPasted(true);
      setPhase("pasted");
      onSpeaking?.(false);
      addTimer(() => {
        setText("");
        setPasted(false);
        setPhase("typing");
      }, PASTED_HOLD + RESET_PAUSE);
      return;
    }

    let charIndex = 0;

    if (phase === "typing") {
      onSpeaking?.(true);
      const typeNext = () => {
        if (charIndex >= BEFORE.length) {
          onSpeaking?.(false);
          setPhase("format");
          return;
        }
        setText(BEFORE.slice(0, charIndex + 1));
        charIndex += 1;
        addTimer(typeNext, TYPE_INTERVAL);
      };
      addTimer(typeNext, TYPE_INTERVAL);
    } else if (phase === "format") {
      addTimer(() => {
        setText(AFTER);
        setPhase("pasted");
        setPasted(true);
      }, FORMAT_PAUSE);
    } else if (phase === "pasted") {
      addTimer(() => {
        setPhase("reset");
      }, PASTED_HOLD);
    } else if (phase === "reset") {
      addTimer(() => {
        setText("");
        setPasted(false);
        setPhase("typing");
      }, RESET_PAUSE);
    }

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, reduced]);

  return (
    <div
      className="w-full max-w-xl select-none rounded-[var(--radius-lg)] border border-subtle bg-panel p-5 shadow-soft"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Dictation demo (animated)"
    >
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-faint">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        {phase === "typing"
          ? "Listening"
          : phase === "format"
            ? "Formatting"
            : phase === "pasted"
              ? "Pasted"
              : "Ready"}
      </div>

      <div
        className="min-h-[4.5rem] font-sans text-[15px] leading-relaxed text-primary md:text-base"
        aria-live="polite"
      >
        {text}
        {phase === "typing" && <span className="caret" style={{ height: "1em" }} />}
        {pasted && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/12 px-2 py-0.5 align-middle text-xs text-accent">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2.5 6.5l2.5 2.5 4.5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            pasted
          </span>
        )}
      </div>

      <p className="mt-3 font-mono text-[11px] text-faint">
        Hover to pause · loops every few seconds
      </p>
    </div>
  );
}
