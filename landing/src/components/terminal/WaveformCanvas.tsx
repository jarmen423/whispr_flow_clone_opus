"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface WaveformCanvasProps {
  /** Number of bars. ~30 keeps draw calls trivial. */
  bars?: number;
  /** Pause the animation loop (e.g. on hover). */
  paused?: boolean;
  className?: string;
}

/**
 * Canvas 2D audio-waveform simulation. Performance contract:
 *
 *   - Single canvas, fixed internal resolution, DPR capped at 1.5.
 *   - One reused Float32Array per frame — zero per-frame allocation.
 *   - rAF runs only while `paused === false` AND the canvas is in view
 *     (IntersectionObserver). Pauses on hover and when scrolled away.
 *   - Bars share one fillStyle (accent) + a single alpha gradient. No shadows,
 *     no blur, no per-bar style objects.
 *   - Cancels rAF and disconnects the observer on unmount.
 *
 * This is the only continuously-animating surface on the page.
 */
export function WaveformCanvas({
  bars = 30,
  paused = false,
  className,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Fixed internal size; CSS scales the element. Keeps draw cost predictable.
    const W = 280;
    const H = 40;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Reused buffers — never reallocate inside the loop.
    const heights = new Float32Array(bars);
    const gap = 3;
    const barWidth = (W - gap * (bars - 1)) / bars;
    const mid = H / 2;

    // Resume painting only while visible. Saves cycles off-screen.
    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    let raf = 0;
    let t = 0;

    const draw = () => {
      t += 0.08;
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < bars; i++) {
        // Cheap waveform: sine envelope + slow noise. Reads like speech.
        const phase = i / bars;
        const envelope = Math.sin(phase * Math.PI); // taper at edges
        const wave =
          0.45 +
          0.35 * Math.sin(t + i * 0.6) +
          0.2 * Math.sin(t * 1.7 + i * 0.23);
        heights[i] = Math.max(0.08, envelope * wave);

        const h = heights[i] * (H - 2);
        const x = i * (barWidth + gap);
        const y = mid - h / 2;

        // Single accent fill; leading edge slightly brighter via alpha.
        ctx.fillStyle = "hsl(156 61% 52% / 0.85)";
        ctx.fillRect(x, y, barWidth, h);
      }

      raf = requestAnimationFrame(draw);
    };

    const loop = () => {
      cancelAnimationFrame(raf);
      if (!pausedRef.current && visible) {
        raf = requestAnimationFrame(loop);
        draw();
      } else {
        // Still draw one static frame so the paused state isn't blank.
        draw();
      }
    };

    loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [bars]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Audio waveform animation"
      className={cn("h-full w-full", className)}
    />
  );
}
