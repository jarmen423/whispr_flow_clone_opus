import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LocalFlow — Speak it. Then keep going.",
  description:
    "LocalFlow turns your voice into clean, formatted text — anywhere you type. Hold a key, talk, let go. It's pasted. Local-first, BYOK, ~3,000 tok/s.",
  keywords: [
    "voice dictation",
    "speech to text",
    "voice typing",
    "AI dictation",
    "LocalFlow",
  ],
  authors: [{ name: "Agent Memory Labs" }],
  openGraph: {
    title: "LocalFlow — Speak it. Then keep going.",
    description:
      "Voice to text, anywhere you type. Hold a key, talk, let go. Local-first and fast.",
    type: "website",
    url: "https://dictate.agentmemorylabs.com",
    siteName: "LocalFlow",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#14110e" },
  ],
  width: "device-width",
  initialScale: 1,
};

/*
 * Blocking FOUC script — runs synchronously before paint.
 * Reads intent ("light" | "dark" | "system"), applies class to <html>.
 * next-themes uses this pattern; we replicate it inline to guarantee no flash.
 */
const themeInitScript = `(() => {
  try {
    const stored = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || ((!stored || stored === 'system') && systemDark);
    document.documentElement.classList.toggle('dark', isDark);
  } catch {}
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
