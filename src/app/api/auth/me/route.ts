import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyJwt } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("localflow_token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
    }

    const db = getDb();
    const user = db.prepare("SELECT id, email, name, created_at FROM users WHERE id = ?").get(payload.userId) as
      | { id: number; email: string; name: string | null; created_at: string }
      | undefined;

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[Auth/Me] Error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
