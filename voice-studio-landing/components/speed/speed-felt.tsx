import { Section } from "@/components/primitives/section";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";

/**
 * Speed, felt — not a chart dump. One big honest line + one metric.
 * CountUp animates the metric on scroll-into-view (once; reduced-motion = final).
 */
export function SpeedFelt() {
  return (
    <Section id="speed" cvAuto>
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <h2
            className="font-[family-name:var(--font-display)] font-medium leading-[1.1] tracking-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
          >
            Faster than you can
            <br />
            <span className="italic text-accent">re-read the sentence.</span>
          </h2>
        </Reveal>

        <Reveal delay={120} className="mt-10">
          <div className="inline-flex flex-col items-center">
            <div
              className="font-[family-name:var(--font-display)] font-semibold tabular-nums"
              style={{ fontSize: "clamp(3.5rem, 10vw, 6rem)" }}
            >
              <CountUp to={0.4} decimals={1} suffix="s" />
            </div>
            <p className="mt-2 font-mono text-sm text-muted">
              first text, typical utterance
            </p>
          </div>
        </Reveal>

        <Reveal delay={220} className="mt-8">
          <p className="mx-auto max-w-xl text-base leading-relaxed text-muted">
            Groq Whisper transcribes at roughly 3,000 tokens per second on your
            key. Cerebras formats in the same breath. By the time you&apos;ve
            finished exhaling, the text is where your cursor was.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
