import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGetOne, dbInsert } from "@/lib/db";
import { signJwt } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email;
    const password = body?.password;
    const name = body?.name;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await dbGetOne("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
    if (existing) {
      return NextResponse.json({ success: false, error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await dbInsert("users", {
      email: email.toLowerCase().trim(),
      name: (name as string | undefined)?.trim() || null,
      password_hash: passwordHash,
    });

    const token = await signJwt({ userId, email: email.toLowerCase().trim() });

    const response = NextResponse.json({
      success: true,
      user: { id: userId, email: email.toLowerCase().trim(), name: (name as string | undefined)?.trim() || null },
    });

    response.cookies.set("localflow_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[Auth/Signup] Error:", error);
    const message = error?.message || String(error);
    return NextResponse.json(
      { success: false, error: "Something went wrong", detail: message },
      { status: 500 }
    );
  }
}
