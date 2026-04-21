"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Mic,
  Zap,
  Keyboard,
  Globe,
  Sparkles,
  Download,
  ArrowRight,
  CheckCircle2,
  MousePointerClick,
  Languages,
  Wand2,
  Command,
  Shield,
  Clock,
  Star,
  Users,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ------------------------------------------------------------------ */
/*  Navbar                                                             */
/* ------------------------------------------------------------------ */
function Navbar({ user, setUser }: { user: { name: string | null; email: string } | null; setUser: (u: { name: string | null; email: string } | null) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-border/50"
          : "bg-transparent border-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold gradient-text">LocalFlow</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#download" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Download
            </a>
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="gap-1.5" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); }}>
                    Log out
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="gap-1.5">
                    Get Started Free
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl"
        >
          <div className="px-4 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground">
              How it works
            </a>
            <a href="#download" onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground">
              Download
            </a>
            <div className="pt-2 flex gap-3">
              {user ? (
                <>
                  <Link href="/dashboard" className="flex-1">
                    <Button variant="outline" className="w-full">Dashboard</Button>
                  </Link>
                  <Button className="flex-1" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); }}>
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" className="flex-1">
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/signup" className="flex-1">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeInUp} className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              100% Free — No credit card required
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            Speak naturally.
            <br />
            <span className="gradient-text">Get perfect text.</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            LocalFlow is the fastest way to turn your voice into beautifully formatted text.
            Global hotkeys, AI-powered refinement, and translation — all completely free.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="gap-2 text-base px-8 h-12">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/download">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8 h-12">
                <Download className="h-4 w-4" />
                Download for Desktop
              </Button>
            </Link>
          </motion.div>

          <motion.p variants={fadeInUp} className="mt-4 text-xs text-muted-foreground">
            Works on Windows, macOS, and Linux. No subscription. No limits.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Social Proof                                                       */
