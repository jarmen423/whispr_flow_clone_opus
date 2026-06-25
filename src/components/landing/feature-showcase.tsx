"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Keyboard,
  Globe,
  Wand2,
  MousePointerClick,
  Shield,
  CheckCircle2,
  Mic,
  Download,
  Command,
  FileText,
} from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

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

export default function FeatureShowcase() {
  return (
    <>
      <Features />
      <HotkeyShowcase />
      <HowItWorks />
    </>
  );
}
