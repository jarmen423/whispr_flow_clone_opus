import type { ReactNode } from "react";

/**
 * Centered max-width content container with responsive gutters.
 * Caps reading width so long prose stays calm.
 */
export function Container({
  children,
  className = "",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
}) {
  const max =
    size === "narrow"
      ? "max-w-2xl"
      : size === "wide"
        ? "max-w-7xl"
        : "max-w-6xl";
  return (
    <div className={`mx-auto w-full ${max} px-6 md:px-8 ${className}`}>
      {children}
    </div>
  );
}
