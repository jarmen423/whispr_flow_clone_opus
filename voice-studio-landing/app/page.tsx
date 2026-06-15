import { SiteHeader } from "@/components/nav/site-header";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero/hero";
import { FeelsLikeStory } from "@/components/feels-like/feels-like-story";
import { ModesAsMoods } from "@/components/modes/modes-as-moods";
import { HotkeyCheatsheet } from "@/components/hotkeys/hotkey-cheatsheet";
import { SpeedFelt } from "@/components/speed/speed-felt";
import { PrivacyLocalFirst } from "@/components/privacy/privacy-local-first";
import { Testimonials } from "@/components/quotes/testimonials";
import { InstallSection } from "@/components/install/install-section";
import { ClosingCTA } from "@/components/hero/closing-cta";

/**
 * Page composition — Server Component.
 * Section order follows the plan: hero → feels-like → modes → hotkeys →
 * speed → privacy → testimonials → install → closing CTA → footer.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <FeelsLikeStory />
        <ModesAsMoods />
        <HotkeyCheatsheet />
        <SpeedFelt />
        <PrivacyLocalFirst />
        <Testimonials />
        <InstallSection />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
