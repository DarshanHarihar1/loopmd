// Synthesized Runner: drives a tool that has NO native /goal.
// Run one turn toward the goal, ask the Guard to decide, and repeat until DONE/HALT
// or the iteration ceiling. Both built-in targets are native-goal, so this path is
// for plugin adapters whose capability profile sets nativeGoal: false.

import type { LoopIR } from "../ir/types.js";

export type RunnerDecision = "DONE" | "CONTINUE" | "HALT";

export interface RunnerDeps {
  // Drive the tool one turn toward the goal (the agent does work here).
  runTurn: (iteration: number) => void | Promise<void>;
  // Ask the Guard to decide after the turn (typically wraps runGuard).
  decide: (iteration: number) => RunnerDecision | Promise<RunnerDecision>;
  // Hard ceiling; defaults to the IR's iteration budget, then 100.
  maxIterations?: number;
}

export interface RunnerResult {
  iterations: number;
  decision: RunnerDecision;
}

export async function runLoop(ir: LoopIR, deps: RunnerDeps): Promise<RunnerResult> {
  const max = deps.maxIterations ?? ir.budget.iterations ?? 100;
  let decision: RunnerDecision = "CONTINUE";
  let i = 0;

  while (i < max) {
    i++;
    await deps.runTurn(i);
    decision = await deps.decide(i);
    if (decision !== "CONTINUE") break;
  }

  return { iterations: i, decision };
}
