"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SectionHeading } from "@/components/primitives/SectionHeading";
import { useInViewOnce } from "@/components/motion/useInViewOnce";
import { useCapabilityTier } from "@/components/motion/useCapabilityTier";

interface Engine {
  name: string;
  /** tokens/sec — used for the bar height ratio. */
  tps: number;
  label: string;
}

const ENGINES: Engine[] = [
  { name: "groq whisper", tps: 3000, label: "~3000 tok/s" },
  { name: "local whisper", tps: 280, label: "~280 tok/s" },
  { name: "browser-native", tps: 8, label: "~1× realtime" },
];

const MAX_TPS = 3000;

/** Count 0 → 0.4 with an ease-out over ~1s. Frozen at final on reduced-motion. */
function useCountUp(target: number, active: boolean, durationMs = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return value;
}

export function Speed() {
  const tier = useCapabilityTier();
  const { ref, inView } = useInViewOnce<HTMLDivElement>({ threshold: 0.3 });
  const animate = inView && tier === "live";
  const count = useCountUp(0.4, animate);

  return (
    <section id="speed" className="cv-auto border-t border-line py-20 sm:py-28">
      <div ref={ref} className="mx-auto max-w-6xl px-4">
        <SectionHeading kicker="speed.">
          One number that matters. First text in your editor in under 400ms.
        </SectionHeading>

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* The big number */}
          <div className="flex flex-col justify-center">
            <div className="font-mono text-7xl font-medium tracking-tighter text-accent sm:text-8xl lg:text-9xl">
              {animate ? count.toFixed(1) : "0.4"}
              <span className="text-4xl text-muted sm:text-5xl">s</span>
            </div>
            <p className="mt-6 max-w-md text-base text-muted">
              <span className="text-content">Hold Alt+L. Talk. Let go. It&apos;s pasted.</span>{" "}
              That&apos;s the whole product. No cloud round-trip for the audio
              path. Groq does the heavy lifting at ~3,000 tok/s.
            </p>
          </div>

          {/* Bar chart */}
          <div className="flex flex-col justify-center">
            <div className="rounded-lg border border-line bg-panel p-6 shadow-panel">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs text-muted">
                  transcription throughput
                </span>
                <span className="font-mono text-[10px] text-muted/60">
                  tok/s, higher is better
                </span>
              </div>

              <div className="flex h-48 items-end justify-around gap-4">
                {ENGINES.map((e, i) => {
                  const ratio = e.tps / MAX_TPS;
                  const isWinner = i === 0;
                  return (
                    <div
                      key={e.name}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                    >
                      <span className="font-mono text-[10px] text-muted">
                        {e.label}
                      </span>
                      <motion.div
                        className={isWinner ? "w-full bg-accent" : "w-full bg-muted/30"}
                        initial={{ height: 0 }}
                        animate={
                          animate ? { height: `${Math.max(4, ratio * 100)}%` } : { height: `${Math.max(4, ratio * 100)}%` }
                        }
                        transition={{
                          duration: 0.6,
                          delay: i * 0.1,
                          ease: "easeOut",
                        }}
                        style={{ minHeight: 4 }}
                      />
                      <span className="font-mono text-[11px] text-content">
                        {e.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
