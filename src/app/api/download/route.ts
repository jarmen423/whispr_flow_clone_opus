import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "@/lib/db";
import { verifyJwt } from "@/lib/jwt";

const SCRIPTS_DIR = join(process.cwd(), "scripts");

const PLATFORM_SCRIPTS: Record<string, { filename: string; contentType: string }> = {
  windows: { filename: "install-agent.ps1", contentType: "text/plain; charset=utf-8" },
  macos: { filename: "install-agent.sh", contentType: "text/plain; charset=utf-8" },
  linux: { filename: "install-agent.sh", contentType: "text/plain; charset=utf-8" },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform")?.toLowerCase() || "windows";

    const script = PLATFORM_SCRIPTS[platform];
    if (!script) {
      return NextResponse.json({ success: false, error: "Invalid platform" }, { status: 400 });
    }

    // Track download
    try {
      const token = request.cookies.get("localflow_token")?.value;
      let userId: number | null = null;
      if (token) {
        const payload = await verifyJwt(token);
        if (payload) userId = payload.userId;
      }

      const db = getDb();
      db.prepare("INSERT INTO download_events (user_id, platform, ip, user_agent) VALUES (?, ?, ?, ?)").run(
        userId,
        platform,
        request.headers.get("x-forwarded-for") || "unknown",
        request.headers.get("user-agent") || "unknown"
      );
    } catch (trackErr) {
      console.error("[Download] Tracking error:", trackErr);
      // Don't fail the download if tracking fails
    }

    const content = readFileSync(join(SCRIPTS_DIR, script.filename), "utf-8");

    return new NextResponse(content, {
      headers: {
        "Content-Type": script.contentType,
        "Content-Disposition": `attachment; filename="localflow-install-${platform}.${platform === "windows" ? "ps1" : "sh"}"`,
      },
    });
  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json({ success: false, error: "Download unavailable" }, { status: 500 });
  }
}
