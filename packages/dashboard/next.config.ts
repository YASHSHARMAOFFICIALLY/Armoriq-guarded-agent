import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Pin Turbopack's workspace root to the monorepo root. Without this, a stray
// lockfile in $HOME made Next infer the home directory as the root.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
};

export default nextConfig;
