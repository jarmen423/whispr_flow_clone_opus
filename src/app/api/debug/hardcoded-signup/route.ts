import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGetOne, dbInsert } from "@/lib/db";
import { signJwt } from "@/lib/jwt";

export async function POST() {
  const trace: string[] = [];

  try {
    trace.push("start");
    const email = `hardcoded_${Date.now()}@test.com`;
    const password = "password123";
    const name = "Test";
    trace.push("hardcoded_values");

    trace.push("checking_existing");
    const existing = await dbGetOne("SELECT id FROM users WHERE email = ?", [email]);
    trace.push("existing:" + (existing ? "yes" : "no"));

    trace.push("hashing");
    const passwordHash = await bcrypt.hash(password, 10);
    trace.push("hashed");

    trace.push("inserting");
    const userId = await dbInsert("users", {
      email,
      name,
      password_hash: passwordHash,
    });
    trace.push("inserted:" + userId);

    trace.push("signing_jwt");
    const token = await signJwt({ userId, email });
    trace.push("jwt_done");

    const response = NextResponse.json({ success: true, userId, trace });
    response.cookies.set("localflow_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[Debug/HardcodedSignup] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: "Something went wrong", debug: message, trace }, { status: 500 });
  }
}
