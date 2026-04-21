import { NextResponse } from "next/server";
import { dbGetOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string; latency_ms?: number }> = {};

  // DB connectivity check
  const t0 = Date.now();
  try {
    await dbGetOne("SELECT 1 as one");
    checks.database = { ok: true, latency_ms: Date.now() - t0 };
  } catch (err: any) {
    checks.database = { ok: false, error: err.message || String(err), latency_ms: Date.now() - t0 };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      ok: allOk,
      checks,
      env: {
        node_env: process.env.NODE_ENV,
        has_database_url: !!process.env.DATABASE_URL,
        has_jwt_secret: !!process.env.JWT_SECRET,
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
