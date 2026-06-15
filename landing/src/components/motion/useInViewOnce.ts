"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fires once when an element scrolls into view. Used to trigger scroll reveals
 * and count-ups. `once: true` semantics — after firing it disconnects.
 *
 * Respects prefers-reduced-motion via the caller (this hook only reports
 * visibility; the caller decides whether to animate).
 */
export function useInViewOnce<T extends Element = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.2 },
): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (inView) return; // already fired; observer is gone

    // No IntersectionObserver support — just show it.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
          break;
        }
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return { ref, inView };
}
