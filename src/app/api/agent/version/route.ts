import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const versionPath = join(process.cwd(), "agent", "version.txt");
    const version = readFileSync(versionPath, "utf-8").trim();
    return NextResponse.json({ success: true, version, changelog: "" });
  } catch {
    return NextResponse.json({ success: true, version: "1.0.0", changelog: "" });
  }
}
