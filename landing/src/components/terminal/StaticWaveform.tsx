import { cn } from "@/lib/cn";

interface StaticWaveformProps {
  bars?: number;
  className?: string;
}

/**
 * Static SVG waveform — the frozen poster variant. No JS, no animation.
 * Used by TerminalPoster (reduced-motion / low-power) and anywhere we want a
 * decorative waveform without the canvas cost.
 *
 * Bar heights are deterministic so SSR and client render identically.
 */
export function StaticWaveform({ bars = 30, className }: StaticWaveformProps) {
  const W = 280;
  const H = 40;
  const gap = 3;
  const barWidth = (W - gap * (bars - 1)) / bars;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Audio waveform"
      className={cn("h-full w-full", className)}
    >
      {Array.from({ length: bars }, (_, i) => {
        const phase = i / bars;
        const envelope = Math.sin(phase * Math.PI);
        const wave =
          0.45 +
          0.35 * Math.sin(i * 0.6) +
          0.2 * Math.sin(i * 0.23);
        const h = Math.max(0.08, envelope * wave) * (H - 2);
        const x = i * (barWidth + gap);
        const y = H / 2 - h / 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={0.5}
            className="fill-accent"
            style={{ opacity: 0.85 }}
          />
        );
      })}
    </svg>
  );
}
