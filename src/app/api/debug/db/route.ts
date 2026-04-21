import { NextResponse } from "next/server";
import { dbGetOne, dbInsert } from "@/lib/db";

export async function GET() {
  const tests: Record<string, unknown> = {};

  try {
    const isPostgres = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

    // Test 1: simple query
    try {
      const test1 = await dbGetOne("SELECT 1 as n");
      tests.select1 = test1;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      tests.select1 = { error: err };
    }

    // Test 2: table check
    try {
      const test2 = await dbGetOne(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') as exists"
      );
      tests.users_table = test2;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      tests.users_table = { error: err };
    }

    // Test 3: insert test
    try {
      const test3 = await dbInsert("users", {
        email: `test_${Date.now()}@example.com`,
        name: "Diagnostics",
        password_hash: "test",
      });
      tests.insert = test3;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      tests.insert = { error: err };
    }

    return NextResponse.json({ success: true, isPostgres, tests });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    return NextResponse.json({ success: false, error: message, stack, tests }, { status: 500 });
  }
}
