"use client";

import { useEffect, useState } from "react";
import {
  PLATFORMS,
  PLATFORM_ORDER,
  detectPlatform,
  type Platform,
} from "@/lib/platform";
import { SectionHeading } from "@/components/primitives/SectionHeading";
import { CopyButton } from "@/components/primitives/CopyButton";
import { TerminalSurface } from "@/components/primitives/TerminalSurface";
import { cn } from "@/lib/cn";

export function Install() {
  const [platform, setPlatform] = useState<Platform>("windows");

  // Auto-detect on mount; default to windows for SSR consistency.
  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
  }, []);

  const config = PLATFORMS[platform];

  return (
    <section
      id="install"
      className="cv-auto border-t border-line py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeading kicker="install.">
          One command. uv bootstraps itself if it has to. No signup, no account
          required to dictate.
        </SectionHeading>

        {/* OS tabs */}
        <div
          role="tablist"
          aria-label="Operating system"
          className="mt-10 inline-flex rounded-md border border-line bg-panel p-1"
        >
          {PLATFORM_ORDER.map((p) => {
            const cfg = PLATFORMS[p];
            const selected = p === platform;
            return (
              <button
                key={p}
                role="tab"
                aria-selected={selected}
                onClick={() => setPlatform(p)}
                className={cn(
                  "rounded px-4 py-1.5 font-mono text-xs transition-colors",
                  selected
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:text-content",
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Command */}
        <div role="tabpanel" className="mt-6">
          <TerminalSurface title={config.shell} bare>
            <div className="flex items-start justify-between gap-3">
              <code className="break-all font-mono text-sm text-content">
                <span className="text-accent">$ </span>
                {config.command}
              </code>
              <CopyButton
                value={config.command}
                label={`Copy ${config.label} install command`}
                className="shrink-0"
              />
            </div>
          </TerminalSurface>
        </div>

        <ol className="mt-6 space-y-2 font-mono text-xs text-muted">
          <li>
            <span className="text-accent">1.</span> open {config.label === "Windows" ? "powershell" : "terminal"}
          </li>
          <li>
            <span className="text-accent">2.</span> paste the command, hit enter
          </li>
          <li>
            <span className="text-accent">3.</span> hold{" "}
            <span className="text-content">Alt+L</span> and start talking
          </li>
        </ol>

        {/* Recovery console */}
        <div className="mt-10 rounded-lg border border-line bg-panel/40 p-4">
          <h3 className="font-mono text-xs text-accent">
            # recovery console
          </h3>
          <p className="mt-2 text-sm text-muted">
            Recordings that fail are saved to disk. Recover them with a single
            command — a self-contained dashboard, or retry inline.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded border border-line bg-canvas/60 px-2 py-1 font-mono text-xs text-content">
              localflow-recover
            </code>
            <span className="font-mono text-[10px] text-muted/60">or</span>
            <code className="rounded border border-line bg-canvas/60 px-2 py-1 font-mono text-xs text-content">
              localflow-agent --recover
            </code>
          </div>
        </div>
      </div>
    </section>
  );
}
