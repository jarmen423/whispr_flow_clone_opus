"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Download,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer } from "@/lib/animations";

function FreeVsAccount() {
  const freeFeatures = [
    "Full desktop dictation agent",
    "All 7 global hotkeys (Alt+L, Alt+M, Alt+A, Alt+., etc.)",
    "AI formatting & translation",
    "Selected-text reformatting",
    "Local processing mode (offline)",
    "Unlimited usage, no throttling",
  ];

  const accountFeatures = [
    "Web dashboard with full transcript history",
    "Cloud sync across multiple devices",
    "Custom AI formatting presets",
    "Usage analytics & word count stats",
    "Priority transcription speed",
    "Export history (Markdown, PDF, TXT)",
  ];

  return (
    <section className="py-24 md:py-32 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
            Generous free tier.{" "}
            <span className="gradient-text">Upgrade when you're ready.</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg">
            Everything you need to start dictating is free. Create an account to unlock cloud features.
          </motion.p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
        >
          <motion.div
            variants={fadeInUp}
            className="p-8 rounded-2xl border border-border bg-card/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <Download className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Free — No Account</h3>
                <p className="text-xs text-muted-foreground">Install and dictate immediately</p>
              </div>
            </div>
            <ul className="space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="p-8 rounded-2xl border border-primary/20 bg-primary/5 relative"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Free Account
              </span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">With Free Account</h3>
                <p className="text-xs text-muted-foreground">Cloud features & sync</p>
              </div>
            </div>
            <ul className="space-y-3">
              {accountFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-border">
              <Link href="/signup">
                <Button className="w-full gap-2">
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Still 100% free. No credit card.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function AgentMemoryLabsBridge() {
  return (
    <section className="py-24 md:py-32 border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid lg:grid-cols-2 gap-12 items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <div>
            <motion.div variants={fadeInUp} className="mb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary">
                From the makers of LocalFlow
              </span>
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
              Building AI agents that{" "}
              <span className="gradient-text">never forget</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg mb-6 leading-relaxed">
              Agent Memory Labs gives your AI agents persistent memory, knowledge graphs, and
              long-term context — so every conversation builds on the last.
            </motion.p>
            <motion.ul variants={fadeInUp} className="space-y-3 mb-8">
              {[
                "Vector memory stores for every agent",
                "Knowledge graphs that connect concepts",
                "Long-term context across sessions",
                "Hosted infrastructure, zero setup",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </motion.ul>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
              <a href="https://agentmemorylabs.com" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="gap-2">
                  Visit Agent Memory Labs
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://github.com/jarmen423/agent-memory-hosted" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline">
                  View on GitHub
                </Button>
              </a>
            </motion.div>
          </div>

          <motion.div variants={fadeInUp} className="relative">
            <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-border bg-card p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Agent Memory Labs</h3>
                  <p className="text-xs text-muted-foreground">agentmemorylabs.com</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground mb-2">User asks:</p>
                  <p className="text-sm">&ldquo;What did we decide about the pricing model last week?&rdquo;</p>
                </div>
                <div className="flex justify-center">
                  <div className="h-8 w-px bg-border" />
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-2">Agent recalls from memory:</p>
                  <p className="text-sm">
                    &ldquo;You chose a freemium model with $0 entry and $29/mo Pro tier. You wanted to keep the free tier generous to drive top-of-funnel leads.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function DownloadSection({ user }: { user: { name: string | null; email: string } | null }) {
  return (
    <section id="download" className="py-24 md:py-32 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
            Ready to <span className="gradient-text">start dictating?</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg mb-10">
            {user
              ? "Download the desktop agent and start speaking instead of typing."
              : "One command to install. No signup, no credit card, no limits."}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link href="/download">
                <Button size="lg" className="gap-2 text-base px-8 h-12">
                  <Download className="h-4 w-4" />
                  Download for Desktop
                </Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button size="lg" className="gap-2 text-base px-8 h-12">
                  <Sparkles className="h-4 w-4" />
                  Create Free Account
                </Button>
              </Link>
            )}
          </motion.div>

          <motion.div variants={fadeInUp} className="mt-12 grid sm:grid-cols-3 gap-6 text-left">
            {[
              { label: "Windows", note: "Windows 10+", platform: "windows" },
              { label: "macOS", note: "10.15+", platform: "macos" },
              { label: "Linux", note: "X11 / Wayland", platform: "linux" },
            ].map((platform) => (
              <Link
                key={platform.label}
                href="/download"
                className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors"
              >
                <Download className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{platform.label}</div>
                  <div className="text-xs text-muted-foreground">{platform.note}</div>
                </div>
              </Link>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function CTABanner({ user }: { user: { name: string | null; email: string } | null }) {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="relative rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-purple-500/5 to-background p-10 md:p-16 text-center overflow-hidden"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
              Stop typing. Start speaking.
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              {user
                ? "Your account is ready. Download the agent and start dictating right now."
                : "Download the free desktop agent and start dictating in under 60 seconds. No account required."}
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link href="/download">
                  <Button size="lg" className="gap-2 text-base px-8 h-12">
                    Download Now
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/download">
                    <Button size="lg" className="gap-2 text-base px-8 h-12">
                      <Download className="h-4 w-4" />
                      Download for Free
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="lg" variant="outline" className="text-base px-8 h-12">
                      Create Free Account
                    </Button>
                  </Link>
                </>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function CTASections({ user }: { user: { name: string | null; email: string } | null }) {
  return (
    <>
      <FreeVsAccount />
      <AgentMemoryLabsBridge />
      <DownloadSection user={user} />
      <CTABanner user={user} />
    </>
  );
}
