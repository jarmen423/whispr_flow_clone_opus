/**
 * OS detection for the download button + install section.
 * Client-only; returns a sensible default during SSR.
 */

export type OS = "mac" | "win" | "linux";

export function detectOS(ua: string): OS {
  const lower = ua.toLowerCase();
  if (lower.includes("mac")) return "mac";
  if (lower.includes("win")) return "win";
  if (lower.includes("linux")) return "linux";
  return "win"; // pragmatic default
}

export function osLabel(os: OS): string {
  switch (os) {
    case "mac":
      return "macOS";
    case "win":
      return "Windows";
    case "linux":
      return "Linux";
  }
}
