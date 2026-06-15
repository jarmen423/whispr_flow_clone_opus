"use client";

import { useEffect, useState } from "react";

/**
 * Voice Orb — the signature visual.
 * Pure SVG + CSS. No canvas, no WebGL.
 *
 * Layers (back to front):
 *   1. Outer halo glow (two blurred radial blobs)
 *   2. Concentric ripple rings (visible on hover/focus — "listening")
 *   3. The orb body: organic blob path filled with the brand gradient
 *
 * Animation:
 *   - Idle: gentle 6s breathing via `.orb-breathe` (compositor transform).
 *   - "Speaking": faster 2.2s breathing via `.is-speaking` (set by streaming demo).
 *   - Reduced motion / mobile: static (no animation class).
 *   - Hover/focus: ripple rings animate outward.
 *
 * Decorative only → aria-hidden.
 */
export function VoiceOrb({ speaking = false }: { speaking?: boolean }) {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    setCapable(!prefersReduced && isDesktop);
  }, []);

  return (
    <div
      className="pointer-events-none relative grid place-items-center"
      style={{ width: "min(70vw, 460px)", aspectRatio: "1 / 1" }}
      aria-hidden="true"
    >
      {/* Outer halo — two soft blurred blobs */}
      <div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--orb-glow-1) 0%, transparent 60%)",
          opacity: 0.7,
        }}
      />
      <div
        className="absolute inset-[8%] rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, var(--orb-glow-2) 0%, transparent 65%)",
          opacity: 0.6,
        }}
      />

      {/* Ripple rings — group, animate outward on hover/focus via parent group-hover */}
      <div
        className={`absolute inset-[18%] rounded-full border ${capable ? "orb-ripple" : ""}`}
        style={{ borderColor: "var(--orb-glow-1)", opacity: 0.35 }}
      />
      <div
        className={`absolute inset-[10%] rounded-full border ${capable ? "orb-ripple" : ""}`}
        style={{ borderColor: "var(--orb-glow-2)", opacity: 0.25 }}
      />

      {/* Orb body */}
      <div
        className={`relative h-[62%] w-[62%] ${capable ? `orb-breathe ${speaking ? "is-speaking" : ""}` : ""}`}
      >
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full drop-shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        >
          <defs>
            <radialGradient id="orb-grad" cx="32%" cy="28%" r="80%">
              <stop offset="0%" stopColor="#ffb59a" />
              <stop offset="32%" stopColor="#ff7a59" />
              <stop offset="70%" stopColor="#b666e6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </radialGradient>
            <filter id="orb-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
          </defs>
          {/* Organic blob — a smooth closed bezier path */}
          <path
            d="M100 18
               C138 18 172 44 178 82
               C184 118 168 152 134 170
               C104 186 64 180 38 156
               C14 134 8 96 24 64
               C40 32 68 18 100 18 Z"
            fill="url(#orb-grad)"
            filter="url(#orb-soft)"
          />
          {/* Specular highlight */}
          <ellipse
            cx="72"
            cy="58"
            rx="28"
            ry="18"
            fill="white"
            opacity="0.22"
            transform="rotate(-25 72 58)"
          />
        </svg>
      </div>
    </div>
  );
}
