"use client";

import { useState } from "react";
import { Container } from "@/components/primitives/container";
import { Button } from "@/components/primitives/button";
import { VoiceOrb } from "./voice-orb";
import { StreamingDemo } from "./streaming-demo";
import { DownloadButton } from "@/components/nav/download-button";

export function Hero() {
  const [speaking, setSpeaking] = useState(false);

  return (
    <section id="top" className="relative overflow-hidden pt-12 md:pt-20">
      <Container size="wide" className="relative">
        <div className="flex flex-col items-center text-center">
          {/* Orb */}
          <div className="relative -mb-12 md:-mb-16">
            <VoiceOrb speaking={speaking} />
          </div>

          {/* Headline */}
          <h1
            className="relative z-10 max-w-3xl font-[family-name:var(--font-display)] font-medium leading-[1.05] tracking-[-0.02em]"
            style={{
              fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
            }}
          >
            Speak it.
            <br />
            <span className="italic text-accent">Then keep going.</span>
          </h1>

          {/* Subhead */}
          <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted md:text-xl">
            LocalFlow turns your voice into clean, formatted text — anywhere you
            type. Hold a key, talk, let go. It&apos;s pasted.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <DownloadButton size="lg" variant="primary" />
            <Button as="a" href="#feels-like" variant="ghost" size="lg">
              See it in action
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M8 3v10M3 8l5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>

          {/* Trust line */}
          <p className="mt-6 font-mono text-xs text-faint">
            BYOK · local-first · ~3,000 tok/s · 0 ms cloud storage
          </p>

          {/* Streaming demo */}
          <div className="mt-12 w-full max-w-xl">
            <StreamingDemo onSpeaking={setSpeaking} />
          </div>
        </div>
      </Container>
    </section>
  );
}
