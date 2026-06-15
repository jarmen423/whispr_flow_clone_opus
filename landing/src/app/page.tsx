import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { HotkeyKeyboard } from "@/components/sections/HotkeyKeyboard";
import { Modes } from "@/components/sections/Modes";
import { Speed } from "@/components/sections/Speed";
import { Privacy } from "@/components/sections/Privacy";
import { Install } from "@/components/sections/Install";
import { Footer } from "@/components/sections/Footer";

/**
 * LocalFlow landing — Terminal Velocity.
 *
 * Server component composing the sections. Client interactivity (terminal demo,
 * keyboard swap, tabs, copy buttons) is isolated to the leaves; this shell
 * stays server-rendered so the LCP text ships in the initial HTML.
 */
export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HotkeyKeyboard />
        <Modes />
        <Speed />
        <Privacy />
        <Install />
      </main>
      <Footer />
    </>
  );
}
