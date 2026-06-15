import { Section } from "@/components/primitives/section";
import { Eyebrow } from "@/components/primitives/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { EARLY_TESTERS } from "@/lib/content";

/**
 * From early testers — placeholder copy until real testimonials arrive.
 * Framed honestly ("early tester") so we never fabricate names.
 */
export function Testimonials() {
  return (
    <Section id="testimonials" cvAuto>
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>From early testers</Eyebrow>
        <h2
          className="mt-3 font-[family-name:var(--font-display)] font-medium tracking-tight"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
        >
          People stop noticing it. That&apos;s the point.
        </h2>
      </Reveal>

      <div className="grid gap-5 md:grid-cols-3">
        {EARLY_TESTERS.map((t, i) => (
          <Reveal
            key={i}
            delay={i * 120}
            className="flex h-full flex-col rounded-[var(--radius-lg)] border border-subtle bg-panel p-6 shadow-soft"
          >
            <svg
              className="mb-4 h-8 w-8 text-accent/40"
              viewBox="0 0 32 32"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 8c-4 1-7 4-7 9v7h8v-8H9c0-3 1.5-5 4-6V8zm14 0c-4 1-7 4-7 9v7h8v-8h-4c0-3 1.5-5 4-6V8z" />
            </svg>
            <blockquote className="flex-1 text-base leading-relaxed text-primary">
              {t.quote}
            </blockquote>
            <footer className="mt-5 border-t border-subtle pt-4">
              <div className="font-medium">{t.name}</div>
              <div className="font-mono text-xs text-faint">{t.role}</div>
            </footer>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
