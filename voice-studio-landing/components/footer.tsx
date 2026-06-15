import { Container } from "@/components/primitives/container";

const FOOTER_LINKS = [
  { href: "#modes", label: "Modes" },
  { href: "#hotkeys", label: "Hotkeys" },
  { href: "#install", label: "Install" },
  { href: "https://github.com", label: "GitHub" },
  { href: "#privacy", label: "Privacy" },
];

export function Footer() {
  return (
    <footer className="border-t border-subtle bg-panel-2">
      <Container size="wide">
        <div className="flex flex-col items-start justify-between gap-8 py-12 md:flex-row md:items-center">
          {/* Wordmark */}
          <div>
            <div className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              LocalFlow
            </div>
            <div className="mt-1 font-mono text-xs text-faint">
              dictate.agentmemorylabs.com
            </div>
          </div>

          {/* Links */}
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted transition-colors duration-[var(--dur-fast)] hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="border-t border-subtle py-6">
          <p className="font-mono text-xs text-faint">
            © {new Date().getFullYear()} Agent Memory Labs. Local-first. Yours.
          </p>
        </div>
      </Container>
    </footer>
  );
}
