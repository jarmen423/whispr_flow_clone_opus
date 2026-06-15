import type { Config } from "tailwindcss";

/**
 * LocalFlow landing — Terminal Velocity palette.
 *
 * Semantic tokens only. No raw hex in components — all colors resolve through
 * CSS variables defined in src/app/globals.css. Components consume the
 * `canvas | panel | content | muted | line | accent` family.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas))",
        panel: "hsl(var(--panel))",
        content: "hsl(var(--content))",
        muted: "hsl(var(--muted))",
        line: "hsl(var(--line))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 hsl(var(--line)), 0 8px 24px -12px hsl(0 0% 0% / 0.6)",
        key: "0 0 0 1px hsl(var(--accent) / 0.5), 0 0 12px -2px hsl(var(--accent) / 0.35)",
      },
      keyframes: {
        "caret-blink": {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "scanline-drift": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 4px" },
        },
        "bar-grow": {
          "0%": { transform: "scaleY(0)" },
          "100%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "caret-blink": "caret-blink 1.05s step-end infinite",
        "scanline-drift": "scanline-drift 0.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
