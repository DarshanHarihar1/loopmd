// Build the real `claude` invocation for a loop, reconciled against the actual
// Claude Code CLI (verified flags only): headless `-p`, session create/resume,
// `--max-budget-usd`, `--permission-mode`, and `--agents` for subagents. The stop
// condition goes into the prompt — there is no native `/goal` command.

import type { LoopIR } from "../ir/types.js";

export interface BuildArgsOptions {
  sessionId: string;
  resume: boolean; // false → --session-id (first run); true → --resume
  budgetUsd?: number; // overrides ir.budget.usd
}

export function buildClaudeArgs(ir: LoopIR, opts: BuildArgsOptions): string[] {
  const args = ["-p"];

  // Reuse the same conversation across runs so each iteration keeps full context.
  args.push(opts.resume ? "--resume" : "--session-id", opts.sessionId);

  if (ir.model && ir.model !== "default") args.push("--model", ir.model);
  if (ir.permissionMode) args.push("--permission-mode", ir.permissionMode);

  const usd = opts.budgetUsd ?? ir.budget.usd;
  if (usd !== undefined) args.push("--max-budget-usd", String(usd));

  if (ir.agents && Object.keys(ir.agents).length > 0) {
    args.push("--agents", JSON.stringify(ir.agents));
  }

  args.push(buildPrompt(ir, opts.resume));
  return args;
}

export function buildPrompt(ir: LoopIR, resume: boolean): string {
  // Defensive: a compiled loop.json always has these, but tolerate a hand-edited one.
  const stop = (ir.stopCondition ?? "").trim();
  const goal = (ir.goal ?? "").trim();
  const context = ir.context ?? [];
  if (resume) {
    return `Continue working toward the goal. Stop when this is true: ${stop}`;
  }

  const lines = [goal, "", `Keep working until this is true: ${stop}`];
  if (context.length > 0) {
    lines.push("", "Context:");
    for (const c of context) lines.push(`- ${c}`);
  }
  if (ir.agents && Object.keys(ir.agents).length > 0) {
    lines.push(
      "",
      `Delegate to your subagents (${Object.keys(ir.agents).join(", ")}) where useful.`,
    );
  }
  return lines.join("\n");
}

// A copy-pasteable shell rendering of the command (for --dry-run output).
export function renderCommand(args: string[]): string {
  return ["claude", ...args].map(shellQuote).join(" ");
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./:=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}
