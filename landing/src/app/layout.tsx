import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "localflow — speak. paste. done.",
  description:
    "Whisper transcription at ~3,000 tok/s. Local-first. Bring your own Groq key. Hold Alt+L. Talk. Let go. It's pasted.",
  keywords: ["dictation", "whisper", "groq", "voice to text", "developer tools"],
  authors: [{ name: "Agent Memory Labs" }],
  openGraph: {
    title: "localflow — speak. paste. done.",
    description:
      "Whisper at ~3,000 tok/s. Local-first. BYOK. A voice-to-text tool that respects your keyboard.",
    type: "website",
    siteName: "localflow",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="font-sans antialiased min-h-screen bg-canvas text-content">
        {children}
      </body>
    </html>
  );
}
