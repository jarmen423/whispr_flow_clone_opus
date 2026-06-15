"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

interface CopyButtonProps {
  /** Text to write to the clipboard. */
  value: string;
  /** Optional accessible label; defaults to "Copy command". */
  label?: string;
  /** Tailwind classes to override the default button styling. */
  className?: string;
  /** Show the "Copied"/"Copy" text label next to the icon. Default true. */
  showLabel?: boolean;
}

type State = "idle" | "copied";

/**
 * Optimistic copy-to-clipboard button. Shows "Copied ✓" immediately on click,
 * then reverts after 1.5s. Falls back to a hidden textarea + execCommand if
 * the async Clipboard API is unavailable (older browsers, non-secure contexts).
 *
 * Server-component-safe: the parent can be a server component and render this
 * as a child — only this primitive is a client component.
 */
export function CopyButton({
  value,
  label = "Copy command",
  className,
  showLabel = true,
}: CopyButtonProps) {
  const [optimistic, setOptimistic] = useState<State>("idle");
  const revertTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const copy = async () => {
    setOptimistic("copied");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for non-secure contexts / older browsers.
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      // Swallow — the optimistic state still gives feedback; the command is
      // visible for manual selection either way.
    }

    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setOptimistic("idle"), 1500);
  };

  const copied = optimistic === "copied";

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-xs text-muted transition-colors hover:text-content hover:border-accent/40",
        copied && "border-accent/60 text-accent",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
      {showLabel && <span>{copied ? "Copied ✓" : "Copy"}</span>}
    </button>
  );
}
