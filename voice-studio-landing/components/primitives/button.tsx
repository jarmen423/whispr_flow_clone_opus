import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "subtle";
type Size = "default" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,background-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out-quart)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent shadow-soft hover:shadow-lift hover:bg-[var(--accent-hover)]",
  ghost:
    "border border-subtle bg-transparent text-primary hover:bg-panel-2 hover:border-strong",
  subtle: "bg-panel-2 text-primary hover:bg-elevated",
};

const sizes: Record<Size, string> = {
  default: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  as?: "button" | "a";
  href?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "default",
  as = "button",
  href,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (as === "a") {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
