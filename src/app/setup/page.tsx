"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mic,
  Download,
  Key,
  Terminal,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function ConfigGenerator() {
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  const config = JSON.stringify({ api_key: apiKey.trim() }, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Your Groq API Key</label>
        <Input
          type="password"
          placeholder="gsk_..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Paste your key to generate the config file content.{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            Get a key
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      {apiKey.trim() && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Config file content</span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-foreground/90">{config}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            Save this as <code className="bg-muted px-1 py-0.5 rounded">~/.localflow/config.json</code> on
            macOS/Linux or{" "}
            <code className="bg-muted px-1 py-0.5 rounded">%USERPROFILE%\.localflow\config.json</code> on
            Windows.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  const [platform, setPlatform] = useState<"windows" | "mac" | "linux">("windows");

  useEffect(() => {
    const p = navigator.platform.toLowerCase();
    if (p.includes("win")) setPlatform("windows");
    else if (p.includes("mac")) setPlatform("mac");
    else setPlatform("linux");
  }, []);

  const installCommand =
    platform === "windows"
      ? 'irm https://dictate.agentmemorylabs.com/api/download?platform=windows | iex'
      : 'curl -fsSL https://dictate.agentmemorylabs.com/api/download?platform=linux | bash';

  const steps = [
    {
      number: "01",
      icon: Download,
      title: "Install the Agent",
      description:
        "LocalFlow runs as a lightweight desktop agent that listens for global hotkeys. Install it with a single command.",
      content: (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["windows", "mac", "linux"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  platform === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="relative bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <code className="text-foreground/90">{installCommand}</code>
            <div className="absolute top-2 right-2">
              <CopyButton text={installCommand} label="Copy" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Or download the script manually from the{" "}
            <Link href="/download" className="text-primary hover:underline">
              download page
            </Link>
            .
          </p>
        </div>
      ),
    },
    {
      number: "02",
      icon: Key,
      title: "Get Your Groq API Key",
      description:
        "LocalFlow uses Groq for fast, high-quality transcription. Sign up for a free Groq account and grab your API key.",
      content: (
        <div className="space-y-3">
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Open Groq Console
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Create a free account at console.groq.com</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Navigate to API Keys and create a new key</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Copy the key — you&apos;ll paste it on first run</span>
            </li>
          </ul>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Why BYOK?</strong> Groq charges ~$0.11/hour of audio. We can&apos;t afford to host
              transcription for all users, so you bring your own key. Your key is never stored on our
              servers — it travels with each request and is used only to call Groq on your behalf.
            </p>
          </div>
        </div>
      ),
    },
    {
      number: "03",
      icon: Terminal,
      title: "Run & Configure",
      description:
        "Start the agent. On first run, it will prompt you for your Groq API key and save it to ~/.localflow/config.json.",
      content: (
        <div className="space-y-3">
          <div className="relative bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <code className="text-foreground/90">localflow-agent</code>
            <div className="absolute top-2 right-2">
              <CopyButton text="localflow-agent" label="Copy" />
            </div>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>The agent starts and listens for your hotkey (default: Alt+L)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>On first run, paste your Groq API key when prompted</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Hold Alt+L to record, release to transcribe and paste</span>
            </li>
          </ul>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80 mb-1">Alternative: Environment Variable</p>
            <p>
              You can also set{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">GROQ_API_KEY</code> as an
              environment variable instead of using the interactive prompt.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xl font-bold gradient-text">LocalFlow</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 pb-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Get Started with{" "}
              <span className="gradient-text">LocalFlow</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to voice-powered productivity. No local servers required — just the
              agent and your Groq API key.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              custom={i}
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
            >
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-mono text-primary/70">{step.number}</span>
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                      </div>
                      <CardDescription>{step.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pl-[72px]">{step.content}</CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quick Config Generator */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  Quick Config Generator
                </CardTitle>
                <CardDescription>
                  Already have your Groq API key? Generate your config file here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfigGenerator />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Hotkey reference */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Hotkey Reference</CardTitle>
                <CardDescription>All the shortcuts you need at your fingertips</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "Alt + L", desc: "Raw dictation — transcription only" },
                    { key: "Alt + M", desc: "Outline/format dictation — structured output" },
                    { key: "Alt + T", desc: "Toggle translation mode" },
                    { key: "Alt + A", desc: "Voice agent — ask a question" },
                    { key: "Alt + J", desc: "Format selected text" },
                    { key: "Alt + N", desc: "Cleanup selected text" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <kbd className="px-2 py-1 rounded bg-background border border-border text-xs font-mono font-medium shrink-0">
                        {item.key}
                      </kbd>
                      <span className="text-sm text-muted-foreground">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <p className="text-muted-foreground mb-4">
              Ready to dictate anywhere? Install the agent and start talking.
            </p>
            <Link href="/download">
              <Button size="lg" className="gap-2">
                <Download className="h-4 w-4" />
                Download Agent
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
