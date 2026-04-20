import { NextRequest, NextResponse } from "next/server";
import { dbGetAll } from "@/lib/db";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "localflow-admin-dev-key";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader?.replace("Bearer ", "") || "";

    if (apiKey !== ADMIN_KEY) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const format = request.nextUrl.searchParams.get("format") || "json";
    const users = await dbGetAll("SELECT id, email, name, created_at FROM users ORDER BY created_at DESC") as { id: number; email: string; name: string | null; created_at: string }[];

    if (format === "csv") {
      const lines = ["id,email,name,created_at"];
      for (const u of users) {
        lines.push(`${u.id},${u.email},"${u.name || ""}",${u.created_at}`);
      }
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=localflow-leads.csv",
        },
      });
    }

    return NextResponse.json({ success: true, count: users.length, users });
  } catch (error) {
    console.error("[Admin/Leads] Error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
