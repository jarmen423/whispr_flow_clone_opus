import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGetOne, dbInsert } from "@/lib/db";
import { signJwt } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  const trace: string[] = [];

  try {
    trace.push("start");
    trace.push("before_json");
    const body = await request.json();
    trace.push("after_json");
    trace.push("body_type:" + typeof body);
    trace.push("body_keys:" + (body && typeof body === "object" ? Object.keys(body).join(",") : "n/a"));

    const email = (body as Record<string, unknown>).email;
    const password = (body as Record<string, unknown>).password;
    const name = (body as Record<string, unknown>).name;
    trace.push("destructured");

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Email and password are required", trace }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters", trace }, { status: 400 });
    }

    trace.push("checking_existing");
    const existing = await dbGetOne("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    trace.push("existing:" + (existing ? "yes" : "no"));
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already exists", trace }, { status: 409 });
    }

    trace.push("hashing");
    const passwordHash = await bcrypt.hash(password as string, 10);
    trace.push("hashed");

    trace.push("inserting");
    const userId = await dbInsert("users", {
      email: email.toLowerCase().trim(),
      name: (name as string | undefined)?.trim() || null,
      password_hash: passwordHash,
    });
    trace.push("inserted:" + userId);

    trace.push("signing_jwt");
    const token = await signJwt({ userId, email: email.toLowerCase().trim() });
    trace.push("jwt_done");

    const response = NextResponse.json({
      success: true,
      user: { id: userId, email: email.toLowerCase().trim(), name: (name as string | undefined)?.trim() || null },
      trace,
    });

    response.cookies.set("localflow_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    trace.push("done");
    return response;
  } catch (error) {
    console.error("[Debug/FullSignup] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: "Something went wrong", debug: message, trace }, { status: 500 });
  }
}
