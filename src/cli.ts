import { run } from "./router.js";

// Bin entrypoint. The shebang is injected by tsup at build time.
run(process.argv.slice(2)).then((code) => process.exit(code));
