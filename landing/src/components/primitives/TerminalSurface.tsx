import { cn } from "@/lib/cn";

interface TerminalSurfaceProps {
  children: React.ReactNode;
  className?: string;
  /** Optional titlebar text (mono). When provided, renders the mac-dots row. */
  title?: string;
  /** Hide the window chrome (dots + title). Default false. */
  bare?: boolean;
}

/**
 * The fake-terminal window chrome used across the page: hero demo, mode card
 * before/after surfaces, install command panels. Mono by default, lifted panel
 * background, subtle border, tight 4pt internal padding.
 *
 * Dots are mono-grey (not red/yellow/green) to keep the palette to one accent.
 */
export function TerminalSurface({
  children,
  className,
  title,
  bare = false,
}: TerminalSurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-panel shadow-panel",
        className,
      )}
    >
      {!bare && (
        <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted/30" />
          </div>
          {title ? (
            <span className="ml-1 font-mono text-[11px] text-muted">
              {title}
            </span>
          ) : null}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
