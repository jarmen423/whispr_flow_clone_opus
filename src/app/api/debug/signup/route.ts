import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGetOne, dbInsert } from "@/lib/db";
import { signJwt } from "@/lib/jwt";

export async function POST() {
  const steps: Record<string, unknown> = {};

  try {
    // Step 1: bcrypt
    try {
      const hash = await bcrypt.hash("test", 10);
      steps.bcrypt = { ok: true, hashPrefix: hash.substring(0, 20) };
    } catch (e) {
      steps.bcrypt = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    // Step 2: dbGetOne
    try {
      const row = await dbGetOne("SELECT id FROM users WHERE email = ?", ["nonexistent@test.com"]);
      steps.dbGetOne = { ok: true, row };
    } catch (e) {
      steps.dbGetOne = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    // Step 3: dbInsert
    try {
      const id = await dbInsert("users", {
        email: `diag_${Date.now()}@test.com`,
        name: "Diag",
        password_hash: "test",
      });
      steps.dbInsert = { ok: true, id };
    } catch (e) {
      steps.dbInsert = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    // Step 4: signJwt
    try {
      const token = await signJwt({ userId: 1, email: "test@test.com" });
      steps.signJwt = { ok: true, tokenPrefix: token.substring(0, 20) };
    } catch (e) {
      steps.signJwt = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    return NextResponse.json({ success: true, steps });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message, steps }, { status: 500 });
  }
}
