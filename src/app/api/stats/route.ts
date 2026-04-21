import { NextResponse } from "next/server";
import { dbGetOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public stats endpoint for social proof and internal tracking.
 * Returns aggregate counts — no user-level data.
 */
export async function GET() {
  try {
    const totalDownloads = await dbGetOne(
      "SELECT COUNT(*) as count FROM download_events"
    ) as { count: number } | null;

    const totalInstalls = await dbGetOne(
      "SELECT COUNT(*) as count FROM install_events"
    ) as { count: number } | null;

    const totalSignups = await dbGetOne(
      "SELECT COUNT(*) as count FROM users"
    ) as { count: number } | null;

    const platformBreakdown = await dbGetOne(
      `SELECT 
        COALESCE(SUM(CASE WHEN platform = 'windows' THEN 1 ELSE 0 END), 0) as windows,
        COALESCE(SUM(CASE WHEN platform = 'macos' THEN 1 ELSE 0 END), 0) as macos,
        COALESCE(SUM(CASE WHEN platform = 'linux' THEN 1 ELSE 0 END), 0) as linux
      FROM install_events`
    ) as { windows: number; macos: number; linux: number } | null;

    return NextResponse.json({
      ok: true,
      downloads: Number(totalDownloads?.count ?? 0),
      installs: Number(totalInstalls?.count ?? 0),
      signups: Number(totalSignups?.count ?? 0),
      platforms: {
        windows: Number(platformBreakdown?.windows ?? 0),
        macos: Number(platformBreakdown?.macos ?? 0),
        linux: Number(platformBreakdown?.linux ?? 0),
      },
    });
  } catch (error) {
    console.error("[Stats] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Stats unavailable" },
      { status: 500 }
    );
  }
}
