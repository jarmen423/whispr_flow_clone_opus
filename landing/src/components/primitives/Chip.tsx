import { cn } from "@/lib/cn";

interface ChipProps {
  children: React.ReactNode;
  className?: string;
  /** Accent variant highlights the chip border/text in accent. */
  accent?: boolean;
}

/**
 * Small mono pill — used for metric chips, mode tags, badges. Always mono;
 * the terminal aesthetic is consistent type, not color variety.
 */
export function Chip({ children, className, accent = false }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs",
        accent
          ? "border-accent/40 text-accent"
          : "border-line text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
