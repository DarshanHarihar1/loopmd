// loopmd run <name> — manually trigger a loop now (design §3.6).
// Invokes `claude -p "/goal <stopCondition>" --tokens <n>` with the compiled IR.
// Also called by the generated crontab / GH Actions scheduler.

import { spawnSync } from "node:child_process";
import type { Command } from "./types.js";
import type { LoopIR } from "../ir/types.js";
import { loadLoopConfig } from "../guard/config.js";

const HELP = `loopmd run <name> — manually trigger a loop

Usage: loopmd run <name> [options]

  name         loop name (reads loopmd/<name>.loop.json; run \`loopmd build\` first)
  --tokens <n> override the budget.tokens ceiling for this run`;

export const run: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const name = argv.find((a) => !a.startsWith("-"));
  if (!name) {
    console.error("loopmd run: loop name is required");
    return 1;
  }

  let ir;
  try {
    ir = loadLoopConfig(name, process.cwd());
  } catch (err) {
    console.error(`loopmd run: ${(err as Error).message}`);
    return 1;
  }

  const tokenOverride = flagValue(argv, "--tokens");
  const result = spawnSync("claude", claudeArgs(ir, tokenOverride), { stdio: "inherit" });
  return result.status ?? 0;
};

// The `claude -p` argument vector for a loop: the goal prompt, the token ceiling
// (overridable per run), and worktree isolation when requested (§3.4.1).
export function claudeArgs(ir: LoopIR, tokenOverride?: string): string[] {
  const tokens = tokenOverride !== undefined ? Number(tokenOverride) : ir.budget.tokens;
  const args = ["-p", `/goal ${ir.stopCondition}`];
  if (tokens !== undefined) args.push("--tokens", String(tokens));
  if (ir.isolation === "worktree") args.push("--isolation", "worktree");
  return args;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}
