import { NextRequest, NextResponse } from "next/server";
import { dbGetAll, dbGetOne } from "@/lib/db";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "localflow-admin-dev-key";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader?.replace("Bearer ", "") || "";

    if (apiKey !== ADMIN_KEY) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const totalUsersRow = await dbGetOne("SELECT COUNT(*) as count FROM users") as { count: number } | null;
    const totalDownloadsRow = await dbGetOne("SELECT COUNT(*) as count FROM download_events") as { count: number } | null;
    const downloadsByPlatform = await dbGetAll("SELECT platform, COUNT(*) as count FROM download_events GROUP BY platform") as { platform: string; count: number }[];
    const usersWithDownloadsRow = await dbGetOne("SELECT COUNT(DISTINCT user_id) as count FROM download_events WHERE user_id IS NOT NULL") as { count: number } | null;

    const totalUsers = totalUsersRow?.count ?? 0;
    const totalDownloads = totalDownloadsRow?.count ?? 0;
    const usersWithDownloads = usersWithDownloadsRow?.count ?? 0;

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
