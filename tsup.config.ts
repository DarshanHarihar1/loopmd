import { defineConfig } from "tsup";
import { readFileSync, writeFileSync } from "node:fs";

const pkgVersion = JSON.parse(readFileSync("package.json", "utf8")).version as string;

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
  // Inject the package version so `loopmd --version` reflects the published release.
  define: { "process.env.LOOPMD_VERSION": JSON.stringify(pkgVersion) },
  dts: { entry: { sdk: "src/sdk.ts" } },
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Ship the /bin/sh Guard fallback next to the bundled guard.js (design §4),
  // so it sits beside guard.js (which it execs when Node is available). Normalize
  // to LF + a final newline so the script always runs under dash/sh, regardless of
  // how the source was checked out (a CRLF guard.sh breaks dash).
  onSuccess: async () => {
    const sh = readFileSync("scripts/guard.sh", "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    writeFileSync("dist/guard.sh", sh.endsWith("\n") ? sh : sh + "\n", { mode: 0o755 });
  },
});
