import { NextRequest, NextResponse } from "next/server";
import { dbInsert } from "@/lib/db";

/**
 * Anonymous install pingback.
 * Called once at the end of the install script.
 * No PII stored — just platform and timestamp.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform")?.toLowerCase() || "unknown";

    await dbInsert("install_events", {
      platform,
      // No IP, no user-agent, no user_id — completely anonymous
      created_at: new Date().toISOString(),
    });

    return new NextResponse("ok", { status: 200 });
  } catch {
    // Silent fail — install shouldn't break if pingback fails
    return new NextResponse("ok", { status: 200 });
  }
}
