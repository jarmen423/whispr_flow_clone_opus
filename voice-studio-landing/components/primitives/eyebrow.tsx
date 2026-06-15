/**
 * Small mono label above headings — editorial detail.
 * Example: "How it feels"
 */
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block font-mono text-xs uppercase tracking-[0.18em] text-faint ${className}`}
    >
      {children}
    </span>
  );
}
