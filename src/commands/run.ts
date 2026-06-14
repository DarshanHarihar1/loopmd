// loopmd run <name> — drive a loop now (design §3.6), also called by the generated
// scheduler. Each turn runs Claude Code headlessly on a *persistent* session (first
// turn --session-id, later turns --resume), then the Guard verifies/budgets/records
// and decides DONE / CONTINUE / HALT. Iterates until DONE/HALT or the iteration
// ceiling; `--once` does a single turn + Guard check.

import { spawnSync } from "node:child_process";
import type { Command } from "./types.js";
import { loadLoopConfig } from "../guard/config.js";
import { runGuard } from "../guard/guard.js";
import { gitDerivedContext } from "../guard/cli.js";
import { getSession, saveSession } from "../run/session.js";
import { buildClaudeArgs, renderCommand } from "../run/command.js";
import { driveRunLoop } from "../run/loop.js";

const HELP = `loopmd run <name> — drive a loop now

Usage: loopmd run <name> [options]

  name              loop name (reads loopmd/<name>.loop.json; run \`loopmd build\` first)
  --once            run a single turn + one Guard check, then stop
  --budget-usd <n>  override the loop's --max-budget-usd ceiling for this run
  --dry-run         print the claude command without running it`;

const DEFAULT_MAX_ITERATIONS = 20;

export const run: Command = async (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }

  const once = argv.includes("--once");
  const dryRun = argv.includes("--dry-run");
  const name = argv.find((a) => !a.startsWith("-"));
  if (!name) {
    console.error("loopmd run: loop name is required");
    return 1;
  }

  const cwd = process.cwd();
  let ir;
  try {
    ir = loadLoopConfig(name, cwd);
  } catch (err) {
    console.error(`loopmd run: ${(err as Error).message}`);
    return 1;
  }

  const budgetOverride = flagValue(argv, "--budget-usd");
  if (budgetOverride !== undefined && !isPositiveNumber(budgetOverride)) {
    console.error(`loopmd run: --budget-usd must be a positive number (got '${budgetOverride}')`);
    return 1;
  }
  const budgetUsd = budgetOverride !== undefined ? Number(budgetOverride) : undefined;

  const session = getSession(name);

  if (dryRun) {
    const args = buildClaudeArgs(ir, { sessionId: session.id, resume: !session.isNew, budgetUsd });
    console.log(renderCommand(args));
    return 0;
  }

  const target = ir.targets[0] ?? "claude-code";

  const result = await driveRunLoop({
    maxIterations: once ? 1 : (ir.budget.iterations ?? DEFAULT_MAX_ITERATIONS),
    // Resume when the loop signals a later turn, or when the session already
    // existed from a previous `loopmd run` (so we never recreate it).
    spawnTurn: (resumeTurn) => {
      const resume = resumeTurn || !session.isNew;
      const args = buildClaudeArgs(ir, { sessionId: session.id, resume, budgetUsd });
      return spawnSync("claude", args, { stdio: "inherit" });
    },
    decide: () => runGuard(ir, gitDerivedContext(cwd, target), { cwd }),
  });

  if (result.launchError) {
    const why = result.launchError.includes("ENOENT")
      ? "claude not found on PATH"
      : result.launchError;
    console.error(`loopmd run: failed to launch claude — ${why}`);
    return 1;
  }

  // The session now exists; persist its id so the next run resumes it.
  saveSession(name, session.id);

  const reason = result.lastHaltReason ? ` (${result.lastHaltReason})` : "";
  console.error(
    `\nloopmd run: ${result.decision}${reason} after ${result.iterations} turn(s)` +
      `\nResume this loop's session: claude --resume ${session.id}`,
  );

  return result.decision === "HALT" ? 1 : 0;
};

function isPositiveNumber(s: string): boolean {
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}
