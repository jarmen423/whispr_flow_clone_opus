import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyJwt } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const platform = body.platform || "unknown";

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Download/Track] Error:", error);
    return NextResponse.json({ success: false, error: "Tracking failed" }, { status: 500 });
  }
}
