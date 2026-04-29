import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { dbGetOne, dbInsert } from "@/lib/db";
import { signJwt } from "@/lib/jwt";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

async function exchangeCodeForToken(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Userinfo failed (${response.status}): ${text}`);
  }

  return response.json();
}

function getErrorRedirect(origin: string, error: string): NextResponse {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const origin = request.nextUrl.origin;

    if (error) {
      console.error("[OAuth/Google] User denied consent:", error);
      return getErrorRedirect(origin, "access_denied");
    }

    if (!code || !state) {
      return getErrorRedirect(origin, "oauth_failed");
    }

    // Validate state (CSRF protection)
    const cookieState = request.cookies.get("oauth_state")?.value;
    if (!cookieState || cookieState !== state) {
      console.error("[OAuth/Google] State mismatch");
      return getErrorRedirect(origin, "invalid_state");
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("[OAuth/Google] Missing client credentials");
      return getErrorRedirect(origin, "oauth_not_configured");
    }

    const redirectUri = `${origin}/api/auth/callback/google`;

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code, redirectUri);

    // Fetch user info
    const googleUser = await fetchGoogleUserInfo(tokenData.access_token);

    if (!googleUser.email) {
      return getErrorRedirect(origin, "oauth_failed");
    }

    // Find user by google_id first
    let user = await dbGetOne("SELECT * FROM users WHERE google_id = ?", [googleUser.id]) as
      | { id: number; email: string; name: string | null }
      | null;

    if (!user) {
      // Check if a user with this email already exists (link accounts)
      const existingUser = await dbGetOne("SELECT * FROM users WHERE email = ?", [googleUser.email.toLowerCase().trim()]) as
        | { id: number; email: string; name: string | null }
        | null;

      if (existingUser) {
        // Link Google account to existing user
        await dbGetOne("UPDATE users SET google_id = ? WHERE id = ?", [googleUser.id, existingUser.id]);
        user = existingUser;
      } else {
        // Create new user
        const randomPassword = randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomPassword, 10);

        const userId = await dbInsert("users", {
          email: googleUser.email.toLowerCase().trim(),
          name: googleUser.name?.trim() || null,
          password_hash: passwordHash,
          google_id: googleUser.id,
        });

        user = {
          id: userId,
          email: googleUser.email.toLowerCase().trim(),
          name: googleUser.name?.trim() || null,
        };
      }
    }

    // Issue JWT
    const token = await signJwt({ userId: user.id, email: user.email });

    const response = NextResponse.redirect(`${origin}/dashboard`);
    response.cookies.set("localflow_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    // Clear oauth_state cookie
    response.cookies.set("oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[OAuth/Google] Callback error:", err);
    return getErrorRedirect(request.nextUrl.origin, "oauth_failed");
  }
}
