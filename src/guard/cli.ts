// CLI assembly for the Guard: turn `guard --loop <name> [flags]` into a GuardContext
// and run it. Shared by the standalone bundle (node guard.js) and the `loopmd guard`
// command. Zero-dependency — Node built-ins only.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { AgentTarget } from "../ir/types.js";
import type { GuardContext, GuardResult } from "./types.js";
import { loadLoopConfig } from "./config.js";
import { runGuard } from "./guard.js";

const HELP = `loopmd guard — runtime verify/budget/stall/escalate/record for a loop

Usage: loopmd guard --loop <name> [options]

  --loop <name>           required; reads loopmd/<name>.loop.json
  --cwd <dir>             working directory (default: cwd)
  --stdin                 read a JSON context payload from stdin (hook integration)
  --tokens <n>            total tokens used so far
  --changed <a,b,...>     changed paths (default: git status)
  --diff-hash <hash>      proposed-diff hash (default: hash of git diff)
  --irreversible <a,b>    detected irreversible actions
  --target <t>            claude-code | codex (default: first configured target)

Exit codes: 0 done/continue · 1 halt · 2 error`;

export async function runGuardCli(argv: string[]): Promise<number> {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const name = flagValue(argv, "--loop");
  if (!name) {
    console.error("loopmd guard: --loop <name> is required");
    return 2;
  }
  const cwd = flagValue(argv, "--cwd") ?? process.cwd();

  let ir;
  try {
    ir = loadLoopConfig(name, cwd);
  } catch (err) {
    console.error(`loopmd guard: ${(err as Error).message}`);
    return 2;
  }

  let payload: StdinPayload = {};
  if (argv.includes("--stdin")) {
    try {
      const raw = await readStdin();
      if (raw.trim()) payload = JSON.parse(raw) as StdinPayload;
    } catch {
      console.error("loopmd guard: invalid JSON on stdin");
      return 2;
    }
  }

  const ctx = assembleContext(ir.targets[0]!, payload, argv, cwd);
  const result = await runGuard(ir, ctx, { cwd });
  printDecision(result);
  return result.decision === "HALT" ? 1 : 0;
}

interface StdinPayload {
  tokens?: { input?: number; output?: number; total?: number };
  changedPaths?: string[];
  diffHash?: string;
  irreversibleActions?: string[];
  target?: AgentTarget;
}

function assembleContext(
  defaultTarget: AgentTarget,
  payload: StdinPayload,
  argv: string[],
  cwd: string,
): GuardContext {
  let tokens = normalizeTokens(payload.tokens);
  const flagTokens = num(flagValue(argv, "--tokens"));
  if (flagTokens !== undefined) tokens = { input: 0, output: 0, total: flagTokens };

  const changedPaths =
    list(flagValue(argv, "--changed")) ?? payload.changedPaths ?? gitChangedPaths(cwd);
  const diffHash = flagValue(argv, "--diff-hash") ?? payload.diffHash ?? gitDiffHash(cwd);
  // Fall back to deletions detected from `git status` so the irreversible-action
  // gate (§3.9) fires even when the caller supplies nothing. Force-push / prod-call
  // detection has no signal at hook time and remains caller-supplied.
  const irreversibleActions =
    list(flagValue(argv, "--irreversible")) ?? payload.irreversibleActions ?? gitDeletions(cwd);
  const target = (flagValue(argv, "--target") ?? payload.target ?? defaultTarget) as AgentTarget;

  return { target, tokens, changedPaths, diffHash, irreversibleActions };
}

function normalizeTokens(t: StdinPayload["tokens"]): GuardContext["tokens"] {
  const input = t?.input ?? 0;
  const output = t?.output ?? 0;
  return { input, output, total: t?.total ?? input + output };
}

// A GuardContext derived purely from git (changed paths, diff hash, deletions),
// with no token data. Shared by the hook path and the iterating `loopmd run` loop.
export function gitDerivedContext(cwd: string, target: AgentTarget): GuardContext {
  return {
    target,
    tokens: { input: 0, output: 0, total: 0 },
    changedPaths: gitChangedPaths(cwd),
    diffHash: gitDiffHash(cwd),
    irreversibleActions: gitDeletions(cwd),
  };
}

function printDecision(r: GuardResult): void {
  console.log(`guard: ${r.haltReason ? `${r.decision} (${r.haltReason})` : r.decision}`);
}

// --- git-derived context ---

function gitChangedPaths(cwd: string): string[] {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"], // don't leak git's stderr (e.g. "not a git repo")
    });
    return out
      .split("\n")
      .filter((l) => l.length > 0)
      .map(porcelainPath);
  } catch {
    return [];
  }
}

// A porcelain line is "XY path" (status in cols 0-1); renames are "old -> new".
function porcelainPath(line: string): string {
  const rest = line.length > 3 ? line.slice(3) : line;
  const arrow = rest.indexOf(" -> ");
  return (arrow !== -1 ? rest.slice(arrow + 4) : rest).replace(/^"|"$/g, "");
}

// Deletions (porcelain status with a 'D' in either column) are irreversible actions.
function gitDeletions(cwd: string): string[] {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out
      .split("\n")
      .filter((l) => l.length > 2 && (l[0] === "D" || l[1] === "D"))
      .map((l) => `delete ${porcelainPath(l)}`);
  } catch {
    return [];
  }
}

function gitDiffHash(cwd: string): string {
  try {
    const diff = execFileSync("git", ["diff"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return diff ? createHash("sha256").update(diff).digest("hex") : "";
  } catch {
    return "";
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

// --- arg helpers ---

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}

function num(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined; // ignore --tokens NaN/Infinity
}

function list(s: string | undefined): string[] | undefined {
  return s === undefined
    ? undefined
    : s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
}
