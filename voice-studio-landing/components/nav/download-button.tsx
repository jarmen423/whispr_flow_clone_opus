"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/primitives/button";
import { detectOS, osLabel, type OS } from "@/lib/os-detect";

/**
 * Download button — auto-detects OS from the UA, surfaces the right label.
 * Links to the install section (the canonical command lives there).
 */
export function DownloadButton({
  size = "default",
  variant = "primary",
  withCaret = false,
  className = "",
}: {
  size?: "default" | "lg";
  variant?: "primary" | "ghost";
  withCaret?: boolean;
  className?: string;
}) {
  const [os, setOs] = useState<OS | null>(null);

  useEffect(() => {
    setOs(detectOS(navigator.userAgent));
  }, []);

  const label = os ? `Download for ${osLabel(os)}` : "Download";

  return (
    <Button as="a" href="#install" variant={variant} size={size} className={className}>
      {label}
      {withCaret && (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </Button>
  );
}
