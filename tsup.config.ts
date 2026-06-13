import { defineConfig } from "tsup";

// Two standalone bundles:
//  - cli.js   → the `loopmd` binary
//  - guard.js → the zero-dependency Guard, runnable on its own inside hooks/CI (Phase 2)
export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    guard: "src/guard/guard.ts",
  },
  format: ["esm"],
  target: "node20",
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
