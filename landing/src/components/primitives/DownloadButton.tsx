"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import {
  type Platform,
  PLATFORMS,
  detectPlatform,
} from "@/lib/platform";
import { cn } from "@/lib/cn";

interface DownloadButtonProps {
  className?: string;
  /** Anchor href; should point at the #install section. */
  href?: string;
}

/**
 * Secondary hero CTA. Labels itself with the detected OS ("Download for macOS")
 * and links to the install section. Detection runs client-side on mount; before
 * that it renders a neutral "Download" label to avoid hydration mismatch.
 */
export function DownloadButton({
  className,
  href = "#install",
}: DownloadButtonProps) {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
  }, []);

  const label = platform
    ? `Download for ${PLATFORMS[platform].label}`
    : "Download";

  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 font-mono text-sm text-content transition-colors hover:border-accent/40 hover:text-accent",
        className,
      )}
    >
      <ArrowDown className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );
}
