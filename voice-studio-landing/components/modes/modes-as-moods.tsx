import { Section } from "@/components/primitives/section";
import { Eyebrow } from "@/components/primitives/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { ModeCard } from "./mode-card";
import { MODES } from "@/lib/content";

/**
 * Modes as moods — present hotkey modes as *jobs* (use cases), not feature flags.
 * Each card expands to a fuller before→after replay.
 */
export function ModesAsMoods() {
  return (
    <Section id="modes" cvAuto>
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>Modes</Eyebrow>
        <h2
          className="mt-3 font-[family-name:var(--font-display)] font-medium tracking-tight"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
        >
          Six jobs. Six keys. No app to open.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Each one lives behind a single chord. Tap a card to see what goes in
          and what comes out.
        </p>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-2">
        {MODES.map((mode, i) => (
          <Reveal key={mode.id} delay={(i % 2) * 100}>
            <ModeCard mode={mode} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
