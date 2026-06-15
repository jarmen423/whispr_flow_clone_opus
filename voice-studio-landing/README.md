# Voice Studio — Landing Page Concept

A standalone Next.js landing-page concept for `dictate.agentmemorylabs.com` (LocalFlow).

This is **Concept 2 ("Voice Studio")** from a design exploration — warm, calm,
editorial; built for writers, PMs, and knowledge workers. It lives in its own
directory and does **not** import or modify the existing app. The stack was
chosen fresh from `frontend-design-skill-router` guidance, not inherited.

## What's in here

- **Hero** with a pure-CSS/SVG breathing **voice orb** (no WebGL, no canvas)
  coupled to a self-typing **streaming demo** that simulates the dictation flow.
- **"What it feels like"** — 3-step horizontal scroll-snap story (native CSS).
- **Modes as moods** — six use-case cards with click-to-expand before→after.
- **Hotkey cheat-sheet** — interactive keyboard (Alt + L/M/T/A/J/N) with a
  shared-element demo panel. Fully keyboard-navigable. Mobile shows a list.
- **Speed** — one honest metric, count-up on scroll.
- **Privacy / local-first** — warm copy + flow diagram (cloud is off to the side).
- **Install** — OS-auto-detected tabs, copyable `uv tool install` command,
  optimistic "Copied ✓" feedback.
- **Closing CTA** + minimal footer.

## Stack

| | |
|---|---|
| **Framework** | Next.js 15 (App Router, React 19) |
| **Styles** | Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`) |
| **Theming** | `next-themes` + blocking `<head>` FOUC script; light-first with a derived warm dark mode |
| **Motion** | Framer Motion (compositor-only: `transform`/`opacity`); CSS keyframes for the orb |
| **Fonts** | Fraunces (display serif) + Geist Sans + Geist Mono via `next/font` |

All motion is on compositor-friendly properties. `prefers-reduced-motion` is
honored everywhere: the orb freezes to a static poster, reveals become instant
fades, the streaming demo shows its final state.

## Develop

```bash
cd voice-studio-landing
npm run dev      # http://localhost:3000
```

> **Note on the nested repo:** this directory sits inside a parent that also has
> a `package.json`. If `npm install` ever reports deps as "up to date" while
> Tailwind is missing, it's npm hoisting against the parent's `node_modules`.
> Fix: `yarn add --dev tailwindcss @tailwindcss/postcss postcss` (yarn installs
> them into *this* `node_modules`). The production build already passes.

## Build

```bash
npm run build && npm start
```

Output: fully static prerender, ~148 kB First Load JS for the whole page.

## Structure

```
app/                    layout, page, globals.css (tokens)
components/
  nav/                  header, theme toggle, OS-aware download button
  hero/                 hero, voice orb, streaming demo, closing CTA
  feels-like/           scroll-snap story
  modes/                use-case cards
  hotkeys/              interactive keyboard + demo panel
  speed/ privacy/       supporting sections
  quotes/ install/      testimonials + install
  primitives/           Container, Section, Eyebrow, Button
  motion/               Reveal (IO fade/stagger), CountUp
lib/                    content.ts (all copy), os-detect.ts
```

## Notes

- The voice orb is **decorative only** (`aria-hidden`); state is always
  conveyed by text (the demo's phase label, the "✓ pasted" tag).
- Hotkey keys are real `<button>`s with focus rings; mobile gets a tappable list.
- Section copy lives in `lib/content.ts` so the page composition stays structural.
