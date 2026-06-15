"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Theme toggle — instant class swap via next-themes.
 * Uses CSS variables, so theme changes have zero re-render cost after the class flips.
 * The mounted guard avoids hydration mismatch (next-themes recommended pattern).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      className="grid h-9 w-9 place-items-center rounded-full border border-subtle text-muted transition-colors duration-[var(--dur-fast)] hover:bg-panel-2 hover:text-primary"
    >
      {mounted ? (
        isDark ? (
          // Sun
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
            </g>
          </svg>
        ) : (
          // Moon
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
              fill="currentColor"
            />
          </svg>
        )
      ) : (
        <span className="block h-4 w-4" />
      )}
    </button>
  );
}
