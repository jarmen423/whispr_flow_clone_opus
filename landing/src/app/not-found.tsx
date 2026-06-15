import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-mono text-xs text-muted">
        <span className="text-accent">$</span> cd /
      </p>
      <h1 className="font-mono text-6xl font-medium tracking-tight text-content sm:text-7xl">
        4<span className="text-accent">0</span>4
      </h1>
      <p className="max-w-sm text-sm text-muted">
        that route doesn&apos;t exist. nothing was pasted.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 font-mono text-sm text-accent-foreground transition-opacity hover:opacity-90"
      >
        ← back to /
      </Link>
    </main>
  );
}
