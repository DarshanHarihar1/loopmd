// Standalone Guard entrypoint, bundled to dist/guard.js (a single self-contained,
// zero-dependency script). Hooks/CI invoke this directly: `node guard.js --loop <name>`.
// It is only ever executed as the bin, so it runs unconditionally.

import { runGuardCli } from "./cli.js";

runGuardCli(process.argv.slice(2)).then((code) => process.exit(code));
