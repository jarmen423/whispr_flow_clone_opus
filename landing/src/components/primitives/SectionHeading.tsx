import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  /** Mono-styled kicker, e.g. "the keys" — lowercase, terminal voice. */
  kicker: string;
  /** Optional body line under the heading. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Imperative, mono-styled section heading. The kicker is the "title" rendered
 * in mono with a leading marker for terminal feel; children are the subtitle.
 *
 * Voice rule: kickers are lowercase verbs/nouns — `install.`, `the modes.`,
 * `speed.`, `privacy.`, `the keys.`
 */
export function SectionHeading({
  kicker,
  children,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <h2 className="font-mono text-2xl font-medium tracking-tight text-content sm:text-3xl">
        <span className="text-accent">#</span> {kicker}
      </h2>
      {children ? (
        <p className="max-w-2xl text-sm text-muted sm:text-base">{children}</p>
      ) : null}
    </div>
  );
}
