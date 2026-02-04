/**
 * @fileoverview LocalFlow Root Layout - Next.js Application Layout Component
 *
 * This module provides the root layout for the LocalFlow Next.js application,
 * configuring global styles, fonts, metadata, and UI providers that wrap all
 * pages in the application.
 *
 * Purpose & Reasoning:
 *   The root layout is the top-level React component that wraps every page in
 *   the application. It was created to centralize global configuration including:
 *   - Font loading (Inter) with CSS variable support for consistent typography
 *   - Dark mode theming via CSS class application
 *   - Toast notification provider (sonner) for user feedback
 *   - Metadata configuration for SEO and browser presentation
 *
 *   Using a layout component ensures consistent UI chrome across all routes
 *   without duplicating code in individual pages.
 *
 * Dependencies:
 *   External Packages:
 *     - next/font/google: Next.js font optimization with Google Fonts
 *     - sonner: Toast notification library for React
 *     - React: Core UI library
 *
 *   CSS:
 *     - globals.css: Global styles and CSS variables for theming
 *
 * Role in Codebase:
 *   This layout is used by Next.js for all routes in the app directory.
 *   It is the entry point for client-side UI rendering and provides the
 *   foundation that all page components build upon.
 *
 * Key Technologies/APIs:
 *   - next/font/google.Inter: Optimized Google Font loading with next/font
 *   - next/metadata.Metadata: SEO metadata configuration (title, description, keywords)
 *   - sonner.Toaster: Toast notification container with theming support
 *   - React.ReactNode: Type for children prop accepting any valid React child
 *
 * @module app/layout
 * @author LocalFlow Development Team
 * @version 1.0.0
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

/**
 * Inter font configuration with CSS variable support.
 *
 * Loads the Inter font from Google Fonts via next/font for automatic
 * optimization, subsetting, and CSS variable generation. The font is
 * configured with the "latin" subset and exposes a CSS variable
 * (--font-inter) for use in Tailwind CSS configuration.
 *
 * Key Technologies/APIs:
 *   - next/font/google: Automatic font optimization and loading
 *   - CSS variables: --font-inter for Tailwind font-sans utility
 *
 * @example
 * // In Tailwind config or CSS
 * font-family: var(--font-inter), sans-serif;
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/**
 * Application metadata for SEO and browser presentation.
 *
 * Defines the page title, description, and keywords that appear in
 * search engine results and browser tabs. Also used by social media
 * platforms when sharing links.
 *
 * Key Technologies/APIs:
 *   - next/metadata.Metadata: Next.js metadata API for SEO
 *
 * @example
 * // Results in:
 * // <title>LocalFlow - Smart Dictation System</title>
 * // <meta name="description" content="...">
 */
export const metadata: Metadata = {
  title: "LocalFlow - Smart Dictation System",
  description: "Hybrid cloud/local dictation system with intelligent text refinement",
  keywords: ["dictation", "speech-to-text", "voice", "transcription", "AI"],
};

/**
 * Root Layout Component - Wraps all pages in the application.
 *
 * This is the root layout component that Next.js uses for all routes.
 * It provides the HTML document structure, applies global styles and
 * fonts, and includes the toast notification provider.
 *
 * Purpose & Reasoning:
 *   The layout component ensures all pages share common UI elements
 *   and configurations without duplication. It applies dark mode theming
 *   via the "dark" class and sets up the Inter font family.
 *
 * Key Technologies/APIs:
 *   - React.FC: Functional component with children prop
 *   - HTML lang attribute: Accessibility for screen readers
 *   - Tailwind CSS classes: dark mode, font-sans, antialiased
 *   - sonner.Toaster: Toast notification container with position theming
 *
 * @param props - Component props
 * @param props.children - Child React elements (page content)
 * @returns JSX.Element - The rendered layout with children
 *
 * @example
 * // This layout wraps the output of each page.tsx
 * <RootLayout>
 *   <LocalFlowPage />
 * </RootLayout>
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
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
