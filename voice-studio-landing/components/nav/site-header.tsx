"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/primitives/container";
import { ThemeToggle } from "./theme-toggle";
import { DownloadButton } from "./download-button";

const NAV_LINKS = [
  { href: "#modes", label: "Modes" },
  { href: "#hotkeys", label: "Hotkeys" },
  { href: "#speed", label: "Speed" },
  { href: "#privacy", label: "Privacy" },
  { href: "#install", label: "Install" },
];

/**
 * Sticky header. Translucent + blurred bg only after scrolling (saves GPU when at rest).
 * Mobile collapses nav links (recognition over recall — logo + download stay visible).
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-[var(--dur-med)] ${
        scrolled
          ? "border-b border-subtle bg-[var(--bg-canvas)]/80 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <Container size="wide">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Wordmark */}
          <a
            href="#top"
            className="group flex items-baseline gap-2"
            aria-label="LocalFlow home"
          >
            <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
              LocalFlow
            </span>
            <span className="hidden font-mono text-[10px] text-faint sm:inline">
              dictate.agentmemorylabs.com
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-2 text-sm text-muted transition-colors duration-[var(--dur-fast)] hover:bg-panel-2 hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DownloadButton size="default" className="hidden sm:inline-flex" />
          </div>
        </div>
      </Container>
    </header>
  );
}
