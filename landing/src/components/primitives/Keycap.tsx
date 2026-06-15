import { cn } from "@/lib/cn";

interface KeycapProps {
  /** Glyph shown on the key, e.g. "L", "Alt", "M". */
  glyph: string;
  /** Size variant — default keys are small, the active/hero keys are larger. */
  size?: "sm" | "md" | "lg";
  /** Lit keys get the accent border + glow. */
  lit?: boolean;
  /** Modifier keys (Alt) are rendered wider. */
  wide?: boolean;
  /** Filler/non-functional keys render dimmer. */
  filler?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const SIZE_MAP = {
  sm: "h-8 min-w-8 text-[11px]",
  md: "h-11 min-w-11 text-sm",
  lg: "h-12 min-w-12 text-base",
} as const;

/**
 * A single keycap. Purely presentational — no interaction. The keyboard and
 * the mode cards compose these. Lit keys carry the accent; filler keys are
 * dim to keep the 6 reserved letters as the visual focus.
 */
export function Keycap({
  glyph,
  size = "md",
  lit = false,
  wide = false,
  filler = false,
  className,
  children,
}: KeycapProps) {
  return (
    <span
      aria-hidden={filler || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-md border font-mono font-medium leading-none",
        SIZE_MAP[size],
        wide && "min-w-[3.5rem]",
        // Base surface
        "bg-panel text-muted border-line",
        // Lit state: accent border + glow shadow token
        lit && "border-accent/60 text-content shadow-key",
        // Filler: dim further
        filler && "bg-canvas/60 text-muted/40 border-line/60",
        className,
      )}
    >
      {children ?? glyph}
    </span>
  );
}
