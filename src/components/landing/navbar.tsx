"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mic,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Navbar({ user, setUser }: { user: { name: string | null; email: string } | null; setUser: (u: { name: string | null; email: string } | null) => void }) {
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
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold gradient-text">LocalFlow</span>
          </Link>

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
            <Link href="/setup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Setup
            </Link>
            <a href="https://agentmemorylabs.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:text-primary/80 transition-colors">
              Agent Memory Labs ↗
            </a>
          </div>

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

          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

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
            <Link href="/setup" onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground">
              Setup
            </Link>
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
