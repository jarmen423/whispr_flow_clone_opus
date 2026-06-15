import { Section } from "@/components/primitives/section";
import { Eyebrow } from "@/components/primitives/eyebrow";
import { Reveal } from "@/components/motion/reveal";

/**
 * Yours, privately — warm, not fear-mongering.
 * A small SVG diagram: mic → local agent → paste, with cloud deliberately
 * off to the side and only used on explicit retry.
 */
export function PrivacyLocalFirst() {
  return (
    <Section id="privacy" className="bg-panel-2" cvAuto>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>Yours, privately</Eyebrow>
          <h2
            className="mt-3 font-[family-name:var(--font-display)] font-medium tracking-tight"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
          >
            Your audio stays on your machine.
          </h2>
          <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted">
            <p>
              Recording happens locally. Audio goes straight to transcription
              with <em>your</em> Groq key — never stored on our servers.
            </p>
            <p>
              Bring your own key (BYOK). Nothing is retained unless{" "}
              <em>you</em> explicitly retry a failed recording, and even then
              only locally, with an expiry.
            </p>
          </div>

          <ul className="mt-6 space-y-2">
            {[
              "0 ms cloud storage",
              "Your API key, your request, never saved",
              "Failed recordings kept locally, auto-expire",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M2.5 6.5l2.5 2.5 4.5-5"
                    stroke="var(--accent)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-primary">{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Diagram */}
        <Reveal delay={120}>
          <div className="rounded-[var(--radius-lg)] border border-subtle bg-panel p-8 shadow-soft">
            <FlowDiagram />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function FlowDiagram() {
  const node =
    "rounded-[var(--radius-md)] border border-subtle bg-panel-2 px-4 py-3 text-center text-sm font-medium";
  const label =
    "font-mono text-[10px] uppercase tracking-wider text-faint";
  const arrow = "text-faint";

  return (
    <div className="flex flex-col items-stretch gap-3">
      {/* Local row */}
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
        <div>
          <div className={node}>🎙️ Mic</div>
        </div>
        <svg className={arrow} width="20" height="14" viewBox="0 0 20 14" aria-hidden>
          <path d="M2 7h14M12 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <div className={node}>Local agent</div>
          <div className={`mt-1 text-center ${label}`}>your machine</div>
        </div>
        <svg className={arrow} width="20" height="14" viewBox="0 0 20 14" aria-hidden>
          <path d="M2 7h14M12 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <div className={node}>⌨️ Paste</div>
        </div>
      </div>

      {/* Cloud — off to the side, only on retry */}
      <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-subtle bg-panel/50 p-3">
        <span className="text-lg">☁️</span>
        <div className="flex-1">
          <div className="text-sm font-medium">Cloud transcription</div>
          <div className="font-mono text-[11px] text-faint">
            only when you hold a key · your key · never stored
          </div>
        </div>
        <span className="rounded-full border border-subtle px-2 py-0.5 font-mono text-[10px] uppercase text-faint">
          on demand
        </span>
      </div>
    </div>
  );
}
