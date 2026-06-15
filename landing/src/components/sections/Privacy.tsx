import { Key, Laptop, Lock } from "lucide-react";
import { SectionHeading } from "@/components/primitives/SectionHeading";

/**
 * Privacy / local-first. A CSS/SVG diagram (no canvas) showing that audio stays
 * on the machine: the only network path is the user's own Groq key, sent
 * per-request, never stored. The "retry" path is muted/dashed to signal it's
 * opt-in.
 */
export function Privacy() {
  return (
    <section
      id="privacy"
      className="cv-auto border-t border-line bg-panel/30 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading kicker="privacy.">
          Your audio stays on your machine. The only thing that leaves is a
          transcription request, signed with your own key.
        </SectionHeading>

        <div className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Diagram */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-lg border border-line bg-canvas/60 p-6">
              <div className="flex items-center justify-between gap-3">
                {/* Your machine */}
                <div className="flex flex-1 flex-col items-center gap-2 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border border-accent/40 bg-panel">
                    <Laptop className="h-6 w-6 text-accent" aria-hidden />
                  </div>
                  <span className="font-mono text-[11px] text-content">
                    your machine
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    audio + key
                  </span>
                </div>

                {/* Arrow: stays local (accent, solid) */}
                <div className="flex flex-1 flex-col items-center">
                  <span className="font-mono text-[10px] text-accent">
                    transcribe
                  </span>
                  <svg
                    viewBox="0 0 100 12"
                    className="h-3 w-full"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <line
                      x1="2"
                      y1="6"
                      x2="94"
                      y2="6"
                      className="stroke-accent"
                      strokeWidth="2"
                    />
                    <polygon points="94,2 100,6 94,10" className="fill-accent" />
                  </svg>
                  <span className="font-mono text-[10px] text-muted">
                    your groq key
                  </span>
                </div>

                {/* Groq */}
                <div className="flex flex-1 flex-col items-center gap-2 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border border-line bg-panel">
                    <Key className="h-6 w-6 text-muted" aria-hidden />
                  </div>
                  <span className="font-mono text-[11px] text-content">
                    groq
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    whisper only
                  </span>
                </div>
              </div>

              {/* Retry path — opt-in, muted dashed */}
              <div className="mt-6 border-t border-line/60 pt-4">
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted/70">
                  <span className="h-px flex-1 border-t border-dashed border-muted/40" />
                  <span>failed? saved to disk. recover locally.</span>
                  <span className="h-px flex-1 border-t border-dashed border-muted/40" />
                </div>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div>
                <h3 className="font-mono text-sm text-content">
                  nothing stored server-side
                </h3>
                <p className="mt-1 text-sm text-muted">
                  The hosted API forwards audio to Groq and returns text. Your
                  key and audio are never written to disk on our side.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Key className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div>
                <h3 className="font-mono text-sm text-content">
                  bring your own key
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Set <code className="font-mono text-accent">GROQ_API_KEY</code>{" "}
                  and the agent signs every request with it. No middleman
                  billing, no surprise quotas.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Laptop className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <div>
                <h3 className="font-mono text-sm text-content">
                  recovery is local
                </h3>
                <p className="mt-1 text-sm text-muted">
                  A transcription fails, the WAV stays on your disk under{" "}
                  <code className="font-mono text-muted">
                    ~/.localflow/failed-recordings
                  </code>
                  . Retry it yourself. Nothing re-uploads unless you say so.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
