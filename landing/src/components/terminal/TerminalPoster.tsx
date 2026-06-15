import type { Mode } from "@/lib/modes";
import { TerminalSurface } from "@/components/primitives/TerminalSurface";
import { TerminalContent } from "@/components/terminal/TerminalContent";
import { StaticWaveform } from "@/components/terminal/StaticWaveform";

interface TerminalPosterProps {
  mode: Mode;
  title?: string;
}

/**
 * Static fallback for the hero terminal. Shown when the device is low-power or
 * prefers-reduced-motion. Renders a frozen "completed" frame — the waveform is
 * a static SVG, the text is fully revealed (no streaming), and the paste
 * confirmation is shown. No JS, no canvas, no rAF.
 *
 * Visually identical to the final frame of the live demo, so the swap between
 * live and poster is imperceptible.
 */
export function TerminalPoster({
  mode,
  title = "localflow",
}: TerminalPosterProps) {
  return (
    <TerminalSurface title={`${title} — ${mode.keys.join("+").toLowerCase()}`}>
      <TerminalContent
        prompt={mode.keys.join("+").toLowerCase()}
        status="done"
        waveform={<StaticWaveform />}
        body={
          <span className="text-content">{mode.after || mode.demoTokens.join(" ")}</span>
        }
        pasted
      />
    </TerminalSurface>
  );
}
