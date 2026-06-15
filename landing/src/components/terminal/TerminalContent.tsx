import { cn } from "@/lib/cn";

/**
 * Static, presentational terminal content layout. Reused by:
 *   - the live TerminalDemo (which streams tokens into the `body` slot)
 *   - the TerminalPoster (reduced-motion fallback, frozen final frame)
 *   - the hotkey-keyboard's demo swap panel
 *
 * Keeping the chrome (prompt, waveform slot, paste confirmation) in one place
 * means the live and poster variants stay visually identical.
 */
interface TerminalContentProps {
  /** Mono prompt label, e.g. "alt+l" or the active mode. */
  prompt?: string;
  /** Status pill on the right of the prompt row. */
  status?: string;
  /** Waveform area (Canvas in live mode, SVG bars in poster). */
  waveform?: React.ReactNode;
  /** The transcribed/streaming text body. */
  body: React.ReactNode;
  /** Whether to show the "pasted at cursor ✓" confirmation line. */
  pasted?: boolean;
  className?: string;
}

export function TerminalContent({
  prompt = "alt+l",
  status,
  waveform,
  body,
  pasted = false,
  className,
}: TerminalContentProps) {
  return (
    <div className={cn("flex flex-col gap-3 font-mono text-sm", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          <span className="text-accent">$</span> {prompt}
        </span>
        {status ? (
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px]">
            {status}
          </span>
        ) : null}
      </div>

      {waveform ? <div className="h-10">{waveform}</div> : null}

      <div className="min-h-[3.5rem] leading-relaxed text-content">{body}</div>

      <div
        className={cn(
          "flex items-center gap-1.5 text-xs transition-opacity duration-300",
          pasted ? "text-accent opacity-100" : "text-muted opacity-0",
        )}
        aria-hidden={!pasted}
      >
        <span>↳</span>
        <span>pasted at cursor</span>
        <span>✓</span>
      </div>
    </div>
  );
}
