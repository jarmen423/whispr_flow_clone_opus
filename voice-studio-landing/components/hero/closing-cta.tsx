import { Container } from "@/components/primitives/container";
import { Reveal } from "@/components/motion/reveal";
import { DownloadButton } from "@/components/nav/download-button";
import { VoiceOrb } from "./voice-orb";

/**
 * Closing CTA — full-bleed warm section, the orb now still,
 * one line + download. Mirrors the hero for a satisfying bookend.
 */
export function ClosingCTA() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <Container size="narrow" className="relative text-center">
        <div className="mx-auto mb-8 w-fit">
          {/* Static orb (no speaking) */}
          <VoiceOrb />
        </div>
        <Reveal>
          <h2
            className="font-[family-name:var(--font-display)] font-medium leading-[1.1] tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 6vw, 4rem)" }}
          >
            Hold a key.
            <br />
            <span className="italic text-accent">Start talking.</span>
          </h2>
        </Reveal>
        <Reveal delay={120} className="mt-8 flex justify-center">
          <DownloadButton size="lg" />
        </Reveal>
      </Container>
    </section>
  );
}
