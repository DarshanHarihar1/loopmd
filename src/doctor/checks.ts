// Environment diagnostics for `loopmd doctor`.
// Pure and injectable: runChecks() takes a DoctorEnv so tests can drive every
// severity deterministically. The real command wires in execFileSync + process.env.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentTarget } from "../ir/types.js";

export type Severity = "ok" | "warn" | "fail";

export interface Check {
  name: string;
  status: Severity;
  message: string;
}

export interface DoctorEnv {
  cwd: string;
  env: Record<string, string | undefined>;
  // Version string (e.g. "1.4.0") for a CLI, or null when it is not installed.
  versionOf: (cmd: string) => string | null;
}

// Pinned tested version ranges — doctor is the runtime source of truth.
// Maintained here as native primitives drift; bump as new versions are verified.
export const TESTED: Record<AgentTarget, { cmd: string; min: string }> = {
  "claude-code": { cmd: "claude", min: "1.0.0" },
  codex: { cmd: "codex", min: "0.1.0" },
};

export function runChecks(env: DoctorEnv): Check[] {
  const loops = readLoopConfigs(env.cwd);

  if (loops.length === 0) {
    return [
      { name: "loops", status: "ok", message: "no compiled loops found — run `loopmd build`" },
    ];
  }

  const targets = new Set<AgentTarget>();
  for (const l of loops) for (const t of l.targets) targets.add(t);

  const checks: Check[] = [];

  if (targets.has("claude-code")) {
    checks.push(versionCheck(env, "claude-code"));
    checks.push(goalCheck(env, "claude-code"));
    checks.push(credentialCheck(env, "claude-code"));
  }

  if (targets.has("codex")) {
    checks.push(versionCheck(env, "codex"));
    checks.push(goalCheck(env, "codex"));
    checks.push(...codexAutomationChecks(env, loops));
  }

  return checks;
}

function versionCheck(env: DoctorEnv, target: AgentTarget): Check {
  const { cmd, min } = TESTED[target];
  const v = env.versionOf(cmd);
  if (v === null) {
    return {
      name: `${cmd} version`,
      status: "fail",
      message: `${cmd} not found — install it to run ${target} loops`,
    };
  }
  if (semverLt(v, min)) {
    return {
      name: `${cmd} version`,
      status: "warn",
      message: `${cmd} ${v} is below the tested minimum ${min} — upgrade recommended`,
    };
  }
  return { name: `${cmd} version`, status: "ok", message: `${cmd} ${v} (tested >= ${min})` };
}

// /goal availability: it ships with the tool, so presence of a recent enough CLI implies it.
function goalCheck(env: DoctorEnv, target: AgentTarget): Check {
  const { cmd } = TESTED[target];
  const v = env.versionOf(cmd);
  if (v === null) {
    return {
      name: "/goal availability",
      status: "fail",
      message: `/goal needs ${cmd}; it is not installed`,
    };
  }
  return { name: "/goal availability", status: "ok", message: `/goal available via ${cmd}` };
}

function credentialCheck(env: DoctorEnv, target: AgentTarget): Check {
  if (target === "claude-code") {
    const key = env.env.ANTHROPIC_API_KEY;
    if (!key) {
      return {
        name: "credentials",
        status: "warn",
        message: "ANTHROPIC_API_KEY is not set — scheduled Claude Code runs will fail",
      };
    }
    return {
      name: "credentials",
      status: "ok",
      message: "ANTHROPIC_API_KEY set — keep it scoped to least privilege",
    };
  }
  return { name: "credentials", status: "ok", message: "no credential check for this target" };
}

function codexAutomationChecks(env: DoctorEnv, loops: LoopConfig[]): Check[] {
  const codexLoops = loops.filter((l) => l.targets.includes("codex")).map((l) => l.name);
  const registered = `Automations are registered in the Codex app — loopmd cannot create them. Verify ${codexLoops.join(", ")} ${codexLoops.length === 1 ? "is" : "are"} registered.`;
  return [
    { name: "codex automation", status: "warn", message: registered },
    {
      name: "machine sleep",
      status: "warn",
      message: "Automations may run on this machine; if it sleeps, scheduled runs are skipped",
    },
  ];
}

export function worstSeverity(checks: Check[]): Severity {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "ok";
}

// ok → 0, warn → 1, fail → 2 (the exit code reflects the worst severity).
export function exitCodeFor(severity: Severity): number {
  return severity === "fail" ? 2 : severity === "warn" ? 1 : 0;
}

// --- loop config scanning ---

interface LoopConfig {
  name: string;
  targets: AgentTarget[];
}

function readLoopConfigs(cwd: string): LoopConfig[] {
  const dir = join(cwd, "loopmd");
  if (!existsSync(dir)) return [];
  const configs: LoopConfig[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".loop.json")) continue;
    try {
      const ir = JSON.parse(readFileSync(join(dir, file), "utf8")) as LoopConfig;
      if (typeof ir.name === "string" && Array.isArray(ir.targets)) {
        configs.push({ name: ir.name, targets: ir.targets });
      }
    } catch {
      // skip an unreadable/partial config
    }
  }
  return configs;
}

// --- tiny semver compare (major.minor.patch) ---

function semverLt(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i]! < pb[i]!) return true;
    if (pa[i]! > pb[i]!) return false;
  }
  return false;
}

function parseSemver(v: string): [number, number, number] {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}
