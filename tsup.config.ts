import { defineConfig } from "tsup";

// Standalone bundles:
//  - cli.js   → the `loopmd` binary
//  - guard.js → the zero-dependency Guard, runnable on its own inside hooks/CI
//  - sdk.js   → the public plugin SDK (imported as "loopmd/sdk"), with .d.ts types
// splitting:false keeps each entry fully self-contained (no shared chunk files), so
// guard.js is a single droppable script.
export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    guard: "src/guard/bin.ts",
    sdk: "src/sdk.ts",
  },
  format: ["esm"],
  target: "node20",
  splitting: false,
  clean: true,
  dts: { entry: { sdk: "src/sdk.ts" } },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
