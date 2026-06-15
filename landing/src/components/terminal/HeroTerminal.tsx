"use client";

import dynamic from "next/dynamic";
import type { Mode } from "@/lib/modes";
import { useCapabilityTier } from "@/components/motion/useCapabilityTier";
import { TerminalPoster } from "@/components/terminal/TerminalPoster";

interface HeroTerminalProps {
  mode: Mode;
}

// Live demo is client-only and never SSR'd — the poster is the SSR/low-power
// default, swapped for the canvas version only on capable devices. The loading
// fallback is a dimension-matching skeleton so the canvas chunk loading never
// causes a flash of broken content or layout shift.
const TerminalDemo = dynamic(
  () => import("@/components/terminal/TerminalDemo").then((m) => m.TerminalDemo),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-lg border border-line bg-panel" />
    ),
  },
);

/**
 * Picks the live canvas terminal or the static poster based on the device's
 * capability tier. The poster is the default (SSR + low-power + reduced
 * motion); the live demo mounts only after the client determines the device
 * can handle it.
 */
export function HeroTerminal({ mode }: HeroTerminalProps) {
  const tier = useCapabilityTier();

  if (tier === "poster") {
    return <TerminalPoster mode={mode} />;
  }

  return <TerminalDemo mode={mode} />;
}
