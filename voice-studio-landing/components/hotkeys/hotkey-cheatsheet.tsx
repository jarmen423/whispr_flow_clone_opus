"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Section } from "@/components/primitives/section";
import { Eyebrow } from "@/components/primitives/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { MODES } from "@/lib/content";

/**
 * Hotkey cheat-sheet — the credibility anchor (stolen from Concept 1).
 *
 * Two-column layout:
 *   LEFT  — stylized keyboard; the Alt key + L/M/T/A/J/N keys are interactive.
 *           Hover/focus/click a key → it becomes "active" and the right demo updates.
 *   RIGHT — shared-element demo panel that swaps to the active mode.
 *
 * Fully keyboard navigable: keys are <button>s with focus rings.
 * Mobile: the keyboard visual is hidden; the mode list (below) takes over,
 *   each item is a tappable row that updates the same demo panel.
 *
 * Shared-element: the demo panel uses a stable layoutId so Framer Motion
 * morphs the content swap on transform/opacity only.
 */
export function HotkeyCheatsheet() {
  const [activeId, setActiveId] = useState<string>(MODES[0].id);
  const active = MODES.find((m) => m.id === activeId) ?? MODES[0];

  return (
    <Section id="hotkeys" className="bg-panel-2" cvAuto>
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>The whole map</Eyebrow>
        <h2
          className="mt-3 font-[family-name:var(--font-display)] font-medium tracking-tight"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)" }}
        >
          Memorize six keys. That&apos;s the product.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Hover a key to see what it does. Every chord works with left Alt,
          right Alt, and AltGr.
        </p>
      </Reveal>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Keyboard (desktop) */}
        <Reveal className="hidden md:block">
          <Keyboard activeId={activeId} onSelect={setActiveId} />
        </Reveal>

        {/* Mobile list */}
        <Reveal className="md:hidden">
          <ul className="space-y-2">
            {MODES.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(m.id)}
                  aria-pressed={m.id === activeId}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors duration-[var(--dur-fast)] ${
                    m.id === activeId
                      ? "border-strong bg-panel"
                      : "border-subtle bg-panel/60"
                  }`}
                >
                  <span
                    className="rounded-md border border-subtle bg-panel-2 px-2 py-1 font-mono text-sm font-semibold"
                    style={{ color: m.accent }}
                  >
                    {m.chord}
                  </span>
                  <span className="text-sm font-medium">{m.job}</span>
                </button>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Shared-element demo panel */}
        <Reveal delay={100}>
          <div className="min-h-[20rem] rounded-[var(--radius-lg)] border border-subtle bg-panel p-6 shadow-soft md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="rounded-[10px] border border-subtle bg-panel-2 px-3 py-1.5 font-mono text-base font-semibold"
                    style={{ color: active.accent }}
                  >
                    {active.chord}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-wider text-faint">
                    {active.label}
                  </span>
                </div>

                <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-medium">
                  {active.job}
                </h3>

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-faint">
                      You said
                    </div>
                    <p className="text-sm italic leading-relaxed text-faint">
                      &ldquo;{active.before}&rdquo;
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-faint">
                      It pasted
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-primary">
                      {active.after}
                    </p>
                  </div>
                </div>

                <p className="mt-5 font-mono text-xs text-accent">{active.tag}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/**
 * Stylized keyboard — Alt + six letter keys.
 * Keys are real buttons (keyboard accessible). Active key glows with its accent.
 */
function Keyboard({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-subtle bg-panel p-6 shadow-soft">
      <div className="flex items-center justify-center gap-2">
        {/* Alt key */}
        <div className="grid h-16 w-20 place-items-center rounded-[10px] border border-strong bg-panel-2 font-mono text-xs font-semibold text-muted">
          Alt
        </div>
        <span className="font-mono text-faint">+</span>

        {/* Letter keys */}
        <div className="grid grid-cols-6 gap-2">
          {MODES.map((m) => {
            const isActive = m.id === activeId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                onMouseEnter={() => onSelect(m.id)}
                onFocus={() => onSelect(m.id)}
                aria-label={`${m.chord} — ${m.job}`}
                aria-pressed={isActive}
                className="grid h-16 w-12 place-items-center rounded-[10px] border font-mono text-lg font-semibold transition-[transform,box-shadow,background-color,border-color] duration-[var(--dur-fast)] hover:-translate-y-0.5"
                style={{
                  borderColor: isActive ? m.accent : "var(--border-subtle)",
                  backgroundColor: isActive
                    ? `${m.accent}1a`
                    : "var(--bg-panel-2)",
                  color: isActive ? m.accent : "var(--text-muted)",
                  boxShadow: isActive
                    ? `0 0 0 3px ${m.accent}26, 0 4px 12px ${m.accent}26`
                    : "none",
                }}
              >
                {m.key}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-center font-mono text-[11px] text-faint">
        L · M · T · A · J · N — all reserved. Don&apos;t reassign without the
        map.
      </p>
    </div>
  );
}
