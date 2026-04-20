import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "localflow-admin-dev-key";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader?.replace("Bearer ", "") || "";

    if (apiKey !== ADMIN_KEY) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }).count;
    const totalDownloads = (db.prepare("SELECT COUNT(*) as count FROM download_events").get() as { count: number }).count;
    const downloadsByPlatform = db
      .prepare("SELECT platform, COUNT(*) as count FROM download_events GROUP BY platform")
      .all() as { platform: string; count: number }[];

    // Users who downloaded
    const usersWithDownloads = (
      db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM download_events WHERE user_id IS NOT NULL").get() as {
        count: number;
      }
    ).count;

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalDownloads,
        downloadsByPlatform,
        usersWithDownloads,
        conversionRate: totalUsers > 0 ? ((usersWithDownloads / totalUsers) * 100).toFixed(1) + "%" : "N/A",
      },
    });
  } catch (error) {
    console.error("[Admin/Stats] Error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
