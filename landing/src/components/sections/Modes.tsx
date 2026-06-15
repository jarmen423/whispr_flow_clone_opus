"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { MODES, type ModeId } from "@/lib/modes";
import { SectionHeading } from "@/components/primitives/SectionHeading";
import { Keycap } from "@/components/primitives/Keycap";
import { cn } from "@/lib/cn";

function ModeCard({ mode }: { mode: (typeof MODES)[number] }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-lg border bg-panel p-4 text-left transition-colors",
        open ? "border-accent/40" : "border-line hover:border-accent/30",
      )}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keycap glyph={mode.keys[1]} size="sm" lit />
          <span className="font-mono text-sm text-content">{mode.name}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted transition-transform",
            open && "rotate-180 text-accent",
          )}
          aria-hidden
        />
      </div>

      <p className="text-xs text-muted">{mode.blurb}</p>

      {/* Before → after mini terminal */}
      <div className="rounded-md border border-line bg-canvas/60 p-2.5 font-mono text-[11px] leading-relaxed">
        <div className="text-muted">
          <span className="text-muted/50">in </span>
          {mode.before}
        </div>
        <div className="mt-1 text-content">
          <span className="text-accent">out</span>{" "}
          <span className="text-accent">→</span>{" "}
          <span className="whitespace-pre-line">{mode.after}</span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="long"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-md border border-line bg-canvas/60 p-2.5 font-mono text-[11px] leading-relaxed">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted/50">
                longer replay
              </div>
              <div className="text-muted">
                <span className="text-muted/50">in </span>
                {mode.beforeLong}
              </div>
              <div className="mt-1 whitespace-pre-line text-content">
                <span className="text-accent">out</span>{" "}
                <span className="text-accent">→</span> {mode.afterLong}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto flex items-center gap-1.5 pt-1 font-mono text-[10px] text-muted">
        <span className="rounded border border-line px-1.5 py-0.5">
          {mode.keys.join("+")}
        </span>
        <span>·</span>
        <span>{mode.trigger}</span>
      </div>
    </motion.button>
  );
}

/**
 * The modes, as cards. Each shows a 2-line before→after and expands into a
 * longer replay on click. All six hotkey modes get a card (the keyboard above
 * is the quick reference; this is the detail view).
 */
export function Modes() {
  return (
    <section id="modes" className="cv-auto border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading kicker="the modes.">
          Six hotkeys. Six jobs. Same hold-and-release gesture, different
          outcomes. Tap a card for the longer replay.
        </SectionHeading>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((mode) => (
            <ModeCard key={mode.id} mode={mode} />
          ))}
        </div>
      </div>
    </section>
  );
}
