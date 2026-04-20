import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LocalFlow — Free AI Dictation for Everyone",
  description:
    "Speak naturally. Get perfectly formatted text instantly. LocalFlow is a free AI-powered dictation tool with global hotkeys, translation, and smart formatting.",
  keywords: [
    "dictation",
    "speech-to-text",
    "voice typing",
    "AI dictation",
    "free dictation tool",
    "voice transcription",
    "productivity",
  ],
  openGraph: {
    title: "LocalFlow — Free AI Dictation for Everyone",
    description:
      "Speak naturally. Get perfectly formatted text instantly. Free AI-powered dictation with global hotkeys.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
            },
          }}
        />
      </body>
    </html>
  );
}
