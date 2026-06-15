"use client";

import { useEffect, useState } from "react";

/**
 * Capability tier — gates the hero canvas behind device signals.
 *
 * Returns "poster" (static SVG fallback) when the device is low-power OR the
 * user has requested reduced motion. Otherwise "live" (Canvas animation).
 *
 * Per the high-end-visuals skill: gate heavy experiences behind
 * prefers-reduced-motion, deviceMemory, and hardwareConcurrency, and always
 * ship a static fallback.
 *
 * SSR-safe: returns "poster" on the server and during the first client paint
 * (before useEffect), then upgrades to "live" if the device qualifies. The
 * canvas is dynamically imported with ssr:false, so this only governs whether
 * the client mounts it.
 */
export type CapabilityTier = "live" | "poster";

export function useCapabilityTier(): CapabilityTier {
  const [tier, setTier] = useState<CapabilityTier>("poster");

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;

    if (reducedMotion || memory <= 4 || cores <= 4) {
      setTier("poster");
    } else {
      setTier("live");
    }
  }, []);

  return tier;
}
