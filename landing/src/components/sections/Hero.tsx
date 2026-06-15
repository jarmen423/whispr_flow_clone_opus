import { CopyButton } from "@/components/primitives/CopyButton";
import { DownloadButton } from "@/components/primitives/DownloadButton";
import { HeroTerminal } from "@/components/terminal/HeroTerminal";
import { MetricChips } from "@/components/terminal/MetricChips";
import { MODE_MAP } from "@/lib/modes";
import { DEV_INSTALL_COMMAND } from "@/lib/platform";

/**
 * Hero — asymmetric 60/40 split.
 *
 * Left (server-rendered): mono badge, `speak. paste. done.` headline with
 * blinking caret, one-line subhead, copy-command CTA, OS-detected download.
 * Scanlines overlay on this column only.
 *
 * Right (client): the live terminal demo (or poster fallback) + metric chips.
 */
export function Hero() {
  const mode = MODE_MAP.raw;

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-20 pt-24 sm:pt-28 lg:grid-cols-5 lg:gap-12 lg:pb-28 lg:pt-32">
        {/* Left column — 60% on lg */}
        <div className="scanlines relative z-10 flex flex-col justify-center lg:col-span-3">
          <p className="font-mono text-xs text-muted">
            <span className="text-accent">//</span> voice-to-text, terminal-grade
          </p>

          <h1 className="mt-5 font-mono text-5xl font-medium leading-[1.05] tracking-tight text-content sm:text-6xl lg:text-7xl">
            speak.
            <br />
            paste.
            <br />
            done.
            <span
              className="ml-1 inline-block h-[0.85em] w-[0.45ch] translate-y-[0.06em] bg-accent animate-caret-blink"
              aria-hidden
            />
          </h1>

          <p className="mt-6 max-w-md text-base text-muted sm:text-lg">
            Whisper at ~3,000 tok/s. Local-first. Bring your own Groq key.
          </p>

          {/* Primary CTA — fake terminal command you can actually copy */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="group relative flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2.5 font-mono text-sm shadow-panel">
              <span className="text-accent">$</span>
              <code className="text-content">{DEV_INSTALL_COMMAND}</code>
              <CopyButton
                value={DEV_INSTALL_COMMAND}
                label="Copy install command"
                className="absolute -right-[5.5rem] top-1/2 -translate-y-1/2 sm:static sm:translate-y-0"
              />
            </div>
            <DownloadButton />
          </div>

          <div className="mt-10">
            <MetricChips />
          </div>
        </div>

        {/* Right column — 40% on lg, the live terminal */}
        <div className="relative z-10 flex items-center lg:col-span-2">
          <div className="w-full">
            <HeroTerminal mode={mode} />
          </div>
        </div>
      </div>
    </section>
  );
}
