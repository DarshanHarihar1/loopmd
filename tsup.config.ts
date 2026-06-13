import { defineConfig } from "tsup";

// Two standalone bundles:
//  - cli.js   → the `loopmd` binary
//  - guard.js → the zero-dependency Guard, runnable on its own inside hooks/CI
// splitting:false keeps each entry fully self-contained (no shared chunk files), so
// guard.js is a single droppable script.
export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    guard: "src/guard/bin.ts",
  },
  format: ["esm"],
  target: "node20",
  splitting: false,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
