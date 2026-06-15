import type { ReactNode } from "react";
import { Container } from "./container";

/**
 * Vertical-rhythm section wrapper.
 * - `quiet` = less padding (for adjacent supporting sections)
 * - `cvAuto` applies content-visibility:auto for below-the-fold perf
 */
export function Section({
  children,
  className = "",
  size = "default",
  quiet = false,
  cvAuto = false,
  as: Tag = "section",
  id,
  ariaLabel,
  ariaLabelledBy,
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
  quiet?: boolean;
  cvAuto?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
  id?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}) {
  return (
    <Tag
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={`${quiet ? "py-16 md:py-20" : "py-20 md:py-32"} ${cvAuto ? "cv-auto" : ""} ${className}`}
    >
      <Container size={size}>{children}</Container>
    </Tag>
  );
}
