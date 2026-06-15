import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app is a self-contained project nested inside a repo whose root also
  // has a package.json. Tell Next.js explicitly that *this* dir is the root,
  // so it doesn't try to trace/output relative to the parent workspace.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
