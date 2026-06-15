import { Section } from "@/components/primitives/section";
import { Eyebrow } from "@/components/primitives/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { FEELS_LIKE_STEPS } from "@/lib/content";

/**
 * "What it feels like" — 3-step horizontal scroll-snap story.
 * Native CSS scroll-snap (no JS scroll listeners, no scroll-jacking).
 * On narrow screens it becomes a swipeable carousel; on wide screens
 * the three steps sit side by side and snapping is a no-op.
 */
export function FeelsLikeStory() {
  return (
    <Section id="feels-like" cvAuto>
      <Reveal className="mx-auto mb-10 max-w-2xl text-center">
        <Eyebrow>How it feels</Eyebrow>
        <h2
          className="mt-3 font-[family-name:var(--font-display)] font-medium tracking-tight"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
        >
          Three steps. Then you forget it&apos;s there.
        </h2>
      </Reveal>

      {/* Snap container — horizontal on mobile, grid on desktop */}
      <div className="snap-x-story flex snap-x gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
        {FEELS_LIKE_STEPS.map((step, i) => (
          <Reveal
            key={step.n}
            delay={i * 120}
            className="flex min-w-[85%] flex-col items-start gap-4 rounded-[var(--radius-lg)] border border-subtle bg-panel p-7 shadow-soft md:min-w-0"
          >
            {/* Step illustration — simple inline SVG per step */}
            <StepIllustration index={i} />

            <span className="font-mono text-xs text-faint">Step {step.n}</span>
            <h3 className="font-[family-name:var(--font-display)] text-2xl font-medium">
              {step.title}
            </h3>
            <p className="text-base leading-relaxed text-muted">{step.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/** Lightweight inline SVG per step — keeps it illustration-feel without image weight. */
function StepIllustration({ index }: { index: number }) {
  const common = "h-12 w-12";
  if (index === 0) {
    // Hold the key — a key cap
    return (
      <div
        className={`${common} grid place-items-center rounded-[10px] border border-subtle bg-panel-2 font-mono text-sm font-semibold`}
      >
        ⌥L
      </div>
    );
  }
  if (index === 1) {
    // Talk naturally — waveform
    return (
      <svg className={common} viewBox="0 0 48 48" fill="none" aria-hidden>
        <g
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.85"
        >
          <path d="M8 24v0M16 18v12M24 10v28M32 16v16M40 22v4" />
        </g>
      </svg>
    );
  }
  // It appears — a cursor / paste caret
  return (
    <svg className={common} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect
        x="14"
        y="8"
        width="20"
        height="32"
        rx="3"
        stroke="var(--accent)"
        strokeWidth="2.5"
        opacity="0.4"
      />
      <path
        d="M22 16v16M26 16v16"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
