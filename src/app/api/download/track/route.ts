import { NextRequest, NextResponse } from "next/server";
import { dbInsert } from "@/lib/db";
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

    await dbInsert("download_events", {
      user_id: userId,
      platform,
      ip: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Download/Track] Error:", error);
    return NextResponse.json({ success: false, error: "Tracking failed" }, { status: 500 });
  }
}
