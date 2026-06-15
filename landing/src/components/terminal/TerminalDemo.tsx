"use client";

import { useEffect, useState } from "react";
import type { Mode } from "@/lib/modes";
import { TerminalSurface } from "@/components/primitives/TerminalSurface";
import { TerminalContent } from "@/components/terminal/TerminalContent";
import { WaveformCanvas } from "@/components/terminal/WaveformCanvas";
import { TokenStream } from "@/components/terminal/TokenStream";

interface TerminalDemoProps {
  mode: Mode;
  title?: string;
}

type Phase = "recording" | "streaming" | "pasted" | "hold";

// Phase durations (ms). Tuned so a full loop reads naturally but doesn't drag.
const PHASE_MS: Record<Phase, number> = {
  recording: 1400, // waveform reacting, no text yet
  streaming: 0, // governed by TokenStream token count (~120 + n*55)
  pasted: 900, // confirmation line held
  hold: 1200, // pause on final frame before loop restarts
};

// Extra pad after the last token fires before flipping to "pasted".
const STREAM_TAIL_MS = 300;

/**
 * The live hero terminal. Cycles record → stream → paste → hold → restart.
 * Pauses the loop on hover (freezes on whatever phase it's in) and stops the
 * waveform via the `paused` prop handed to WaveformCanvas.
 *
 * The component is a client component but is dynamically imported with
 * ssr:false by its parent (Hero), so it never participates in SSR. The poster
 * variant renders during SSR and on low-power devices.
 */
export function TerminalDemo({ mode, title = "localflow" }: TerminalDemoProps) {
  const [phase, setPhase] = useState<Phase>("recording");
  const [hovered, setHovered] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // Restart the loop whenever the mode changes.
    setPhase("recording");
    setCycle((c) => c + 1);
  }, [mode.id]);

  useEffect(() => {
    if (hovered) return; // freeze on hover
    if (phase === "pasted") {
      const id = setTimeout(() => setPhase("hold"), PHASE_MS.pasted);
      return () => clearTimeout(id);
    }
    if (phase === "hold") {
      const id = setTimeout(() => {
        setPhase("recording");
        setCycle((c) => c + 1);
      }, PHASE_MS.hold);
      return () => clearTimeout(id);
    }
    if (phase === "recording") {
      const id = setTimeout(() => setPhase("streaming"), PHASE_MS.recording);
      return () => clearTimeout(id);
    }
    // streaming → pasted: wait for the token stream to finish.
    if (phase === "streaming") {
      const streamMs =
        120 + mode.demoTokens.length * 55 + STREAM_TAIL_MS;
      const id = setTimeout(() => setPhase("pasted"), streamMs);
      return () => clearTimeout(id);
    }
  }, [phase, hovered, cycle, mode.demoTokens.length]);

  const prompt = mode.keys.join("+").toLowerCase();
  const showStream = phase === "streaming" || phase === "pasted" || phase === "hold";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={-1}
    >
      <TerminalSurface title={`${title} — ${prompt}`}>
        <TerminalContent
          prompt={prompt}
          status={
            phase === "recording"
              ? "rec"
              : phase === "streaming"
                ? "typing"
                : phase === "pasted" || phase === "hold"
                  ? "done"
                  : undefined
          }
          waveform={
            <WaveformCanvas paused={phase !== "recording" || hovered} />
          }
          body={
            showStream ? (
              <TokenStream
                tokens={mode.demoTokens}
                resetKey={`${mode.id}-${cycle}`}
              />
            ) : (
              <span className="text-muted">
                <span className="text-accent">●</span> listening…
              </span>
            )
          }
          pasted={phase === "pasted" || phase === "hold"}
        />
      </TerminalSurface>
    </div>
  );
}
