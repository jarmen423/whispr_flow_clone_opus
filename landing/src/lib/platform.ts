/**
 * Platform install configuration + UA detection.
 *
 * Commands sourced from the existing download flow (src/app/download/page.tsx
 * in the parent repo) — reused here as DATA only, not copied component code.
 * Kept in lib so both the hero CTA and the install tabs consume one source.
 */

export type Platform = "windows" | "macos" | "linux";

export interface PlatformConfig {
  id: Platform;
  label: string;
  /** Short label for buttons, e.g. "macOS" */
  command: string;
  /** Shell hint shown next to the command, e.g. "powershell" */
  shell: string;
}

export const PLATFORMS: Record<Platform, PlatformConfig> = {
  windows: {
    id: "windows",
    label: "Windows",
    shell: "powershell",
    command:
      "irm https://dictate.agentmemorylabs.com/api/download?platform=windows | iex",
  },
  macos: {
    id: "macos",
    label: "macOS",
    shell: "bash",
    command:
      "curl -fsSL https://dictate.agentmemorylabs.com/api/download?platform=macos | bash",
  },
  linux: {
    id: "linux",
    label: "Linux",
    shell: "bash",
    command:
      "curl -fsSL https://dictate.agentmemorylabs.com/api/download?platform=linux | bash",
  },
};

export const PLATFORM_ORDER: Platform[] = ["windows", "macos", "linux"];

/** Dev/source install command — the hero's primary CTA. */
export const DEV_INSTALL_COMMAND = "uv tool install --editable .";

/**
 * Detect OS from user agent. Returns "linux" as the fallback (curl command
 * works on most unix-likes). Must run client-side; callers guard in useEffect.
 */
export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}
