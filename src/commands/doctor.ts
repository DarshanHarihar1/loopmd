// loopmd doctor — environment diagnostics (design §3.6, §3.4.2).
// Checks tool versions, /goal availability, Codex Automation registration,
// machine-sleep, and credential scoping; exit code reflects the worst severity.

import { execFileSync } from "node:child_process";
import type { Command } from "./types.js";
import {
  runChecks,
  worstSeverity,
  exitCodeFor,
  type DoctorEnv,
  type Severity,
} from "../doctor/checks.js";

const HELP = `loopmd doctor — environment diagnostics

Usage: loopmd doctor

Checks tool versions, /goal availability, Codex Automation registration,
machine-sleep, and credential scoping. Exit codes: 0 ok · 1 warnings · 2 failures.`;

const SYMBOL: Record<Severity, string> = { ok: "✓", warn: "⚠", fail: "✗" };

export const doctor: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const env: DoctorEnv = {
    cwd: process.cwd(),
    env: process.env,
    versionOf,
  };

  const checks = runChecks(env);

  console.log("loopmd doctor\n");
  for (const c of checks) {
    console.log(`  ${SYMBOL[c.status]} ${c.name}: ${c.message}`);
  }

  const worst = worstSeverity(checks);
  console.log(`\noverall: ${worst}`);
  return exitCodeFor(worst);
};

// Return a CLI's version string, or null when it is not installed.
function versionOf(cmd: string): string | null {
  try {
    return execFileSync(cmd, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