/* ------------------------------------------------------------------ */
function SocialProof() {
  const stats = [
    { icon: Users, value: "10,000+", label: "Active users" },
    { icon: Clock, value: "50x", label: "Faster than typing" },
    { icon: Star, value: "4.9/5", label: "User rating" },
    { icon: Shield, value: "100%", label: "Free & private" },
  ];

  return (
    <section className="py-12 border-y border-border/50 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={fadeInUp} className="text-center">
              <stat.icon className="h-6 w-6 text-primary mx-auto mb-3" />
              <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Features                                                           */
/* ------------------------------------------------------------------ */
function Features() {
  const features = [
    {
      icon: Keyboard,
      title: "Global Hotkeys",
      description:
        "Hold Alt+L anywhere on your system to dictate. Alt+M for smart formatting. Alt+T to toggle translation. Works in any app.",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description:
        "Whisper transcription at ~50x real-time speed. Cloud, networked-local, or fully local processing modes.",
    },
    {
      icon: Wand2,
      title: "AI Formatting",
      description:
        "Voice commands for bullet points, numbered lists, indentation, and outlines. Speak structure, get structure.",
    },
    {
      icon: Globe,
      title: "Translation Mode",
      description:
        "Speak in any language and get perfectly translated English output. Alt+T toggles translation instantly.",
    },
    {
      icon: MousePointerClick,
      title: "Selected-Text Formatter",
      description:
        "Highlight any text, press Alt+J, and watch it reformat into Markdown, JSON, CSV, or clean prose instantly.",
    },
    {
      icon: Shield,
      title: "Private by Design",
      description:
        "Local processing mode keeps everything on your machine. No audio stored, no data retention, no surveillance.",
    },
  ];

  return (
    <section id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to{" "}
            <span className="gradient-text">dictate like a pro</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg">
            Six powerful features designed to make voice your fastest input method.
          </motion.p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeInUp}
              custom={i}
              className="group relative p-6 rounded-2xl border border-border bg-card/50 hover:bg-card transition-colors"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Hotkey Showcase                                                    */
/* ------------------------------------------------------------------ */
function HotkeyShowcase() {
  const hotkeys = [
    { keys: ["Alt", "L"], label: "Raw Dictation", desc: "Transcription only, no LLM" },
    { keys: ["Alt", "M"], label: "Format Mode", desc: "AI-structured outlines & lists" },
    { keys: ["Alt", "T"], label: "Translation", desc: "Toggle translate to English" },
    { keys: ["Alt", "A"], label: "Voice Agent", desc: "Ask questions, get answers" },
    { keys: ["Alt", "J"], label: "Format Selection", desc: "Reformat highlighted text" },
    { keys: ["Alt", "N"], label: "Cleanup", desc: "Repair punctuation & grammar" },
  ];

  return (
    <section className="py-24 md:py-32 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid lg:grid-cols-2 gap-16 items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <div>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
              Dictate from <span className="gradient-text">anywhere</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg mb-8">
              Six global hotkeys that work in every application. No clicking, no switching windows — just hold, speak, and release.
            </motion.p>
            <motion.div variants={fadeInUp} className="space-y-4">
              {hotkeys.map((h) => (
                <div
                  key={h.label}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50"
                >
                  <div className="flex items-center gap-1 shrink-0">
                    {h.keys.map((k, idx) => (
                      <span key={k} className="flex items-center gap-1">
                        <kbd className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg bg-muted border border-border text-xs font-mono font-medium">
                          {k}
                        </kbd>
                        {idx < h.keys.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{h.label}</div>
                    <div className="text-xs text-muted-foreground">{h.desc}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div variants={fadeInUp} className="relative">
            <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="ml-2 text-xs text-muted-foreground">LocalFlow Desktop Agent</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                    <Mic className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Recording started</p>
                    <p className="text-xs text-muted-foreground">Hold Alt+L to dictate in any app</p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 border border-border">
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;First, we need to refactor the auth module. Second, add OAuth support. Third, write tests for the new flow.&rdquo;
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Pasted at cursor</p>
                    <p className="text-xs text-muted-foreground">Processed in 0.8s</p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 p-4 border border-border">
                  <p className="text-sm">
                    1. Refactor the auth module
                    <br />
                    2. Add OAuth support
                    <br />
                    3. Write tests for the new flow
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

/* ------------------------------------------------------------------ */
/*  How It Works                                                       */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  const steps = [
    {
      icon: Download,
      title: "Install the Agent",
      description: "Download and run the LocalFlow desktop agent. It sits quietly in your system tray.",
    },
    {
      icon: Command,
      title: "Hold Your Hotkey",
      description: "Press and hold Alt+L (or your chosen hotkey) in any application. Speak naturally.",
    },
    {
      icon: FileText,
      title: "Release to Paste",
      description: "Release the hotkey. Your perfectly formatted text appears instantly at your cursor.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mb-4">
            Three steps to <span className="gradient-text">voice-powered</span> productivity
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted-foreground text-lg">
            No training, no setup wizard, no configuration headache.
          </motion.p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
        >
          {steps.map((step, i) => (
            <motion.div key={step.title} variants={fadeInUp} custom={i} className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="absolute top-0 left-14 text-6xl font-bold text-muted/10 select-none">
                {i + 1}
              </div>
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Download                                                           */
/* ------------------------------------------------------------------ */
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
              : "Create your free account to download the desktop agent and unlock all features."}
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
                href={user ? "/download" : "/signup"}
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

/* ------------------------------------------------------------------ */
/*  CTA Banner                                                         */
/* ------------------------------------------------------------------ */
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
                : "Join thousands of developers, writers, and productivity hackers who dictate faster than they type."}
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
                  <Link href="/signup">
                    <Button size="lg" className="gap-2 text-base px-8 h-12">
                      Get Started Free
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline" className="text-base px-8 h-12">
                      Already have an account?
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

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */
function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xl font-bold gradient-text">LocalFlow</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              Free AI-powered dictation for everyone. Built by the team at{" "}
              <a href="https://agentmemorylabs.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Agent Memory Labs
              </a>
              .
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#download" className="hover:text-foreground transition-colors">Download</a></li>
              <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Web Dictation</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Account</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Log in</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} LocalFlow. A free tool from{" "}
            <a href="https://agentmemorylabs.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Agent Memory Labs
            </a>
            .
          </p>
          <p className="text-xs text-muted-foreground">
            100% free. No credit card required. No data retention.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  const [user, setUser] = useState<{ name: string | null; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <Navbar user={user} setUser={setUser} />
      <Hero />
      <SocialProof />
      <Features />
      <HotkeyShowcase />
      <HowItWorks />
      <DownloadSection user={user} />
      <CTABanner user={user} />
      <Footer />
    </main>
  );
}
