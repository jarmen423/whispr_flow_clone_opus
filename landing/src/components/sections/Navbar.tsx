"use client";

import Link from "next/link";
import { Github, Terminal } from "lucide-react";
import { useScrolled } from "@/components/motion/useScrolled";
import { cn } from "@/lib/cn";

/**
 * Sticky navbar. Transparent over the hero, gains a blurred canvas backdrop +
 * bottom border once scrolled. Mono wordmark — no icon logo. The whole bar is
 * a client component only because of the scroll listener.
 */
export function Navbar() {
  const scrolled = useScrolled(8);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
        scrolled
          ? "border-b border-line bg-canvas/80 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-sm font-medium text-content"
        >
          <span className="text-accent">_</span>localflow
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="#keys"
            className="rounded-md px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-content"
          >
            keys
          </Link>
          <Link
            href="#modes"
            className="rounded-md px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-content"
          >
            modes
          </Link>
          <a
            href="https://github.com/jarmen423"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="rounded-md p-1.5 text-muted transition-colors hover:text-content"
          >
            <Github className="h-4 w-4" aria-hidden />
          </a>
          <Link
            href="#install"
            className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 font-mono text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Terminal className="h-3.5 w-3.5" aria-hidden />
            install
          </Link>
        </div>
      </nav>
    </header>
  );
}
