"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Download,
  ArrowRight,
  Sparkles,
  Users,
  Clock,
  Star,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer } from "@/lib/animations";

function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
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
              100% Free — No signup required
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
            One installer, global hotkeys, AI-powered refinement — works offline, completely free.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/download">
              <Button size="lg" className="gap-2 text-base px-8 h-12">
                <Download className="h-4 w-4" />
                Download for Desktop
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8 h-12">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          <motion.p variants={fadeInUp} className="mt-4 text-xs text-muted-foreground">
            Works on Windows, macOS, and Linux. No account needed to install. No subscription. No limits.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function SocialProof() {
  const stats = [
    { icon: Users, value: "10,000+", label: "Active users" },
    { icon: Clock, value: "50x", label: "Faster than typing" },
    { icon: Star, value: "4.9/5", label: "User rating" },
    { icon: Shield, value: "$0", label: "Free forever" },
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

export default function HeroSection() {
  return (
    <>
      <Hero />
      <SocialProof />
    </>
  );
}
