// loopmd run <name> — manually trigger a loop now (design §3.6), also called by
// the generated scheduler. Drives Claude Code headlessly (`claude -p`) on a
// persistent session so each run resumes the previous one; the stop condition is
// part of the prompt (there is no native /goal). Subagents are passed via --agents.

import { spawnSync } from "node:child_process";
import type { Command } from "./types.js";
import { loadLoopConfig } from "../guard/config.js";
import { getSession, saveSession } from "../run/session.js";
import { buildClaudeArgs, renderCommand } from "../run/command.js";

const HELP = `loopmd run <name> — manually trigger a loop

Usage: loopmd run <name> [options]

  name              loop name (reads loopmd/<name>.loop.json; run \`loopmd build\` first)
  --budget-usd <n>  override the loop's --max-budget-usd ceiling for this run
  --dry-run         print the claude command without running it`;

export const run: Command = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const dryRun = argv.includes("--dry-run");
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

  const budgetOverride = flagValue(argv, "--budget-usd");
  if (budgetOverride !== undefined && !isPositiveNumber(budgetOverride)) {
    console.error(`loopmd run: --budget-usd must be a positive number (got '${budgetOverride}')`);
    return 1;
  }

  const session = getSession(name);
  const args = buildClaudeArgs(ir, {
    sessionId: session.id,
    resume: !session.isNew,
    budgetUsd: budgetOverride !== undefined ? Number(budgetOverride) : undefined,
  });

  if (dryRun) {
    console.log(renderCommand(args));
    return 0;
  }

  const result = spawnSync("claude", args, { stdio: "inherit" });
  if (result.error) {
    const why =
      (result.error as NodeJS.ErrnoException).code === "ENOENT"
        ? "claude not found on PATH"
        : result.error.message;
    console.error(`loopmd run: failed to launch claude — ${why}`);
    return 1;
  }

  // The session now exists; persist its id so the next run resumes it, and tell
  // the user how to take it over interactively.
  saveSession(name, session.id);
  console.error(`\nResume this loop's session: claude --resume ${session.id}`);

  return result.status ?? 0;
};

function isPositiveNumber(s: string): boolean {
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}
