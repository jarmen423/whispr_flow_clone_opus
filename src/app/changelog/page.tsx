import type { ReactElement } from "react";
import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";
import { ArrowLeft, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function renderMarkdown(md: string): ReactElement[] {
  // Very small markdown subset for CHANGELOG.md: headings, bullets, bold, code, hr.
  // We intentionally avoid a real markdown renderer dep to keep this page self-contained.
  const lines = md.split("\n");
  const out: ReactElement[] = [];
  let bullets: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={key++} className="list-disc pl-6 space-y-1 my-3 text-sm text-muted-foreground">
          {bullets.map((b, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(b) }} />
          ))}
        </ul>
      );
      bullets = [];
    }
  };

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs font-mono">$1</code>');

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      flushBullets();
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        out.push(
          <pre key={key++} className="rounded-lg bg-muted border border-border p-3 my-3 overflow-x-auto">
            <code className="text-xs font-mono">{codeBuf.join("\n")}</code>
          </pre>
        );
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (line.startsWith("## ")) {
      flushBullets();
      out.push(
        <h2 key={key++} className="text-2xl font-bold mt-10 mb-3">
          {line.replace(/^##\s+/, "")}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushBullets();
      out.push(
        <h3 key={key++} className="text-lg font-semibold mt-6 mb-2">
          {line.replace(/^###\s+/, "")}
        </h3>
      );
    } else if (line.startsWith("---")) {
      flushBullets();
      out.push(<hr key={key++} className="my-6 border-border" />);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      bullets.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushBullets();
    } else {
      flushBullets();
      out.push(
        <p key={key++} className="text-sm text-muted-foreground leading-relaxed my-2" dangerouslySetInnerHTML={{ __html: inline(line) }} />
      );
    }
  }
  flushBullets();
  return out;
}

function readChangelog(): string {
  try {
    const p = join(process.cwd(), "CHANGELOG.md");
    return readFileSync(p, "utf-8");
  } catch {
    return "# Changelog\n\nChangelog is currently unavailable.";
  }
}

function readVersion(): string {
  try {
    const p = join(process.cwd(), "agent", "version.txt");
    return readFileSync(p, "utf-8").trim();
  } catch {
    return "1.0.1";
  }
}

export default function ChangelogPage() {
  const md = readChangelog();
  const version = readVersion();
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-border/50">
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold gradient-text">LocalFlow</span>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-4">
            Current version: v{version}
          </span>
          <h1 className="text-4xl font-bold mb-3">What&rsquo;s new in LocalFlow</h1>
          <p className="text-muted-foreground text-lg">
            Every release of the LocalFlow desktop agent and hosted API, with
            detailed notes on what changed and why.
          </p>
        </div>

        <div className="prose prose-invert max-w-none">
          {renderMarkdown(md)}
        </div>
      </div>
    </div>
  );
}
