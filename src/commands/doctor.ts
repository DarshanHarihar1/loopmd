// loopmd doctor — environment diagnostics (design §3.6).
// Phase 5 ships the stub-level Codex checks: warn that Automations are registered
// in-app and may be skipped if the machine sleeps (§3.4.2). The full tool-version /
// `/goal` availability / credential-scoping checks land in Phase 6.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "./types.js";

const HELP = `loopmd doctor — environment diagnostics

Usage: loopmd doctor

Phase 5: warns about Codex Automation registration and machine-sleep.
Full checks (tool versions, /goal availability, credentials) land in Phase 6.`;

const SUFFIX = ".codex-automation.json";

export const doctor: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  console.log("loopmd doctor\n");

  const codexLoops = findCodexLoops(process.cwd());
  if (codexLoops.length === 0) {
    console.log("No Codex loops found. (Full environment checks land in Phase 6.)");
    return 0;
  }

  console.log(`Codex loops detected: ${codexLoops.join(", ")}`);
  console.log("  ⚠ Codex Automations must be registered in the Codex app — loopmd cannot");
  console.log("    create them. Re-run `loopmd build` to (re)generate the descriptor.");
  console.log("  ⚠ Automations may run on this machine; if it sleeps, scheduled runs are skipped.");
  console.log("\n(Full environment checks land in Phase 6.)");
  return 0;
};

function findCodexLoops(cwd: string): string[] {
  const dir = join(cwd, "loopmd");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(SUFFIX))
    .map((f) => f.slice(0, -SUFFIX.length))
    .sort();
}
