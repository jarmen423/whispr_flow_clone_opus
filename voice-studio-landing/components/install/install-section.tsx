"use client";

import { useEffect, useState, useOptimistic } from "react";
import { Section } from "@/components/primitives/section";
import { Eyebrow } from "@/components/primitives/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/primitives/button";
import { detectOS, osLabel, type OS } from "@/lib/os-detect";
import { INSTALL_COMMANDS } from "@/lib/content";

const TABS: { id: OS; label: string }[] = [
  { id: "win", label: "Windows" },
  { id: "mac", label: "macOS" },
  { id: "linux", label: "Linux" },
];

/**
 * Install section — OS tabs (auto-detected), single copyable command,
 * optimistic "Copied ✓" feedback via useOptimistic (reverts after 1.5s).
 * One line on the recovery console for power users.
 */
export function InstallSection() {
  const [os, setOs] = useState<OS>("win");
  const [copied, setCopied] = useState(false);

  // useOptimistic for the copy confirmation.
  const [optimisticCopied, setOptimisticCopied] = useOptimistic(copied);

  useEffect(() => {
    setOs(detectOS(navigator.userAgent));
  }, []);

  const command = INSTALL_COMMANDS[os];

  const onCopy = async () => {
    setOptimisticCopied(true);
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard can fail in non-secure contexts; the optimistic state still
      // gives feedback. We don't lie — the command is right there to copy manually.
    }
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Section id="install" cvAuto>
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <Eyebrow>Install</Eyebrow>
          <h2
            className="mt-3 font-[family-name:var(--font-display)] font-medium tracking-tight"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
          >
            One command. Then hold a key.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Managed by uv — no manual venvs, no launcher scripts. Editable
            install means <code className="font-mono text-sm">git pull</code>{" "}
            updates without reinstall.
          </p>
        </Reveal>

        {/* OS tabs */}
        <Reveal delay={100} className="mt-8">
          <div
            role="tablist"
            aria-label="Operating system"
            className="inline-flex rounded-full border border-subtle bg-panel p-1 shadow-soft"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={os === tab.id}
                onClick={() => setOs(tab.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-[var(--dur-fast)] ${
                  os === tab.id
                    ? "bg-accent text-on-accent"
                    : "text-muted hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Command block */}
        <Reveal delay={150} className="mt-5">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-subtle bg-panel p-3 pl-5 text-left shadow-soft">
            <span className="select-none font-mono text-faint">$</span>
            <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-primary">
              {command}
            </code>
            <Button
              variant={optimisticCopied ? "subtle" : "ghost"}
              size="default"
              onClick={onCopy}
              className="shrink-0"
              aria-label={`Copy install command for ${osLabel(os)}`}
            >
              {optimisticCopied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2.5 9.5h-.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  </svg>
                  Copy
                </>
              )}
            </Button>
          </div>
        </Reveal>

        <Reveal delay={220} className="mt-6">
          <p className="font-mono text-xs text-faint">
            Installs <span className="text-muted">localflow-agent</span> +{" "}
            <span className="text-muted">localflow-recover</span> (the recovery
            console, in case a recording ever fails)
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
