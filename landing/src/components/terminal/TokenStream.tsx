"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface TokenStreamProps {
  tokens: string[];
  /** Reset key — when this changes, the stream replays from the start. */
  resetKey: string | number;
  className?: string;
}

/**
 * Streams tokens in one at a time, simulating ~3000 tok/s reveal. Pure CSS:
 * each token is a span that starts at opacity-0/translateY(2px) and transitions
 * to visible once its stagger delay has elapsed. The component only flips a
 * single `revealed` boolean per cycle — no per-token JS state, no per-frame
 * React updates.
 *
 * The cycle: hidden → (after mount) revealed (staggered CSS reveal) → onDone.
 * Caller (TerminalDemo) drives the broader record→stream→paste loop and swaps
 * `resetKey` to restart.
 */
export function TokenStream({ tokens, resetKey, className }: TokenStreamProps) {
  const [revealed, setRevealed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Reset on resetKey change.
    setRevealed(false);
    setVisibleCount(0);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // Reveal tokens progressively. ~50ms each reads as fast streaming.
    tokens.forEach((_, i) => {
      const id = setTimeout(() => {
        setVisibleCount((c) => Math.max(c, i + 1));
        if (i === tokens.length - 1) setRevealed(true);
      }, 120 + i * 55);
      timers.current.push(id);
    });

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [tokens, resetKey]);

  return (
    <span className={cn("inline", className)} aria-live="polite">
      {tokens.map((tok, i) => {
        const shown = i < visibleCount;
        return (
          <span
            key={`${resetKey}-${i}`}
            className={cn(
              "inline-block transition-all duration-150 ease-out",
              shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-0.5",
            )}
          >
            {tok}
            {i < tokens.length - 1 ? "\u00A0" : ""}
          </span>
        );
      })}
      {/* Caret blinks only while actively streaming, gone once revealed */}
      {!revealed && visibleCount > 0 ? (
        <span className="ml-0.5 inline-block h-[1.05em] w-[0.5ch] translate-y-[0.15em] bg-accent animate-caret-blink" aria-hidden />
      ) : null}
    </span>
  );
}
