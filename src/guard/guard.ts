// The Guard runtime: the one component loopmd owns end-to-end, identical
// for both targets. Per invocation it verifies, enforces budget, detects stalls,
// escalates (notifying), records, and decides DONE/CONTINUE/HALT.
//
// Zero-runtime-dependency: this module and everything it imports use only Node
// built-ins and IR *types* — never the parser or zod — so it bundles to a single
// standalone script runnable inside hooks/CI.

import { randomUUID } from "node:crypto";
import type { LoopIR } from "../ir/types.js";
import type { Decision, GuardContext, GuardResult, HaltReason, RunRecord } from "./types.js";
import { runVerifiers, type VerifyResult } from "./verify.js";
import { checkBudget } from "./budget.js";
import { checkStall } from "./stall.js";
import { checkEscalation, type EscalationResult } from "./escalate.js";
import { loadState, saveState } from "./state.js";
import { appendRecord } from "./record.js";
import { notify, type NotifySink } from "./notify.js";

export interface RunGuardOptions {
  cwd?: string;
  now?: () => string; // injectable clock for deterministic records
  runId?: () => string; // injectable id for deterministic records
  sink?: NotifySink; // notification sink (default console.log)
}

export async function runGuard(
  ir: LoopIR,
  ctx: GuardContext,
  opts: RunGuardOptions = {},
): Promise<GuardResult> {
  const now = opts.now ?? (() => new Date().toISOString());
  const cwd = opts.cwd ?? process.cwd();
  const startedAt = now();

  const state = loadState(ir.name);
  const iterations = state.iterations + 1;

  const verify = await runVerifiers(ir.verifiers, cwd);
  const budgetHalt = checkBudget(ir.budget, { tokens: ctx.tokens.total, iterations });
  const stall = checkStall(ir.escalation, state.stall, {
    diffHash: ctx.diffHash,
    verifyPassed: verify.passed,
  });
  const esc = checkEscalation(ir.escalation, ctx.changedPaths, ctx.irreversibleActions);

  // Decision order is safety-first: escalate > budget > stall > verify result.
  let decision: Decision;
  let haltReason: HaltReason | undefined;
  if (esc.escalate) {
    decision = "HALT";
    haltReason = "escalate";
  } else if (budgetHalt) {
    decision = "HALT";
    haltReason = "budget";
  } else if (stall.stalled) {
    decision = "HALT";
    haltReason = "stall";
  } else if (verify.passed) {
    decision = "DONE";
  } else {
    decision = "CONTINUE";
  }

  const record: RunRecord = {
    loop: ir.name,
    runId: opts.runId?.() ?? randomUUID(),
    target: ctx.target,
    startedAt,
    endedAt: now(),
    iterations,
    tokens: ctx.tokens,
    outcome: outcomeFor(decision, haltReason),
    ...(haltReason ? { haltReason } : {}),
    verifiers: verify.outcomes,
    diffsTouched: ctx.changedPaths,
    irreversibleActions: ctx.irreversibleActions,
    needsHuman: decision === "HALT",
  };

  appendRecord(record);
  saveState(ir.name, { iterations, stall: stall.state });
  dispatchNotifications(ir, decision, haltReason, esc, opts.sink);

  return { decision, haltReason, record };
}

function outcomeFor(decision: Decision, haltReason?: HaltReason): RunRecord["outcome"] {
  if (decision === "DONE") return "done";
  if (decision === "CONTINUE") return "running";
  return haltReason === "escalate" ? "escalated" : "halted";
}

function dispatchNotifications(
  ir: LoopIR,
  decision: Decision,
  haltReason: HaltReason | undefined,
  esc: EscalationResult,
  sink?: NotifySink,
): void {
  if (decision === "DONE") {
    notify(ir.notify, { loop: ir.name, event: "done", summary: "verifiers passed" }, sink);
  } else if (decision === "HALT" && haltReason === "escalate") {
    notify(ir.notify, { loop: ir.name, event: "escalate", summary: esc.reasons.join("; ") }, sink);
  } else if (decision === "HALT") {
    notify(ir.notify, { loop: ir.name, event: "fail", summary: `halted: ${haltReason}` }, sink);
  }
}

export type { VerifyResult };
