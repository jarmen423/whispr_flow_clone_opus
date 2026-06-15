"use client";

import { useEffect, useRef, useState, type ReactNode, type ElementType } from "react";

/**
 * Reveal — fades/slides children in on scroll-into-view.
 *
 * Honors prefers-reduced-motion: the CSS `.reveal` class is a no-op
 * (fully visible) under reduced motion, so this component just renders
 * children plainly without triggering any transition.
 *
 * Uses IntersectionObserver (no scroll listeners). Adds `.is-visible` once,
 * then disconnects — single transition per element.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // SSR/old-browser fallback: show immediately.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ ["--reveal-delay" as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
