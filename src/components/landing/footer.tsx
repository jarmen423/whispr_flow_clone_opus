"use client";

import Link from "next/link";
import { Mic } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-5 gap-8 mb-8">
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

          <div>
            <h4 className="text-sm font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="https://agentmemorylabs.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Agent Memory Labs</a></li>
              <li><a href="https://github.com/jarmen423" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a></li>
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
