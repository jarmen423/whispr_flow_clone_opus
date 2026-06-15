"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HotkeyMode } from "@/lib/content";

/**
 * Mode card — presents a hotkey mode as a *job* (use case),
 * with a real before→after. Clicking expands a longer replay panel
 * via Framer Motion shared-element layout animation (compositor-only).
 *
 * Keyboard accessible: it's a real <button>, focus-visible handled globally.
 */
export function ModeCard({ mode }: { mode: HotkeyMode }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      layout
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className={`overflow-hidden rounded-[var(--radius-lg)] border bg-panel shadow-soft transition-colors duration-[var(--dur-med)] ${
        open ? "border-strong" : "border-subtle hover:border-strong"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`mode-detail-${mode.id}`}
        className="flex w-full items-start gap-4 p-6 text-left"
      >
        {/* Hotkey chip */}
        <span
          className="mt-0.5 shrink-0 rounded-[10px] border border-subtle bg-panel-2 px-2.5 py-1.5 font-mono text-sm font-semibold"
          style={{ color: mode.accent }}
        >
          {mode.chord}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-display)] text-xl font-medium">
            {mode.job}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-faint">{mode.label}</p>

          {/* Before → after inline preview */}
          <div className="mt-3 space-y-2">
            <p className="line-clamp-2 text-sm text-faint italic">
              &ldquo;{mode.before}&rdquo;
            </p>
            <p className="line-clamp-2 text-sm text-muted">→ {mode.after}</p>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`mt-1 shrink-0 text-faint transition-transform duration-[var(--dur-med)] ${open ? "rotate-180" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`mode-detail-${mode.id}`}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-subtle p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
                    What you said
                  </div>
                  <p className="text-sm leading-relaxed text-faint italic">
                    {mode.before}
                  </p>
                </div>
                <div>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
                    What got pasted
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-primary">
                    {mode.after}
                  </p>
                </div>
              </div>
              <p className="mt-4 font-mono text-xs text-accent">{mode.tag}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
