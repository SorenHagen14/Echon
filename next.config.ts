import type { NextConfig } from "next";
import path from "node:path";

// Pin the Turbopack root to this project. Without it, Turbopack walks up the
// filesystem looking for a package.json and finds a stray one in the user's
// home directory, causing dev-mode module resolution (tailwindcss, etc.) to
// fail because it searches from ~/ instead of the project root.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
