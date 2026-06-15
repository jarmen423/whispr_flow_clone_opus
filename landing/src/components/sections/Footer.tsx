/** Minimal footer. Mono mark, two link columns, one credit line. */
export function Footer() {
  return (
    <footer className="border-t border-line py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-sm font-medium text-content">
            <span className="text-accent">_</span>localflow
          </span>
          <p className="max-w-xs text-xs text-muted">
            speak. paste. done.
          </p>
        </div>

        <div className="flex gap-12">
          <nav className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted/60">
              product
            </span>
            <a
              href="#keys"
              className="font-mono text-xs text-muted transition-colors hover:text-content"
            >
              keys
            </a>
            <a
              href="#modes"
              className="font-mono text-xs text-muted transition-colors hover:text-content"
            >
              modes
            </a>
            <a
              href="#install"
              className="font-mono text-xs text-muted transition-colors hover:text-content"
            >
              install
            </a>
          </nav>

          <nav className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted/60">
              elsewhere
            </span>
            <a
              href="https://github.com/jarmen423"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted transition-colors hover:text-content"
            >
              github
            </a>
            <a
              href="https://agentmemorylabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted transition-colors hover:text-content"
            >
              agent memory labs
            </a>
          </nav>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-6xl px-4">
        <p className="border-t border-line/60 pt-6 font-mono text-[10px] text-muted/60">
          built by agent memory labs. whisper on groq, refine on cerebras.
        </p>
      </div>
    </footer>
  );
}
