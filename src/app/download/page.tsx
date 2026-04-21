"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, Copy, Check, Terminal, Monitor, Apple, TerminalSquare, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "windows" | "macos" | "linux";

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: React.ElementType; color: string; command: string }> = {
  windows: {
    label: "Windows",
    icon: Monitor,
    color: "text-blue-400",
    command: "irm https://dictate.agentmemorylabs.com/api/download?platform=windows | iex",
  },
  macos: {
    label: "macOS",
    icon: Apple,
    color: "text-gray-300",
    command: "curl -fsSL https://dictate.agentmemorylabs.com/api/download?platform=macos | bash",
  },
  linux: {
    label: "Linux",
    icon: TerminalSquare,
    color: "text-yellow-400",
    command: "curl -fsSL https://dictate.agentmemorylabs.com/api/download?platform=linux | bash",
  },
};

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}

export default function DownloadPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("windows");
  const [copied, setCopied] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<{ name: string | null; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.user);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, [router]);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const config = PLATFORM_CONFIG[platform];
  const Icon = config.icon;

  const copyCommand = () => {
    navigator.clipboard.writeText(config.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 px-4 sm:px-6 lg:px-8 py-4">
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold gradient-text">LocalFlow</span>
        </Link>
      </div>

      <motion.div
        className="w-full max-w-lg text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <div className={`inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4`}>
            <Icon className={`h-8 w-8 ${config.color}`} />
          </div>
          <h1 className="text-3xl font-bold mb-2">Install LocalFlow</h1>
          <p className="text-muted-foreground">
            One command to install on {config.label}. Copy, paste, run.
          </p>
        </div>

        {/* Anonymous user nudge */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 text-left"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Want cloud-synced history & settings?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create a free account to unlock the web dashboard and sync across devices.{" "}
                  <Link href="/signup?redirect=/download" className="text-primary hover:underline font-medium">
                    Sign up free →
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Platform tabs */}
        <div className="flex justify-center gap-2 mb-6">
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => {
            const PIcon = PLATFORM_CONFIG[p].icon;
            return (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  platform === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <PIcon className="h-4 w-4" />
                {PLATFORM_CONFIG[p].label}
              </button>
            );
          })}
        </div>

        {/* Command box */}
        <div className="relative mb-6">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted border border-border text-left font-mono text-sm">
            <Terminal className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <code className="break-all">{config.command}</code>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 gap-1.5"
            onClick={copyCommand}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* Steps */}
        <div className="text-left space-y-3 mb-8">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shrink-0">1</span>
            <p className="text-sm text-muted-foreground">
              {platform === "windows"
                ? "Open PowerShell (press Win + X, then select 'Terminal' or 'PowerShell')"
                : "Open Terminal (press Cmd + Space, type 'Terminal', hit Enter)"}
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shrink-0">2</span>
            <p className="text-sm text-muted-foreground">
              Paste the command above and press Enter
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shrink-0">3</span>
            <p className="text-sm text-muted-foreground">
              The installer will set everything up automatically. Hold Alt+L to start dictating.
            </p>
          </div>
        </div>

        {/* Script download fallback */}
        <p className="text-xs text-muted-foreground mb-8">
          Prefer a file?{" "}
          <a
            href={`/api/download?platform=${platform}`}
            className="text-primary hover:underline"
          >
            Download the install script
          </a>{" "}
          instead.
        </p>

        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
