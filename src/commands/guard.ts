import type { Command } from "./types.js";
import { runGuardCli } from "../guard/cli.js";

// Phase 2: runtime entrypoint that hooks / skill steps call. Delegates to the
// shared Guard CLI assembly (also used by the standalone guard.js bundle).
export const guard: Command = (argv) => runGuardCli(argv);
