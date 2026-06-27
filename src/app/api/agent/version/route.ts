import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CHANGELOG_HEADLINE =
  "v1.0.1: Auto-mute system audio while dictating (Windows). Restored on stop. " +
  "New Alt+. toggle dictation hotkey. Updated install scripts.";

export async function GET() {
  try {
    const versionPath = join(process.cwd(), "agent", "version.txt");
    const changelogPath = join(process.cwd(), "CHANGELOG.md");
    const version = readFileSync(versionPath, "utf-8").trim();
    // Pull the [Unreleased] section if present, otherwise fall back to a headline
    let changelog = CHANGELOG_HEADLINE;
    if (existsSync(changelogPath)) {
      const full = readFileSync(changelogPath, "utf-8");
      const m = full.match(/## \[Unreleased\][\s\S]*?(?=\n## |$)/);
      if (m) {
        // Strip the heading + leading/trailing blank lines for a compact payload
        changelog = m[0]
          .replace(/^## \[Unreleased\]\s*\n/, "")
          .trim()
          .slice(0, 4000);
      }
    }
    return NextResponse.json({ success: true, version, changelog });
  } catch {
    return NextResponse.json({ success: true, version: "1.0.1", changelog: CHANGELOG_HEADLINE });
  }
}
